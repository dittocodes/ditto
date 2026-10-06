"""Processing job queue."""
from __future__ import annotations

import hashlib
import uuid
from typing import Optional

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db.models.student_platform import ProcessingJob

# Matches ProcessingJob.idempotency_key Column(String(128))
_IDEM_MAX = 128


def _fit_idempotency_key(key: str) -> str:
    if len(key) <= _IDEM_MAX:
        return key
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return f"h:{digest}"  # 66 chars


def create_job(
    db: Session,
    *,
    uid: str,
    report_target: str,
    raw_vault_item_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> ProcessingJob:
    if idempotency_key:
        idempotency_key = _fit_idempotency_key(idempotency_key)
        existing = (
            db.query(ProcessingJob)
            .filter(ProcessingJob.idempotency_key == idempotency_key)
            .first()
        )
        if existing:
            return existing

    job = ProcessingJob(
        id=str(uuid.uuid4()),
        uid=uid,
        raw_vault_item_id=raw_vault_item_id,
        status="queued",
        stage="queued",
        report_target=report_target,
        idempotency_key=idempotency_key or str(uuid.uuid4()),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> ProcessingJob | None:
    return db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()


def list_recent_jobs(db: Session, uid: str, limit: int = 5) -> list[ProcessingJob]:
    return (
        db.query(ProcessingJob)
        .filter(ProcessingJob.uid == uid)
        .order_by(ProcessingJob.created_at.desc())
        .limit(max(1, min(limit, 20)))
        .all()
    )


def claim_next_job(db: Session) -> ProcessingJob | None:
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(minutes=2)
    stuck = db.query(ProcessingJob).filter(ProcessingJob.status == "processing").all()
    changed = False
    for row in stuck:
        stamp = row.updated_at or row.created_at
        if stamp is not None and getattr(stamp, "tzinfo", None) is not None:
            stamp = stamp.replace(tzinfo=None)
        if stamp is not None and stamp >= cutoff:
            continue
        row.status = "retry" if (row.attempts or 0) < 3 else "dead_letter"
        if not row.last_error:
            row.last_error = "Processing timed out and was queued again."
        changed = True
    if changed:
        db.commit()

    for _ in range(5):
        db.expire_all()
        job = (
            db.query(ProcessingJob)
            .filter(ProcessingJob.status.in_(["queued", "retry"]))
            .order_by(ProcessingJob.created_at.asc())
            .first()
        )
        if not job:
            return None
        job_id = job.id
        claimed = db.execute(
            update(ProcessingJob)
            .where(ProcessingJob.id == job_id, ProcessingJob.status.in_(["queued", "retry"]))
            .values(status="processing", attempts=ProcessingJob.attempts + 1)
        )
        db.commit()
        if claimed.rowcount == 1:
            return db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    return None
