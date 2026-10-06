"""Assemble Profile Dashboard payloads from DB + living reports."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.data.mock_tracker_profile import (
    COMPETENCY_BADGES,
    DEFAULT_ACHIEVEMENTS_SEMESTER,
    DEFAULT_CAREER_EXPERIENCE,
    DEFAULT_CAREER_GOAL,
    DEFAULT_COMPETENCY_SKILLS,
    DEFAULT_GROWTH_ANALYSIS,
    DEFAULT_LEARNING_RESOURCES,
    DEFAULT_PERFORMANCE_INDICATORS,
    DEFAULT_PROFILE_SKILLS,
    DEFAULT_RECENT_ACTIVITY,
    LINK_TYPE_LABELS,
    MOCK_ACADEMIC_HONORS,
    MOCK_ATTENDANCE_HISTORY,
    MOCK_CURRENT_COURSES,
    MOCK_DOCUMENT_LIBRARY,
    MOCK_GPA_TREND,
    MOCK_PROFILE_ACHIEVEMENTS,
)
from app.db.models.meetings import Meetings
from app.db.models.mentors import Mentor
from app.db.models.student_platform import CampusActivity, StudentActivityV2, StudentLink
from app.db.models.students import Student
from app.services.demo_utils import allow_sample_content
from app.services.living_report_service import get_report


def _use_samples(st: Student | None) -> bool:
    return allow_sample_content(st.student_usn if st else None)


def mentor_display_name(db: Session, mentor_id: str | None) -> str:
    if not mentor_id:
        return "Assigned Mentor"
    row = db.query(Mentor).filter(Mentor.mentor_id == mentor_id).first()
    return row.mentor_name if row else mentor_id


def _format_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = "".join(c for c in str(raw) if c.isdigit())
    if len(digits) == 10:
        return f"+1 ({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return str(raw).strip()


def _joined_label(batch: str | None) -> str:
    if not batch:
        return "September 2022"
    try:
        year = int(str(batch).split("-")[0])
        return f"September {year}"
    except (ValueError, IndexError):
        return "September 2022"


def load_student_links(db: Session, uid: str, st: Student | None) -> list[dict[str, str]]:
    rows = db.query(StudentLink).filter(StudentLink.uid == uid).order_by(StudentLink.id).all()
    links: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        label = LINK_TYPE_LABELS.get((row.link_type or "").lower(), row.link_type or "Link")
        identity = ((row.link_type or label).strip().lower(), (row.url or "").strip())
        if identity in seen:
            continue
        seen.add(identity)
        links.append({"label": label, "url": row.url, "id": row.id, "type": row.link_type})
    if links:
        return links
    if st and st.linkedin:
        return [{"label": "LinkedIn", "url": st.linkedin, "type": "linkedin"}]
    return [
        {"label": "LinkedIn", "url": "https://linkedin.com", "type": "linkedin"},
        {"label": "Portfolio", "url": "https://example.com", "type": "portfolio"},
        {"label": "GitHub", "url": "https://github.com", "type": "github"},
    ]


def meeting_counts(db: Session, usn: str) -> tuple[int, int, int]:
    meetings = db.query(Meetings).filter(Meetings.student_usn == usn).all()
    completed = sum(1 for m in meetings if (m.status or "").lower() == "completed")
    upcoming = sum(1 for m in meetings if (m.status or "").lower() in ("approved", "scheduled", "pending"))
    return completed, upcoming, len(meetings)


def activity_task_counts(db: Session, uid: str) -> tuple[int, int, int, int]:
    acts = [
        row
        for row in db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).all()
        if (row.status or "").lower() != "requested"
    ]
    campus = db.query(CampusActivity).filter(CampusActivity.uid == uid).count()
    completed = sum(1 for a in acts if (a.status or "").lower() == "completed") + campus
    in_progress = sum(1 for a in acts if (a.status or "").lower() in ("in_progress", "in progress", "active"))
    total = len(acts) + campus
    task_done = completed + max(0, in_progress - 1)
    task_total = max(25, total + 16) if total else 25
    return completed, total, task_done, task_total


def profile_stats_rows(db: Session, uid: str, facts: dict[str, Any]) -> list[dict[str, str]]:
    st = db.query(Student).filter(Student.uid == uid).first()
    usn = facts.get("usn") or (st.student_usn if st else "")
    act_done, act_total, task_done, task_total = activity_task_counts(db, uid)
    meet_done, _meet_up, _meet_all = meeting_counts(db, usn)
    act_cap = max(15, act_total or 15)
    meet_cap = 10
    return [
        {"label": "Activities", "value": f"{act_done}/{act_cap}", "trend": ""},
        {"label": "Meetings", "value": f"{meet_done}/{meet_cap}", "trend": ""},
        {"label": "Tasks", "value": f"{min(task_done, task_total)}/{task_total}", "trend": ""},
    ]


def profile_skill_breakdown(db: Session, uid: str) -> list[dict[str, Any]]:
    dash = get_report(db, uid, "tracker_dashboard")
    if dash and dash.structured_state:
        skills = dash.structured_state.get("skills_overview")
        if skills:
            stated = []
            for s in skills[:8]:
                pct = s.get("pct") if isinstance(s, dict) else None
                if not isinstance(pct, (int, float)) or not s.get("name"):
                    continue
                stated.append({"name": s.get("name"), "pct": int(pct)})
            if stated:
                return stated
    acad = get_report(db, uid, "academic_report")
    if acad and acad.structured_state and acad.structured_state.get("skills"):
        return acad.structured_state["skills"]
    st = db.query(Student).filter(Student.uid == uid).first()
    if not _use_samples(st):
        return []
    return list(DEFAULT_PROFILE_SKILLS)


def profile_achievements_list(db: Session, uid: str, *, samples: bool = True) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    campus = (
        db.query(CampusActivity)
        .filter(CampusActivity.uid == uid)
        .order_by(CampusActivity.id.desc())
        .limit(4)
        .all()
    )
    for row in campus:
        out.append(
            {
                "title": row.event_name or "External activity",
                "date": row.record_date or "Recorded",
                "tag": (row.role or "Activity")[:32],
                "status": "completed",
            }
        )
    acts = (
        db.query(StudentActivityV2)
        .filter(StudentActivityV2.uid == uid)
        .order_by(StudentActivityV2.due_date.desc())
        .limit(4)
        .all()
    )
    for a in acts:
        if len(out) >= 4:
            break
        if (a.status or "").lower() == "requested":
            continue
        status = (a.status or "").lower()
        completed = status == "completed"
        date = "Completed" if completed else f"In progress ({a.progress_pct or 0}% complete)"
        if a.due_date and completed:
            date = a.due_date.strftime("Completed on %b %d, %Y")
        out.append(
            {
                "title": a.title,
                "date": date,
                "tag": (a.term or "Activity")[:32],
                "status": "completed" if completed else "progress",
            }
        )
    if out:
        return out[:4]
    if not samples:
        return []
    return [dict(a) for a in MOCK_PROFILE_ACHIEVEMENTS]


def build_personal_block(db: Session, uid: str, facts: dict[str, Any], st: Student | None) -> dict[str, Any]:
    mentor = mentor_display_name(db, st.assigned_mentor if st else None)
    program = facts.get("program", "Programme")
    sem = facts.get("semester", 1)
    samples = _use_samples(st)
    phone = _format_phone(st.student_phoneno if st else None) or ("+1 (555) 123-4567" if samples else "")
    alt = _format_phone(getattr(st, "mother_contact", None) if st else None) or _format_phone(
        getattr(st, "father_contact", None) if st else None
    )
    email = (st.student_email if st else None) or f"{facts.get('usn', 'student')}@university.edu"
    perf = float(facts.get("completion_pct", 0) or 0)
    tags: list[str] = []
    if perf >= 65:
        tags.append("Top Performer")
    if st and st.verified_at:
        tags.append("Verified")
    elif samples and not tags:
        tags.append("Verified")

    now = datetime.now(timezone.utc)
    last_login = now.strftime("Today, %I:%M %p").replace(" 0", " ").lstrip("0")

    return {
        "name": facts.get("full_name"),
        "initials": _initials(facts.get("full_name")),
        "usn": facts.get("usn"),
        "program": program,
        "program_line": f"{program} • Year {sem}",
        "email": email,
        "verified": bool(st and st.verified_at),
        "top_performer": perf >= 65,
        "tags": tags,
        "contact": {
            "email": email,
            "phone": phone,
            "phone_alt": alt or ("+1 (555) 987-6543" if samples else ""),
        },
        "academic": {
            "student_id": facts.get("usn"),
            "department": program,
            "year": sem,
            "year_label": f"Year {sem}",
            "mentor": mentor,
        },
        "location": {
            "campus": "International Campus" if samples else "",
            "joined": _joined_label(st.student_batch if st else None),
            "last_login": last_login,
        },
        "links": load_student_links(db, uid, st),
    }


def _initials(name: str | None) -> str:
    if not name:
        return "??"
    parts = str(name).strip().split()
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    return name[:2].upper()


def _standing_label(gpa: float, *, has_gpa: bool = True) -> str:
    if not has_gpa:
        return "No marksheet yet"
    if gpa >= 3.5:
        return "Good"
    if gpa >= 3.0:
        return "Satisfactory"
    return "Needs Improvement"


def _gpa_trend_series(gpa: float) -> list[dict[str, Any]]:
    g = round(float(gpa), 1)
    if g >= 3.5:
        return [dict(x) for x in MOCK_GPA_TREND]
    return [
        {"term": "Fall 2021", "gpa": round(max(2.5, g - 0.3), 1)},
        {"term": "Spring 2022", "gpa": round(max(2.6, g - 0.2), 1)},
        {"term": "Fall 2022", "gpa": round(max(2.7, g - 0.1), 1)},
        {"term": "Spring 2023", "gpa": round(max(2.8, g - 0.05), 1)},
        {"term": "Fall 2023", "gpa": g},
    ]


def _competency_score(gpa: float) -> float:
    if gpa >= 3.7:
        return 4.8
    return round(min(5.0, 3.5 + gpa / 10), 1)


def build_academic_tab(
    db: Session,
    uid: str,
    st: Student | None,
    facts: dict[str, Any],
    gpa: float,
    records: list[Any] | None = None,
) -> dict[str, Any]:
    """Academic tab: profile, courses, attendance, GPA trend, honors, competency."""
    acad_report = get_report(db, uid, "academic_report")
    state = (acad_report.structured_state or {}) if acad_report else {}
    g = float(gpa)
    has_gpa = bool(state.get("gpa")) and float(state.get("gpa") or 0) > 0
    samples = _use_samples(st)
    courses = state.get("current_courses") or (list(MOCK_CURRENT_COURSES) if samples else [])
    gpa_trend = state.get("gpa_trend") or (_gpa_trend_series(g) if samples else [])
    if gpa_trend and isinstance(gpa_trend[0], dict):
        gpa_trend = [{"term": x.get("term"), "gpa": float(x.get("gpa", g))} for x in gpa_trend]

    credit_default = 65 if samples else 0
    req_earned = int(state.get("required_credits_earned", state.get("credits_earned", credit_default)))
    req_total = int(state.get("required_credits_total", state.get("credits_required", 100 if samples else 0)))
    elec_earned = int(state.get("elective_credits_earned", 21 if samples else 0))
    elec_total = int(state.get("elective_credits_total", 30 if samples else 0))

    academic = {
        "department": (st.student_program if st else None) or facts.get("program", "Computer Science"),
        "year": st.semester if st else facts.get("semester", 3),
        "student_id": (st.student_usn if st else None) or facts.get("usn", ""),
        "gpa": g,
        "standing": _standing_label(g) if samples or has_gpa else "No marksheet yet",
        "courses": courses,
        "gpa_trend": gpa_trend,
        "credit_progress": {
            "required": {"earned": req_earned, "total": req_total},
            "elective": {"earned": elec_earned, "total": elec_total},
        },
        "progress_bars": {
            "credits_earned": req_earned,
            "credits_required": req_total,
            "course_completion_pct": int(facts.get("completion_pct", 65)),
        },
        "records": records or [],
    }

    attendance = state.get("attendance_history") or (list(MOCK_ATTENDANCE_HISTORY) if samples else [])
    honors = state.get("honors") or (list(MOCK_ACADEMIC_HONORS) if samples and g >= 3.5 else [])
    skills = state.get("competency_skills") or ([dict(s) for s in DEFAULT_COMPETENCY_SKILLS] if samples else [])
    if state.get("competency_score") is not None and samples:
        score = float(state["competency_score"])
    elif samples:
        score = _competency_score(g)
    else:
        from app.services.student_score import score_student

        overall = score_student(db, uid).get("overall")
        score = round(float(overall) / 20, 1) if overall is not None else 0.0

    competency = {
        "score": score,
        "stars": 0 if score <= 0 else min(5, max(1, int(round(score)))),
        "skills": skills,
        "badges": state.get("competency_badges") or ([dict(b) for b in COMPETENCY_BADGES] if samples else []),
    }

    return {
        "academic": academic,
        "attendance_history": attendance,
        "honors": honors,
        "competency": competency,
    }


def _mentor_initials(name: str) -> str:
    parts = [p for p in name.replace(".", " ").split() if p]
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[-1][0]}".upper()
    return _initials(name)


def _normalize_growth_analysis(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list) and raw:
        out: list[dict[str, Any]] = []
        for item in raw:
            if isinstance(item, dict) and item.get("label") is not None:
                out.append({"label": item["label"], "pct": int(item.get("pct", 0) or 0)})
        if out:
            return out
    if isinstance(raw, dict):
        if raw.get("label") is not None and raw.get("pct") is not None:
            return [{"label": raw["label"], "pct": int(raw["pct"] or 0)}]
        return [
            {"label": "Technical Growth", "pct": int(raw.get("skills_pct", 42) or 42)},
            {"label": "Soft Skills", "pct": int(raw.get("meetings_pct", 23) or 23)},
        ]
    return [dict(x) for x in DEFAULT_GROWTH_ANALYSIS]


def _normalize_learning_resources(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list) or not raw:
        return [dict(x) for x in DEFAULT_LEARNING_RESOURCES]
    out: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, str):
            out.append(
                {
                    "title": item[:120],
                    "description": "",
                    "badge": "Recommended",
                    "rating": "",
                }
            )
        elif isinstance(item, dict) and item.get("title"):
            out.append(dict(item))
    return out or [dict(x) for x in DEFAULT_LEARNING_RESOURCES]


def build_career_tab(
    db: Session,
    uid: str,
    st: Student | None,
    facts: dict[str, Any],
    career_records: list[Any] | None = None,
    narrative: str | None = None,
) -> dict[str, Any]:
    career_report = get_report(db, uid, "career_report")
    state = (career_report.structured_state or {}) if career_report else {}

    samples = _use_samples(st)
    goals = state.get("goals") or narrative or (DEFAULT_CAREER_GOAL if samples else "")
    if len(goals) < 40 and narrative:
        goals = narrative

    experience = state.get("experience")
    if not experience:
        if career_records:
            experience = []
            for i, c in enumerate(career_records):
                fallback = DEFAULT_CAREER_EXPERIENCE[min(i, len(DEFAULT_CAREER_EXPERIENCE) - 1)] if samples else {}
                experience.append(
                    {
                        "title": c.title,
                        "org": c.org or fallback.get("org", ""),
                        "bullets": list((c.extra.get("bullets") if isinstance(c.extra, dict) else None) or fallback.get("bullets") or []),
                    }
                )
        elif samples:
            experience = [dict(x) for x in DEFAULT_CAREER_EXPERIENCE]
        else:
            experience = []

    mentor_name = mentor_display_name(db, st.assigned_mentor if st else None)
    act_done, act_total, _td, _tt = activity_task_counts(db, uid)
    usn = facts.get("usn") or (st.student_usn if st else "")
    meet_done, _up, _all = meeting_counts(db, usn)
    act_cap = max(15, act_total or 15)

    skills = profile_skill_breakdown(db, uid)

    career = {
        "goals": goals,
        "experience": experience,
        "mentor": {
            "name": mentor_name,
            "initials": _mentor_initials(mentor_name),
            "role_line": state.get("mentor_role_line") or ("Senior Data Scientist • Weekly Meetings" if samples else ""),
        },
        "analytics": {
            "title": "Analytics Report",
            "subtitle": "Summary of your performance metrics",
            "activities": {
                "value": f"{act_done}/{act_cap}",
                "trend": state.get("activities_trend") or ("↑ +3 this month" if samples else ""),
            },
            "meetings": {
                "value": f"{meet_done}/10",
                "trend": state.get("meetings_trend") or ("↑ +2 this month" if samples else ""),
            },
        },
        "skill_breakdown": skills,
        "performance_indicators": state.get("performance_indicators") or ([dict(x) for x in DEFAULT_PERFORMANCE_INDICATORS] if samples else []),
        "achievements_semester": state.get("achievements_semester") or ([dict(x) for x in DEFAULT_ACHIEVEMENTS_SEMESTER] if samples else []),
        "recent_activity": state.get("recent_activity") or ([dict(x) for x in DEFAULT_RECENT_ACTIVITY] if samples else []),
        "growth_analysis": _normalize_growth_analysis(state.get("growth_analysis")) if samples or state.get("growth_analysis") else [],
        "learning_resources": _normalize_learning_resources(state.get("learning_resources")) if samples or state.get("learning_resources") else [],
    }

    return {"career": career}


def build_documents_tab(
    db: Session,
    uid: str,
    facts: dict[str, Any],
    st: Student | None,
    gpa: float,
    existing_documents: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Extend documents payload with library list from mock or DB."""
    library = list(MOCK_DOCUMENT_LIBRARY) if _use_samples(st) else []
    docs_payload = dict(existing_documents or {})
    docs_payload["library"] = library
    return {"documents": docs_payload}
