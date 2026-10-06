"""Campus hub: announcements, events, RSVP, attendance, and blogs."""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_current_mentor, get_current_student
from app.db.database import get_db
from app.db.models.campus_portal import (
    CampusAnnouncement,
    CampusEvent,
    EventAttendance,
    EventRSVP,
    StudentBlog,
)
from app.db.models.mentors import Mentor
from app.db.models.student_platform import SwotEntry
from app.db.models.students import Student
from app.services.campus_sync import mark_and_sync
from app.services.demo_utils import is_sample_account
from app.services.livekit_service import create_join_token
from app.data.demo_personas import SAMPLE_ACCOUNT_USNS

router = APIRouter()

_ROLES = {"admin", "dept_head", "mentor"}
_TYPES = {"online", "offline"}
_VISIBILITY = {"caseload_only", "campus_wide"}
_SAMPLE_VISIBILITY = "sample_accounts"
_SAMPLE_MENTORS = {"DEMO-MENTOR", "MENTOR-SAMPLE-001"}
_MARKS = {"present", "absent"}
_JOIN_LEAD = timedelta(minutes=10)


class AnnouncementIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    author_role: str = "mentor"
    is_pinned: bool = False


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    event_type: str = "offline"
    location_details: str = ""
    visibility: str = "caseload_only"
    scheduled_at: str
    linked_skills: list[str] = Field(default_factory=list)


class RsvpIn(BaseModel):
    attending: bool = True


class MarkIn(BaseModel):
    student_uid: str = ""
    code: str = ""
    status: str = "present"


class BlogIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=4000)


def _parse_when(value: str) -> datetime:
    text = (value or "").strip().replace("Z", "")
    if "+" in text[10:]:
        text = text.split("+", 1)[0]
    try:
        return datetime.fromisoformat(text[:19])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Enter a valid start time") from exc


def _student(db: Session, current: dict) -> Student:
    student = db.query(Student).filter(Student.student_usn == current["student_usn"]).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.uid:
        from app.services.uid_registry import ensure_student_uid

        student.uid = ensure_student_uid(db, student.student_usn)
    return student


def _visible(event: CampusEvent, student: Student) -> bool:
    if event.visibility == "campus_wide":
        return True
    if event.visibility == _SAMPLE_VISIBILITY:
        return is_sample_account(student.student_usn)
    return bool(student.assigned_mentor) and event.creator_id == student.assigned_mentor


def _join_open(event: CampusEvent, now: datetime | None = None) -> bool:
    if event.event_type != "online" or event.status == "ended" or not event.scheduled_at:
        return False
    current = now or datetime.now()
    start = event.scheduled_at
    if getattr(start, "tzinfo", None) is not None:
        start = start.replace(tzinfo=None)
    return current >= start - _JOIN_LEAD


def _room_name(event: CampusEvent) -> str:
    place = (event.location_details or "").strip()
    return place or f"campus-event-{event.id}"


def _host_names(db: Session, events: list[CampusEvent]) -> dict[str, str]:
    ids = {event.creator_id for event in events if event.creator_role == "mentor"}
    if not ids:
        return {}
    rows = db.query(Mentor).filter(Mentor.mentor_id.in_(ids)).all()
    return {row.mentor_id: row.mentor_name for row in rows}


def _event_out(
    event: CampusEvent,
    host: str,
    student: Student | None,
    rsvp: EventRSVP | None,
    mark: EventAttendance | None,
    swot_match: bool = False,
    attending_count: int = 0,
) -> dict:
    when = event.scheduled_at.isoformat(sep=" ", timespec="minutes") if event.scheduled_at else ""
    created = event.created_at.isoformat(sep=" ", timespec="minutes") if event.created_at else when
    attending = bool(rsvp and rsvp.status == "attending")
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description or "",
        "event_type": event.event_type,
        "location": event.location_details or "",
        "visibility": event.visibility,
        "scheduled_at": when,
        "created_at": created,
        "skills": event.linked_skills or [],
        "status": event.status,
        "host": host or event.creator_id,
        "rsvp": attending,
        "joined": bool(rsvp and rsvp.joined_at),
        "attendance": mark.status if mark else "",
        "join_open": _join_open(event),
        "qr_value": student.uid if student and attending and event.event_type == "offline" else "",
        "swot_match": swot_match,
        "attending_count": attending_count,
    }


def _attending_counts(db: Session, event_ids: list[int]) -> dict[int, int]:
    if not event_ids:
        return {}
    rows = (
        db.query(EventRSVP.event_id, func.count(EventRSVP.id))
        .filter(EventRSVP.event_id.in_(event_ids), EventRSVP.status == "attending")
        .group_by(EventRSVP.event_id)
        .all()
    )
    return {event_id: int(count) for event_id, count in rows}


def _author_name(row: CampusAnnouncement, mentor_names: dict[str, str]) -> str:
    if row.author_role == "mentor":
        return mentor_names.get(row.author_id) or "Mentor"
    if row.author_role == "dept_head":
        return "Department"
    if row.author_role == "admin":
        return "Admin"
    return "Campus"


def _names(db: Session, uids: set[str]) -> dict[str, str]:
    if not uids:
        return {}
    rows = db.query(Student).filter(Student.uid.in_(uids)).all()
    return {row.uid: row.student_name or row.student_usn for row in rows}


def _matches_gap(skills: list, gap_text: str) -> bool:
    if not gap_text:
        return False
    for skill in skills or []:
        name = str(skill or "").strip().lower()
        if name and name in gap_text:
            return True
    return False


def _blog_out(row: StudentBlog, fallback_author: str, viewer_uid: str) -> dict:
    text = row.content or ""
    author = fallback_author
    body = text
    if text.startswith("By "):
        first, _, rest = text.partition("\n")
        author = first[3:].strip() or fallback_author
        body = rest.strip()
    return {
        "id": row.id,
        "title": row.title,
        "content": body,
        "author": author,
        "published_at": row.published_at.isoformat(sep=" ", timespec="minutes") if row.published_at else "",
        "mine": row.student_uid == viewer_uid,
    }


@router.get("/campus/feed")
def campus_feed(current: dict = Depends(get_current_student), db: Session = Depends(get_db)):
    student = _student(db, current)
    sample = is_sample_account(student.student_usn)
    notes = db.query(CampusAnnouncement).order_by(CampusAnnouncement.id.desc()).all()
    if not sample:
        notes = [row for row in notes if not str(row.author_id or "").startswith("SAMPLE-")]
    notes.sort(key=lambda row: (not bool(row.is_pinned), -(row.created_at.timestamp() if row.created_at else 0), -(row.id or 0)))
    events = db.query(CampusEvent).order_by(CampusEvent.scheduled_at.asc()).all()
    visible = [event for event in events if _visible(event, student)]
    hosts = _host_names(db, visible)
    swot = db.query(SwotEntry).filter(SwotEntry.uid == student.uid).first()
    gap_text = " ".join(str(item) for item in ((swot.weaknesses if swot else None) or [])).lower()
    rsvps = {
        row.event_id: row
        for row in db.query(EventRSVP).filter(EventRSVP.student_uid == student.uid).all()
    }
    marks = {
        row.event_id: row
        for row in db.query(EventAttendance).filter(EventAttendance.student_uid == student.uid).all()
    }
    blogs = db.query(StudentBlog).order_by(StudentBlog.id.desc()).limit(50).all()
    if not sample:
        author_rows = db.query(Student).filter(Student.uid.in_({row.student_uid for row in blogs})).all() if blogs else []
        sample_uids = {row.uid for row in author_rows if is_sample_account(row.student_usn)}
        blogs = [row for row in blogs if row.student_uid not in sample_uids]
    authors = _names(db, {row.student_uid for row in blogs})
    mentor_ids = {row.author_id for row in notes if row.author_role == "mentor" and row.author_id}
    mentor_names = {}
    if mentor_ids:
        mentor_names = {
            row.mentor_id: row.mentor_name
            for row in db.query(Mentor).filter(Mentor.mentor_id.in_(mentor_ids)).all()
            if row.mentor_name
        }
    counts = _attending_counts(db, [event.id for event in visible])
    return {
        "announcements": [
            {
                "id": row.id,
                "author_role": row.author_role,
                "author_id": row.author_id,
                "author_name": _author_name(row, mentor_names),
                "content": row.content,
                "is_pinned": bool(row.is_pinned),
                "created_at": row.created_at.isoformat(sep=" ", timespec="minutes") if row.created_at else "",
            }
            for row in notes
        ],
        "events": [
            _event_out(
                event,
                hosts.get(event.creator_id, event.creator_id),
                student,
                rsvps.get(event.id),
                marks.get(event.id),
                _matches_gap(event.linked_skills or [], gap_text),
                counts.get(event.id, 0),
            )
            for event in visible
        ],
        "blogs": [_blog_out(row, authors.get(row.student_uid, "Student"), student.uid) for row in blogs],
    }


@router.post("/campus/events/{event_id}/rsvp")
def rsvp_event(event_id: int, body: RsvpIn, current: dict = Depends(get_current_student), db: Session = Depends(get_db)):
    student = _student(db, current)
    event = db.query(CampusEvent).filter(CampusEvent.id == event_id).first()
    if not event or not _visible(event, student):
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status == "ended":
        raise HTTPException(status_code=400, detail="This event has ended")
    row = (
        db.query(EventRSVP)
        .filter(EventRSVP.event_id == event.id, EventRSVP.student_uid == student.uid)
        .first()
    )
    if not body.attending:
        if row:
            db.delete(row)
            db.commit()
        return {"ok": True, "attending": False}
    if row is None:
        row = EventRSVP(event_id=event.id, student_uid=student.uid, status="attending")
        db.add(row)
    else:
        row.status = "attending"
    db.commit()
    return {"ok": True, "attending": True, "qr_value": student.uid if event.event_type == "offline" else ""}


@router.post("/campus/events/{event_id}/join")
def join_event(event_id: int, current: dict = Depends(get_current_student), db: Session = Depends(get_db)):
    student = _student(db, current)
    event = db.query(CampusEvent).filter(CampusEvent.id == event_id).first()
    if not event or not _visible(event, student):
        raise HTTPException(status_code=404, detail="Event not found")
    if event.event_type != "online":
        raise HTTPException(status_code=400, detail="This event is in person")
    if not _join_open(event):
        raise HTTPException(status_code=400, detail="Join opens 10 minutes before the start")
    row = (
        db.query(EventRSVP)
        .filter(EventRSVP.event_id == event.id, EventRSVP.student_uid == student.uid)
        .first()
    )
    if row is None:
        row = EventRSVP(event_id=event.id, student_uid=student.uid, status="attending")
        db.add(row)
    row.status = "attending"
    row.joined_at = datetime.now()
    if event.status == "scheduled":
        event.status = "live"
    db.commit()
    room = _room_name(event)
    token = create_join_token(room_name=room, participant_identity=student.uid)
    configured = token not in {"livekit-not-configured", "livekit-token-error"}
    return {
        "ok": True,
        "room": room,
        "configured": configured,
        "token": token if configured else "",
        "url": os.getenv("LIVEKIT_URL", "") if configured else "",
    }


@router.post("/campus/blogs")
def publish_blog(body: BlogIn, current: dict = Depends(get_current_student), db: Session = Depends(get_db)):
    student = _student(db, current)
    row = StudentBlog(student_uid=student.uid, title=body.title.strip(), content=body.content.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "ok": True}


def _save_announcement(db: Session, author_id: str, body: AnnouncementIn) -> CampusAnnouncement:
    role = body.author_role if body.author_role in _ROLES else "mentor"
    row = CampusAnnouncement(
        author_id=author_id,
        author_role=role,
        content=body.content.strip(),
        is_pinned=bool(body.is_pinned),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/admin/campus/announcements")
def admin_announcement(body: AnnouncementIn, current: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    row = _save_announcement(db, current["admin_id"], body)
    return {"id": row.id, "ok": True}


@router.get("/admin/campus/announcements")
def admin_announcements(_admin: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = db.query(CampusAnnouncement).order_by(CampusAnnouncement.id.desc()).limit(40).all()
    return [
        {
            "id": row.id,
            "author_role": row.author_role,
            "content": row.content,
            "is_pinned": bool(row.is_pinned),
            "created_at": row.created_at.isoformat(sep=" ", timespec="minutes") if row.created_at else "",
        }
        for row in rows
    ]


def _own_event(db: Session, mentor_id: str, event_id: int) -> CampusEvent:
    event = db.query(CampusEvent).filter(CampusEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.creator_id == mentor_id:
        return event
    if event.visibility == _SAMPLE_VISIBILITY and mentor_id in _SAMPLE_MENTORS:
        return event
    raise HTTPException(status_code=404, detail="Event not found")


def _find_student(db: Session, code: str) -> Student | None:
    text = (code or "").strip()
    if not text:
        return None
    row = db.query(Student).filter(Student.uid == text).first()
    if row:
        return row
    return db.query(Student).filter(Student.student_usn == text).first()


@router.get("/mentor/campus/events")
def mentor_events(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = current["mentor_id"]
    query = db.query(CampusEvent).filter(CampusEvent.creator_id == mentor_id)
    if mentor_id in _SAMPLE_MENTORS:
        query = db.query(CampusEvent).filter(
            or_(CampusEvent.creator_id == mentor_id, CampusEvent.visibility == _SAMPLE_VISIBILITY)
        )
    rows = query.order_by(CampusEvent.scheduled_at.desc()).all()
    return [_event_out(row, mentor_id, None, None, None) for row in rows]


@router.post("/mentor/campus/events")
def create_event(body: EventIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    if body.event_type not in _TYPES:
        raise HTTPException(status_code=400, detail="Choose online or offline")
    if body.visibility not in _VISIBILITY:
        raise HTTPException(status_code=400, detail="Choose a caseload or the whole campus")
    skills = []
    for name in body.linked_skills:
        text = str(name or "").strip()
        if text and text not in skills:
            skills.append(text[:80])
    event = CampusEvent(
        creator_id=current["mentor_id"],
        creator_role="mentor",
        title=body.title.strip(),
        description=(body.description or "").strip(),
        event_type=body.event_type,
        location_details=(body.location_details or "").strip(),
        visibility=body.visibility,
        scheduled_at=_parse_when(body.scheduled_at),
        linked_skills=skills,
        status="scheduled",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    if event.event_type == "online" and not event.location_details:
        event.location_details = f"campus-event-{event.id}"
        db.commit()
    return {"id": event.id, "ok": True}


@router.get("/mentor/campus/events/{event_id}/roster")
def event_roster(event_id: int, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    event = _own_event(db, current["mentor_id"], event_id)
    if event.visibility == "caseload_only":
        people = (
            db.query(Student)
            .filter(Student.assigned_mentor == current["mentor_id"])
            .order_by(Student.student_name.asc())
            .all()
        )
    elif event.visibility == _SAMPLE_VISIBILITY:
        people = (
            db.query(Student)
            .filter(Student.student_usn.in_(SAMPLE_ACCOUNT_USNS))
            .order_by(Student.student_name.asc())
            .all()
        )
    else:
        rsvp_uids = [row.student_uid for row in db.query(EventRSVP).filter(EventRSVP.event_id == event.id).all()]
        people = db.query(Student).filter(Student.uid.in_(rsvp_uids)).all() if rsvp_uids else []
    rsvps = {row.student_uid: row for row in db.query(EventRSVP).filter(EventRSVP.event_id == event.id).all()}
    marks = {row.student_uid: row for row in db.query(EventAttendance).filter(EventAttendance.event_id == event.id).all()}
    return {
        "event": _event_out(event, current["mentor_id"], None, None, None),
        "students": [
            {
                "uid": person.uid,
                "usn": person.student_usn,
                "name": person.student_name or person.student_usn,
                "rsvp": bool(rsvps.get(person.uid) and rsvps[person.uid].status == "attending"),
                "joined": bool(rsvps.get(person.uid) and rsvps[person.uid].joined_at),
                "attendance": marks[person.uid].status if person.uid in marks else "",
            }
            for person in people
            if person.uid
        ],
    }


@router.post("/mentor/campus/events/{event_id}/attendance")
def mark_attendance(event_id: int, body: MarkIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    event = _own_event(db, current["mentor_id"], event_id)
    if body.status not in _MARKS:
        raise HTTPException(status_code=400, detail="Mark present or absent")
    student = _find_student(db, body.student_uid or body.code)
    if not student or not student.uid:
        raise HTTPException(status_code=404, detail="Student not found")
    if event.visibility == _SAMPLE_VISIBILITY and not is_sample_account(student.student_usn):
        raise HTTPException(status_code=403, detail="That student is not on this event")
    if event.visibility == "caseload_only" and student.assigned_mentor != current["mentor_id"]:
        raise HTTPException(status_code=403, detail="That student is not on this caseload")
    mark_and_sync(db, event, student, body.status, current["mentor_id"])
    if body.status != "present":
        db.commit()
    return {"ok": True, "status": body.status, "student_uid": student.uid}


@router.post("/mentor/campus/events/{event_id}/end")
def end_event(event_id: int, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    event = _own_event(db, current["mentor_id"], event_id)
    joined = (
        db.query(EventRSVP)
        .filter(EventRSVP.event_id == event.id, EventRSVP.joined_at.isnot(None))
        .all()
    )
    present = 0
    for rsvp in joined:
        existing = (
            db.query(EventAttendance)
            .filter(EventAttendance.event_id == event.id, EventAttendance.student_uid == rsvp.student_uid)
            .first()
        )
        if existing and existing.status == "absent":
            continue
        student = db.query(Student).filter(Student.uid == rsvp.student_uid).first()
        if not student:
            continue
        mark_and_sync(db, event, student, "present", current["mentor_id"])
        present += 1
    event.status = "ended"
    db.commit()
    return {"ok": True, "present": present}


@router.post("/mentor/campus/announcements")
def mentor_announcement(body: AnnouncementIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    row = _save_announcement(db, current["mentor_id"], body)
    return {"id": row.id, "ok": True}
