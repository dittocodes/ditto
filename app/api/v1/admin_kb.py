"""Admin knowledge base and live product-owner view."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin
from app.db.database import get_db
from app.db.models.student_platform import (
    KnowledgeBaseEntry,
    LivingReport,
    ProcessingJob,
    StudentKnowledgeItem,
)
from app.db.models.students import Student

router = APIRouter()

_SCOPES = {"global", "programme", "swot", "campus"}


class KbIn(BaseModel):
    scope: str = "global"
    programme_id: str | None = None
    title: str | None = None
    content: str


def _kb_row(row: KnowledgeBaseEntry) -> dict:
    return {
        "id": row.id,
        "scope": row.scope,
        "programme_id": row.programme_id,
        "content": (row.content or "")[:2000],
    }


@router.get("/admin/knowledge-base")
def list_kb(db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    rows = db.query(KnowledgeBaseEntry).order_by(KnowledgeBaseEntry.id.desc()).limit(200).all()
    return [_kb_row(row) for row in rows]


@router.post("/admin/knowledge-base")
def add_kb(body: KbIn, db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    scope = (body.scope or "global").strip().lower()
    if scope not in _SCOPES:
        raise HTTPException(status_code=400, detail="Choose general, programme, SWOT training, or campus knowledge")
    text = (body.content or "").strip()
    title = (body.title or "").strip()
    if title:
        text = f"{title}\n\n{text}".strip()
    if not text:
        raise HTTPException(status_code=400, detail="Content required")
    row = KnowledgeBaseEntry(
        scope=scope,
        programme_id=(body.programme_id or "").strip() or None,
        content=text,
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.delete("/admin/knowledge-base/{entry_id}")
def delete_kb(entry_id: int, db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    row = db.query(KnowledgeBaseEntry).filter(KnowledgeBaseEntry.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _score_for(state: dict | None) -> float | None:
    if not isinstance(state, dict):
        return None
    breakdown = state.get("score_breakdown")
    if isinstance(breakdown, dict) and isinstance(breakdown.get("overall"), (int, float)):
        return float(breakdown["overall"])
    raw = state.get("performance_score")
    if isinstance(raw, (int, float)):
        return float(raw)
    return None


@router.get("/admin/live")
def live_board(db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    students = db.query(Student).order_by(Student.student_name.asc()).limit(80).all()
    uids = [row.uid for row in students if row.uid]
    reports = (
        db.query(LivingReport)
        .filter(LivingReport.uid.in_(uids), LivingReport.report_type == "tracker_dashboard")
        .all()
        if uids
        else []
    )
    by_uid = {row.uid: row for row in reports}
    doc_counts = {}
    if uids:
        for row in db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.uid.in_(uids)).all():
            doc_counts[row.uid] = doc_counts.get(row.uid, 0) + 1
    people = []
    for student in students:
        report = by_uid.get(student.uid)
        people.append(
            {
                "usn": student.student_usn,
                "name": student.student_name or student.student_usn,
                "program": student.student_program or "",
                "documents": doc_counts.get(student.uid, 0),
                "score": _score_for(report.structured_state if report else None),
                "onboarding": bool(student.verified_at),
            }
        )
    jobs = (
        db.query(ProcessingJob)
        .order_by(ProcessingJob.updated_at.desc(), ProcessingJob.created_at.desc())
        .limit(25)
        .all()
    )
    names = {row.uid: row.student_name or row.student_usn for row in students if row.uid}
    job_rows = [
        {
            "id": job.id,
            "student": names.get(job.uid) or job.uid,
            "status": job.status,
            "stage": job.stage,
            "target": job.report_target,
        }
        for job in jobs
    ]
    kb_rows = db.query(KnowledgeBaseEntry).all()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "students": len(students),
            "documents": sum(doc_counts.values()),
            "jobs_active": sum(1 for job in jobs if job.status in ("queued", "processing", "retry")),
            "swot": sum(1 for row in kb_rows if row.scope == "swot"),
            "campus": sum(1 for row in kb_rows if row.scope == "campus"),
            "knowledge": len(kb_rows),
        },
        "students": people,
        "jobs": job_rows,
    }
