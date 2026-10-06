"""Run processing_jobs through OCR → PII mask → document analyse → reidentify → notify."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.student_platform import (
    AcademicRecord,
    CampusActivity,
    CareerRecord,
    DocumentGenerated,
    PiiVaultEntry,
    ProcessingJob,
    RawVaultItem,
    ReidentifyAuditLog,
    StudentKnowledgeItem,
)
from app.services.doc_type_config import categories_for_doc_type, dashboard_merge_for_doc_type, report_target_for_doc_type
from app.services.dashboard_mapper import TRACKER_DASHBOARD_REPORT, merge_doc_fields_to_dashboard_delta
from app.services.gemini_gateway import generate_json
from app.services.living_report_service import merge_delta
from app.db.models.student_platform import LivingReport
from app.services.ocr_service import DOCUMENT_FIELD_GUIDE, extract_id_card_fields, phone_from_text, read_uploaded_document
from app.services.pii_service import mask_pii
from app.services.notify_service import notify_uid
from app.services.gemini_insight_service import build_profile
from app.services.report_pdf_service import build_tracker_report_pdf, report_sections_from_payload
from app.services.shadow_write_service import shadow_write_academic
from app.db.models.students import Student


def _fernet_encrypt(value: str) -> str:
    key = os.getenv("PII_FERNET_KEY")
    if not key:
        return value
    try:
        from cryptography.fernet import Fernet

        f = Fernet(key.encode() if isinstance(key, str) else key)
        return f.encrypt(value.encode()).decode()
    except Exception:
        return value


def _mask_pii(text: str) -> tuple[str, list[tuple[str, str]]]:
    return mask_pii(text)


def _unmask_value(value: Any, tokens: list[tuple[str, str]]) -> Any:
    if isinstance(value, str):
        for tok, raw in tokens:
            value = value.replace(tok, raw)
        return value
    if isinstance(value, dict):
        return {k: _unmask_value(v, tokens) for k, v in value.items()}
    if isinstance(value, list):
        return [_unmask_value(v, tokens) for v in value]
    return value


def _field_text(fields: dict[str, Any], *keys: str) -> str:
    for key in keys:
        raw = fields.get(key)
        if raw is None:
            continue
        text = str(raw).strip()
        if not text or text.lower().startswith("document uploaded") or text.startswith("<<"):
            continue
        return text
    return ""


def _apply_id_card_fields(db: Session, uid: str, fields: dict[str, Any]) -> None:
    """Fill empty profile fields from a college ID. Login USN stays unchanged."""
    student = db.query(Student).filter(Student.uid == uid).first()
    if not student:
        return
    name = _field_text(fields, "student_name", "name", "full_name")
    program = _field_text(fields, "programme", "program", "student_program", "course")
    phone = _field_text(fields, "phone", "student_phoneno", "mobile")
    semester = _field_text(fields, "semester", "sem")
    if name and not (student.student_name or "").strip():
        student.student_name = name[:255]
    if program and not (student.student_program or "").strip():
        student.student_program = program[:255]
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits and not (student.student_phoneno or "").strip():
        student.student_phoneno = digits[-10:]
    if semester and student.semester is None:
        try:
            student.semester = int("".join(ch for ch in semester if ch.isdigit()) or "0") or None
        except ValueError:
            pass


def _living_report_versions(db: Session, uid: str) -> dict[str, int]:
    rows = db.query(LivingReport).filter(LivingReport.uid == uid).all()
    return {r.report_type: int(r.version or 1) for r in rows}


def _complete_job(
    db: Session,
    job: ProcessingJob,
    *,
    target: str,
    analysis: dict[str, Any] | None = None,
    pipeline_extras: dict[str, Any] | None = None,
) -> None:
    job.stage = "notify"
    job.status = "completed"
    payload: dict[str, Any] = dict(analysis or {})
    if pipeline_extras:
        payload.update(pipeline_extras)
    if payload:
        job.confidence = float(payload.get("confidence") or job.confidence or 0.7)
        job.result_json = payload
    notify_uid(
        db,
        job.uid,
        "Document processed",
        f"Your {target} update is ready.",
        link="/student",
    )
    from app.services.insight_cache import invalidate_uid

    invalidate_uid(job.uid)
    db.commit()


def _process_cv_job(db: Session, job: ProcessingJob) -> None:
    job.stage = "cv_generate"
    db.commit()
    student = db.query(Student).filter(Student.uid == job.uid).first()
    name = (student.student_name if student else None) or job.uid
    preview = build_profile(db, job.uid, "documents")
    sections = report_sections_from_payload("progress", preview)
    pdf = build_tracker_report_pdf(title="Curriculum Vitae", student_name=name, sections=sections)
    out_dir = Path("uploads") / "cv"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{job.uid}_{job.id}.pdf"
    path.write_bytes(pdf)
    doc = DocumentGenerated(
        uid=job.uid,
        doc_type="cv",
        storage_ref=str(path),
        preview_json=preview,
    )
    db.add(doc)
    db.commit()
    _complete_job(db, job, target="cv_pdf", analysis={"structured_fields": {"cv_path": str(path)}})


_GROUP_ROUTES = {
    "academic": ("academic", "academic_report"),
    "certificate": ("academic", "academic_report"),
    "career": ("career", "career_report"),
    "activity": ("campus", "campus_report"),
}


_GENERIC_READ_TITLES = {
    "certificate of completion",
    "uploaded document",
    "document uploaded: inbox",
    "document uploaded: academic",
}


def _needs_deeper_read(fields: dict, group: str, category: str) -> bool:
    text = f"{group} {category}".lower()
    if any(word in text for word in ("mark", "transcript", "grade")):
        return False
    if any(fields.get(key) for key in ("skills_covered", "skills", "program_name", "course", "bullets")):
        return False
    title = str(fields.get("title") or "").strip().lower()
    has_date = bool(fields.get("completion_date") or fields.get("date") or fields.get("score"))
    if has_date and title and title not in _GENERIC_READ_TITLES:
        return False
    return True


def _fill_missing_fields(fields: dict, incoming: dict) -> dict:
    for key, value in incoming.items():
        if value in (None, "", [], {}):
            continue
        if not fields.get(key):
            fields[key] = value
    return fields


def _hint_from_name(name: str) -> str:
    low = (name or "").lower()
    if "cert" in low:
        return "certificate"
    if any(word in low for word in ("resume", "curriculum", "intern", "offer")):
        return "career"
    if any(word in low for word in ("volunteer", "club", "event")):
        return "activity"
    if any(word in low for word in ("mark", "transcript", "grade", "semester")):
        return "academic"
    return ""


def _normalize_group(group: str | None, category: str | None) -> str:
    for raw in (group, category):
        key = str(raw or "").strip().lower().replace("-", " ").replace("_", " ")
        if key in ("academic", "marklist", "transcript", "project", "thesis", "publication"):
            return "academic"
        if "cert" in key or key in ("award", "workshop"):
            return "certificate"
        if key in ("career", "resume", "cv", "internship", "application", "offer") or "intern" in key:
            return "career"
        if key in ("activity", "campus", "volunteer", "club", "event", "leadership") or "activ" in key:
            return "activity"
    return "academic"


def _remember_knowledge(db: Session, job: ProcessingJob, *, group: str, category: str, title: str, summary: str, status: str) -> None:
    row = db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.job_id == job.id).first()
    if row is None:
        return
    if row.category_source != "user":
        row.doc_group = group or "uncategorised"
        row.category = category or row.doc_group
    if title and not row.title:
        row.title = title[:255]
    if summary and not row.summary:
        row.summary = summary[:500]
    row.status = status


def process_job(db: Session, job: ProcessingJob) -> None:
    try:
        target = job.report_target or "academic_report"
        if target == "cv_pdf" and not job.raw_vault_item_id:
            _process_cv_job(db, job)
            return

        job.stage = "ocr_extract"
        db.commit()
        raw_text = ""
        doc_type = "academic"
        item = None
        seen_analysis = None
        if job.raw_vault_item_id:
            item = db.query(RawVaultItem).filter(RawVaultItem.id == job.raw_vault_item_id).first()
            if item:
                doc_type = item.doc_type or doc_type
                yaml_target = report_target_for_doc_type(doc_type)
                if yaml_target and not job.report_target:
                    target = yaml_target
                if item.storage_ref:
                    try:
                        raw_text, seen_analysis = read_uploaded_document(item.storage_ref, item.doc_type)
                    except Exception:
                        raw_text = f"Document uploaded: {item.doc_type}"

        job.stage = "pii_classify_mask"
        db.commit()
        masked, tokens = _mask_pii(raw_text or "no text")
        for tok, val in tokens:
            db.add(
                PiiVaultEntry(
                    uid=job.uid,
                    field_type=tok,
                    encrypted_value=_fernet_encrypt(val),
                    token_key=tok,
                )
            )
        db.commit()

        job.stage = "document_analyse"
        db.commit()
        cats = categories_for_doc_type(doc_type)
        cat_hint = f" Expected categories: {', '.join(cats)}." if cats else ""
        id_hint = ""
        if doc_type == "id_card":
            id_hint = (
                " This is a college student ID. structured_fields must use these keys when printed: "
                "student_name, student_usn, programme, semester, phone."
            )
        if doc_type == "inbox":
            file_name = ""
            stored = db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.job_id == job.id).first()
            if stored and stored.filename:
                file_name = stored.filename
            analyse_prompt = (
                "Classify this student document. Return JSON with keys: "
                "group (one of academic, career, certificate, activity), "
                "category (a short specific label such as marklist, transcript, course_certificate, internship, resume, volunteer), "
                f"{DOCUMENT_FIELD_GUIDE} confidence (0-1). "
                f"File name: {file_name}\n"
                f"Text:\n{masked[:12000]}"
            )
        else:
            analyse_prompt = (
                "Analyse this anonymised document text. Return JSON with keys: "
                f"{DOCUMENT_FIELD_GUIDE} confidence (0-1), category (string)."
                f"{cat_hint}{id_hint}\n"
                f"Text:\n{masked[:12000]}"
            )
        try:
            if isinstance(seen_analysis, dict) and seen_analysis.get("group"):
                analysis = seen_analysis
                preview = analysis.get("structured_fields") if isinstance(analysis.get("structured_fields"), dict) else {}
                if raw_text and _needs_deeper_read(preview, str(analysis.get("group") or ""), str(analysis.get("category") or "")):
                    deeper = generate_json(analyse_prompt, tier="lite")
                    if isinstance(deeper, dict):
                        deeper_fields = deeper.get("structured_fields") if isinstance(deeper.get("structured_fields"), dict) else {}
                        analysis["structured_fields"] = _fill_missing_fields(dict(preview), deeper_fields)
                        if not analysis.get("category") and deeper.get("category"):
                            analysis["category"] = deeper.get("category")
            else:
                analysis = generate_json(analyse_prompt, tier="high" if doc_type == "id_card" else "lite")
        except Exception:
            analysis = {"structured_fields": {"summary": masked[:500]}, "confidence": 0.5, "category": "unknown"}

        job.stage = "reidentify_merge"
        db.commit()
        db.add(
            ReidentifyAuditLog(job_id=job.id, uid=job.uid, stage="reidentify_merge")
        )
        fields = _unmask_value(analysis.get("structured_fields") or {}, tokens)
        if not isinstance(fields, dict):
            fields = {}
        if doc_type == "id_card" and item and item.storage_ref and not _field_text(fields, "student_name", "name", "full_name"):
            try:
                seen = extract_id_card_fields(item.storage_ref)
                for key, value in seen.items():
                    if _field_text({key: value}, key) and not _field_text(fields, key):
                        fields[key] = value
            except Exception:
                pass
            if not _field_text(fields, "phone", "student_phoneno", "mobile"):
                phone = phone_from_text(raw_text)
                if phone:
                    fields["phone"] = phone
        analysis["structured_fields"] = fields
        if doc_type == "inbox":
            filename_hint = ""
            if item is not None and item.storage_ref:
                filename_hint = item.storage_ref.rsplit("/", 1)[-1]
            named = _hint_from_name(filename_hint)
            group = _normalize_group(analysis.get("group") or named, analysis.get("category") or named)
            doc_type, target = _GROUP_ROUTES[group]
            if item is not None:
                item.doc_type = doc_type
            job.report_target = target
            analysis["group"] = group
            category = str(analysis.get("category") or "")
            if category.lower() in ("", "unknown"):
                analysis["category"] = named or group
        if doc_type == "id_card":
            _apply_id_card_fields(db, job.uid, fields)
        merge_delta(
            db,
            uid=job.uid,
            report_type=target,
            delta=fields,
            narrative_hint=str(fields.get("title") or analysis.get("category") or ""),
            job_id=job.id,
            model=False,
        )

        if dashboard_merge_for_doc_type(doc_type):
            dash_delta = merge_doc_fields_to_dashboard_delta(fields)
            if dash_delta:
                merge_delta(
                    db,
                    uid=job.uid,
                    report_type=TRACKER_DASHBOARD_REPORT,
                    delta=dash_delta,
                    narrative_hint=f"Dashboard refresh from {doc_type}",
                    job_id=job.id,
                    model=False,
                )

        if target == "academic_report":
            db.add(
                AcademicRecord(
                    uid=job.uid,
                    category=analysis.get("category") or "marklist",
                    title=str(fields.get("title", "Uploaded document")),
                    issuer=str(fields.get("issuer", "")),
                    record_date=str(fields.get("completion_date") or fields.get("date") or "")[:32],
                    verified_bool=(analysis.get("confidence") or 0) > 0.9,
                    source_job_id=job.id,
                    extra=fields,
                )
            )
            shadow_write_academic(db, uid=job.uid, fields=fields)
        elif target == "career_report":
            db.add(
                CareerRecord(
                    uid=job.uid,
                    category=analysis.get("category") or "internship",
                    title=str(fields.get("title", "")),
                    org=str(fields.get("org", "")),
                    record_date=str(fields.get("completion_date") or fields.get("date") or "")[:32],
                    source_job_id=job.id,
                    extra=fields,
                )
            )
        elif target == "campus_report":
            db.add(
                CampusActivity(
                    uid=job.uid,
                    event_name=str(fields.get("event_name") or fields.get("title") or "Campus activity"),
                    role=str(fields.get("role") or ""),
                    record_date=str(fields.get("date") or ""),
                    evidence_ref=job.raw_vault_item_id,
                    verified_bool=(analysis.get("confidence") or 0) > 0.85,
                )
            )

        stored_group = str(analysis.get("group") or "")
        if not stored_group:
            stored_group = _normalize_group(None, analysis.get("category"))
            if doc_type == "campus":
                stored_group = "activity"
            elif doc_type == "career":
                stored_group = "career"
            elif doc_type == "academic" and stored_group == "academic":
                stored_group = "academic"
        _remember_knowledge(
            db,
            job,
            group=stored_group,
            category=str(analysis.get("category") or stored_group),
            title=str(fields.get("title") or ""),
            summary=str(fields.get("summary") or raw_text or "")[:800],
            status="stored",
        )
        extras = {
            "ocr_preview": (raw_text or "")[:2000],
            "masked_preview": masked[:2000],
            "analysis_summary": {
                "confidence": analysis.get("confidence"),
                "category": analysis.get("category"),
                "field_keys": list(fields.keys())[:30],
            },
            "living_report_versions": _living_report_versions(db, job.uid),
        }
        db.commit()
        pipeline_extras = extras if os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes") else None
        _complete_job(db, job, target=target, analysis=analysis, pipeline_extras=pipeline_extras)
        from app.services.document_report_refresh import maybe_refresh_after_documents

        maybe_refresh_after_documents(db, job.uid)
    except Exception as e:
        from app.services.vendor_scrub import scrub_vendor_names

        failed = db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.job_id == job.id).first()
        if failed and failed.status == "reading":
            failed.status = "failed"
        job.status = "dead_letter" if (job.attempts or 0) >= 3 else "retry"
        job.last_error = scrub_vendor_names(str(e))[:2000]
        db.commit()
