from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
import io
import zipfile
from pathlib import Path

from app.db.database import get_db
from app.api.v1.deps import get_student_by_uid, get_uid_for_current_student
from app.db.models.students import Student
from app.db.models.student_platform import (
    StudentActivityV2,
    StudentLink,
    SwotEntry,
    DocumentGenerated,
    RawVaultItem,
    ProcessingJob,
    CampusActivity,
    LivingReport,
    StudentKnowledgeItem,
    AcademicRecord,
    CareerRecord,
)
from app.db.models.meetings import Meetings
from app.services.gemini_insight_service import build_overview, build_profile, build_analysis
from app.services.raw_vault_service import store_raw
from app.services.job_queue import create_job, list_recent_jobs
from app.services.living_report_service import merge_delta
from app.services.livekit_service import create_join_token
from app.services.swot_activity_service import generate_activities_from_swot
from app.services.activity_api import activity_to_api
from app.services.mentor_stats import store_term
from app.services.report_pdf_service import build_tracker_report_pdf
from app.services.insight_cache import invalidate_uid
from app.schemas.tracker_insights import TrackerDashboardPayload, TrackerProfilePayload, TrackerAnalysisPayload

router = APIRouter()


def _apply_profile_edits(db: Session, student: Student, edits: dict) -> None:
    from app.db.models.mentors import Mentor

    for key, value in edits.items():
        if key not in _PROFILE_EDIT_FIELDS:
            continue
        if value is None or value == "":
            continue
        if key == "date_of_birth":
            text = str(value)[:10]
            try:
                student.date_of_birth = datetime.strptime(text, "%Y-%m-%d").date()
            except ValueError:
                pass
            continue
        if key == "semester":
            digits = "".join(ch for ch in str(value) if ch.isdigit())
            if digits:
                student.semester = int(digits)
            continue
        if key == "assigned_mentor":
            mentor = db.query(Mentor).filter(Mentor.mentor_id == str(value)).first()
            if mentor:
                student.assigned_mentor = mentor.mentor_id
            continue
        setattr(student, key, value)
    linkedin = edits.get("linkedin")
    if linkedin and str(linkedin).startswith("http"):
        existing = (
            db.query(StudentLink)
            .filter(StudentLink.uid == student.uid, StudentLink.link_type == "linkedin")
            .first()
        )
        if existing:
            existing.url = str(linkedin)
        else:
            db.add(StudentLink(uid=student.uid, link_type="linkedin", url=str(linkedin), verified_bool=False))


def _enqueue(db: Session, uid: str, raw: RawVaultItem, report_target: str) -> ProcessingJob:
    key = f"{uid}:{raw.content_hash}:{report_target}"
    return create_job(db, uid=uid, report_target=report_target, raw_vault_item_id=raw.id, idempotency_key=key)


def _replace_existing_document(db: Session, uid: str, *, filename: str, vault_id: str, keep_job_id: str) -> None:
    """Drop the stored copy of this file so the new upload is the only one."""
    name = (filename or "").strip().lower()
    job_ids: set[str] = set()
    for row in db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.uid == uid).all():
        same_name = bool(name) and (row.filename or "").strip().lower() == name
        same_vault = bool(row.vault_id) and row.vault_id == vault_id
        if not same_name and not same_vault:
            continue
        if row.job_id:
            job_ids.add(row.job_id)
        db.delete(row)
    for job in db.query(ProcessingJob).filter(ProcessingJob.uid == uid, ProcessingJob.raw_vault_item_id == vault_id).all():
        job_ids.add(job.id)
    if job_ids:
        db.query(AcademicRecord).filter(
            AcademicRecord.uid == uid, AcademicRecord.source_job_id.in_(job_ids)
        ).delete(synchronize_session=False)
        db.query(CareerRecord).filter(
            CareerRecord.uid == uid, CareerRecord.source_job_id.in_(job_ids)
        ).delete(synchronize_session=False)
    if vault_id:
        db.query(CampusActivity).filter(
            CampusActivity.uid == uid, CampusActivity.evidence_ref == vault_id
        ).delete(synchronize_session=False)
    if job_ids:
        for job in db.query(ProcessingJob).filter(ProcessingJob.id.in_(list(job_ids))).all():
            if job.id == keep_job_id or job.status not in ("queued", "retry", "processing"):
                continue
            job.status = "completed"
            job.stage = "notify"
    db.flush()


def _accept_document(db: Session, uid: str, raw: RawVaultItem, report_target: str, filename: str) -> ProcessingJob:
    job = _enqueue(db, uid=uid, raw=raw, report_target=report_target)
    _replace_existing_document(db, uid, filename=filename, vault_id=raw.id, keep_job_id=job.id)
    job.status = "queued"
    job.stage = "queued"
    job.attempts = 0
    job.last_error = None
    return job


def _as_dashboard(payload: dict) -> dict:
    return TrackerDashboardPayload.model_validate(payload).model_dump()


def _as_profile(payload: dict) -> dict:
    return TrackerProfilePayload.model_validate(payload).model_dump()


def _as_analysis(payload: dict) -> dict:
    return TrackerAnalysisPayload.model_validate(payload).model_dump()


class LinkIn(BaseModel):
    type: str
    url: str


class SwotIn(BaseModel):
    strengths: List[str] = []
    weaknesses: List[str] = []
    opportunities: List[str] = []
    threats: List[str] = []


class ActivityPatch(BaseModel):
    progress_pct: Optional[int] = None
    status: Optional[str] = None


class ActivityRequestIn(BaseModel):
    title: str
    description: str = ""
    term: Optional[str] = None


class ProfileReviewIn(BaseModel):
    approved: bool = True
    edits: Optional[dict[str, Any]] = None


class OnboardingDraftIn(BaseModel):
    step: int = 0
    max_step: int = 0
    consent: bool = False
    id_uploaded: bool = False
    upload_status: str = ""
    doc_kind: str = "academic"
    documents: List[dict[str, Any]] = []
    program_level: str = ""
    department: str = ""
    start_year: str = ""
    duration: str = ""
    linkedin_user: str = ""
    portfolio: str = ""
    github: str = ""
    profile: dict[str, Any] = {}
    edits: Optional[dict[str, Any]] = None


_WIZARD_REPORT = "onboarding_wizard"


_PROFILE_EDIT_FIELDS = {
    "student_name",
    "student_phoneno",
    "student_program",
    "semester",
    "student_batch",
    "assigned_mentor",
    "linkedin",
    "gender",
    "blood_group",
    "date_of_birth",
    "parent_guardian_contact",
    "mother_contact",
    "father_contact",
}


class ProfilePersonalPatch(BaseModel):
    student_phoneno: Optional[str] = None
    mother_contact: Optional[str] = None
    father_contact: Optional[str] = None
    linkedin: Optional[str] = None
    student_name: Optional[str] = None


@router.get("/students/me/uid")
def my_uid(uid: str = Depends(get_uid_for_current_student)):
    return {"uid": uid}


def _wizard_report(db: Session, uid: str) -> LivingReport | None:
    return (
        db.query(LivingReport)
        .filter(LivingReport.uid == uid, LivingReport.report_type == _WIZARD_REPORT)
        .first()
    )


def _student_onboarding_snapshot(db: Session, student: Student | None) -> dict:
    if not student:
        return {}
    links = db.query(StudentLink).filter(StudentLink.uid == student.uid).all()
    dob = student.date_of_birth.isoformat() if student.date_of_birth else ""
    return {
        "student_name": student.student_name or "",
        "student_phoneno": student.student_phoneno or "",
        "mother_contact": student.mother_contact or "",
        "father_contact": student.father_contact or "",
        "parent_guardian_contact": student.parent_guardian_contact or "",
        "gender": student.gender or "",
        "blood_group": student.blood_group or "",
        "date_of_birth": dob,
        "semester": "" if student.semester is None else str(student.semester),
        "student_program": student.student_program or "",
        "student_batch": student.student_batch or "",
        "assigned_mentor": student.assigned_mentor or "",
        "linkedin": student.linkedin or "",
        "email": student.student_email or "",
        "links": [{"type": row.link_type, "url": row.url} for row in links],
    }


def _upsert_link(db: Session, uid: str, link_type: str, url: str) -> None:
    text = (url or "").strip()
    if not text.startswith("http"):
        return
    existing = (
        db.query(StudentLink)
        .filter(StudentLink.uid == uid, StudentLink.link_type == link_type)
        .first()
    )
    if existing:
        existing.url = text
    else:
        db.add(StudentLink(uid=uid, link_type=link_type, url=text, verified_bool=False))


@router.get("/students/me/onboarding")
def my_onboarding(
    uid: str = Depends(get_uid_for_current_student),
    db: Session = Depends(get_db),
):
    from app.services.demo_utils import allow_sample_content, is_demo_usn

    student = db.query(Student).filter(Student.uid == uid).first()
    usn = student.student_usn if student else None
    demo = is_demo_usn(usn)
    complete = demo or bool(student and student.verified_at)
    row = _wizard_report(db, uid)
    draft = dict(row.structured_state or {}) if row else {}
    return {
        "onboarding_complete": complete,
        "demo": demo,
        "sample_content": allow_sample_content(usn),
        "draft": draft,
        "student": _student_onboarding_snapshot(db, student),
    }


@router.put("/students/me/onboarding")
def save_onboarding(
    body: OnboardingDraftIn,
    uid: str = Depends(get_uid_for_current_student),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.uid == uid).first()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    step = min(4, max(0, int(body.step or 0)))
    max_step = min(4, max(step, int(body.max_step or 0)))
    state = body.model_dump()
    state["step"] = step
    state["max_step"] = max_step
    if body.edits and not student.verified_at:
        _apply_profile_edits(db, student, body.edits)
    if not student.verified_at:
        _upsert_link(db, uid, "portfolio", body.portfolio)
        _upsert_link(db, uid, "github", body.github)
    row = _wizard_report(db, uid)
    if row is None:
        db.add(LivingReport(uid=uid, report_type=_WIZARD_REPORT, structured_state=state, narrative="", version=1))
    else:
        row.structured_state = state
    db.commit()
    return {"ok": True, "step": step, "max_step": max_step}


_KNOWLEDGE_GROUPS = {"academic", "career", "certificate", "activity", "uncategorised"}


class KnowledgePatch(BaseModel):
    doc_group: str
    category: Optional[str] = None


def _http_ref(ref: str | None) -> str:
    text = (ref or "").strip()
    if text.startswith("https://") or text.startswith("http://"):
        return text
    return ""


def _looks_like_filename(text: str) -> bool:
    lower = (text or "").strip().lower()
    if not lower:
        return True
    if lower in ("document", "inbox", "uploaded document") or lower.startswith("document uploaded"):
        return True
    if any(lower.endswith(ext) for ext in (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx")):
        return True
    if "whatsapp" in lower:
        return True
    return " " not in lower and len(lower) > 36


def _clean_fact(value: Any) -> str:
    text = str(value or "").strip()
    if text.lower() in ("", "unknown", "none", "n/a", "null", "uploaded document"):
        return ""
    return text[:120]


def _skill_names(extra: dict) -> list[str]:
    raw = extra.get("skills_covered") or extra.get("skills") or []
    names: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            text = item.get("name") if isinstance(item, dict) else item
            cleaned = _clean_fact(text)
            if cleaned and cleaned not in names:
                names.append(cleaned[:80])
    return names[:8]


def _knowledge_out(
    row: StudentKnowledgeItem,
    view_url: str = "",
    record: AcademicRecord | CareerRecord | None = None,
) -> dict:
    extra = record.extra if record is not None and isinstance(record.extra, dict) else {}
    issuer = ""
    event_date = ""
    verified = False
    if isinstance(record, AcademicRecord):
        issuer = _clean_fact(record.issuer) or _clean_fact(extra.get("issuer"))
        event_date = _clean_fact(record.record_date) or _clean_fact(extra.get("completion_date") or extra.get("date"))
        verified = bool(record.verified_bool)
    elif isinstance(record, CareerRecord):
        issuer = _clean_fact(record.org) or _clean_fact(extra.get("org") or extra.get("issuer"))
        event_date = _clean_fact(record.record_date) or _clean_fact(extra.get("completion_date") or extra.get("date"))
    candidates = []
    if record is not None and record.title:
        candidates.append(record.title)
    for key in ("title", "program_name", "course", "credential"):
        if extra.get(key):
            candidates.append(str(extra.get(key)))
    if row.title:
        candidates.append(row.title)
    display = row.filename or "Document"
    for text in candidates:
        cleaned = _clean_fact(text)
        if cleaned and not _looks_like_filename(cleaned):
            display = cleaned
            break
    chips = []
    if issuer:
        chips.append({"label": "Issuer", "value": issuer})
    term = _clean_fact(extra.get("term") or extra.get("semester") or extra.get("period"))
    if term:
        chips.append({"label": "Term", "value": term})
    elif event_date:
        chips.append({"label": "Date", "value": event_date})
    score = _clean_fact(extra.get("score") or extra.get("percentage") or extra.get("percent"))
    grade = _clean_fact(extra.get("grade") or extra.get("result"))
    if score and grade and grade.lower() not in score.lower():
        chips.append({"label": "Score", "value": f"{score} ({grade})"})
    elif score:
        chips.append({"label": "Score", "value": score})
    elif grade:
        chips.append({"label": "Score", "value": grade})
    gpa = _clean_fact(extra.get("gpa") or extra.get("cgpa"))
    if gpa:
        chips.append({"label": "GPA", "value": gpa})
    duration = _clean_fact(extra.get("duration") or extra.get("course_duration"))
    if duration:
        chips.append({"label": "Duration", "value": duration})
    status = row.status or "reading"
    if status == "failed":
        pipeline = "failed"
    elif status in ("reading", "queued"):
        pipeline = "reading"
    elif verified:
        pipeline = "verified"
    else:
        pipeline = "stored"
    group = row.doc_group or "uncategorised"
    if status == "failed":
        impact = "Not added to reports"
    elif pipeline == "reading":
        impact = "Waiting to be read"
    elif group == "career":
        impact = "Included in the career report"
    elif group in ("academic", "certificate"):
        impact = "Included in the academic report"
    else:
        impact = "Stored with your documents"
    logged = row.created_at.isoformat() if row.created_at else ""
    return {
        "id": row.id,
        "filename": row.filename or "",
        "title": display,
        "doc_group": group,
        "category": row.category or "",
        "category_source": row.category_source or "model",
        "summary": row.summary or "",
        "status": status,
        "pipeline": pipeline,
        "job_id": row.job_id,
        "view_url": view_url,
        "issuer": issuer,
        "event_date": event_date,
        "logged_at": logged,
        "chips": chips,
        "skills": _skill_names(extra),
        "impact": impact,
        "verified": verified,
    }


def _knowledge_view_urls(db: Session, rows: list[StudentKnowledgeItem]) -> dict[int, str]:
    urls: dict[int, str] = {}
    vault_ids = [row.vault_id for row in rows if row.vault_id and not str(row.vault_id).startswith("campus-")]
    if vault_ids:
        for vault in db.query(RawVaultItem).filter(RawVaultItem.id.in_(vault_ids)).all():
            ref = _http_ref(vault.storage_ref)
            if not ref:
                continue
            for row in rows:
                if row.vault_id == vault.id:
                    urls[row.id] = ref
    job_ids = [row.job_id for row in rows if row.job_id and row.id not in urls]
    if not job_ids:
        return urls
    jobs = db.query(ProcessingJob).filter(ProcessingJob.id.in_(job_ids)).all()
    raw_ids = [job.raw_vault_item_id for job in jobs if job.raw_vault_item_id]
    raws = {}
    if raw_ids:
        raws = {
            item.id: _http_ref(item.storage_ref)
            for item in db.query(RawVaultItem).filter(RawVaultItem.id.in_(raw_ids)).all()
        }
    by_job = {job.id: raws.get(job.raw_vault_item_id) or "" for job in jobs}
    for row in rows:
        if row.id not in urls and row.job_id:
            urls[row.id] = by_job.get(row.job_id) or ""
    return urls


def _backfill_knowledge(db: Session, uid: str) -> None:
    existing = db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.uid == uid).all()
    known_jobs = {row.job_id for row in existing if row.job_id}
    for rec in db.query(AcademicRecord).filter(AcademicRecord.uid == uid).all():
        if not rec.source_job_id or rec.source_job_id in known_jobs:
            continue
        label = (rec.category or "").lower()
        group = "certificate" if "cert" in label else "academic"
        db.add(
            StudentKnowledgeItem(
                uid=uid,
                job_id=rec.source_job_id,
                filename=rec.title,
                title=rec.title,
                doc_group=group,
                category=rec.category,
                category_source="model",
                status="stored",
            )
        )
        known_jobs.add(rec.source_job_id)
    for rec in db.query(CareerRecord).filter(CareerRecord.uid == uid).all():
        if not rec.source_job_id or rec.source_job_id in known_jobs:
            continue
        db.add(
            StudentKnowledgeItem(
                uid=uid,
                job_id=rec.source_job_id,
                filename=rec.title,
                title=rec.title,
                doc_group="career",
                category=rec.category,
                category_source="model",
                status="stored",
            )
        )
        known_jobs.add(rec.source_job_id)
    for rec in db.query(CampusActivity).filter(CampusActivity.uid == uid).all():
        key = f"campus-{rec.id}"
        if any(row.vault_id == key for row in existing):
            continue
        db.add(
            StudentKnowledgeItem(
                uid=uid,
                vault_id=key,
                filename=rec.event_name,
                title=rec.event_name,
                doc_group="activity",
                category=rec.role or "activity",
                category_source="model",
                summary=rec.record_date or "",
                status="stored",
            )
        )
    db.commit()


@router.get("/students/me/knowledge")
def list_knowledge(
    uid: str = Depends(get_uid_for_current_student),
    db: Session = Depends(get_db),
):
    _backfill_knowledge(db, uid)
    rows = (
        db.query(StudentKnowledgeItem)
        .filter(StudentKnowledgeItem.uid == uid)
        .order_by(StudentKnowledgeItem.id.desc())
        .all()
    )
    views = _knowledge_view_urls(db, rows)
    job_ids = [row.job_id for row in rows if row.job_id]
    academic = {}
    career = {}
    if job_ids:
        for rec in db.query(AcademicRecord).filter(AcademicRecord.uid == uid, AcademicRecord.source_job_id.in_(job_ids)).all():
            academic[rec.source_job_id] = rec
        for rec in db.query(CareerRecord).filter(CareerRecord.uid == uid, CareerRecord.source_job_id.in_(job_ids)).all():
            career[rec.source_job_id] = rec
    items = []
    for row in rows:
        record = academic.get(row.job_id) or career.get(row.job_id)
        items.append(_knowledge_out(row, views.get(row.id, ""), record))
    return {"items": items}


@router.patch("/students/me/knowledge/{item_id}")
def recategorise_knowledge(
    item_id: int,
    body: KnowledgePatch,
    uid: str = Depends(get_uid_for_current_student),
    db: Session = Depends(get_db),
):
    group = (body.doc_group or "").strip().lower()
    if group not in _KNOWLEDGE_GROUPS or group == "uncategorised":
        raise HTTPException(status_code=400, detail="Choose academic, career, certificate, or activity")
    row = (
        db.query(StudentKnowledgeItem)
        .filter(StudentKnowledgeItem.id == item_id, StudentKnowledgeItem.uid == uid)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    label = (body.category or "").strip() or group
    row.doc_group = group
    row.category = label[:64]
    row.category_source = "user"
    if row.job_id:
        for rec in db.query(AcademicRecord).filter(AcademicRecord.uid == uid, AcademicRecord.source_job_id == row.job_id).all():
            rec.category = label[:64]
        for rec in db.query(CareerRecord).filter(CareerRecord.uid == uid, CareerRecord.source_job_id == row.job_id).all():
            rec.category = label[:64]
    db.commit()
    from app.services.document_report_refresh import maybe_refresh_after_documents

    maybe_refresh_after_documents(db, uid)
    return _knowledge_out(row)


@router.post("/students/{uid}/knowledge/upload", status_code=status.HTTP_202_ACCEPTED)
async def knowledge_upload(
    uid: str,
    file: UploadFile = File(...),
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    data = await file.read()
    filename = file.filename or "document"
    raw = store_raw(db, uid=uid, doc_type="inbox", file_bytes=data, filename=filename)
    target = "inbox" if raw.doc_type == "inbox" else "academic_report"
    if raw.doc_type == "career":
        target = "career_report"
    elif raw.doc_type == "campus":
        target = "campus_report"
    elif raw.doc_type == "academic":
        target = "academic_report"
    job = _accept_document(db, uid, raw, target, filename)
    item = StudentKnowledgeItem(
        uid=uid,
        vault_id=raw.id,
        job_id=job.id,
        filename=filename,
        title=filename,
        doc_group="uncategorised",
        category="",
        category_source="model",
        status="reading",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "job_id": job.id,
        "item_id": item.id,
        "status": "accepted",
        "view_url": _http_ref(raw.storage_ref),
    }


@router.get("/students/me/jobs/recent")
def my_recent_jobs(
    limit: int = 5,
    uid: str = Depends(get_uid_for_current_student),
    db: Session = Depends(get_db),
):
    rows = list_recent_jobs(db, uid, limit=limit)
    return {
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "stage": "document_analyse" if j.stage == "gemini_analyse" else j.stage,
                "report_target": j.report_target,
                "confidence": j.confidence,
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in rows
        ]
    }


@router.get("/students/{uid}/jobs/recent")
def recent_jobs(
    uid: str,
    limit: int = 5,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    rows = list_recent_jobs(db, uid, limit=limit)
    return {
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "stage": "document_analyse" if j.stage == "gemini_analyse" else j.stage,
                "report_target": j.report_target,
                "confidence": j.confidence,
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in rows
        ]
    }


@router.get("/students/{uid}/overview")
def overview(
    uid: str,
    enrich: int = 0,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    """Overview dashboard. Pass enrich=1 to optionally polish narrative copy (slower)."""
    use_enrich = enrich != 0
    return _as_dashboard(build_overview(db, uid, use_gemini=use_enrich))


@router.post("/students/{uid}/overview/refresh")
def refresh_overview(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    invalidate_uid(uid)
    return _as_dashboard(build_overview(db, uid, use_gemini=True))


@router.get("/students/{uid}/profile")
def profile(uid: str, tab: str = "overview", student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    return _as_profile(build_profile(db, uid, tab))


@router.post("/students/{uid}/profile/refresh")
def refresh_profile(uid: str, tab: str = "overview", student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    invalidate_uid(uid)
    return _as_profile(build_profile(db, uid, tab))


@router.patch("/students/{uid}/profile/personal")
def patch_profile_personal(
    uid: str,
    body: ProfilePersonalPatch,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    st = db.query(Student).filter(Student.uid == uid).first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")
    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        if val is not None and hasattr(st, key):
            setattr(st, key, val.strip() if isinstance(val, str) else val)
    db.commit()
    invalidate_uid(uid)
    return _as_profile(build_profile(db, uid, "overview"))


@router.get("/students/{uid}/links")
def list_links(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    rows = db.query(StudentLink).filter(StudentLink.uid == uid).order_by(StudentLink.id).all()
    return {
        "links": [
            {"id": r.id, "type": r.link_type, "url": r.url, "verified": bool(r.verified_bool)}
            for r in rows
        ]
    }


@router.delete("/students/{uid}/links/{link_id}")
def delete_link(link_id: int, uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    row = db.query(StudentLink).filter(StudentLink.id == link_id, StudentLink.uid == uid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(row)
    db.commit()
    invalidate_uid(uid)
    return {"ok": True}


@router.get("/students/{uid}/analysis")
def analysis(uid: str, tab: str = "overview", student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    return _as_analysis(build_analysis(db, uid, tab))


@router.post("/students/{uid}/links")
def add_link(uid: str, body: LinkIn, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    verified = False
    if body.url.startswith("http"):
        verified = True
        try:
            import urllib.request

            req = urllib.request.Request(body.url, method="HEAD")
            with urllib.request.urlopen(req, timeout=3) as resp:
                verified = 200 <= getattr(resp, "status", 200) < 400
        except Exception:
            try:
                import urllib.request

                req = urllib.request.Request(
                    body.url,
                    method="GET",
                    headers={"User-Agent": "MenteeTrackerLinkCheck/1.0"},
                )
                with urllib.request.urlopen(req, timeout=3) as resp:
                    verified = 200 <= getattr(resp, "status", 200) < 400
            except Exception:
                verified = False
    existing = (
        db.query(StudentLink)
        .filter(
            StudentLink.uid == uid,
            StudentLink.link_type == body.type,
            StudentLink.url == body.url,
        )
        .first()
    )
    if existing:
        return {"ok": True, "verified": bool(existing.verified_bool)}
    row = StudentLink(uid=uid, link_type=body.type, url=body.url, verified_bool=verified)
    db.add(row)
    db.commit()
    invalidate_uid(uid)
    return {"ok": True, "verified": verified}


@router.post("/students/{uid}/id-card", status_code=status.HTTP_202_ACCEPTED)
async def upload_id_card(
    uid: str,
    file: UploadFile = File(...),
    consent: str = Form(...),
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    if consent.lower() not in ("true", "1", "yes", "on"):
        raise HTTPException(status_code=400, detail="Consent required")
    data = await file.read()
    raw = store_raw(db, uid=uid, doc_type="id_card", file_bytes=data, filename=file.filename or "id.jpg")
    job = _enqueue(db, uid=uid, raw=raw, report_target="onboarding")
    fields = {}
    if isinstance(job.result_json, dict):
        fields = job.result_json.get("structured_fields") or {}
    has_identity = any(str(fields.get(k) or "").strip() for k in ("student_name", "name", "full_name", "programme", "program"))
    if job.status in ("processing", "completed", "dead_letter", "retry", "failed") and not has_identity:
        job.status = "queued"
        job.stage = "queued"
        job.last_error = None
        db.commit()
    return {"job_id": job.id, "status": "accepted"}


@router.post("/students/{uid}/academic/upload", status_code=status.HTTP_202_ACCEPTED)
async def academic_upload(
    uid: str,
    file: UploadFile = File(...),
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    data = await file.read()
    raw = store_raw(db, uid=uid, doc_type="academic", file_bytes=data, filename=file.filename or "doc.pdf")
    job = _accept_document(db, uid, raw, "academic_report", file.filename or "doc.pdf")
    db.commit()
    return {"job_id": job.id}


@router.get("/students/{uid}/academic")
def get_academic(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    return build_profile(db, uid, "academic")


@router.post("/students/{uid}/career/upload", status_code=status.HTTP_202_ACCEPTED)
async def career_upload(
    uid: str,
    file: UploadFile = File(...),
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    data = await file.read()
    raw = store_raw(db, uid=uid, doc_type="career", file_bytes=data, filename=file.filename or "doc.pdf")
    job = _accept_document(db, uid, raw, "career_report", file.filename or "doc.pdf")
    db.commit()
    return {"job_id": job.id}


@router.post("/students/{uid}/swot")
def submit_swot(uid: str, body: SwotIn, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    entry = SwotEntry(
        uid=uid,
        strengths=body.strengths,
        weaknesses=body.weaknesses,
        opportunities=body.opportunities,
        threats=body.threats,
        source="form",
    )
    db.add(entry)
    merge_delta(
        db,
        uid=uid,
        report_type="swot_report",
        delta=body.model_dump(),
        narrative_hint="SWOT self-assessment submitted",
    )
    generate_activities_from_swot(db, uid, body.weaknesses)
    invalidate_uid(uid)
    db.commit()
    return {"ok": True}


@router.get("/students/{uid}/swot")
def get_swot(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    from app.services.living_report_service import get_report

    r = get_report(db, uid, "swot_report")
    if r:
        return {"structured_state": r.structured_state, "narrative": r.narrative, "version": r.version}
    entry = db.query(SwotEntry).filter(SwotEntry.uid == uid).order_by(SwotEntry.generated_at.desc()).first()
    if entry:
        return {
            "structured_state": {
                "strengths": entry.strengths,
                "weaknesses": entry.weaknesses,
                "opportunities": entry.opportunities,
                "threats": entry.threats,
            },
            "narrative": "SWOT from your latest form submission.",
            "version": 1,
        }
    return {"empty": True}


@router.get("/students/{uid}/activities")
def list_activities(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    rows = db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).order_by(StudentActivityV2.id.asc()).all()
    return [activity_to_api(r) for r in rows]


@router.patch("/students/{uid}/activities/{activity_id}")
def patch_activity(
    uid: str,
    activity_id: int,
    body: ActivityPatch,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    row = db.query(StudentActivityV2).filter(StudentActivityV2.id == activity_id, StudentActivityV2.uid == uid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    if body.progress_pct is not None:
        row.progress_pct = body.progress_pct
    if body.status:
        row.status = body.status
    db.commit()
    return {"ok": True}


@router.post("/students/{uid}/activities/request")
def request_activity(
    uid: str,
    body: ActivityRequestIn,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Enter an activity title")
    row = StudentActivityV2(
        uid=uid,
        title=title[:255],
        description=(body.description or "").strip() or "Requested by student",
        origin="student_request",
        status="requested",
        term=store_term(body.term),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return activity_to_api(row)


@router.post("/students/{uid}/cv/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_cv(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    key = f"{uid}:cv_pdf:{datetime.utcnow().strftime('%Y-%m-%d')}"
    job = create_job(db, uid=uid, report_target="cv_pdf", idempotency_key=key)
    return {"job_id": job.id, "status": "accepted"}


@router.get("/students/{uid}/campus")
def list_campus(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    rows = db.query(CampusActivity).filter(CampusActivity.uid == uid).order_by(CampusActivity.id.desc()).all()
    return [
        {
            "id": r.id,
            "event_name": r.event_name,
            "role": r.role,
            "record_date": r.record_date,
            "verified": r.verified_bool,
            "evidence_ref": r.evidence_ref,
        }
        for r in rows
    ]


@router.get("/students/{uid}/documents")
def list_documents(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    rows = db.query(DocumentGenerated).filter(DocumentGenerated.uid == uid).all()
    return [{"id": r.id, "type": r.doc_type, "generated_at": r.generated_at} for r in rows]


@router.post("/students/{uid}/campus/upload", status_code=status.HTTP_202_ACCEPTED)
async def campus_upload(
    uid: str,
    file: UploadFile = File(...),
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    data = await file.read()
    raw = store_raw(db, uid=uid, doc_type="campus", file_bytes=data, filename=file.filename or "proof.jpg")
    job = _accept_document(db, uid, raw, "campus_report", file.filename or "proof.jpg")
    db.commit()
    return {"job_id": job.id}


@router.post("/students/{uid}/profile/review")
def profile_review(
    uid: str,
    body: ProfileReviewIn,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    if body.approved:
        student.verified_at = datetime.utcnow()
    if body.edits:
        _apply_profile_edits(db, student, body.edits)
    db.commit()
    invalidate_uid(uid)
    return {"ok": True, "verified_at": student.verified_at.isoformat() if student.verified_at else None}


@router.post("/students/{uid}/activities/{activity_id}/evidence", status_code=status.HTTP_202_ACCEPTED)
async def upload_activity_evidence(
    uid: str,
    activity_id: int,
    file: UploadFile = File(...),
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    row = db.query(StudentActivityV2).filter(StudentActivityV2.id == activity_id, StudentActivityV2.uid == uid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    data = await file.read()
    raw = store_raw(db, uid=uid, doc_type="activity_evidence", file_bytes=data, filename=file.filename or "proof.pdf")
    job = _enqueue(db, uid=uid, raw=raw, report_target="academic_report")
    return {"job_id": job.id}


def _report_pdf_bytes(db: Session, uid: str, report_type: str, student: Student) -> tuple[str, bytes]:
    from app.services.report_pdf_service import REPORT_TITLES, sections_for_student

    kind = report_type if report_type in REPORT_TITLES else "progress"
    sections = sections_for_student(db, uid, kind)
    pdf = build_tracker_report_pdf(
        title=REPORT_TITLES[kind],
        student_name=student.student_name or student.student_usn,
        sections=sections,
    )
    return f"{kind}-report.pdf", pdf


@router.get("/students/{uid}/reports/pack")
def download_report_pack(
    uid: str,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for report_type in ("swot", "progress", "academic", "skills"):
            fname, pdf = _report_pdf_bytes(db, uid, report_type, student)
            zf.writestr(fname, pdf)
        cv_row = (
            db.query(DocumentGenerated)
            .filter(DocumentGenerated.uid == uid, DocumentGenerated.doc_type == "cv")
            .order_by(DocumentGenerated.generated_at.desc())
            .first()
        )
        if cv_row and cv_row.storage_ref:
            cv_path = Path(cv_row.storage_ref)
            if cv_path.is_file():
                zf.writestr("curriculum-vitae.pdf", cv_path.read_bytes())
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="mentee-report-pack.zip"'},
    )


@router.get("/students/{uid}/reports/{report_type}/download")
def download_report(
    uid: str,
    report_type: str,
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    fname, pdf = _report_pdf_bytes(db, uid, report_type, student)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.post("/students/{uid}/analysis/refresh")
def refresh_analysis(uid: str, student: Student = Depends(get_student_by_uid), db: Session = Depends(get_db)):
    invalidate_uid(uid)
    return _as_analysis(build_analysis(db, uid, "overview"))


@router.post("/meetings/{meeting_id}/cancel")
def cancel_meeting(
    meeting_id: str,
    uid: str = Depends(get_uid_for_current_student),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.uid == uid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    meeting = (
        db.query(Meetings)
        .filter(Meetings.id == meeting_id, Meetings.student_usn == student.student_usn)
        .first()
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if (meeting.status or "").lower() in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Meeting cannot be cancelled")
    meeting.status = "cancelled"
    db.commit()
    return {"ok": True, "meeting_id": meeting_id}


@router.post("/students/{uid}/meetings/{meeting_id}/summary", status_code=status.HTTP_202_ACCEPTED)
async def upload_meeting_summary(
    uid: str,
    meeting_id: str,
    file: UploadFile = File(...),
    student: Student = Depends(get_student_by_uid),
    db: Session = Depends(get_db),
):
    student_row = db.query(Student).filter(Student.uid == uid).first()
    meeting = (
        db.query(Meetings)
        .filter(Meetings.id == meeting_id, Meetings.student_usn == student_row.student_usn)
        .first()
        if student_row
        else None
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    data = await file.read()
    raw = store_raw(
        db,
        uid=uid,
        doc_type="meeting_recording",
        file_bytes=data,
        filename=file.filename or "recording.txt",
    )
    key = f"{uid}:meeting_summary:{meeting_id}:{raw.content_hash}"
    job = create_job(
        db,
        uid=uid,
        report_target="meeting_summary",
        raw_vault_item_id=raw.id,
        idempotency_key=key,
    )
    return {"job_id": job.id, "status": "accepted"}


@router.post("/meetings/{meeting_id}/join")
def join_meeting(meeting_id: int, uid: str = Depends(get_uid_for_current_student)):
    token = create_join_token(room_name=f"meeting-{meeting_id}", participant_identity=uid)
    return {"token": token, "url": __import__("os").getenv("LIVEKIT_URL")}
