"""Write hosted-event attendance onto the student record without a document upload."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models.campus_portal import CampusEvent, EventAttendance
from app.db.models.student_platform import CampusActivity
from app.db.models.students import Student
from app.services.insight_cache import invalidate_uid
from app.services.living_report_service import get_report, merge_delta, write_report_keys


def _skills(event: CampusEvent) -> list[str]:
    raw = event.linked_skills or []
    names: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            text = str(item or "").strip()
            if text and text not in names:
                names.append(text[:80])
    return names


def _event_date(event: CampusEvent) -> str:
    if not event.scheduled_at:
        return ""
    return event.scheduled_at.date().isoformat()


def sync_student_attendance(db: Session, event: CampusEvent, student: Student) -> None:
    if not student.uid:
        return
    ref = f"event-{event.id}"
    existing = (
        db.query(CampusActivity)
        .filter(CampusActivity.uid == student.uid, CampusActivity.evidence_ref == ref)
        .first()
    )
    when = _event_date(event)
    if existing is None:
        db.add(
            CampusActivity(
                uid=student.uid,
                event_name=event.title,
                role="Attendee",
                record_date=when,
                evidence_ref=ref,
                verified_bool=True,
            )
        )
    skills = _skills(event)
    report = get_report(db, student.uid, "campus_report")
    state = dict(report.structured_state or {}) if report and isinstance(report.structured_state, dict) else {}
    raw_events = state.get("events")
    events = [item for item in raw_events if isinstance(item, dict)] if isinstance(raw_events, list) else []
    if not any(item.get("event_id") == event.id for item in events):
        events.append({"event_id": event.id, "title": event.title, "date": when, "skills": skills})
    raw_skills = state.get("skills")
    stored_skills = [str(item) for item in raw_skills if str(item).strip()] if isinstance(raw_skills, list) else []
    for name in skills:
        if name not in stored_skills:
            stored_skills.append(name)
    _merge_keys(
        db,
        student.uid,
        "campus_report",
        {"events": events, "skills": stored_skills},
        event.title,
    )
    dashboard = get_report(db, student.uid, "tracker_dashboard")
    dash = dict(dashboard.structured_state or {}) if dashboard and isinstance(dashboard.structured_state, dict) else {}
    raw_attained = dash.get("attained_skills")
    attained = [item for item in raw_attained if isinstance(item, dict)] if isinstance(raw_attained, list) else []
    known = {str(item.get("name") or "") for item in attained}
    for name in skills:
        if name not in known:
            attained.append({"name": name, "certificate": event.title, "completed_on": when})
            known.add(name)
    if skills:
        _merge_keys(db, student.uid, "tracker_dashboard", {"attained_skills": attained}, event.title)
    invalidate_uid(student.uid)


def _merge_keys(db: Session, uid: str, report_type: str, delta: dict, hint: str) -> None:
    row = merge_delta(
        db,
        uid=uid,
        report_type=report_type,
        delta=delta,
        narrative_hint=hint,
        model=False,
    )
    state = row.structured_state if isinstance(row.structured_state, dict) else {}
    missing = {key: value for key, value in delta.items() if state.get(key) != value}
    if missing:
        write_report_keys(db, uid=uid, report_type=report_type, keys=missing, narrative=hint)


def mark_and_sync(
    db: Session,
    event: CampusEvent,
    student: Student,
    status: str,
    verified_by: str,
) -> EventAttendance:
    now = datetime.now()
    row = (
        db.query(EventAttendance)
        .filter(EventAttendance.event_id == event.id, EventAttendance.student_uid == student.uid)
        .first()
    )
    if row is None:
        row = EventAttendance(event_id=event.id, student_uid=student.uid)
        db.add(row)
    row.status = status
    row.verified_by = verified_by
    row.verified_at = now
    if status == "present":
        sync_student_attendance(db, event, student)
    return row
