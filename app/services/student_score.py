"""Score a student from evidence that is already stored. Missing parts are left out."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db.models.meetings import Meetings
from app.db.models.student_platform import CampusActivity, StudentActivityV2
from app.db.models.students import Student
from app.services.demo_utils import allow_sample_content
from app.services.living_report_service import get_report

_WEIGHTS = {
    "academic": 35,
    "skills": 25,
    "experience": 15,
    "activities": 15,
    "meetings": 10,
}
_LABELS = {
    "academic": "Academic",
    "skills": "Skills",
    "experience": "Experience",
    "activities": "Activities",
    "meetings": "Meetings",
}


def _clamp(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 1)


def compute_evidence_score(
    *,
    gpa: float | None = None,
    cgpa_10: float | None = None,
    printed_percents: list[float] | None = None,
    skill_count: int = 0,
    experience_count: int = 0,
    activities_total: int = 0,
    activities_completed: int = 0,
    meetings_completed: int = 0,
    meetings_upcoming: int = 0,
) -> dict[str, Any]:
    parts: list[dict[str, Any]] = []
    percents = [float(item) for item in (printed_percents or []) if isinstance(item, (int, float))]

    academic = None
    if gpa is not None and 0 < float(gpa) <= 4:
        academic = float(gpa) / 4 * 100
    elif cgpa_10 is not None and 0 < float(cgpa_10) <= 10:
        academic = float(cgpa_10) / 10 * 100
    elif percents:
        academic = sum(percents) / len(percents)
    if academic is not None:
        parts.append({"key": "academic", "score": _clamp(academic)})

    if skill_count > 0:
        coverage = min(100.0, skill_count / 8 * 100)
        if percents:
            skills_score = (coverage + (sum(percents) / len(percents))) / 2
        else:
            skills_score = coverage
        parts.append({"key": "skills", "score": _clamp(skills_score)})

    if experience_count > 0:
        parts.append({"key": "experience", "score": _clamp(min(100.0, 40 + 20 * experience_count))})

    if activities_total > 0:
        parts.append(
            {
                "key": "activities",
                "score": _clamp(100 * activities_completed / activities_total),
            }
        )

    meeting_total = meetings_completed + meetings_upcoming
    if meeting_total > 0:
        parts.append(
            {
                "key": "meetings",
                "score": _clamp(100 * meetings_completed / meeting_total),
            }
        )

    weight_sum = sum(_WEIGHTS[part["key"]] for part in parts)
    overall = None
    if weight_sum:
        overall = _clamp(sum(part["score"] * _WEIGHTS[part["key"]] for part in parts) / weight_sum)
    for part in parts:
        part["label"] = _LABELS[part["key"]]
        part["weight"] = _WEIGHTS[part["key"]]
    return {
        "overall": overall,
        "parts": parts,
        "skill_count": skill_count,
        "programme_rank": None,
    }


def _report_state(db: Session, uid: str, report_type: str) -> dict[str, Any]:
    row = get_report(db, uid, report_type)
    return dict(row.structured_state or {}) if row else {}


def evidence_for_uid(db: Session, uid: str) -> dict[str, Any]:
    student = db.query(Student).filter(Student.uid == uid).first()
    academic = _report_state(db, uid, "academic_report")
    career = _report_state(db, uid, "career_report")
    dash = _report_state(db, uid, "tracker_dashboard")
    gpa = academic.get("gpa")
    cgpa = academic.get("cgpa_10")
    percents = []
    for row in dash.get("skills_overview") or []:
        if isinstance(row, dict) and isinstance(row.get("pct"), (int, float)) and row.get("name"):
            percents.append(float(row["pct"]))
    attained = [row for row in (dash.get("attained_skills") or []) if isinstance(row, dict) and row.get("name")]
    skill_count = len(attained) or int(dash.get("skills_acquired") or 0)
    experience = [
        row
        for row in (career.get("experience") or [])
        if isinstance(row, dict) and str(row.get("title") or "").strip()
    ]
    activities = [
        row
        for row in db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).all()
        if (row.status or "").lower() != "requested"
    ]
    activities.extend(db.query(CampusActivity).filter(CampusActivity.uid == uid).all())
    completed = 0
    for row in activities:
        status = (getattr(row, "status", None) or "")
        if not status and isinstance(row, CampusActivity):
            status = "completed"
        if status == "completed":
            completed += 1
    usn = student.student_usn if student else ""
    meetings = db.query(Meetings).filter(Meetings.student_usn == usn).all() if usn else []
    meetings_done = sum(1 for row in meetings if (row.status or "").lower() in ("completed", "approved"))
    meetings_upcoming = sum(1 for row in meetings if (row.status or "").lower() in ("scheduled", "pending"))
    return {
        "program": (student.student_program or "").strip().lower() if student else "",
        "gpa": float(gpa) if isinstance(gpa, (int, float)) and float(gpa) > 0 else None,
        "cgpa_10": float(cgpa) if isinstance(cgpa, (int, float)) and float(cgpa) > 0 else None,
        "printed_percents": percents,
        "skill_count": skill_count,
        "experience_count": len(experience),
        "activities_total": len(activities),
        "activities_completed": completed,
        "meetings_completed": meetings_done,
        "meetings_upcoming": meetings_upcoming,
    }


def score_student(db: Session, uid: str, *, with_rank: bool = True) -> dict[str, Any]:
    evidence = evidence_for_uid(db, uid)
    result = compute_evidence_score(
        gpa=evidence["gpa"],
        cgpa_10=evidence["cgpa_10"],
        printed_percents=evidence["printed_percents"],
        skill_count=evidence["skill_count"],
        experience_count=evidence["experience_count"],
        activities_total=evidence["activities_total"],
        activities_completed=evidence["activities_completed"],
        meetings_completed=evidence["meetings_completed"],
        meetings_upcoming=evidence["meetings_upcoming"],
    )
    if with_rank:
        result["programme_rank"] = programme_rank(db, uid, result.get("overall"), evidence["program"])
    return result


def programme_rank(db: Session, uid: str, overall: float | None, program: str) -> int | None:
    if overall is None:
        return None
    peers = db.query(Student).filter(Student.uid.isnot(None)).all()
    scored: list[tuple[str, float]] = [(uid, float(overall))]
    for peer in peers:
        if not peer.uid or peer.uid == uid or allow_sample_content(peer.student_usn):
            continue
        if (peer.student_program or "").strip().lower() != program:
            continue
        peer_score = score_student(db, peer.uid, with_rank=False).get("overall")
        if peer_score is None:
            continue
        scored.append((peer.uid, float(peer_score)))
    ordered = sorted(scored, key=lambda item: (-item[1], item[0]))
    for place, (peer_uid, _score) in enumerate(ordered, start=1):
        if peer_uid == uid:
            return place
    return None


def stored_number(dash: dict[str, Any], *keys: str) -> float:
    """Return a number already saved on the dashboard. Do not derive one."""
    for key in keys:
        value = dash.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    metrics = dash.get("display_metrics") if isinstance(dash.get("display_metrics"), dict) else {}
    for key in keys:
        value = metrics.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return 0.0
