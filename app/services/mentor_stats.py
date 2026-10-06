"""Counting rules shared by the mentor workspace and student dashboards.

Completion is completed activities divided by every assigned activity.
A due date that has passed, on an activity that is not completed or rejected, counts as overdue.
A month appears on the completion chart only when at least one activity is due that month.
Its value is the percent of those activities that are completed.
Engagement for that month is the average stored progress of the same activities.
Attendance is present and late marks divided by every mark in the last 30 days.
Average duration uses only meetings that have a stored duration in minutes.
Category is the activity description when it is one of Research, Technical, Career, Soft Skills, or Other.
Otherwise the term is used. Otherwise the category is Other.
A past meeting that was not cancelled counts as held.
Response rate is the share of mentee threads where the mentor wrote after the mentee's latest message.
"""
from __future__ import annotations

import calendar
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models.attendance import Attendance
from app.db.models.meetings import Meetings
from app.db.models.mentor_platform import MentorMessage
from app.db.models.student_platform import LivingReport, StudentActivityV2
from app.db.models.students import Student

_CATEGORIES = ("Research", "Technical", "Career", "Soft Skills", "Other")
_CATEGORY_COLORS = {
    "Research": "primary",
    "Technical": "success",
    "Career": "warning",
    "Soft Skills": "info",
    "Other": "muted-foreground",
    "Short Term": "primary",
    "Mid Term": "success",
    "Long Term": "warning",
}
_TERM_LABELS = {
    "short-term": "Short Term",
    "mid-term": "Mid Term",
    "long-term": "Long Term",
}


def attendance_percent(
    db: Session,
    *,
    mentor_id: str | None = None,
    student_usn: str | None = None,
    days: int = 30,
) -> float | None:
    since = datetime.now() - timedelta(days=days)
    query = db.query(Attendance).filter(Attendance.marked_at >= since)
    if mentor_id:
        query = query.filter(Attendance.mentor_id == mentor_id)
    if student_usn:
        query = query.filter(Attendance.student_usn == student_usn)
    rows = query.all()
    if not rows:
        return None
    attended = sum(1 for row in rows if (row.status or "").lower() in ("present", "late"))
    return round(1000 * attended / len(rows)) / 10


def effective_status(row: StudentActivityV2, now: datetime | None = None) -> str:
    now = now or datetime.now()
    status = (row.status or "pending").lower().replace("-", "_")
    if status == "requested":
        return "requested"
    if status in ("completed", "rejected"):
        return status
    if row.due_date and row.due_date < now:
        return "overdue"
    if status == "in_progress":
        return "in_progress"
    return "pending"


def store_status(value: str | None) -> str:
    key = (value or "pending").strip().lower().replace("-", "_").replace(" ", "_")
    if key == "inprogress":
        key = "in_progress"
    if key == "overdue":
        return "pending"
    if key not in ("pending", "in_progress", "completed", "rejected", "requested"):
        return "pending"
    return key


def store_term(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    key = value.strip().lower().replace("_", "-").replace(" ", "-")
    aliases = {
        "short-term": "short-term",
        "mid-term": "mid-term",
        "medium-term": "mid-term",
        "long-term": "long-term",
    }
    return aliases.get(key)


def category_of(row: StudentActivityV2) -> str:
    text = (row.description or "").strip()
    for name in _CATEGORIES:
        if text.lower() == name.lower():
            return name
    term = (row.term or "").lower()
    return _TERM_LABELS.get(term, "Other")


def display_term(value: str | None) -> str:
    return _TERM_LABELS.get((value or "").lower(), "Short Term")


def display_status(status: str) -> str:
    return "in-progress" if status == "in_progress" else status


def design_activity(row: StudentActivityV2, name: str, usn: str, now: datetime | None = None) -> dict:
    status = effective_status(row, now)
    return {
        "id": f"ACT{row.id:03d}",
        "numeric_id": row.id,
        "usn": usn,
        "studentName": name or usn,
        "title": row.title,
        "category": category_of(row),
        "termType": display_term(row.term),
        "deadline": row.due_date.date().isoformat() if row.due_date else "",
        "remarks": row.mentor_remarks,
        "completionDays": None,
        "benefitted": status == "completed",
        "proof": None,
        "status": display_status(status),
    }


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


def _months(now: datetime, count: int = 7) -> list[tuple[int, int, str]]:
    items: list[tuple[int, int, str]] = []
    year, month = now.year, now.month
    for _ in range(count):
        items.append((year, month, calendar.month_abbr[month]))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    items.reverse()
    return items


def _ui_meeting_status(row: Meetings, now: datetime) -> str:
    status = (row.status or "").lower()
    if status == "cancelled":
        return "cancelled"
    if status == "completed" or (row.meeting_date and row.meeting_date < now):
        return "completed"
    if status == "pending":
        return "pending"
    return "confirmed"


def _session_kind(agenda: str | None) -> str:
    text = (agenda or "").lower()
    if "career" in text:
        return "Career guidance"
    if "research" in text or "swot" in text:
        return "Research support"
    if "activity" in text or "submission" in text:
        return "Activity reviews"
    return "Progress reviews"


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def build_mentor_statistics(db: Session, mentor_id: str) -> dict:
    now = datetime.now()
    students = (
        db.query(Student)
        .filter(Student.assigned_mentor == mentor_id)
        .order_by(Student.student_name.asc())
        .all()
    )
    names = {row.uid: row.student_name or row.student_usn for row in students if row.uid}
    usns = {row.uid: row.student_usn for row in students if row.uid}
    uids = list(names)
    activities = (
        db.query(StudentActivityV2).filter(StudentActivityV2.uid.in_(uids)).order_by(StudentActivityV2.id.asc()).all()
        if uids
        else []
    )
    activities = [row for row in activities if (row.status or "").lower() != "requested"]
    meetings = (
        db.query(Meetings).filter(Meetings.mentor_id == mentor_id).order_by(Meetings.meeting_date.asc()).all()
    )
    messages = (
        db.query(MentorMessage).filter(MentorMessage.mentor_id == mentor_id).order_by(MentorMessage.id.asc()).all()
    )

    status_counts = {"completed": 0, "in-progress": 0, "overdue": 0, "rejected": 0, "pending": 0}
    term_counts: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for row in activities:
        status = display_status(effective_status(row, now))
        status_counts[status] = status_counts.get(status, 0) + 1
        term_key = (row.term or "unset").lower()
        term_counts[term_key] = term_counts.get(term_key, 0) + 1
        category = category_of(row)
        by_category[category] = by_category.get(category, 0) + 1

    completed = status_counts["completed"]
    completion = round(completed / len(activities) * 100) if activities else None

    cards = []
    scores: list[float] = []
    for student in students:
        score = _score(db, student.uid)
        own = [row for row in activities if row.uid == student.uid]
        own_done = sum(1 for row in own if effective_status(row, now) == "completed")
        progress = round(score) if score is not None else (round(own_done / len(own) * 100) if own else None)
        if score is not None:
            scores.append(score)
        cards.append(
            {
                "usn": student.student_usn,
                "uid": student.uid,
                "name": student.student_name or student.student_usn,
                "program": student.student_program or "",
                "activities": len(own),
                "score": score,
                "progress": progress,
            }
        )

    completion_series = []
    engagement_series = []
    monthly_sessions = []
    monthly_progress = []
    month_labels = []
    for year, month, label in _months(now):
        due = [
            row
            for row in activities
            if row.due_date and row.due_date.year == year and row.due_date.month == month
        ]
        held = [
            row
            for row in meetings
            if row.meeting_date
            and row.meeting_date.year == year
            and row.meeting_date.month == month
            and (row.status or "").lower() != "cancelled"
        ]
        month_labels.append(label)
        monthly_sessions.append(len(held))
        if due:
            done = sum(1 for row in due if effective_status(row, now) == "completed")
            completion_series.append({"name": label, "value": round(done / len(due) * 100)})
            engagement_series.append(
                {"name": label, "value": round(sum(row.progress_pct or 0 for row in due) / len(due))}
            )
            monthly_progress.append(engagement_series[-1]["value"])
        else:
            monthly_progress.append(0)

    durations = [row.duration for row in meetings if isinstance(row.duration, int) and row.duration > 0]
    avg_duration = round(sum(durations) / len(durations)) if durations else None
    attendance = attendance_percent(db, mentor_id=mentor_id)

    upcoming_rows = []
    history_count = 0
    held_count = 0
    past_count = 0
    mix: dict[str, int] = {}
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    week = []
    for row in meetings:
        kind = _session_kind(row.agenda)
        mix[kind] = mix.get(kind, 0) + 1
        status = _ui_meeting_status(row, now)
        if row.meeting_date and row.meeting_date < now:
            past_count += 1
            if status != "cancelled":
                held_count += 1
        if status == "completed":
            history_count += 1
        if status in ("confirmed", "pending") and row.meeting_date and row.meeting_date >= now:
            upcoming_rows.append(row)
        if row.meeting_date and week_start <= row.meeting_date < week_end and status != "cancelled":
            week.append(row)

    session_rate = round(held_count / past_count * 100) if past_count else None
    replied = 0
    inbound = 0
    by_student: dict[str, list[MentorMessage]] = {}
    for message in messages:
        by_student.setdefault(message.student_usn, []).append(message)
    for thread in by_student.values():
        student_ids = [item.id for item in thread if item.sender == "student"]
        if not student_ids:
            continue
        inbound += 1
        latest = max(student_ids)
        if any(item.sender == "mentor" and item.id > latest for item in thread):
            replied += 1
    response_rate = round(replied / inbound * 100) if inbound else None

    best = max(by_category, key=by_category.get) if by_category else None
    average_score = _mean(scores)
    progress_label = f"{round(average_score)}%" if average_score is not None else None
    if progress_label is None and activities:
        progress_values = [card["progress"] for card in cards if isinstance(card["progress"], int)]
        if progress_values:
            progress_label = f"{round(sum(progress_values) / len(progress_values))}%"

    def meeting_card(row: Meetings) -> dict:
        when = row.meeting_date
        return {
            "id": row.srno,
            "meeting_id": row.id,
            "title": row.agenda or "Mentor meeting",
            "date": when.strftime("%b %d, %Y") if when else "",
            "time": when.strftime("%I:%M %p").lstrip("0") if when else "",
            "dateTime": when.isoformat() if when else None,
            "day": when.strftime("%a") if when else "",
            "duration": row.duration or 0,
            "location": row.venue or "",
            "attendees": [row.student_usn],
            "attendee": next((card["name"] for card in cards if card["usn"] == row.student_usn), row.student_usn),
            "status": _ui_meeting_status(row, now),
            "agenda": row.agenda or "",
            "notes": row.progress_notes or "",
            "isVirtual": (row.meeting_mode or "") == "online" or (row.venue or "").lower() in ("virtual", "online"),
            "type": "Video Call" if (row.meeting_mode or "") == "online" else "In-person",
            "attendees_count": 1,
        }

    design_rows = [
        design_activity(row, names.get(row.uid, ""), usns.get(row.uid, ""), now) for row in activities
    ]
    upcoming_cards = [meeting_card(row) for row in upcoming_rows]
    counts = {
        "mentees": len(students),
        "activities": len(activities),
        "meetings": len(upcoming_cards),
        "meetings_total": len(meetings),
        "meetings_upcoming": len(upcoming_cards),
        "completion": completion,
        "average_score": average_score,
        "attendance_rate": attendance,
        "avg_duration_minutes": avg_duration,
    }
    return {
        "generated_at": now.isoformat(timespec="seconds"),
        "rules": {
            "summary": (
                "Completion is completed activities divided by every assigned activity. "
                "A past due date that is still open counts as overdue. "
                "Attendance is present and late marks divided by all marks from the last 30 days. "
                "A month is shown only when an activity is due in that month."
            )
        },
        "counts": counts,
        "status_counts": status_counts,
        "term_counts": term_counts,
        "insights": {
            "overdue": status_counts["overdue"],
            "without_score": sum(1 for card in cards if card["score"] is None),
            "upcoming": len(upcoming_cards),
            "progress": progress_label,
            "best_category": best,
            "avg_duration": f"{avg_duration} min" if avg_duration is not None else None,
            "active_mentees": len(students),
        },
        "students": cards,
        "breakdown": [
            {
                "name": name,
                "value": value,
                "color": _CATEGORY_COLORS.get(name, "primary"),
            }
            for name, value in sorted(by_category.items(), key=lambda item: item[1], reverse=True)
            if value
        ],
        "completion_series": completion_series,
        "engagement_series": engagement_series,
        "activities": design_rows,
        "meetings": upcoming_cards[:8],
        "all_meetings": [meeting_card(row) for row in meetings],
        "week": [
            {
                "id": card["id"],
                "title": card["title"],
                "day": card["day"],
                "time": card["time"],
                "type": card["type"],
                "attendees": card["attendees_count"],
            }
            for card in (meeting_card(row) for row in week)
        ],
        "session_mix": [{"name": name, "value": value} for name, value in mix.items()],
        "monthly": {"months": month_labels, "sessions": monthly_sessions, "progress": monthly_progress},
        "profile_metrics": {
            "response_rate": response_rate,
            "session_completion_rate": session_rate,
            "mentee_progress_rate": round(average_score) if average_score is not None else None,
            "attendance_rate": attendance,
        },
        "summary": {
            "active": len(students),
            "sessions_completed": held_count,
            "sessions_recorded": history_count,
            "upcoming": len(upcoming_cards),
        },
    }
