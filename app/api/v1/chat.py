import json
import logging
import re
import uuid
from typing import Optional

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_mentor, oauth2_scheme
from app.core.security import verify_token
from app.db.database import SessionLocal, get_db
from app.api.v1.deps import get_uid_for_current_student
from app.db.models.ditto_actions import ChatActionProposal
from app.db.models.mentor_platform import MentorChatMessage, MentorChatSession
from app.db.models.student_platform import ChatSession, ChatMessage
from app.db.models.students import Student
from app.services.ditto_tools import claim_proposal, execute, opening_for_mentor, run_turn, update_proposal, _public
from app.services.gemini_insight_service import build_overview
from app.services.mentor_stats import build_mentor_statistics

router = APIRouter()
logger = logging.getLogger(__name__)

REFUSAL = (
    "I can only talk about your own progress. "
    "I can't look up other students, and I won't guess a grade you have not earned yet."
)
MENTOR_REFUSAL = "I can only talk about the mentees assigned to you."

_PEER_PATTERNS = (
    r"\bclassmate\b",
    r"\bother student\b",
    r"\bother students\b",
    r"\bpeers?\b",
    r"\bbatch\b",
    r"\bstu-\d",
    r"\bcompare.*(gpa|grade|score)",
    r"\bgrades? of other",
)
_PREDICT_PATTERNS = (
    r"\bpredict\b",
    r"\bnext (semester|exam|grade|score)\b",
    r"\bwill (i|my).*(score|get|grade)\b",
    r"\bfuture grade\b",
)


class ChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None


class ActionEdit(BaseModel):
    values: dict = Field(default_factory=dict)


def _should_refuse(message: str) -> bool:
    low = message.lower()
    for pat in _PEER_PATTERNS + _PREDICT_PATTERNS:
        if re.search(pat, low):
            return True
    return False


def _present(value) -> bool:
    if value is None or isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return float(value) > 0
    text = str(value).strip().lower().replace(" ", "")
    return text not in ("", "0", "0.0", "0%", "0.0%", "#0", "0hrs", "none", "null")


def _card_value(overview: dict, title: str):
    for key in ("summary_cards", "kpis"):
        for row in overview.get(key) or []:
            if isinstance(row, dict) and row.get("title") == title:
                return row.get("value")
    return None


def _chat_facts(overview: dict) -> str:
    """Short, grounded notes for the assistant. No internal report names."""
    raw_name = str(overview.get("welcome_name") or "").strip()
    first = raw_name.split()[0].capitalize() if raw_name else ""
    lines = [f"First name: {first or 'unknown'}"]

    def add(label: str, value, *, missing: str) -> None:
        lines.append(f"{label}: {value if _present(value) else missing}")

    add("Performance score", _card_value(overview, "Performance Score"), missing="not recorded")
    rank = _card_value(overview, "Programme Rank") or _card_value(overview, "Global Rank")
    add("Programme rank", rank, missing="not recorded")
    add("Skills acquired", _card_value(overview, "Skills Acquired"), missing="none yet")
    skills = [
        row
        for row in (overview.get("attained_skills") or [])
        if isinstance(row, dict) and str(row.get("name") or "").strip()
    ]
    if skills:
        lines.append("Certificate skills:")
        for row in skills[:12]:
            bits = [str(row.get("name")).strip()]
            if row.get("certificate"):
                bits.append(str(row["certificate"]).strip())
            if row.get("completed_on"):
                bits.append(str(row["completed_on"]).strip())
            lines.append("- " + ", ".join(bits))
    printed = [
        row
        for row in (overview.get("skills_overview") or [])
        if isinstance(row, dict) and _present(row.get("pct")) and row.get("name")
    ]
    if printed:
        lines.append("Printed percents:")
        for row in printed[:8]:
            lines.append(f"- {row.get('name')}: {row.get('pct')}%")
    add("Learning hours", _card_value(overview, "Learning Hours") or _card_value(overview, "Avg. Learning Hours"), missing="not recorded")
    add("Goal completion", _card_value(overview, "Goal Completion"), missing="not recorded")
    add("Project submissions", _card_value(overview, "Project Submissions"), missing="not recorded")
    reminders = overview.get("activity_reminders") or {}
    add("Pending activities", reminders.get("pending_activities"), missing="none")
    add("Upcoming meetings", reminders.get("upcoming_meetings"), missing="none")
    add("GPA", overview.get("academic_gpa"), missing="no marksheet yet")
    return "\n".join(lines)


_INTERNAL = re.compile(
    r"\*\*|living report|\b[a-z0-9_]+(?:report|dashboard|wizard)\b(?:\s*\(v\d+\))?|\(v\d+\)",
    re.I,
)
_DROP_SENTENCE = re.compile(
    r"according to the|as noted in|found in|rated at|model vendor|gemini|openai|claude",
    re.I,
)
_ZERO_LINE = re.compile(
    r":\s*(?:#?0(?:\.0+)?%?(?:\s*hours?)?)\s*$",
    re.I,
)


def _polish_reply(text: str) -> str:
    """Turn a raw model reply into short plain paragraphs."""
    cleaned = text.replace("\r\n", "\n")
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"\s+\*\s+", "\n", cleaned)
    cleaned = _INTERNAL.sub("", cleaned)
    paragraphs: list[str] = []
    for raw_line in cleaned.splitlines():
        line = re.sub(r"^\s*[-*]\s+", "", raw_line).strip()
        line = re.sub(r"\s{2,}", " ", line)
        line = re.sub(r"\s+([,.:])", r"\1", line)
        line = re.sub(r"\(\s*\)", "", line).strip(" -")
        if not line or _ZERO_LINE.search(line):
            continue
        kept = []
        for sentence in re.split(r"(?<=[.!?])\s+", line):
            piece = sentence.strip()
            if not piece or _DROP_SENTENCE.search(piece) or re.search(r"\b0(?:\.0+)?%|\b0\.0\b|\b0 hours\b", piece, re.I):
                continue
            kept.append(piece)
        if kept:
            paragraphs.append(" ".join(kept))
    return "\n\n".join(paragraphs).strip()


def _recent_turns(db: Session, uid: str, session_id: str) -> str:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.uid == uid)
        .order_by(ChatMessage.id.desc())
        .limit(8)
        .all()
    )
    if not rows:
        return ""
    lines = ["Recent conversation:"]
    for row in reversed(rows):
        speaker = "Student" if row.role == "user" else "Ditto"
        lines.append(f"{speaker}: {(row.content or '')[:600]}")
    return "\n".join(lines) + "\n"


def _ensure_session(db: Session, uid: str, session_id: Optional[str]) -> str:
    sid = session_id or str(uuid.uuid4())
    existing = db.query(ChatSession).filter(ChatSession.id == sid).first()
    if existing:
        return sid
    db.add(ChatSession(id=sid, uid=uid))
    db.commit()
    return sid


def _persist_turn(uid: str, sid: str, user_text: str, reply: str, as_of, reports_ctx: str) -> None:
    db = SessionLocal()
    try:
        db.add(ChatMessage(session_id=sid, uid=uid, role="user", content=user_text))
        db.add(
            ChatMessage(
                session_id=sid,
                uid=uid,
                role="assistant",
                content=reply,
                cited_reports={"as_of": as_of, "reports": reports_ctx},
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _agent_reply(db: Session, role: str, actor_id: str, prompt: str) -> tuple[str, dict | None]:
    fallback = "Sorry, I lost the thread for a second. Ask me again and I'll pick it up."
    try:
        result = run_turn(db, role=role, actor_id=actor_id, prompt=prompt)
    except Exception:
        logger.exception("Chat reply failed")
        result = {"reply": "", "proposal": None}
    reply = _polish_reply(result.get("reply") or "") or fallback
    return reply, result.get("proposal")


def _yield_reply(reply: str, sid: str, as_of, proposal: dict | None):
    blocks = [block for block in reply.split("\n\n") if block.strip()] or [reply]
    for index, block in enumerate(blocks):
        piece = block if index == len(blocks) - 1 else f"{block}\n\n"
        yield _sse({"delta": piece})
    if proposal:
        yield _sse({"proposal": proposal})
    yield _sse({"done": True, "session_id": sid, "as_of": as_of})


def _actor(db: Session, token: str) -> tuple[str, str]:
    payload = verify_token(token)
    role = payload.get("role")
    ms_id = payload.get("ms_ids")
    if role == "student":
        student = db.query(Student).filter(Student.student_usn == ms_id).first()
        if student is None or not student.uid:
            raise HTTPException(status_code=401, detail="Student not found")
        return "student", student.uid
    if role == "mentor" and ms_id:
        return "mentor", ms_id
    raise HTTPException(status_code=403, detail="Not available")


def _owned_proposal(db: Session, proposal_id: str, token: str) -> tuple[ChatActionProposal, str, str]:
    role, actor_id = _actor(db, token)
    row = claim_proposal(db, proposal_id, role, actor_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Action not found")
    if row.expires_at and row.expires_at < datetime.now() and row.status == "pending":
        row.status = "cancelled"
        db.commit()
        raise HTTPException(status_code=400, detail="That action expired. Ask again.")
    return row, role, actor_id


@router.post("/students/{uid}/chat")
def chat(uid: str, body: ChatIn, db: Session = Depends(get_db), token_uid: str = Depends(get_uid_for_current_student)):
    if uid != token_uid or _should_refuse(body.message):
        def refused():
            yield _sse({"delta": REFUSAL, "done": True, "session_id": body.session_id, "as_of": None})

        return StreamingResponse(refused(), media_type="text/event-stream")

    overview = build_overview(db, uid, use_gemini=False)
    facts = _chat_facts(overview)
    as_of = overview.get("generated_at")
    sid = _ensure_session(db, uid, body.session_id)
    user_text = body.message
    history = _recent_turns(db, uid, sid)
    prompt = (
        "You are Ditto, this student's mentor assistant. "
        "You are warm, steady, and direct, like a mentor who already knows their record. "
        "You are not a help desk, and you do not hype them.\n"
        "Write in plain sentences. Use their first name once, near the start. "
        "Do not introduce yourself unless they ask who you are. "
        "If they ask, say you are Ditto, their mentor assistant.\n"
        "Shape a progress reply like this:\n"
        "Hi Mohan,\n\n"
        "Your performance score is 79.8, and you are 1st in your programme. That comes from the certificates already on your record.\n\n"
        "You have 6 skills from those certificates. Engineering Virtual Program was completed on February 13, 2024.\n\n"
        "Learning hours and goal completion are not on your record yet. There is no marksheet yet, so I can't speak to your academic standing. Upload one when you have it.\n"
        "Rules:\n"
        "- Short paragraphs, with a blank line between them.\n"
        "- No markdown, asterisks, backticks, headings, or bullet symbols.\n"
        "- Use only the facts below. If a fact says not recorded, none, or no marksheet, say that in a normal sentence and, when it helps, say what they can add.\n"
        "- Do not print 0, 0.0, or 0%.\n"
        "- Do not invent skill ratings, attendance, SWOT scores, or ranks.\n"
        "- Do not mention report names, version numbers, or where the data is stored.\n"
        "- Do not name any model vendor.\n"
        "- If there is a recent conversation, answer the new message in that context. Do not repeat the earlier reply.\n"
        f"Facts:\n{facts}\n"
        f"{history}"
        f"Student: {user_text}"
    )
    reply, proposal = _agent_reply(db, "student", uid, prompt)

    def event_stream():
        _persist_turn(uid, sid, user_text, reply, as_of, facts)
        yield from _yield_reply(reply, sid, as_of, proposal)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _shown(value) -> str:
    if value is None or value == "":
        return "not recorded"
    return str(value)


def _mentor_caseload_facts(stats: dict) -> str:
    counts = stats.get("counts") or {}
    insights = stats.get("insights") or {}
    lines = [
        f"Assigned mentees: {counts.get('mentees') or 0}",
        f"Activity completion: {_shown(counts.get('completion'))}",
        f"Overdue activities: {insights.get('overdue') or 0}",
        f"Attendance last 30 days: {_shown(counts.get('attendance_rate'))}",
        f"Average mentee score: {_shown(counts.get('average_score'))}",
        "Mentees:",
    ]
    students = stats.get("students") or []
    if not students:
        lines.append("- none assigned")
    for card in students:
        lines.append(
            f"- {card.get('name') or card.get('usn')} ({card.get('usn')}): "
            f"score {_shown(card.get('score'))}, activities {card.get('activities') or 0}, "
            f"progress {_shown(card.get('progress'))}"
        )
    overdue = [
        row for row in (stats.get("activities") or [])
        if isinstance(row, dict) and row.get("status") == "overdue"
    ][:8]
    if overdue:
        lines.append("Overdue tasks:")
        for row in overdue:
            lines.append(f"- {row.get('studentName') or row.get('usn')}: {row.get('title')}")
    meetings = (stats.get("meetings") or [])[:6]
    if meetings:
        lines.append("Upcoming meetings:")
        for row in meetings:
            lines.append(
                f"- {row.get('attendee') or ''} {row.get('title') or 'Meeting'} on {row.get('date') or ''} {row.get('time') or ''}".strip()
            )
    else:
        lines.append("Upcoming meetings: none")
    return "\n".join(lines)


def _assigned_hit(message: str, card: dict) -> bool:
    low = message.lower()
    usn = str(card.get("usn") or "").strip().lower()
    uid = str(card.get("uid") or "").strip().lower()
    name = str(card.get("name") or "").strip().lower()
    if usn and usn in low:
        return True
    if uid and uid in low:
        return True
    if name and name in low:
        return True
    parts = [part for part in name.split() if len(part) >= 3]
    return bool(parts) and all(part in low for part in parts)


def _asks_about_outsider(message: str, students: list[dict]) -> bool:
    known = set()
    for card in students:
        for key in ("usn", "uid"):
            value = str(card.get(key) or "").strip().lower()
            if value:
                known.add(value)
    for token in re.findall(r"\b(?:jain-[a-z0-9-]+|stu-[a-z0-9]+)\b", message.lower()):
        if token not in known:
            return True
    return False


def _mentor_session(db: Session, mentor_id: str, session_id: Optional[str]) -> str:
    sid = session_id or str(uuid.uuid4())
    existing = (
        db.query(MentorChatSession)
        .filter(MentorChatSession.id == sid, MentorChatSession.mentor_id == mentor_id)
        .first()
    )
    if existing:
        return sid
    if db.query(MentorChatSession).filter(MentorChatSession.id == sid).first():
        sid = str(uuid.uuid4())
    db.add(MentorChatSession(id=sid, mentor_id=mentor_id))
    db.commit()
    return sid


def _mentor_history(db: Session, mentor_id: str, session_id: str) -> str:
    rows = (
        db.query(MentorChatMessage)
        .filter(MentorChatMessage.session_id == session_id, MentorChatMessage.mentor_id == mentor_id)
        .order_by(MentorChatMessage.id.desc())
        .limit(8)
        .all()
    )
    if not rows:
        return ""
    lines = ["Recent conversation:"]
    for row in reversed(rows):
        speaker = "Mentor" if row.role == "user" else "Ditto"
        lines.append(f"{speaker}: {(row.content or '')[:600]}")
    return "\n".join(lines) + "\n"


def _persist_mentor_turn(mentor_id: str, sid: str, user_text: str, reply: str) -> None:
    db = SessionLocal()
    try:
        db.add(MentorChatMessage(session_id=sid, mentor_id=mentor_id, role="user", content=user_text))
        db.add(MentorChatMessage(session_id=sid, mentor_id=mentor_id, role="assistant", content=reply))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.post("/mentor/chat")
def mentor_chat(body: ChatIn, db: Session = Depends(get_db), current: dict = Depends(get_current_mentor)):
    mentor_id = current["mentor_id"]
    stats = build_mentor_statistics(db, mentor_id)
    students = [card for card in (stats.get("students") or []) if isinstance(card, dict)]
    if _asks_about_outsider(body.message, students):
        def refused():
            yield _sse({"delta": MENTOR_REFUSAL, "done": True, "session_id": body.session_id, "as_of": None})

        return StreamingResponse(refused(), media_type="text/event-stream")

    facts = _mentor_caseload_facts(stats)
    named = [card for card in students if _assigned_hit(body.message, card)][:2]
    for card in named:
        uid = card.get("uid")
        if not uid:
            continue
        overview = build_overview(db, uid, use_gemini=False)
        facts += f"\nRecord for {card.get('name') or card.get('usn')}:\n{_chat_facts(overview)}"
    as_of = stats.get("generated_at")
    sid = _mentor_session(db, mentor_id, body.session_id)
    user_text = body.message
    history = _mentor_history(db, mentor_id, sid)
    prompt = (
        "You are Ditto, this mentor's assistant. "
        "You help them understand the mentees assigned to them. "
        "You are warm, steady, and direct.\n"
        "Write in plain sentences. Do not introduce yourself unless they ask who you are. "
        "If they ask, say you are Ditto, their caseload assistant.\n"
        "Rules:\n"
        "- Short paragraphs, with a blank line between them.\n"
        "- No markdown, asterisks, backticks, headings, or bullet symbols.\n"
        "- Use only the facts below. If a fact says not recorded, say that in a normal sentence.\n"
        "- Do not invent skill ratings, attendance, SWOT scores, or ranks.\n"
        "- Do not mention report names, version numbers, or where the data is stored.\n"
        "- Do not name any model vendor.\n"
        "- If they ask about someone who is not in the facts, say you can only talk about assigned mentees.\n"
        "- If there is a recent conversation, answer the new message in that context. Do not repeat the earlier reply.\n"
        f"Facts:\n{facts}\n"
        f"{history}"
        f"Mentor: {user_text}"
    )
    reply, proposal = _agent_reply(db, "mentor", mentor_id, prompt)

    def event_stream():
        _persist_mentor_turn(mentor_id, sid, user_text, reply)
        yield from _yield_reply(reply, sid, as_of, proposal)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/mentor/chat/opening")
def mentor_opening(db: Session = Depends(get_db), current: dict = Depends(get_current_mentor)):
    note = opening_for_mentor(db, current["mentor_id"])
    return note or {"text": "", "proposal": None}


@router.patch("/chat/actions/{proposal_id}")
def edit_action(
    proposal_id: str,
    body: ActionEdit,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    row, _role, _actor_id = _owned_proposal(db, proposal_id, token)
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="That action can no longer be edited")
    return update_proposal(db, row, body.values or {})


@router.post("/chat/actions/{proposal_id}/cancel")
def cancel_action(proposal_id: str, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    row, _role, _actor_id = _owned_proposal(db, proposal_id, token)
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="That action can no longer be cancelled")
    row.status = "cancelled"
    db.commit()
    return {"ok": True, "status": "cancelled"}


@router.post("/chat/actions/{proposal_id}/execute")
def execute_action(proposal_id: str, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    row, role, actor_id = _owned_proposal(db, proposal_id, token)
    if row.status == "done":
        return {"ok": True, "status": "done", "message": row.result_text or "Already done", "proposal": _public(row)}
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="That action is already running")
    claimed = (
        db.query(ChatActionProposal)
        .filter(ChatActionProposal.id == row.id, ChatActionProposal.status == "pending")
        .update({"status": "running"})
    )
    db.commit()
    if claimed != 1:
        raise HTTPException(status_code=409, detail="That action is already running")
    try:
        result = execute(db, role, actor_id, row.tool_name, row.args_json if isinstance(row.args_json, dict) else {})
    except Exception:
        logger.exception("Action failed")
        db.rollback()
        result = {"ok": False, "message": "That action could not be completed."}
    row = db.query(ChatActionProposal).filter(ChatActionProposal.id == proposal_id).first()
    row.result_text = result.get("message") or ""
    row.status = "done" if result.get("ok") else "pending"
    db.commit()
    payload = {"ok": bool(result.get("ok")), "status": row.status, "message": row.result_text, "proposal": _public(row)}
    if result.get("qr_value"):
        payload["qr_value"] = result["qr_value"]
    return payload
