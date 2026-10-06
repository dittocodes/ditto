"""Living report create/merge/snapshot."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.student_platform import LivingReport, ReportSnapshot, ReviewQueueItem
from app.services.gemini_gateway import generate_json


def get_report(db: Session, uid: str, report_type: str) -> LivingReport | None:
    return (
        db.query(LivingReport)
        .filter(LivingReport.uid == uid, LivingReport.report_type == report_type)
        .first()
    )


def _enqueue_conflicts(
    db: Session,
    *,
    uid: str,
    job_id: str | None,
    existing: dict[str, Any],
    delta: dict[str, Any],
) -> dict[str, Any]:
    """Strip conflicting keys from delta and queue mentor/admin review."""
    safe_delta = dict(delta)
    for key, new_val in list(delta.items()):
        old_val = (existing or {}).get(key)
        if old_val is not None and old_val != new_val:
            db.add(
                ReviewQueueItem(
                    uid=uid,
                    job_id=job_id,
                    field_path=key,
                    old_value=old_val if isinstance(old_val, (dict, list)) else {"value": old_val},
                    new_value=new_val if isinstance(new_val, (dict, list)) else {"value": new_val},
                    status="pending",
                )
            )
            safe_delta.pop(key, None)
    return safe_delta


def merge_delta(
    db: Session,
    *,
    uid: str,
    report_type: str,
    delta: dict[str, Any],
    narrative_hint: str = "",
    job_id: str | None = None,
    model: bool = True,
) -> LivingReport:
    row = get_report(db, uid, report_type)
    existing = row.structured_state if row else {}
    delta = _enqueue_conflicts(db, uid=uid, job_id=job_id, existing=existing or {}, delta=delta)
    if model:
        prompt = (
            "Merge this JSON delta into the existing living report. "
            "Return JSON with keys structured_state (object) and narrative (string). "
            f"Existing: {json.dumps(existing)[:8000]}\nDelta: {json.dumps(delta)[:8000]}\n"
            f"Hint: {narrative_hint}"
        )
        try:
            merged = generate_json(prompt)
            structured = merged.get("structured_state", {**(existing or {}), **delta})
            narrative = merged.get("narrative", narrative_hint)
        except Exception:
            structured = {**(existing or {}), **delta}
            narrative = narrative_hint or (row.narrative if row else "")
    else:
        structured = {**(existing or {}), **delta}
        narrative = (row.narrative if row and row.narrative else "") or narrative_hint

    if not row:
        row = LivingReport(uid=uid, report_type=report_type, structured_state=structured, narrative=narrative, version=1)
        db.add(row)
    else:
        row.structured_state = structured
        row.narrative = narrative
        row.version = (row.version or 1) + 1

    db.commit()
    db.refresh(row)
    snap = ReportSnapshot(
        living_report_id=row.id,
        version=row.version,
        snapshot_json=structured,
    )
    db.add(snap)
    db.commit()
    return row


def write_report_keys(
    db: Session,
    *,
    uid: str,
    report_type: str,
    keys: dict[str, Any],
    narrative: str | None = None,
) -> LivingReport:
    """Replace named keys without sending conflicts to review."""
    row = get_report(db, uid, report_type)
    structured = dict(row.structured_state or {}) if row else {}
    structured.update(keys)
    if row and narrative is None:
        narrative_out = row.narrative or ""
    else:
        narrative_out = narrative or ""
    if not row:
        row = LivingReport(
            uid=uid,
            report_type=report_type,
            structured_state=structured,
            narrative=narrative_out,
            version=1,
        )
        db.add(row)
    else:
        row.structured_state = structured
        if narrative is not None:
            row.narrative = narrative_out
        row.version = (row.version or 1) + 1
    db.commit()
    db.refresh(row)
    db.add(
        ReportSnapshot(
            living_report_id=row.id,
            version=row.version,
            snapshot_json=structured,
        )
    )
    db.commit()
    return row


def upsert_living_report(
    db: Session,
    *,
    uid: str,
    report_type: str,
    delta: dict[str, Any],
    narrative_hint: str = "",
) -> LivingReport:
    """Shallow-merge delta into living report without Gemini (seeds, admin tools)."""
    row = get_report(db, uid, report_type)
    existing = dict(row.structured_state or {}) if row else {}
    structured = {**existing, **delta}
    narrative = narrative_hint or (row.narrative if row else "")
    if not row:
        row = LivingReport(
            uid=uid,
            report_type=report_type,
            structured_state=structured,
            narrative=narrative,
            version=1,
        )
        db.add(row)
    else:
        row.structured_state = structured
        row.narrative = narrative
        row.version = (row.version or 1) + 1
    db.flush()
    db.add(
        ReportSnapshot(
            living_report_id=row.id,
            version=row.version,
            snapshot_json=structured,
        )
    )
    db.commit()
    db.refresh(row)
    return row
