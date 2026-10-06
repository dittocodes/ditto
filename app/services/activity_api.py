"""Serialize StudentActivityV2 rows for Tracker activities UI."""
from __future__ import annotations

from app.db.models.student_platform import StudentActivityV2

_TERM_TAGS = {
    "short-term": "Short-term",
    "mid-term": "Mid-term",
    "long-term": "Long-term",
}

_STATUS_TAGS = {
    "pending": "Pending",
    "in_progress": "In Progress",
    "in-progress": "In Progress",
    "completed": "Completed",
    "overdue": "Overdue",
    "rejected": "Rejected",
    "requested": "Waiting for mentor",
}


def is_assigned_activity(row: StudentActivityV2) -> bool:
    return (row.status or "").lower() != "requested"


def activity_to_api(row: StudentActivityV2) -> dict:
    from app.services.mentor_stats import effective_status
    status = effective_status(row)
    term = (row.term or "").lower()
    term_tag = _TERM_TAGS.get(term, row.term or "")
    status_tag = _STATUS_TAGS.get(status, status.replace("_", " ").title())
    if status == "in_progress":
        icon = "progress"
    elif status == "completed":
        icon = "completed"
    else:
        icon = "pending"
    return {
        "id": row.id,
        "title": row.title,
        "description": row.description,
        "status": status,
        "status_tag": status_tag,
        "progress_pct": row.progress_pct,
        "due_date": row.due_date.isoformat() if row.due_date else None,
        "term": row.term,
        "term_tag": term_tag,
        "term_type": term,
        "priority": row.priority,
        "icon": icon,
        "mentor_remarks": row.mentor_remarks,
        "origin": row.origin or "mentor",
    }
