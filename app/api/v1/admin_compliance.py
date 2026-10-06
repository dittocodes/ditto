"""Admin review queue, erasure, compliance (§10 stubs)."""
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin
from app.db.database import get_db
from app.db.models.student_platform import (
    LivingReport,
    PiiVaultEntry,
    ProcessingJob,
    ReidentifyAuditLog,
    ReviewQueueItem,
)
from app.db.models.students import Student
from app.services.insight_cache import invalidate_uid
from app.services.living_report_service import get_report
from app.workers.processing_worker import run_worker_once

router = APIRouter()


class ReviewResolveIn(BaseModel):
    action: str  # accept_new | keep_old


@router.get("/admin/review-queue")
def list_review_queue(db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    rows = (
        db.query(ReviewQueueItem)
        .filter(ReviewQueueItem.status == "pending")
        .order_by(ReviewQueueItem.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": r.id,
            "uid": r.uid,
            "job_id": r.job_id,
            "field_path": r.field_path,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/admin/review-queue/{item_id}/resolve")
def resolve_review(
    item_id: int,
    body: ReviewResolveIn,
    db: Session = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    row = db.query(ReviewQueueItem).filter(ReviewQueueItem.id == item_id).first()
    if not row or row.status != "pending":
        raise HTTPException(status_code=404, detail="Queue item not found")
    report_type = "academic_report"
    if row.field_path and "." in row.field_path:
        report_type = row.field_path.split(".", 1)[0]
    lr = get_report(db, row.uid, report_type)
    if lr and lr.structured_state is not None:
        state = dict(lr.structured_state)
        key = row.field_path.split(".")[-1] if row.field_path else row.field_path
        if body.action == "accept_new":
            new_val = row.new_value
            if isinstance(new_val, dict) and "value" in new_val:
                new_val = new_val["value"]
            if key:
                state[key] = new_val
        row.status = "accepted_new" if body.action == "accept_new" else "kept_old"
        lr.structured_state = state
        lr.version = (lr.version or 1) + 1
    else:
        row.status = "accepted_new" if body.action == "accept_new" else "kept_old"
    row.resolved_at = datetime.utcnow()
    db.commit()
    invalidate_uid(row.uid)
    return {"ok": True}


class RunWorkerIn(BaseModel):
    count: int = 5


@router.post("/admin/demo/run-worker")
def demo_run_worker(
    body: RunWorkerIn,
    db: Session = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if os.getenv("DEMO_MODE", "").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=403, detail="DEMO_MODE required")
    ran = 0
    for _ in range(max(1, min(body.count, 20))):
        if run_worker_once():
            ran += 1
    return {"ok": True, "jobs_processed": ran}


@router.get("/admin/demo/pipeline/{job_id}")
def demo_pipeline_job(job_id: str, db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    audits = (
        db.query(ReidentifyAuditLog)
        .filter(ReidentifyAuditLog.job_id == job_id)
        .order_by(ReidentifyAuditLog.id)
        .all()
    )
    tokens = (
        db.query(PiiVaultEntry.field_type)
        .filter(PiiVaultEntry.uid == job.uid)
        .distinct()
        .all()
    )
    result = job.result_json or {}
    from app.services.vendor_scrub import scrub_vendor_names

    return {
        "job": {
            "id": job.id,
            "uid": job.uid,
            "status": job.status,
            "stage": "document_analyse" if job.stage == "gemini_analyse" else job.stage,
            "report_target": job.report_target,
            "confidence": job.confidence,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "last_error": scrub_vendor_names(job.last_error) if job.last_error else None,
        },
        "ocr_preview": result.get("ocr_preview"),
        "masked_preview": result.get("masked_preview"),
        "analysis_summary": result.get("analysis_summary") or result.get("gemini_summary"),
        "living_report_versions": result.get("living_report_versions"),
        "audit_stages": [
            ("document_analyse" if a.stage == "gemini_analyse" else a.stage) for a in audits
        ],
        "pii_token_types": [t[0] for t in tokens],
    }


@router.get("/admin/demo/students/{uid}/living-reports")
def demo_living_reports(uid: str, db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    rows = db.query(LivingReport).filter(LivingReport.uid == uid).all()
    return [
        {
            "report_type": r.report_type,
            "version": r.version,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            "structured_state": r.structured_state,
        }
        for r in rows
    ]


@router.post("/admin/students/{uid}/erase")
def erase_student_data(uid: str, db: Session = Depends(get_db), _admin: dict = Depends(get_current_admin)):
    student = db.query(Student).filter(Student.uid == uid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    tombstone_email = f"erased-{uid}@tombstone.local"
    student.student_name = "Erased user"
    student.student_email = tombstone_email
    student.student_phoneno = None
    student.linkedin = None
    student.profile_photo_url = None
    student.parent_guardian_contact = None
    student.mother_contact = None
    student.father_contact = None
    student.verified_at = None
    db.commit()
    invalidate_uid(uid)
    return {"ok": True, "uid": uid, "erased_at": datetime.utcnow().isoformat()}
