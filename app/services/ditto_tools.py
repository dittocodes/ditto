"""Ditto tool registry. Writes become proposals. Identity comes from the session, not the model."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.campus_portal import CampusEvent, EventRSVP
from app.db.models.ditto_actions import ChatActionProposal
from app.db.models.meetings import Meetings
from app.db.models.mentor_platform import MentorMessage
from app.db.models.mentors import Mentor
from app.db.models.student_platform import AcademicRecord, StudentActivityV2, StudentKnowledgeItem
from app.db.models.students import Student
from app.services.gemini_gateway import generate_text, generate_with_tools
from app.services.living_report_service import get_report
from app.services.mentor_stats import build_mentor_statistics, store_term

_FORBIDDEN = {"uid", "student_uid", "mentor_id", "student_usn", "usn", "id"}
_PROPOSAL_MINUTES = 30
_GROUPS = {"academic", "career", "certificate", "activity"}


def _schema(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        "name": name,
        "description": description,
        "parameters": {"type": "OBJECT", "properties": properties, "required": required},
    }


def _string(description: str) -> dict:
    return {"type": "STRING", "description": description}


_TOOLS: dict[str, dict] = {
    "fetch_upcoming_events": {
        "role": "student",
        "kind": "read",
        "title": "Upcoming events",
        "schema": _schema(
            "fetch_upcoming_events",
            "List upcoming campus events this student can see. Use when they ask what is coming up. Do not pass any id.",
            {},
            [],
        ),
    },
    "summarize_missing_documents": {
        "role": "student",
        "kind": "read",
        "title": "Missing documents",
        "schema": _schema(
            "summarize_missing_documents",
            "Say which document groups are not on this student's record yet. Do not pass any id.",
            {},
            [],
        ),
    },
    "triage_caseload": {
        "role": "mentor",
        "kind": "read",
        "title": "Caseload check",
        "schema": _schema(
            "triage_caseload",
            "List assigned mentees who have overdue work or a recorded low score. Do not invent scores. Do not pass any id.",
            {},
            [],
        ),
    },
    "request_activity": {
        "role": "student",
        "kind": "write",
        "title": "Request an activity",
        "schema": _schema(
            "request_activity",
            "Propose an activity request for the signed-in student. It is not created until they confirm. Do not pass any id.",
            {
                "title": _string("Short activity title"),
                "description": _string("Why this activity helps"),
                "term": _string("short-term, mid-term, or long-term"),
            },
            ["title"],
        ),
    },
    "schedule_mentor_meeting": {
        "role": "student",
        "kind": "write",
        "title": "Request a meeting",
        "schema": _schema(
            "schedule_mentor_meeting",
            "Propose a meeting request with the assigned mentor. Pass scheduled_at as an ISO datetime. Do not pass any id.",
            {
                "scheduled_at": _string("ISO datetime such as 2026-10-16T15:00"),
                "agenda": _string("What the meeting is about"),
                "meeting_mode": _string("online or offline"),
                "venue": _string("Place, if offline"),
            },
            ["scheduled_at"],
        ),
    },
    "rsvp_campus_event": {
        "role": "student",
        "kind": "write",
        "title": "RSVP to an event",
        "schema": _schema(
            "rsvp_campus_event",
            "Propose an RSVP to one upcoming event by its title. Do not pass any id.",
            {"event_title": _string("Event title to match")},
            ["event_title"],
        ),
    },
    "send_mentor_message": {
        "role": "student",
        "kind": "write",
        "title": "Message your mentor",
        "schema": _schema(
            "send_mentor_message",
            "Propose a message to the assigned mentor. Do not pass any id.",
            {"message": _string("The message text")},
            ["message"],
        ),
    },
    "reclassify_document": {
        "role": "student",
        "kind": "write",
        "title": "Reclassify a document",
        "schema": _schema(
            "reclassify_document",
            "Propose a new category for one of this student's documents, matched by filename or title.",
            {
                "document_hint": _string("Filename or title words"),
                "doc_group": _string("academic, career, certificate, or activity"),
            },
            ["document_hint", "doc_group"],
        ),
    },
    "create_campus_event": {
        "role": "mentor",
        "kind": "write",
        "title": "Create an event",
        "schema": _schema(
            "create_campus_event",
            "Propose a campus event for this mentor. Pass scheduled_at as an ISO datetime. Do not pass any id.",
            {
                "title": _string("Event title"),
                "description": _string("What the event is"),
                "scheduled_at": _string("ISO datetime"),
                "event_type": _string("online or offline"),
                "location_details": _string("Place or room"),
                "visibility": _string("caseload_only or campus_wide"),
                "skills": _string("Skill names separated by commas"),
            },
            ["title", "scheduled_at"],
        ),
    },
    "process_approval_queue": {
        "role": "mentor",
        "kind": "write",
        "title": "Approve activity requests",
        "schema": _schema(
            "process_approval_queue",
            "Propose approving every waiting activity request on this mentor's caseload. Do not pass any id.",
            {},
            [],
        ),
    },
    "nudge_students": {
        "role": "mentor",
        "kind": "write",
        "title": "Remind mentees",
        "schema": _schema(
            "nudge_students",
            "Propose reminders only for assigned mentees who are actually missing the stated item. Pass names only if the mentor named them. Do not pass ids.",
            {
                "topic": _string("What is missing, such as academic documents"),
                "message": _string("The reminder text"),
                "names": _string("Optional mentee names, comma separated"),
            },
            ["message"],
        ),
    },
    "assign_bulk_activity": {
        "role": "mentor",
        "kind": "write",
        "title": "Assign an activity",
        "schema": _schema(
            "assign_bulk_activity",
            "Propose one activity for assigned mentees whose stored record shows they failed the named subject. If none match, nobody is assigned.",
            {
                "title": _string("Activity title"),
                "description": _string("What they should do"),
                "subject": _string("Subject that must appear as a failed result"),
                "term": _string("short-term, mid-term, or long-term"),
            },
            ["title", "subject"],
        ),
    },
}


def declarations_for(role: str) -> list[dict]:
    return [spec["schema"] for spec in _TOOLS.values() if spec["role"] == role]


def tool_rules(role: str) -> str:
    names = ", ".join(spec["schema"]["name"] for spec in _TOOLS.values() if spec["role"] == role)
    return (
        "You may use a tool when the user asks you to do something or to look something up that is not already in the facts. "
        f"Tools you can use: {names}. "
        "Never put a user id, USN, or mentor id in a tool. "
        "A write tool only proposes an action. Do not say it is already done. "
        "If they are only asking a question you can answer from the facts, answer in text and do not call a tool. "
        "You cannot approve activity requests on behalf of a mentor, and you cannot change another person's record.\n"
    )


def _clean_args(raw: Any) -> dict:
    args = raw if isinstance(raw, dict) else {}
    cleaned = {}
    for key, value in args.items():
        if str(key) in _FORBIDDEN:
            continue
        cleaned[str(key)] = value.strip() if isinstance(value, str) else value
    return cleaned


def _student(db: Session, uid: str) -> Student | None:
    return db.query(Student).filter(Student.uid == uid).first()


def _caseload(db: Session, mentor_id: str) -> list[Student]:
    return (
        db.query(Student)
        .filter(Student.assigned_mentor == mentor_id)
        .order_by(Student.student_name.asc())
        .all()
    )


def _parse_when(value: str) -> datetime | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "")[:19])
    except ValueError:
        pass
    for fmt, size in (("%Y-%m-%d %H:%M", 16), ("%Y-%m-%d", 10)):
        try:
            return datetime.strptime(text[:size], fmt)
        except ValueError:
            continue
    return None


def _upcoming_for(db: Session, student: Student) -> list[CampusEvent]:
    from app.api.v1.campus_portal import _visible

    now = datetime.now()
    found = []
    for event in db.query(CampusEvent).order_by(CampusEvent.scheduled_at.asc()).all():
        if not _visible(event, student) or event.status == "ended" or not event.scheduled_at:
            continue
        start = event.scheduled_at.replace(tzinfo=None) if getattr(event.scheduled_at, "tzinfo", None) else event.scheduled_at
        if start >= now:
            found.append(event)
    return found


def _missing_groups(db: Session, uid: str) -> list[str]:
    present = {
        (row.doc_group or "").lower()
        for row in db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.uid == uid).all()
    }
    if db.query(AcademicRecord).filter(AcademicRecord.uid == uid).first():
        present.add("academic")
    report = get_report(db, uid, "academic_report")
    state = report.structured_state if report and isinstance(report.structured_state, dict) else {}
    if state.get("gpa") or state.get("cgpa_10"):
        present.add("academic")
    return [name for name in ("academic", "career", "certificate") if name not in present]


def _missing_academic(db: Session, uid: str) -> bool:
    return "academic" in _missing_groups(db, uid)


def _failed_subject(db: Session, uid: str, subject: str) -> bool:
    needle = (subject or "").strip().lower()
    if len(needle) < 2:
        return False
    blobs = []
    for rec in db.query(AcademicRecord).filter(AcademicRecord.uid == uid).all():
        blobs.append(" ".join([rec.title or "", rec.category or "", json.dumps(rec.extra or {})]).lower())
    report = get_report(db, uid, "academic_report")
    if report and isinstance(report.structured_state, dict):
        blobs.append(json.dumps(report.structured_state).lower())
    return any(needle in blob and "fail" in blob for blob in blobs)


def _card(tool: str, args: dict) -> tuple[str, str, list[dict]]:
    spec = _TOOLS[tool]
    labels = {
        "title": "Title",
        "description": "Details",
        "term": "Term",
        "scheduled_at": "When",
        "agenda": "Agenda",
        "meeting_mode": "Format",
        "venue": "Place",
        "event_title": "Event",
        "message": "Message",
        "document_hint": "Document",
        "doc_group": "Category",
        "event_type": "Format",
        "location_details": "Place",
        "visibility": "Audience",
        "skills": "Skills",
        "topic": "About",
        "names": "Mentees",
        "subject": "Subject",
    }
    fields = []
    for key, label in labels.items():
        value = args.get(key)
        if value is None or value == "":
            continue
        fields.append({"key": key, "label": label, "value": str(value)[:500]})
    summary = spec["title"]
    if args.get("title"):
        summary = f"{spec['title']}: {args['title']}"
    elif args.get("event_title"):
        summary = f"{spec['title']}: {args['event_title']}"
    return spec["title"], summary[:500], fields


def _public(row: ChatActionProposal) -> dict:
    args = row.args_json if isinstance(row.args_json, dict) else {}
    title, summary, fields = _card(row.tool_name, args)
    return {
        "id": row.id,
        "tool": row.tool_name,
        "title": title,
        "summary": row.summary or summary,
        "fields": fields,
        "status": row.status,
    }


def propose(db: Session, *, role: str, actor_id: str, tool: str, args: dict) -> dict:
    _title, summary, _fields = _card(tool, args)
    row = ChatActionProposal(
        id=str(uuid.uuid4()),
        actor_role=role,
        actor_id=actor_id,
        tool_name=tool,
        args_json=args,
        status="pending",
        summary=summary,
        expires_at=datetime.now() + timedelta(minutes=_PROPOSAL_MINUTES),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _public(row)


def run_turn(db: Session, *, role: str, actor_id: str, prompt: str) -> dict:
    full = f"{prompt}\n{tool_rules(role)}"
    turn = generate_with_tools(full, declarations_for(role))
    if turn.get("kind") != "call":
        return {"reply": str(turn.get("text") or ""), "proposal": None}
    name = str(turn.get("name") or "")
    spec = _TOOLS.get(name)
    args = _clean_args(turn.get("args"))
    if spec is None or spec["role"] != role:
        return {"reply": "I can't do that from this chat.", "proposal": None}
    if spec["kind"] == "read":
        result = execute(db, role, actor_id, name, args)
        follow = (
            f"{full}\nTool result:\n{result.get('message') or ''}\n"
            "Write the reply from that result only. Do not call another tool. Do not say an action was saved."
        )
        return {"reply": generate_text(follow), "proposal": None}
    intro = {
        "request_activity": "I can send this activity request. Review it below and confirm.",
        "schedule_mentor_meeting": "I can request this meeting. It is not booked until you confirm.",
        "rsvp_campus_event": "I can sign you up for this event. Confirm to save the RSVP.",
        "send_mentor_message": "I can send this message to your mentor. Confirm to send it.",
        "reclassify_document": "I can change how this document is filed. Confirm to update it.",
        "create_campus_event": "I can publish this event. Confirm to create it.",
        "process_approval_queue": "I can approve the waiting activity requests on your caseload. Confirm to apply that.",
        "nudge_students": "I can send this reminder to the mentees who are missing it. Confirm to send.",
        "assign_bulk_activity": "I can assign this only where the stored record shows that subject was failed. Confirm to assign it.",
    }.get(name, "Review this action and confirm.")
    return {"reply": intro, "proposal": propose(db, role=role, actor_id=actor_id, tool=name, args=args)}


def update_proposal(db: Session, row: ChatActionProposal, values: dict) -> dict:
    args = dict(row.args_json or {})
    allowed = set((_TOOLS[row.tool_name]["schema"]["parameters"].get("properties") or {}).keys())
    for key, value in _clean_args(values).items():
        if key in allowed:
            args[key] = value
    row.args_json = args
    _title, summary, _fields = _card(row.tool_name, args)
    row.summary = summary
    db.commit()
    db.refresh(row)
    return _public(row)


def execute(db: Session, role: str, actor_id: str, name: str, args: dict) -> dict:
    spec = _TOOLS.get(name)
    if spec is None or spec["role"] != role:
        return {"ok": False, "message": "That action is not available here."}
    handlers = {
        "fetch_upcoming_events": _read_events,
        "summarize_missing_documents": _read_missing,
        "triage_caseload": _read_triage,
        "request_activity": _write_request,
        "schedule_mentor_meeting": _write_meeting,
        "rsvp_campus_event": _write_rsvp,
        "send_mentor_message": _write_student_message,
        "reclassify_document": _write_reclassify,
        "create_campus_event": _write_event,
        "process_approval_queue": _write_approvals,
        "nudge_students": _write_nudge,
        "assign_bulk_activity": _write_bulk,
    }
    return handlers[name](db, actor_id, args)


def _read_events(db: Session, uid: str, _args: dict) -> dict:
    student = _student(db, uid)
    if student is None:
        return {"ok": False, "message": "Student not found."}
    rows = _upcoming_for(db, student)
    if not rows:
        return {"ok": True, "message": "No upcoming events."}
    lines = [f"{row.title} on {row.scheduled_at} at {row.location_details or row.event_type}" for row in rows[:8]]
    return {"ok": True, "message": "Upcoming events:\n" + "\n".join(lines)}


def _read_missing(db: Session, uid: str, _args: dict) -> dict:
    missing = _missing_groups(db, uid)
    if not missing:
        return {"ok": True, "message": "Academic, career, and certificate documents are already on the record."}
    return {"ok": True, "message": "Not on the record yet: " + ", ".join(missing) + "."}


def _read_triage(db: Session, mentor_id: str, _args: dict) -> dict:
    stats = build_mentor_statistics(db, mentor_id)
    lines = []
    for row in stats.get("activities") or []:
        if isinstance(row, dict) and row.get("status") == "overdue":
            lines.append(f"{row.get('studentName') or row.get('usn')} has overdue work: {row.get('title')}")
    for card in stats.get("students") or []:
        if not isinstance(card, dict):
            continue
        try:
            number = float(card.get("score"))
        except (TypeError, ValueError):
            continue
        if 0 < number < 60:
            lines.append(f"{card.get('name') or card.get('usn')} has a recorded score of {number}.")
    if not lines:
        return {"ok": True, "message": "No overdue work and no recorded score under 60 on this caseload."}
    return {"ok": True, "message": "\n".join(lines[:12])}


def _write_request(db: Session, uid: str, args: dict) -> dict:
    title = str(args.get("title") or "").strip()
    if not title:
        return {"ok": False, "message": "Add an activity title first."}
    row = StudentActivityV2(
        uid=uid,
        title=title[:255],
        description=str(args.get("description") or "").strip() or "Requested by student",
        origin="student_request",
        status="requested",
        term=store_term(str(args.get("term") or "")) or "short-term",
    )
    db.add(row)
    db.commit()
    return {"ok": True, "message": f"Request sent: {row.title}"}


def _write_meeting(db: Session, uid: str, args: dict) -> dict:
    student = _student(db, uid)
    if student is None or not student.assigned_mentor:
        return {"ok": False, "message": "No mentor is assigned yet."}
    when = _parse_when(str(args.get("scheduled_at") or ""))
    if when is None:
        return {"ok": False, "message": "Enter a start time like 2026-10-16T15:00."}
    mode = str(args.get("meeting_mode") or "online").strip().lower()
    if mode not in {"online", "offline"}:
        mode = "online"
    venue = (str(args.get("venue") or "").strip() or ("Online" if mode == "online" else "To be confirmed"))[:255]
    db.add(
        Meetings(
            id=str(uuid.uuid4()),
            mentor_id=student.assigned_mentor,
            student_usn=student.student_usn,
            meeting_date=when,
            venue=venue,
            agenda=(str(args.get("agenda") or "").strip() or "Requested from Ditto")[:255],
            status="requested",
            meeting_mode=mode,
        )
    )
    db.commit()
    return {"ok": True, "message": f"Meeting request saved for {when.strftime('%d %b %Y, %H:%M')}."}


def _write_rsvp(db: Session, uid: str, args: dict) -> dict:
    student = _student(db, uid)
    hint = str(args.get("event_title") or "").strip().lower()
    if student is None or not hint:
        return {"ok": False, "message": "Name the event first."}
    match = next((event for event in _upcoming_for(db, student) if hint in (event.title or "").lower()), None)
    if match is None:
        return {"ok": False, "message": "I could not find that upcoming event on your campus list."}
    row = db.query(EventRSVP).filter(EventRSVP.event_id == match.id, EventRSVP.student_uid == student.uid).first()
    if row is None:
        db.add(EventRSVP(event_id=match.id, student_uid=student.uid, status="attending"))
    else:
        row.status = "attending"
    db.commit()
    payload = {"ok": True, "message": f"You are signed up for {match.title}."}
    if match.event_type == "offline":
        payload["qr_value"] = student.uid
    return payload


def _write_student_message(db: Session, uid: str, args: dict) -> dict:
    student = _student(db, uid)
    text = str(args.get("message") or "").strip()
    if student is None or not student.assigned_mentor:
        return {"ok": False, "message": "No mentor is assigned yet."}
    if not text:
        return {"ok": False, "message": "Write the message first."}
    db.add(MentorMessage(mentor_id=student.assigned_mentor, student_usn=student.student_usn, sender="student", content=text[:4000]))
    db.commit()
    return {"ok": True, "message": "Message sent to your mentor."}


def _write_reclassify(db: Session, uid: str, args: dict) -> dict:
    group = str(args.get("doc_group") or "").strip().lower()
    hint = str(args.get("document_hint") or "").strip().lower()
    if group not in _GROUPS:
        return {"ok": False, "message": "Choose academic, career, certificate, or activity."}
    if len(hint) < 2:
        return {"ok": False, "message": "Name the document first."}
    match = None
    for row in db.query(StudentKnowledgeItem).filter(StudentKnowledgeItem.uid == uid).all():
        blob = f"{row.filename or ''} {row.title or ''}".lower()
        if hint in blob:
            match = row
            break
    if match is None:
        return {"ok": False, "message": "I could not find that document on your record."}
    match.doc_group = group
    match.category = group[:64]
    match.category_source = "user"
    db.commit()
    from app.services.document_report_refresh import maybe_refresh_after_documents

    maybe_refresh_after_documents(db, uid)
    return {"ok": True, "message": f"Filed {match.filename or match.title or 'that document'} as {group}."}


def _write_event(db: Session, mentor_id: str, args: dict) -> dict:
    title = str(args.get("title") or "").strip()
    when = _parse_when(str(args.get("scheduled_at") or ""))
    if not title or when is None:
        return {"ok": False, "message": "Add a title and a start time like 2026-10-16T15:00."}
    kind = str(args.get("event_type") or "offline").strip().lower()
    if kind not in {"online", "offline"}:
        kind = "offline"
    visibility = str(args.get("visibility") or "caseload_only").strip().lower()
    if visibility not in {"caseload_only", "campus_wide"}:
        visibility = "caseload_only"
    skills = [part.strip()[:80] for part in str(args.get("skills") or "").split(",") if part.strip()]
    event = CampusEvent(
        creator_id=mentor_id,
        creator_role="mentor",
        title=title[:255],
        description=str(args.get("description") or "").strip(),
        event_type=kind,
        location_details=str(args.get("location_details") or "").strip()[:255],
        visibility=visibility,
        scheduled_at=when,
        linked_skills=skills,
        status="scheduled",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    if event.event_type == "online" and not event.location_details:
        event.location_details = f"campus-event-{event.id}"
        db.commit()
    return {"ok": True, "message": f"Event published: {event.title}."}


def _write_approvals(db: Session, mentor_id: str, _args: dict) -> dict:
    uids = [person.uid for person in _caseload(db, mentor_id) if person.uid]
    if not uids:
        return {"ok": True, "message": "No mentees are assigned."}
    rows = (
        db.query(StudentActivityV2)
        .filter(StudentActivityV2.uid.in_(uids), StudentActivityV2.status == "requested")
        .all()
    )
    if not rows:
        return {"ok": True, "message": "There are no waiting activity requests."}
    for row in rows:
        row.status = "pending"
        row.term = row.term or "short-term"
    db.commit()
    count = len(rows)
    return {"ok": True, "message": f"Approved {count} activity request{'' if count == 1 else 's'}."}


def _named_people(people: list[Student], names_text: str) -> list[Student]:
    hints = [part.strip().lower() for part in names_text.split(",") if part.strip()]
    if not hints:
        return people
    chosen = []
    for person in people:
        blob = f"{person.student_name or ''} {person.student_usn or ''}".lower()
        if any(hint in blob for hint in hints):
            chosen.append(person)
    return chosen


def _write_nudge(db: Session, mentor_id: str, args: dict) -> dict:
    text = str(args.get("message") or "").strip()
    if not text:
        return {"ok": False, "message": "Write the reminder first."}
    topic = str(args.get("topic") or "academic documents").lower()
    if not any(word in topic for word in ("academic", "mark", "document")):
        return {"ok": True, "message": "I only send reminders for a missing academic document, so nothing was sent."}
    people = _named_people(_caseload(db, mentor_id), str(args.get("names") or ""))
    sent = []
    for person in people:
        if not person.uid or not _missing_academic(db, person.uid):
            continue
        db.add(MentorMessage(mentor_id=mentor_id, student_usn=person.student_usn, sender="mentor", content=text[:4000]))
        sent.append(person.student_name or person.student_usn)
    db.commit()
    if not sent:
        return {"ok": True, "message": "Nobody on the caseload is missing that, so no reminder was sent."}
    return {"ok": True, "message": "Reminder sent to " + ", ".join(sent) + "."}


def _write_bulk(db: Session, mentor_id: str, args: dict) -> dict:
    title = str(args.get("title") or "").strip()
    subject = str(args.get("subject") or "").strip()
    if not title or not subject:
        return {"ok": False, "message": "Add an activity title and the subject."}
    matched = [person for person in _caseload(db, mentor_id) if person.uid and _failed_subject(db, person.uid, subject)]
    if not matched:
        return {"ok": True, "message": f"No assigned mentee has a stored failed result for {subject}, so nothing was assigned."}
    term = store_term(str(args.get("term") or "")) or "short-term"
    description = str(args.get("description") or "").strip() or f"Assigned because the stored record shows a failed result in {subject}."
    for person in matched:
        db.add(
            StudentActivityV2(
                uid=person.uid,
                title=title[:255],
                description=description,
                origin="mentor",
                status="pending",
                term=term,
            )
        )
    db.commit()
    names = ", ".join(person.student_name or person.student_usn for person in matched)
    return {"ok": True, "message": f"Assigned to {names}."}


def opening_for_mentor(db: Session, mentor_id: str) -> dict | None:
    missing = [person for person in _caseload(db, mentor_id) if person.uid and _missing_academic(db, person.uid)]
    if not missing:
        return None
    existing = (
        db.query(ChatActionProposal)
        .filter(
            ChatActionProposal.actor_role == "mentor",
            ChatActionProposal.actor_id == mentor_id,
            ChatActionProposal.tool_name == "nudge_students",
            ChatActionProposal.status == "pending",
            ChatActionProposal.expires_at > datetime.now(),
        )
        .order_by(ChatActionProposal.created_at.desc())
        .first()
    )
    names = ", ".join(person.student_name or person.student_usn for person in missing[:8])
    if existing is None:
        mentor = db.query(Mentor).filter(Mentor.mentor_id == mentor_id).first()
        who = mentor.mentor_name if mentor and mentor.mentor_name else "your mentor"
        proposal = propose(
            db,
            role="mentor",
            actor_id=mentor_id,
            tool="nudge_students",
            args={
                "topic": "academic documents",
                "message": f"Please upload your academic documents when you can. This note is from {who}.",
                "names": names,
            },
        )
    else:
        proposal = _public(existing)
    return {
        "text": f"These mentees have no academic document yet: {names}. I can remind them. Nothing is sent until you confirm.",
        "proposal": proposal,
    }


def claim_proposal(db: Session, proposal_id: str, role: str, actor_id: str) -> ChatActionProposal | None:
    return (
        db.query(ChatActionProposal)
        .filter(
            ChatActionProposal.id == proposal_id,
            ChatActionProposal.actor_role == role,
            ChatActionProposal.actor_id == actor_id,
        )
        .first()
    )
