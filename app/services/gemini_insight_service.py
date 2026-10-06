"""Build Tracker UI payloads from DB + living reports (+ optional Gemini copy)."""
from __future__ import annotations

import copy
import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.orm import Session

from app.db.models.meetings import Meetings
from app.db.models.students import Student
from app.db.models.student_platform import (
    AcademicRecord,
    CareerRecord,
    DocumentGenerated,
    KnowledgeBaseEntry,
    LivingReport,
    ReportSnapshot,
    StudentActivityV2,
    SwotEntry,
)
from app.services.gemini_gateway import generate_json
from app.services.insight_cache import cache_key, get as cache_get, set as cache_set
from app.services.living_report_service import get_report
from app.services.vendor_scrub import scrub_vendor_names
from app.data.mock_tracker_profile import MOCK_DOCUMENT_LIBRARY
from app.services.analysis_dashboard_service import build_analysis_tab_payload
from app.services.demo_utils import allow_sample_content, is_demo_day0_usn
from app.services.profile_dashboard_service import (
    build_academic_tab,
    build_career_tab,
    build_personal_block,
    mentor_display_name,
    profile_achievements_list,
    profile_skill_breakdown,
    profile_stats_rows,
)

logger = logging.getLogger(__name__)

_MAX_NARRATIVE = 500
_MAX_INSIGHT = 120


def _report_version(db: Session, uid: str) -> int:
    rows = db.query(LivingReport).filter(LivingReport.uid == uid).all()
    if not rows:
        return 0
    return max(r.version or 1 for r in rows)


def _student_facts(db: Session, uid: str) -> dict[str, Any]:
    st = db.query(Student).filter(Student.uid == uid).first()
    if not st:
        return {}
    acts = db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).all()
    completed = sum(1 for a in acts if a.status == "completed")
    total = len(acts) or 1
    usn = st.student_usn
    meetings = db.query(Meetings).filter(Meetings.student_usn == usn).all()
    meetings_done = sum(1 for m in meetings if (m.status or "").lower() == "completed")
    meetings_upcoming = sum(1 for m in meetings if (m.status or "").lower() in ("approved", "scheduled", "pending"))
    facts_completion = (100 * completed / total) * 0.5 + meetings_done * 5 + 40
    perf = round(min(100, facts_completion), 1)
    return {
        "name": (st.student_name or "").split()[0] if st.student_name else st.student_usn,
        "full_name": st.student_name or st.student_usn,
        "usn": usn,
        "program": st.student_program or "Programme",
        "semester": st.semester or 1,
        "activities_total": len(acts),
        "activities_completed": completed,
        "completion_pct": round(100 * completed / total, 1),
        "meetings_completed": meetings_done,
        "meetings_upcoming": meetings_upcoming,
        "learning_hours": len(acts) * 8 + meetings_done * 2,
        "performance_score": perf,
    }


def _benchmark_from_swot(db: Session, uid: str) -> dict[str, Any]:
    swot = db.query(SwotEntry).filter(SwotEntry.uid == uid).order_by(SwotEntry.generated_at.desc()).first()
    base = [70, 72, 68, 65, 70, 66]
    if swot and swot.strengths:
        boost = min(15, len(swot.strengths) * 3)
        your = [min(100, b + boost) for b in base]
    else:
        your = [78, 85, 65, 70, 72, 68]
    axes = ["Technical Skills", "Problem Solving", "Communication", "Leadership", "Time Management", "Industry Knowledge"]
    return {
        "axes": axes,
        "your_score": your,
        "regional_avg": [74, 75, 80, 68, 70, 65],
        "global_avg": [70, 72, 78, 65, 68, 62],
    }


def _performance_analysis_rows(benchmark: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for i, axis in enumerate(benchmark.get("axes", [])):
        score = benchmark["your_score"][i] if i < len(benchmark.get("your_score", [])) else 70
        global_avg = benchmark["global_avg"][i] if i < len(benchmark.get("global_avg", [])) else 70
        delta = round(score - global_avg, 1)
        rows.append(
            {
                "skill": axis,
                "score": score,
                "global_avg": global_avg,
                "vs_global": delta,
                "trend_pct": abs(int(delta)),
                "trend": "up" if score >= global_avg else "down",
                "narrative": f"Your {axis.lower()} is {'above' if score >= global_avg else 'below'} the global benchmark.",
            }
        )
    return rows


_PATHWAY_SKILLS = {
    "Foundation Skills": ["Problem Solving Basics", "Communication Fundamentals", "Technical Foundation"],
    "Specialization": ["Advanced Technical Skills", "Domain Knowledge", "Project Application"],
    "Industry Project": ["Project Management", "Teamwork", "Problem Solving", "Technical Implementation"],
    "Leadership Development": ["Team Leadership", "Strategic Thinking", "Decision Making"],
}


def _pathway_phases(facts: dict[str, Any]) -> list[dict[str, Any]]:
    sem = facts.get("semester", 1)
    comp = int(facts.get("completion_pct", 65))
    return [
        {
            "title": "Foundation Skills",
            "subtitle": "Core competencies for your career path",
            "status": "completed",
            "duration": "3 months",
            "progress_pct": 100,
            "skills": _PATHWAY_SKILLS["Foundation Skills"],
        },
        {
            "title": "Specialization",
            "subtitle": "Focused learning in your chosen field",
            "status": "completed" if sem > 2 else "active",
            "duration": "4 months",
            "progress_pct": 100 if sem > 2 else 70,
            "skills": _PATHWAY_SKILLS["Specialization"],
        },
        {
            "title": "Industry Project",
            "subtitle": "Real-world application of learned skills",
            "status": "active",
            "duration": "3 months",
            "progress_pct": comp,
            "est_completion": "3 weeks",
            "skills": _PATHWAY_SKILLS["Industry Project"],
        },
        {
            "title": "Leadership Development",
            "subtitle": "Developing leadership and management skills",
            "status": "locked",
            "duration": "2 months",
            "progress_pct": 0,
            "skills": _PATHWAY_SKILLS["Leadership Development"],
        },
    ]


def _profile_personal_block(facts: dict[str, Any], st: Student | None) -> dict[str, Any]:
    mentor = (st.assigned_mentor if st and st.assigned_mentor else None) or "Assigned Mentor"
    program = facts.get("program", "Programme")
    return {
        "name": facts.get("full_name"),
        "usn": facts.get("usn"),
        "program": program,
        "program_line": f"{program} • Year {facts.get('semester', 1)}",
        "email": getattr(st, "student_email", None) if st else None,
        "verified": bool(st and st.verified_at),
        "tags": ["Top Performer", "Verified"] if facts.get("completion_pct", 0) >= 70 else ["Verified"],
        "contact": {
            "email": getattr(st, "student_email", None) if st else f"{facts.get('usn', 'student')}@university.edu",
            "phone": "+1 (555) 123-4567",
            "phone_alt": "+1 (555) 987-6543",
            "address_line1": "",
            "city": "",
            "state": "",
            "postal_code": "",
        },
        "academic": {
            "student_id": facts.get("usn"),
            "department": program,
            "year": facts.get("semester", 1),
            "year_label": f"Year {facts.get('semester', 1)}",
            "mentor": mentor,
        },
        "location": {
            "campus": "International Campus",
            "joined": "September 2022",
            "last_login": "Today",
        },
        "links": [
            {"label": "LinkedIn", "url": "https://linkedin.com"},
            {"label": "Portfolio", "url": "https://example.com"},
            {"label": "GitHub", "url": "https://github.com"},
        ],
    }


@lru_cache(maxsize=1)
def _dashboard_enrich_template() -> str:
    path = Path(__file__).resolve().parent.parent / "prompts" / "dashboard_enrich.yaml"
    if not path.is_file():
        return ""
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return str(data.get("template") or "")


def _safe_copy_text(val: Any, max_len: int) -> str | None:
    if not isinstance(val, str):
        return None
    s = val.strip()
    if not s or len(s) > max_len:
        return None
    return s


def merge_gemini_dashboard_copy(base: dict[str, Any], gemini_out: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(gemini_out, dict):
        return out

    gem_rows = gemini_out.get("performance_analysis")
    base_rows = out.get("performance_analysis") or []
    if isinstance(gem_rows, list) and len(gem_rows) == len(base_rows):
        merged_rows = []
        for i, base_row in enumerate(base_rows):
            gr = gem_rows[i] if isinstance(gem_rows[i], dict) else {}
            if gr.get("skill") != base_row.get("skill") or gr.get("score") != base_row.get("score"):
                merged_rows.append(base_row)
                continue
            nar = _safe_copy_text(gr.get("narrative"), _MAX_NARRATIVE)
            merged_rows.append({**base_row, **({"narrative": nar} if nar else {})})
        out["performance_analysis"] = merged_rows

    gem_panel = (gemini_out.get("benchmark_panel") or {}).get("items")
    base_panel = (out.get("benchmark_panel") or {}).get("items") or []
    if isinstance(gem_panel, list) and len(gem_panel) == len(base_panel):
        items = []
        for i, bi in enumerate(base_panel):
            gi = gem_panel[i] if isinstance(gem_panel[i], dict) else {}
            if gi.get("label") != bi.get("label") or gi.get("score") != bi.get("score"):
                items.append(bi)
                continue
            ins = _safe_copy_text(gi.get("insight"), _MAX_INSIGHT)
            items.append({**bi, **({"insight": ins} if ins else {})})
        out["benchmark_panel"] = {"items": items}

    msg = _safe_copy_text((gemini_out.get("activity_reminders") or {}).get("message"), 280)
    if msg:
        ar = dict(out.get("activity_reminders") or {})
        ar["message"] = msg
        out["activity_reminders"] = ar

    rt = _safe_copy_text((gemini_out.get("meeting_widgets") or {}).get("reminder_text"), 280)
    if rt:
        mw = dict(out.get("meeting_widgets") or {})
        mw["reminder_text"] = rt
        out["meeting_widgets"] = mw

    gem_phases = (gemini_out.get("learning_pathway") or {}).get("phases")
    base_phases = (out.get("learning_pathway") or {}).get("phases") or []
    if isinstance(gem_phases, list) and base_phases:
        by_title: dict[str, str] = {}
        for p in gem_phases:
            if isinstance(p, dict) and p.get("title"):
                sub = _safe_copy_text(p.get("subtitle"), 200)
                if sub:
                    by_title[str(p["title"])] = sub
        if by_title:
            phases = []
            for p in base_phases:
                sub = by_title.get(p.get("title"))
                phases.append({**p, **({"subtitle": sub} if sub else {})})
            out["learning_pathway"] = {"phases": phases}

    return out


def _gemini_enrich_input(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "welcome_name": payload.get("welcome_name"),
        "summary_cards": payload.get("summary_cards"),
        "kpis": [
            {k: v for k, v in kpi.items() if k in ("title", "value", "trend_pct", "weeks", "bar_heights")}
            for kpi in (payload.get("kpis") or [])
        ],
        "global_benchmark": payload.get("global_benchmark"),
        "performance_analysis": payload.get("performance_analysis"),
        "benchmark_panel": payload.get("benchmark_panel"),
        "activity_reminders": payload.get("activity_reminders"),
        "meeting_widgets": {
            "upcoming": (payload.get("meeting_widgets") or {}).get("upcoming"),
            "completed": (payload.get("meeting_widgets") or {}).get("completed"),
            "pending_activities": (payload.get("activity_reminders") or {}).get("pending_activities"),
            "reminder_text": (payload.get("meeting_widgets") or {}).get("reminder_text"),
        },
        "learning_pathway": payload.get("learning_pathway"),
    }


def enrich_dashboard_with_gemini(payload: dict[str, Any]) -> dict[str, Any]:
    template = _dashboard_enrich_template()
    if not template:
        return payload
    prompt = template.replace(
        "{payload_json}",
        json.dumps(_gemini_enrich_input(payload), default=str)[:12000],
    )
    try:
        gem_out = generate_json(prompt)
        if isinstance(gem_out, dict):
            return merge_gemini_dashboard_copy(payload, gem_out)
    except Exception as exc:
        logger.warning("dashboard enrich failed: %s", scrub_vendor_names(str(exc)))
    return payload


def build_overview(db: Session, uid: str, use_gemini: bool = True) -> dict[str, Any]:
    from app.services.dashboard_mapper import assemble_dashboard

    ver = _report_version(db, uid)
    key = cache_key(uid, "overview", version=ver)
    cached = cache_get(key)
    if cached:
        return cached

    payload = assemble_dashboard(db, uid)
    acad = get_report(db, uid, "academic_report")
    if acad and acad.structured_state and acad.structured_state.get("gpa"):
        payload["academic_gpa"] = acad.structured_state.get("gpa")

    if use_gemini:
        payload = enrich_dashboard_with_gemini(payload)
    cache_set(key, payload)
    return payload


def _is_blank_account(db: Session, st: Student | None) -> bool:
    """New signup / Day0 with no living reports yet — do not fill sample profile data."""
    if not st or not is_demo_day0_usn(st.student_usn):
        return False
    return (
        db.query(LivingReport)
        .filter(LivingReport.uid == st.uid, LivingReport.report_type != "onboarding")
        .count()
        == 0
    )


def _blank_profile(tab: str, facts: dict[str, Any], st: Student | None) -> dict[str, Any]:
    email = (st.student_email if st else None) or ""
    usn = facts.get("usn") or (st.student_usn if st else "")
    name = (st.student_name if st else None) or ""
    base: dict[str, Any] = {
        "tab": tab,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "student": facts,
        "blank": True,
    }
    if tab == "overview":
        base.update(
            {
                "personal": {
                    "name": name,
                    "initials": "??",
                    "usn": usn,
                    "program": "",
                    "program_line": "",
                    "email": email,
                    "verified": False,
                    "top_performer": False,
                    "tags": [],
                    "contact": {"email": email, "phone": "", "phone_alt": ""},
                    "academic": {
                        "student_id": usn,
                        "department": "",
                        "year": "",
                        "year_label": "",
                        "mentor": "",
                    },
                    "location": {"campus": "", "joined": "", "last_login": ""},
                    "links": [],
                },
                "profile_stats": [
                    {"label": "Activities", "value": "0/0", "trend": ""},
                    {"label": "Meetings", "value": "0/0", "trend": ""},
                    {"label": "Tasks", "value": "0/0", "trend": ""},
                ],
                "achievements": [],
                "skill_breakdown": [],
                "attendance_history": [],
                "honors": [],
                "recent_activity": [],
                "growth_analysis": [],
                "learning_resources": [],
                "performance_badges": [],
                "achievements_semester": [],
                "competency": {"score": 0, "skills": [], "badges": []},
                "badges": [],
            }
        )
    elif tab == "academic":
        base.update(
            {
                "academic": {
                    "department": "",
                    "year": "",
                    "student_id": usn,
                    "gpa": 0,
                    "standing": "",
                    "courses": [],
                    "gpa_trend": [],
                    "credit_progress": {
                        "required": {"earned": 0, "total": 0},
                        "elective": {"earned": 0, "total": 0},
                    },
                    "progress_bars": {
                        "credits_earned": 0,
                        "credits_required": 0,
                        "course_completion_pct": 0,
                    },
                    "records": [],
                },
                "attendance_history": [],
                "honors": [],
                "competency": {"score": 0, "stars": 0, "skills": [], "badges": []},
            }
        )
    elif tab == "career":
        base["career"] = {
            "goals": "",
            "experience": [],
            "mentor": {"name": "", "initials": "", "role_line": ""},
            "analytics": {
                "title": "Analytics Report",
                "subtitle": "",
                "activities": {"value": "0/0", "trend": ""},
                "meetings": {"value": "0/0", "trend": ""},
            },
            "skill_breakdown": [],
            "performance_indicators": [],
            "achievements_semester": [],
            "recent_activity": [],
            "growth_analysis": [],
            "learning_resources": [],
        }
    elif tab == "documents":
        base["documents"] = {
            "recent": [],
            "library": [],
            "cv_preview": {
                "name": name,
                "email": email,
                "program": "",
                "program_line": "",
                "student_id": usn,
                "education": {},
                "skills": [],
                "certifications": [],
                "experience": [],
                "international_standards": [],
                "summary": "",
            },
        }
    return base


def _blank_analysis(tab: str, overview: dict[str, Any]) -> dict[str, Any]:
    base: dict[str, Any] = {
        "tab": tab,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "blank": True,
    }
    if tab == "overview":
        enriched = copy.deepcopy(overview)
        enriched["global_benchmark"] = {"axes": [], "your_score": [], "regional_avg": [], "global_avg": []}
        enriched["benchmark_panel"] = {"items": []}
        enriched["kpis"] = []
        enriched["skills_overview"] = []
        enriched["performance_analysis"] = []
        base.update(enriched)
        base["analytics_panel"] = {"activities": 0, "meetings": 0, "achievements": 0}
        base["analytics_sidebar"] = {
            "title": "Analytics Report",
            "subtitle": "",
            "activities": {"value": "0/0", "trend": ""},
            "meetings": {"value": "0/0", "trend": ""},
            "skill_breakdown": [],
            "badges": [],
            "achievements_semester": [],
            "recent_activity": [],
            "growth_analysis": [],
        }
        base["overview_ctas"] = {}
    elif tab == "skills":
        base.update(
            {
                "swot": {
                    "updated": "",
                    "strengths": [],
                    "weaknesses": [],
                    "opportunities": [],
                    "threats": [],
                    "mentor_recommendations": [],
                },
                "swot_tabs": {"S": [], "W": [], "O": [], "T": []},
                "key_metrics": [],
                "skill_assessment": [],
                "mentor_recommendations": [],
                "recommendations": [],
            }
        )
    elif tab == "comparison":
        base.update(
            {
                "comparison": {
                    "categories": [],
                    "current": [],
                    "previous": [],
                    "chart_rows": [],
                    "period_options": ["1M", "3M", "6M", "1Y"],
                    "range": "1M",
                    "compare_note": "",
                },
                "global_benchmark": {"axes": [], "your_score": [], "regional_avg": [], "global_avg": []},
                "performance_analysis": [],
                "activity_progress": {"months": [], "total": [], "completed": []},
            }
        )
    elif tab == "reports":
        base["report_cards"] = []
    return base


def build_profile(db: Session, uid: str, tab: str) -> dict[str, Any]:
    ver = _report_version(db, uid)
    key = cache_key(uid, "profile", tab=tab, version=ver)
    cached = cache_get(key)
    if cached:
        return cached

    facts = _student_facts(db, uid)
    st = db.query(Student).filter(Student.uid == uid).first()
    if _is_blank_account(db, st):
        base = _blank_profile(tab, facts, st)
        cache_set(key, base)
        return base
    base: dict[str, Any] = {"tab": tab, "generated_at": datetime.now(timezone.utc).isoformat(), "student": facts}
    acad_report = get_report(db, uid, "academic_report")
    career_report = get_report(db, uid, "career_report")
    day0_profile = bool(st and is_demo_day0_usn(st.student_usn))
    samples = allow_sample_content(st.student_usn if st else None)
    gpa = (acad_report.structured_state or {}).get("gpa", 3.8 if samples else 0) if acad_report else (3.8 if samples else 0.0)

    if tab == "overview":
        personal = build_personal_block(db, uid, facts, st)
        base["personal"] = personal
        base["profile_stats"] = profile_stats_rows(db, uid, facts)
        base["achievements"] = profile_achievements_list(db, uid, samples=samples)
        base["skill_breakdown"] = profile_skill_breakdown(db, uid)
        dash_report = get_report(db, uid, "tracker_dashboard")
        dash_state = (dash_report.structured_state or {}) if dash_report else {}
        base["attained_skills"] = [
            row
            for row in (dash_state.get("attained_skills") or [])
            if isinstance(row, dict) and row.get("name")
        ]
        if not samples:
            acad_state = (acad_report.structured_state or {}) if acad_report else {}
            career_state = (career_report.structured_state or {}) if career_report else {}
            honors = list(acad_state.get("honors") or [])
            base["attendance_history"] = []
            base["honors"] = honors
            base["recent_activity"] = list(career_state.get("recent_activity") or [])
            base["growth_analysis"] = list(career_state.get("growth_analysis") or [])
            base["learning_resources"] = []
            base["performance_badges"] = []
            base["achievements_semester"] = [
                {"title": row.get("title"), "status": "Completed"} for row in honors[:4] if row.get("title")
            ]
            base["competency"] = {"score": 0, "skills": [], "badges": []}
            from app.services.student_score import score_student

            overall = score_student(db, uid).get("overall")
            if overall is not None:
                comp = round(float(overall) / 20, 1)
                base["competency"] = {
                    "score": comp,
                    "stars": 0 if comp <= 0 else min(5, max(1, int(round(comp)))),
                    "skills": [],
                    "badges": [],
                }
            if not base["achievements"] and honors:
                base["achievements"] = [
                    {
                        "title": row.get("title"),
                        "date": row.get("term") or "Recorded",
                        "tag": "Certificate",
                        "status": "completed",
                    }
                    for row in honors[:4]
                ]
        else:
            base["attendance_history"] = [
                {"title": "Monthly Progress Review", "date": "Nov 10, 2023", "time": "10:30 AM", "status": "Present"},
                {"title": "Technical Skills Assessment", "date": "Nov 5, 2023", "time": "11:00 AM", "status": "Present"},
                {"title": "Group Mentoring Session", "date": "Oct 28, 2023", "time": "2:00 PM", "status": "Absent"},
            ]
            base["honors"] = [
                {"title": "Dean's List", "term": "Spring 2023 Semester"},
                {"title": "Outstanding Project Award", "term": "Database Design Competition"},
            ] if float(gpa) >= 3.5 else []
            base["recent_activity"] = [
                {"title": "Progress Meeting Attended", "when": "Today, 10:30 AM"},
                {"title": "Project Milestone Completed", "when": "Yesterday, 2:15 PM"},
            ]
            base["growth_analysis"] = [
                {"label": "Technical Growth", "pct": 42},
                {"label": "Soft Skills", "pct": 23},
            ]
            base["learning_resources"] = [
                {"title": "Machine Learning Fundamentals", "description": "Online course with certification", "badge": "Recommended", "rating": "4.8/5"},
            ]
            base["performance_badges"] = [
                "Top 10% in Department",
                "85% Activity Completion",
                "92% Meeting Attendance",
                "3 Certifications",
            ]
            base["achievements_semester"] = [
                {"title": "Research Paper Submission", "status": "Completed"},
                {"title": "Python Certification", "status": "Completed"},
                {"title": "Web Development Project", "status": "In Progress"},
            ]
            base["competency"] = {
                "score": round(min(5.0, 3.5 + float(gpa) / 10), 1),
                "skills": [
                    {"name": "Technical Proficiency", "score": round(min(5, 3 + float(gpa) / 5), 1)},
                    {"name": "Problem Solving", "score": 4.9},
                    {"name": "Communication", "score": 4.2},
                    {"name": "Leadership", "score": 4.5},
                ],
                "badges": ["Expert", "Verified", "Mentor"],
            }
        if samples:
            base["badges"] = ["Expert", "Verified"] if st and st.verified_at else ["Verified"]
        else:
            base["badges"] = []
    elif tab == "academic":
        records = db.query(AcademicRecord).filter(AcademicRecord.uid == uid).all()
        record_rows = [{"title": r.title, "category": r.category} for r in records]
        base.update(build_academic_tab(db, uid, st, facts, float(gpa), record_rows))
    elif tab == "career":
        careers = db.query(CareerRecord).filter(CareerRecord.uid == uid).all()
        narrative = (career_report.narrative if career_report else None)
        base.update(build_career_tab(db, uid, st, facts, careers, narrative))
    elif tab == "documents":
        docs = db.query(DocumentGenerated).filter(DocumentGenerated.uid == uid).order_by(DocumentGenerated.generated_at.desc()).limit(10).all()
        preview = build_overview(db, uid, use_gemini=False)
        email = (getattr(st, "student_email", None) if st else None) or f"{facts.get('usn')}@university.edu"
        default_experience = [
            {"title": "Research Assistant", "org": "University Research Lab • 2023", "bullets": ["Conducted research on machine learning applications"]},
            {"title": "Web Developer Intern", "org": "TechStart Inc. • 2022", "bullets": ["Developed and maintained web applications"]},
        ]
        recent = []
        if docs:
            d0 = docs[0]
            recent.append(
                {
                    "type": d0.doc_type,
                    "label": "Last CV",
                    "at": d0.generated_at.strftime("%b %d, %Y") if d0.generated_at else "Recent",
                    "icon": "blue",
                    "id": d0.id,
                }
            )
        elif samples:
            recent.append({"type": "cv_pdf", "label": "Last CV", "at": "Oct 25, 2023", "icon": "blue", "id": None})
        if acad_report and acad_report.updated_at:
            recent.append(
                {
                    "type": "transcript",
                    "label": "Academic Transcript",
                    "at": acad_report.updated_at.strftime("%b %d, %Y"),
                    "icon": "purple",
                    "id": None,
                }
            )
        elif samples:
            recent.append({"type": "transcript", "label": "Academic Transcript", "at": "Sep 15, 2023", "icon": "purple", "id": None})
        career_state = (career_report.structured_state or {}) if career_report else {}
        dash = get_report(db, uid, "tracker_dashboard")
        dash_state = (dash.structured_state or {}) if dash else {}
        if samples:
            certifications = [
                "Python Certification (ISO 9001)",
                "Web Development Project (IEEE Standard)",
                "Database Design (ISO 27001)",
            ]
            cv_experience = default_experience
        else:
            certifications = list(dash_state.get("certifications") or [])
            cv_experience = list(career_state.get("experience") or [])
        library = list(MOCK_DOCUMENT_LIBRARY) if samples and not docs else []
        base["documents"] = {
            "recent": recent,
            "cv_preview": {
                "name": facts.get("full_name"),
                "email": email,
                "program": facts.get("program"),
                "program_line": f"{facts.get('program')}, Year {facts.get('semester', 1)}",
                "student_id": facts.get("usn"),
                "education": {
                    "degree": facts.get("program") or "",
                    "institution": "International University, 2022-2026" if samples else "",
                    "gpa": f"{gpa}/4.0" if gpa else "",
                },
                "skills": preview.get("skills_overview") or preview.get("skill_breakdown") or [],
                "certifications": certifications,
                "experience": cv_experience,
                "international_standards": [
                    {"label": "ISO 9001 — Quality Management Systems", "icon": "globe"},
                    {"label": "IEEE — Software Engineering Practices", "icon": "doc"},
                ] if samples else [],
                "summary": (career_report.narrative if career_report else "")[:500],
            },
            "library": library,
        }
    cache_set(key, base)
    return base


def build_analysis(db: Session, uid: str, tab: str) -> dict[str, Any]:
    ver = _report_version(db, uid)
    key = cache_key(uid, "analysis", tab=tab, version=ver)
    cached = cache_get(key)
    if cached:
        return cached

    overview = build_overview(db, uid, use_gemini=False)
    facts = _student_facts(db, uid)
    st = db.query(Student).filter(Student.uid == uid).first()
    if _is_blank_account(db, st):
        base = _blank_analysis(tab, overview)
        cache_set(key, base)
        return base
    base = build_analysis_tab_payload(
        db,
        uid,
        tab,
        overview,
        facts,
        performance_analysis_fn=_performance_analysis_rows,
        benchmark_from_swot_fn=_benchmark_from_swot,
    )
    cache_set(key, base)
    return base
