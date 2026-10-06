"""Mentor workspace: live mentee data, chat, attendance, and profile documents."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytz
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_mentor, get_current_student
from app.db.database import get_db
from app.db.models.attendance import Attendance, AttendanceSession
from app.db.models.meetings import Meetings
from app.db.models.mentor_platform import MentorKnowledgeItem, MentorMessage, MentorProfile
from app.db.models.mentors import Mentor
from app.db.models.student_platform import LivingReport, StudentActivityV2, StudentKnowledgeItem
from app.db.models.students import Student
from app.services.activity_api import activity_to_api
from app.services.mentor_profile_docs import apply_mentor_extract, read_mentor_document
from app.services.mentor_stats import build_mentor_statistics, design_activity, store_status, store_term

router = APIRouter()

_ROOT = Path(__file__).resolve().parents[2]
_STORE = _ROOT / "uploads" / "mentor_docs"
_GROUPS = {"certificate", "academic", "career", "activity", "uncategorised"}


class ActivityIn(BaseModel):
    student_usn: str
    title: str
    description: str | None = None
    category: str | None = None
    term: str | None = None
    due_date: str | None = None
    status: str | None = None
    mentor_remarks: str | None = None


class ActivityPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    term: str | None = None
    due_date: str | None = None
    status: str | None = None
    progress_pct: int | None = None
    mentor_remarks: str | None = None


class MeetingIn(BaseModel):
    student_usns: list[str]
    meeting_date: str
    venue: str
    agenda: str | None = None
    meeting_mode: str = "offline"
    duration: int | None = None


class MeetingPatch(BaseModel):
    status: str | None = None
    meeting_date: str | None = None


class SessionIn(BaseModel):
    session_name: str
    location: str | None = None


class MarkIn(BaseModel):
    session_id: str
    student_usn: str
    status: str
    method: str | None = None


class MessageIn(BaseModel):
    content: str


class ProfileIn(BaseModel):
    title: str | None = None
    bio: str | None = None
    location: str | None = None
    institution: str | None = None
    expertise: list[str] | None = None
    education: list[dict] | None = None
    awards: list[dict] | None = None
    experience: list[dict] | None = None
    publications: list | None = None


class CategoryIn(BaseModel):
    doc_group: str | None = None
    category: str | None = None


def _mentor_id(current: dict) -> str:
    return current["mentor_id"]


def _assigned(db: Session, mentor_id: str) -> list[Student]:
    return (
        db.query(Student)
        .filter(Student.assigned_mentor == mentor_id)
        .order_by(Student.student_name.asc())
        .all()
    )


def _require_student(db: Session, mentor_id: str, usn: str) -> Student:
    student = db.query(Student).filter(Student.student_usn == usn).first()
    if not student or student.assigned_mentor != mentor_id:
        raise HTTPException(status_code=403, detail="That student is not assigned to you")
    return student


def _score(db: Session, uid: str | None) -> float | None:
    if not uid:
        return None
    report = (
        db.query(LivingReport)
        .filter(LivingReport.uid == uid, LivingReport.report_type == "tracker_dashboard")
        .first()
    )
    state = report.structured_state if report else None
    if not isinstance(state, dict):
        return None
    breakdown = state.get("score_breakdown")
    if isinstance(breakdown, dict) and isinstance(breakdown.get("overall"), (int, float)):
        return float(breakdown["overall"])
    raw = state.get("performance_score")
    if isinstance(raw, (int, float)):
        return float(raw)
    return None


def _profile_row(db: Session, mentor_id: str) -> MentorProfile:
    row = db.query(MentorProfile).filter(MentorProfile.mentor_id == mentor_id).first()
    if row is None:
        row = MentorProfile(mentor_id=mentor_id, expertise=[], education=[], awards=[], experience=[], publications=[])
        db.add(row)
        db.flush()
    return row


def _profile_out(mentor: Mentor, row: MentorProfile) -> dict:
    return {
        "id": mentor.mentor_id,
        "name": mentor.mentor_name,
        "department": mentor.mentor_department,
        "email": mentor.mentor_email,
        "phone": mentor.mentor_phoneno,
        "title": row.title or "",
        "bio": row.bio or "",
        "location": row.location or "",
        "institution": row.institution or "",
        "expertise": row.expertise or [],
        "education": row.education or [],
        "awards": row.awards or [],
        "experience": row.experience or [],
        "publications": row.publications or [],
    }


def _student_card(db: Session, student: Student) -> dict:
    docs = 0
    activity_count = 0
    if student.uid:
        docs = db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.uid == student.uid).count()
        activity_count = db.query(StudentActivityV2).filter(StudentActivityV2.uid == student.uid).count()
    return {
        "usn": student.student_usn,
        "uid": student.uid,
        "name": student.student_name or student.student_usn,
        "program": student.student_program or "",
        "documents": docs,
        "activities": activity_count,
        "score": _score(db, student.uid),
    }


@router.get("/mentor/home")
def mentor_home(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    mentor = db.query(Mentor).filter(Mentor.mentor_id == mentor_id).first()
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    stats = build_mentor_statistics(db, mentor_id)
    stats["mentor_name"] = mentor.mentor_name
    return stats


def _names(db: Session, mentor_id: str) -> dict[str, str]:
    return {row.uid: row.student_name or row.student_usn for row in _assigned(db, mentor_id) if row.uid}


def _usn_by_uid(db: Session, mentor_id: str) -> dict[str, str]:
    return {row.uid: row.student_usn for row in _assigned(db, mentor_id) if row.uid}


def _activity_row(db: Session, row: StudentActivityV2, names: dict | None = None, usns: dict | None = None) -> dict:
    payload = activity_to_api(row)
    payload["student_name"] = (names or {}).get(row.uid) or ""
    payload["usn"] = (usns or {}).get(row.uid) or ""
    return payload


@router.get("/mentor/activities")
def list_mentor_activities(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    names = _names(db, mentor_id)
    usns = _usn_by_uid(db, mentor_id)
    if not names:
        return []
    rows = db.query(StudentActivityV2).filter(StudentActivityV2.uid.in_(list(names))).order_by(StudentActivityV2.id.desc()).all()
    return [
        design_activity(row, names.get(row.uid, ""), usns.get(row.uid, ""))
        for row in rows
        if (row.status or "").lower() != "requested"
    ]


def _request_out(row: StudentActivityV2, names: dict, usns: dict) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "description": row.description or "",
        "term": row.term or "",
        "student_name": names.get(row.uid) or "",
        "usn": usns.get(row.uid) or "",
    }


def _own_request(db: Session, mentor_id: str, activity_id: int) -> tuple[StudentActivityV2, Student]:
    row = db.query(StudentActivityV2).filter(StudentActivityV2.id == activity_id).first()
    if not row or (row.status or "").lower() != "requested":
        raise HTTPException(status_code=404, detail="Request not found")
    student = db.query(Student).filter(Student.uid == row.uid, Student.assigned_mentor == mentor_id).first()
    if not student:
        raise HTTPException(status_code=403, detail="That student is not assigned to you")
    return row, student


class RequestDecision(BaseModel):
    term: str | None = None
    due_date: str | None = None
    mentor_remarks: str | None = None


@router.get("/mentor/activity-requests")
def list_activity_requests(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    names = _names(db, mentor_id)
    usns = _usn_by_uid(db, mentor_id)
    if not names:
        return []
    rows = (
        db.query(StudentActivityV2)
        .filter(StudentActivityV2.uid.in_(list(names)), StudentActivityV2.status == "requested")
        .order_by(StudentActivityV2.id.desc())
        .all()
    )
    return [_request_out(row, names, usns) for row in rows]


@router.post("/mentor/activity-requests/{activity_id}/approve")
def approve_activity_request(
    activity_id: int,
    body: RequestDecision,
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    row, _student = _own_request(db, _mentor_id(current), activity_id)
    row.status = "pending"
    row.term = store_term(body.term) or row.term or "short-term"
    if body.due_date:
        try:
            row.due_date = datetime.fromisoformat(body.due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Use a valid due date")
    if body.mentor_remarks:
        row.mentor_remarks = body.mentor_remarks.strip()
    db.commit()
    return {"ok": True}


@router.post("/mentor/activity-requests/{activity_id}/reject")
def reject_activity_request(
    activity_id: int,
    body: RequestDecision,
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    row, _student = _own_request(db, _mentor_id(current), activity_id)
    row.status = "rejected"
    if body.mentor_remarks:
        row.mentor_remarks = body.mentor_remarks.strip()
    db.commit()
    return {"ok": True}


@router.post("/mentor/activities")
def create_activity(body: ActivityIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    student = _require_student(db, mentor_id, body.student_usn.strip())
    if not student.uid:
        raise HTTPException(status_code=400, detail="This student is not ready for activities yet")
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    due = None
    if body.due_date:
        try:
            due = datetime.fromisoformat(body.due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Use a valid due date")
    row = StudentActivityV2(
        uid=student.uid,
        title=title,
        description=(body.category or body.description or "").strip() or None,
        origin="mentor",
        status=store_status(body.status),
        term=store_term(body.term),
        due_date=due,
        mentor_remarks=(body.mentor_remarks or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _activity_row(db, row, {student.uid: student.student_name}, {student.uid: student.student_usn})


@router.patch("/mentor/activities/{activity_id}")
def patch_mentor_activity(
    activity_id: int,
    body: ActivityPatch,
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    mentor_id = _mentor_id(current)
    row = db.query(StudentActivityV2).filter(StudentActivityV2.id == activity_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    owner = db.query(Student).filter(Student.uid == row.uid, Student.assigned_mentor == mentor_id).first()
    if not owner:
        raise HTTPException(status_code=403, detail="That student is not assigned to you")
    if body.title:
        row.title = body.title.strip()
    if body.category or body.description:
        row.description = (body.category or body.description or "").strip() or None
    if body.term is not None:
        row.term = store_term(body.term)
    if body.due_date:
        try:
            row.due_date = datetime.fromisoformat(body.due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Use a valid due date")
    if body.status:
        row.status = store_status(body.status)
    if body.progress_pct is not None:
        row.progress_pct = max(0, min(100, body.progress_pct))
    if body.mentor_remarks is not None:
        row.mentor_remarks = body.mentor_remarks
    db.commit()
    return {"ok": True}


def _meeting_row(db: Session, row: Meetings) -> dict:
    student = db.query(Student).filter(Student.student_usn == row.student_usn).first()
    return {
        "id": row.srno,
        "meeting_id": row.id,
        "student_usn": row.student_usn,
        "student_name": (student.student_name if student else None) or row.student_usn,
        "title": row.agenda or "Mentor meeting",
        "meeting_date": row.meeting_date.isoformat() if row.meeting_date else None,
        "venue": row.venue,
        "status": row.status or "",
        "meeting_mode": row.meeting_mode or "offline",
        "duration": row.duration,
        "notes": row.progress_notes or "",
    }


@router.get("/mentor/meetings")
def list_mentor_meetings(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    rows = db.query(Meetings).filter(Meetings.mentor_id == mentor_id).order_by(Meetings.meeting_date.desc()).all()
    return [_meeting_row(db, row) for row in rows]


@router.post("/mentor/meetings")
def create_meeting(body: MeetingIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    if not body.student_usns:
        raise HTTPException(status_code=400, detail="Choose at least one mentee")
    try:
        when = datetime.fromisoformat(body.meeting_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Use a valid date and time")
    mode = (body.meeting_mode or "offline").lower()
    if mode not in ("online", "offline"):
        raise HTTPException(status_code=400, detail="Choose online or offline")
    venue = (body.venue or "").strip() or ("Online" if mode == "online" else "")
    if mode == "offline" and not venue:
        raise HTTPException(status_code=400, detail="Venue is required")
    created = []
    for usn in body.student_usns:
        _require_student(db, mentor_id, usn.strip())
        row = Meetings(
            id=str(uuid.uuid4()),
            mentor_id=mentor_id,
            student_usn=usn.strip(),
            meeting_date=when,
            venue=venue,
            agenda=(body.agenda or "").strip() or None,
            meeting_mode=mode,
            status="approved",
            duration=body.duration if body.duration and body.duration > 0 else None,
        )
        db.add(row)
        created.append(row)
    db.commit()
    return {"ok": True, "count": len(created)}


@router.patch("/mentor/meetings/{meeting_id}")
def patch_meeting(meeting_id: str, body: MeetingPatch, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    row = db.query(Meetings).filter(Meetings.id == meeting_id, Meetings.mentor_id == _mentor_id(current)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if body.meeting_date:
        try:
            row.meeting_date = datetime.fromisoformat(body.meeting_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Choose a valid date and time") from exc
    if body.status:
        status = body.status.strip().lower()
        if status in ("confirmed", "rescheduled", "pending"):
            status = "approved"
        if status not in ("approved", "completed", "cancelled"):
            raise HTTPException(status_code=400, detail="Choose approved, completed, or cancelled")
        row.status = status
    db.commit()
    return {"ok": True}


@router.get("/mentor/attendance")
def mentor_attendance(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    students = _assigned(db, mentor_id)
    sessions = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.mentor_id == mentor_id)
        .order_by(AttendanceSession.created_at.desc())
        .limit(30)
        .all()
    )
    marks = db.query(Attendance).filter(Attendance.mentor_id == mentor_id).all()
    by_session: dict[str, dict[str, dict]] = {}
    for mark in marks:
        by_session.setdefault(mark.session_id, {})[mark.student_usn] = {
            "status": mark.status,
            "method": mark.notes or "QR",
        }
    return {
        "students": [{"usn": row.student_usn, "name": row.student_name or row.student_usn} for row in students],
        "sessions": [
            {
                "session_id": row.session_id,
                "session_name": row.session_name or "Session",
                "location": row.location or "",
                "qr_code_data": row.qr_code_data,
                "is_active": bool(row.is_active),
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in sessions
        ],
        "marks": by_session,
    }


@router.post("/mentor/attendance/sessions")
def create_session(body: SessionIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    name = body.session_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Session name is required")
    session_id = uuid.uuid4().hex
    ist = pytz.timezone("Asia/Kolkata")
    expires = (datetime.now(ist) + timedelta(hours=4)).replace(tzinfo=None)
    payload = json.dumps({"session_id": session_id, "mentor_id": mentor_id, "expires_at": expires.isoformat(), "session_name": name})
    row = AttendanceSession(
        session_id=session_id,
        mentor_id=mentor_id,
        session_name=name,
        qr_code_data=payload,
        expires_at=expires,
        is_active=True,
        location=(body.location or "").strip() or None,
    )
    db.add(row)
    db.commit()
    return {"session_id": session_id, "qr_code_data": payload}


@router.post("/mentor/attendance/mark")
def mark_attendance(body: MarkIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    status = body.status.strip().lower()
    if status not in ("present", "absent", "unmarked"):
        raise HTTPException(status_code=400, detail="Choose present, absent, or unmarked")
    session = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.session_id == body.session_id, AttendanceSession.mentor_id == mentor_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _require_student(db, mentor_id, body.student_usn)
    existing = (
        db.query(Attendance)
        .filter(Attendance.session_id == body.session_id, Attendance.student_usn == body.student_usn)
        .first()
    )
    if status == "unmarked":
        if existing:
            db.delete(existing)
            db.commit()
        return {"ok": True}
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist).replace(tzinfo=None)
    if existing:
        existing.status = status
        existing.notes = None if (body.method or "").upper() == "QR" else "Manual"
        existing.marked_at = now
    else:
        db.add(
            Attendance(
                session_id=body.session_id,
                student_usn=body.student_usn,
                mentor_id=mentor_id,
                status=status,
                notes=None if (body.method or "").upper() == "QR" else "Manual",
                marked_at=now,
            )
        )
    db.commit()
    return {"ok": True}


def _messages(db: Session, mentor_id: str, usn: str) -> list[dict]:
    rows = (
        db.query(MentorMessage)
        .filter(MentorMessage.mentor_id == mentor_id, MentorMessage.student_usn == usn)
        .order_by(MentorMessage.id.asc())
        .all()
    )
    return [
        {
            "id": row.id,
            "sender": row.sender,
            "content": row.content,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.get("/mentor/messages")
def message_inbox(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    students = _assigned(db, mentor_id)
    inbox = []
    for student in students:
        last = (
            db.query(MentorMessage)
            .filter(MentorMessage.mentor_id == mentor_id, MentorMessage.student_usn == student.student_usn)
            .order_by(MentorMessage.id.desc())
            .first()
        )
        inbox.append(
            {
                "usn": student.student_usn,
                "name": student.student_name or student.student_usn,
                "preview": last.content if last else "",
            }
        )
    return inbox


@router.get("/mentor/messages/{student_usn}")
def message_thread(student_usn: str, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    student = _require_student(db, mentor_id, student_usn)
    return {"name": student.student_name or student.student_usn, "usn": student.student_usn, "messages": _messages(db, mentor_id, student_usn)}


@router.post("/mentor/messages/{student_usn}")
def send_mentor_message(
    student_usn: str,
    body: MessageIn,
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    mentor_id = _mentor_id(current)
    _require_student(db, mentor_id, student_usn)
    text = body.content.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Write a message first")
    db.add(MentorMessage(mentor_id=mentor_id, student_usn=student_usn, sender="mentor", content=text))
    db.commit()
    return {"ok": True}


@router.get("/students/me/mentor-chat")
def student_mentor_chat(current: dict = Depends(get_current_student), db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_usn == current["student_usn"]).first()
    if not student or not student.assigned_mentor:
        return {"mentor_name": "", "messages": []}
    mentor = db.query(Mentor).filter(Mentor.mentor_id == student.assigned_mentor).first()
    return {
        "mentor_name": mentor.mentor_name if mentor else student.assigned_mentor,
        "messages": _messages(db, student.assigned_mentor, student.student_usn),
    }


@router.post("/students/me/mentor-chat")
def student_send_mentor_chat(
    body: MessageIn,
    current: dict = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.student_usn == current["student_usn"]).first()
    if not student or not student.assigned_mentor:
        raise HTTPException(status_code=400, detail="No mentor is assigned yet")
    text = body.content.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Write a message first")
    db.add(MentorMessage(mentor_id=student.assigned_mentor, student_usn=student.student_usn, sender="student", content=text))
    db.commit()
    return {"ok": True}


@router.get("/mentor/profile")
def get_profile(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    mentor_id = _mentor_id(current)
    mentor = db.query(Mentor).filter(Mentor.mentor_id == mentor_id).first()
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    statistics = build_mentor_statistics(db, mentor_id)
    return {
        "profile": _profile_out(mentor, _profile_row(db, mentor_id)),
        "students": statistics["students"],
        "sessions": statistics["counts"]["meetings_total"],
        "average_score": statistics["counts"]["average_score"],
        "statistics": statistics,
    }


@router.patch("/mentor/profile")
def patch_profile(body: ProfileIn, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    row = _profile_row(db, _mentor_id(current))
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    return {"ok": True}


def _doc_out(row: MentorKnowledgeItem) -> dict:
    return {
        "id": row.id,
        "filename": row.filename,
        "doc_group": row.doc_group,
        "category": row.category,
        "category_source": row.category_source,
        "summary": row.summary,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _store_upload(mentor_id: str, filename: str, data: bytes) -> str:
    folder = _STORE / mentor_id
    folder.mkdir(parents=True, exist_ok=True)
    safe = Path(filename).name or "document"
    stored = f"{uuid.uuid4().hex}_{safe}"
    (folder / stored).write_bytes(data)
    return stored


def _mime_for(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    return "application/octet-stream"


@router.get("/mentor/documents")
def list_documents(current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    rows = (
        db.query(MentorKnowledgeItem)
        .filter(MentorKnowledgeItem.mentor_id == _mentor_id(current))
        .order_by(MentorKnowledgeItem.id.desc())
        .all()
    )
    return [_doc_out(row) for row in rows]


@router.post("/mentor/documents")
async def upload_documents(
    files: list[UploadFile] = File(...),
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    mentor_id = _mentor_id(current)
    saved = []
    for upload in files:
        data = await upload.read()
        if not data:
            continue
        if len(data) > 8_000_000:
            raise HTTPException(status_code=400, detail=f"{upload.filename or 'File'} is larger than 8 MB")
        filename = Path(upload.filename or "document").name
        existing = (
            db.query(MentorKnowledgeItem)
            .filter(MentorKnowledgeItem.mentor_id == mentor_id, MentorKnowledgeItem.filename == filename)
            .first()
        )
        if existing and existing.stored_name:
            old = _STORE / mentor_id / existing.stored_name
            if old.exists():
                old.unlink()
        stored = _store_upload(mentor_id, filename, data)
        mime = upload.content_type or _mime_for(filename)
        extracted = read_mentor_document(data, mime.split(";")[0].strip().lower())
        group = str(extracted.get("group") or "uncategorised").lower()
        if group not in _GROUPS:
            group = "uncategorised"
        summary = str(extracted.get("summary") or "").strip() or None
        status = "added" if extracted else "stored"
        if existing and existing.category_source == "user":
            group = existing.doc_group
        if existing:
            existing.stored_name = stored
            existing.summary = summary
            existing.status = status
            existing.extracted = extracted or None
            if existing.category_source != "user":
                existing.doc_group = group
                existing.category = str(extracted.get("category") or group)
            row = existing
        else:
            row = MentorKnowledgeItem(
                mentor_id=mentor_id,
                filename=filename,
                stored_name=stored,
                doc_group=group,
                category=str(extracted.get("category") or group),
                category_source="model",
                summary=summary,
                status=status,
                extracted=extracted or None,
            )
            db.add(row)
        if extracted:
            apply_mentor_extract(db, mentor_id, extracted)
        saved.append(row)
    db.commit()
    return {"count": len(saved)}


@router.patch("/mentor/documents/{item_id}")
def recategorise(
    item_id: int,
    body: CategoryIn,
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    row = db.query(MentorKnowledgeItem).filter(MentorKnowledgeItem.id == item_id, MentorKnowledgeItem.mentor_id == _mentor_id(current)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    if body.doc_group:
        group = body.doc_group.strip().lower()
        if group not in _GROUPS:
            raise HTTPException(status_code=400, detail="Choose a document group")
        row.doc_group = group
    if body.category is not None:
        row.category = body.category.strip() or row.doc_group
    row.category_source = "user"
    db.commit()
    return {"ok": True}


@router.get("/mentor/documents/{item_id}/file")
def download_document(item_id: int, current: dict = Depends(get_current_mentor), db: Session = Depends(get_db)):
    row = db.query(MentorKnowledgeItem).filter(MentorKnowledgeItem.id == item_id, MentorKnowledgeItem.mentor_id == _mentor_id(current)).first()
    if not row or not row.stored_name:
        raise HTTPException(status_code=404, detail="Document not found")
    path = _STORE / _mentor_id(current) / row.stored_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="File is missing")
    return FileResponse(path, filename=row.filename or row.stored_name)
