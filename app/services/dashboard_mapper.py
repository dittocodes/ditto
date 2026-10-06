"""Deterministic Dashboard overview assembly from DB + living reports + snapshots."""
from __future__ import annotations

import calendar
import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import yaml
from sqlalchemy.orm import Session

from app.db.models.meetings import Meetings
from app.db.models.students import Student
from app.db.models.student_platform import CampusActivity, LivingReport, ReportSnapshot, StudentActivityV2, SwotEntry
from app.services.demo_utils import allow_sample_content
from app.services.living_report_service import get_report
from app.services.mentor_stats import attendance_percent
from app.services.student_score import score_student, stored_number

TRACKER_DASHBOARD_REPORT = "tracker_dashboard"


def _first_number(*values):
    for value in values:
        if isinstance(value, (int, float)):
            return value
    return 0

DEFAULT_SKILLS_OVERVIEW = [
    {"name": "Programming", "pct": 85},
    {"name": "Data Analysis", "pct": 70},
    {"name": "Database Design", "pct": 55},
    {"name": "Web Development", "pct": 80},
    {"name": "Algorithms", "pct": 65},
]

_PATHWAY_SKILLS = {
    "Foundation Skills": ["Problem Solving Basics", "Communication Fundamentals", "Technical Foundation"],
    "Specialization": ["Advanced Technical Skills", "Domain Knowledge", "Project Application"],
    "Industry Project": ["Project Management", "Teamwork", "Problem Solving", "Technical Implementation"],
    "Leadership Development": ["Team Leadership", "Strategic Thinking", "Decision Making"],
}

PERF_ROW_LABELS = [
    "Technical Proficiency",
    "Problem Solving",
    "Communication",
    "Professional Network",
]

SKILL_GROWTH_NAMES = ["Problem Solving", "Communication", "Technical", "Leadership"]


def _activity_stamp(raw: str | None) -> datetime:
    text = (raw or "").strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%b %Y", "%B %Y"):
        try:
            return datetime.strptime(text[:32], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def student_facts(db: Session, uid: str) -> dict[str, Any]:
    st = db.query(Student).filter(Student.uid == uid).first()
    if not st:
        return {}
    acts = [
        row
        for row in db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).all()
        if (row.status or "").lower() != "requested"
    ]
    for row in db.query(CampusActivity).filter(CampusActivity.uid == uid).all():
        acts.append(
            SimpleNamespace(
                status="completed",
                due_date=_activity_stamp(row.record_date),
                title=row.event_name or "Activity",
            )
        )
    completed = sum(1 for a in acts if (getattr(a, "status", "") or "") == "completed")
    usn = st.student_usn
    meetings = db.query(Meetings).filter(Meetings.student_usn == usn).all()
    meetings_done = sum(1 for m in meetings if (m.status or "").lower() in ("completed", "approved"))
    meetings_upcoming = sum(1 for m in meetings if (m.status or "").lower() in ("approved", "scheduled", "pending"))
    meetings_cancelled = sum(1 for m in meetings if (m.status or "").lower() == "cancelled")
    pending_acts = sum(1 for a in acts if (getattr(a, "status", "") or "") != "completed")
    if not acts:
        completion_pct = 0.0
    else:
        completion_pct = round(100 * completed / len(acts), 1)
    samples = allow_sample_content(usn)
    if samples:
        total = len(acts) or 1
        facts_completion = (100 * completed / total) * 0.5 + meetings_done * 5 + 40
        learning_hours = len(acts) * 8 + meetings_done * 2
    else:
        facts_completion = completion_pct
        learning_hours = 0
    perf = round(min(100, facts_completion), 1)
    attendance = attendance_percent(db, student_usn=usn)
    return {
        "name": (st.student_name or "").split()[0] if st.student_name else st.student_usn,
        "full_name": st.student_name or st.student_usn,
        "usn": usn,
        "program": st.student_program or "Programme",
        "semester": st.semester or 1,
        "activities_total": len(acts),
        "activities_completed": completed,
        "activities_pending": pending_acts,
        "completion_pct": completion_pct,
        "meetings_completed": meetings_done,
        "meetings_upcoming": meetings_upcoming,
        "meetings_cancelled": meetings_cancelled,
        "learning_hours": learning_hours,
        "performance_score": perf,
        "attendance_pct": attendance,
        "meetings": meetings,
        "activities": acts,
    }


def _dashboard_state(db: Session, uid: str) -> dict[str, Any]:
    row = get_report(db, uid, TRACKER_DASHBOARD_REPORT)
    return dict(row.structured_state or {}) if row else {}


def _prior_dashboard_snapshot(db: Session, uid: str) -> dict[str, Any]:
    snap = (
        db.query(ReportSnapshot)
        .join(LivingReport, ReportSnapshot.living_report_id == LivingReport.id)
        .filter(LivingReport.uid == uid, LivingReport.report_type == TRACKER_DASHBOARD_REPORT)
        .order_by(ReportSnapshot.id.desc())
        .offset(1)
        .first()
    )
    if snap and isinstance(snap.snapshot_json, dict):
        return snap.snapshot_json
    return {}


def _benchmark_from_swot(db: Session, uid: str, dash: dict[str, Any]) -> dict[str, Any]:
    if dash.get("benchmark"):
        return dash["benchmark"]
    swot = db.query(SwotEntry).filter(SwotEntry.uid == uid).order_by(SwotEntry.generated_at.desc()).first()
    base = [70, 72, 68, 65, 70, 66]
    if swot and swot.strengths:
        boost = min(15, len(swot.strengths) * 3)
        your = [min(100, b + boost) for b in base]
    else:
        your = [78, 85, 65, 70, 72, 68]
    axes = [
        "Technical Skills",
        "Problem Solving",
        "Communication",
        "Leadership",
        "Time Management",
        "Industry Knowledge",
    ]
    return {
        "axes": axes,
        "your_score": your,
        "regional_avg": [74, 75, 80, 68, 70, 65],
        "global_avg": [70, 72, 78, 65, 68, 62],
    }


def _performance_rows(benchmark: dict[str, Any]) -> list[dict[str, Any]]:
    axes = benchmark.get("axes", [])
    your = benchmark.get("your_score", [])
    global_avg = benchmark.get("global_avg", [])
    idx_map = [0, 1, 2, 5]
    rows = []
    for i, label in enumerate(PERF_ROW_LABELS):
        ai = idx_map[i] if i < len(idx_map) else i
        score = your[ai] if ai < len(your) else 70
        gavg = global_avg[ai] if ai < len(global_avg) else 70
        delta = round(score - gavg, 1)
        rows.append(
            {
                "skill": label,
                "score": int(score),
                "global_avg": int(gavg),
                "vs_global": delta,
                "trend_pct": abs(int(delta)),
                "trend": "up" if score >= gavg else "down",
                "narrative": f"Your {label.lower()} is {'above' if score >= gavg else 'below'} the global benchmark.",
            }
        )
    return rows


def _pathway_phases(facts: dict[str, Any], dash: dict[str, Any]) -> list[dict[str, Any]]:
    sem = facts.get("semester", 1)
    comp = int(facts.get("completion_pct", 65))
    template = [
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
    overrides = (dash.get("learning_pathway") or {}).get("phases") or []
    if not overrides:
        return template
    by_title = {p.get("title"): p for p in overrides if p.get("title")}
    merged = []
    for t in template:
        o = by_title.get(t["title"], {})
        merged.append({**t, **{k: v for k, v in o.items() if v is not None}})
    return merged


def _month_buckets(activities: list, months_back: int = 6) -> tuple[list[str], list[int], list[int]]:
    now = datetime.now(timezone.utc)
    labels = []
    totals = []
    completed = []
    for i in range(months_back - 1, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        labels.append(calendar.month_abbr[m])
        total = 0
        done = 0
        for a in activities:
            dt = a.due_date
            if not dt:
                continue
            if dt.month == m and dt.year == y:
                total += 1
                if (a.status or "") == "completed":
                    done += 1
        totals.append(total)
        completed.append(done)
    return labels, totals, completed


def _activity_progress_chart(activities: list) -> dict[str, Any]:
    labels, totals, completed = _month_buckets(activities, 4)
    return {
        "subtitle": "Monthly activity totals vs completed",
        "months": labels,
        "total": totals,
        "completed": completed,
    }


def _skills_overview(dash: dict[str, Any], benchmark: dict[str, Any], *, samples: bool = True) -> list[dict[str, Any]]:
    stated = []
    for row in dash.get("skills_overview") or []:
        if not isinstance(row, dict) or not row.get("name"):
            continue
        pct = row.get("pct")
        if not isinstance(pct, (int, float)):
            continue
        stated.append({"name": row["name"], "pct": int(pct)})
    if stated:
        return stated
    if not samples:
        return []
    return list(DEFAULT_SKILLS_OVERVIEW)


def _skill_growth(skills: list[dict[str, Any]], prior: dict[str, Any], perf: float) -> list[dict[str, Any]]:
    prior_skills = {s.get("name"): s.get("pct", 0) for s in (prior.get("skills_overview") or [])}
    out = []
    skill_map = {s["name"]: s["pct"] for s in skills}
    for name in SKILL_GROWTH_NAMES:
        current = skill_map.get(name, int(perf))
        if name == "Technical":
            current = skill_map.get("Programming", int(perf))
        previous = prior_skills.get(name, prior_skills.get("Programming" if name == "Technical" else name, max(40, current - 15)))
        if previous <= 0:
            previous = max(40, current - 15)
        growth = round((current - previous) / max(previous, 1) * 100)
        out.append(
            {
                "skill": name,
                "previous": int(previous),
                "current": int(current),
                "growth_pct": max(0, growth),
            }
        )
    return out


def _performance_trend_chart(dash: dict[str, Any], perf: float, *, samples: bool = True) -> dict[str, Any]:
    pt = dash.get("performance_trend")
    if isinstance(pt, dict) and pt.get("scores"):
        return {
            "subtitle": pt.get("subtitle") or "Weekly performance score",
            "weeks": list(pt.get("weeks") or [f"W{i}" for i in range(1, 9)]),
            "scores": list(pt["scores"]),
        }
    if not samples:
        return {"subtitle": "Weekly performance score", "weeks": [], "scores": []}
    return {
        "subtitle": "Weekly performance score",
        "weeks": [f"W{i}" for i in range(1, 9)],
        "scores": [max(60, perf - 20 + i * 2) for i in range(8)],
    }


def _skill_growth_items(
    dash: dict[str, Any],
    skills: list[dict[str, Any]],
    prior: dict[str, Any],
    perf: float,
    *,
    samples: bool = True,
) -> list[dict[str, Any]]:
    override = dash.get("skill_growth_items")
    if isinstance(override, list) and override:
        return list(override)
    if not samples:
        return []
    return _skill_growth(skills, prior, perf)


def _term_tag(term: str | None) -> str:
    t = (term or "").lower()
    if "long" in t:
        return "Long-term"
    if "mid" in t:
        return "Mid-term"
    if "short" in t:
        return "Short-term"
    return term or "Mid-term"


def _status_tag(status: str | None) -> str:
    s = (status or "pending").replace("_", " ")
    return s.title()


def _activity_icon(status: str | None) -> str:
    s = (status or "").lower()
    if s == "completed":
        return "completed"
    if s in ("reviewed", "approved"):
        return "reviewed"
    return "progress"


def _map_activity(a: Any) -> dict[str, Any]:
    st = getattr(a, "status", None)
    due = getattr(a, "due_date", None)
    return {
        "title": getattr(a, "title", None) or "Activity",
        "description": getattr(a, "description", None) or "",
        "status": st,
        "term": getattr(a, "term", None),
        "term_tag": _term_tag(getattr(a, "term", None)),
        "status_tag": _status_tag(st),
        "priority": getattr(a, "priority", None) or "Medium",
        "progress_pct": getattr(a, "progress_pct", None) or 0,
        "due_date": due.isoformat() if hasattr(due, "isoformat") else None,
        "mentor_remarks": getattr(a, "mentor_remarks", None),
        "icon": _activity_icon(st),
    }


def _trend_pct(current: float, previous: float) -> float:
    if previous <= 0:
        return 12.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


def _kpi_weeks(current: float, prior_val: float | None = None) -> list[float]:
    end = float(current)
    start = float(prior_val if prior_val is not None else end * 0.7)
    step = (end - start) / 3 if end != start else end / 4
    return [round(start + step * i, 1) for i in range(4)]


def _kpi_bar_heights(weeks: list[float]) -> list[int]:
    w = list(weeks[:4]) if weeks else []
    while len(w) < 4:
        w.append(w[-1] if w else 0.0)
    lo, hi = min(w), max(w)
    if hi <= lo:
        base = int(hi) if hi > 0 else 20
        return [max(8, min(35, base + i * 2)) for i in range(4)]
    return [max(8, min(35, int(8 + (v - lo) / (hi - lo) * 27))) for v in w]


def _split_kpi_value(value: Any, title: str) -> tuple[str, str]:
    text = str(value) if value is not None else ""
    if text.endswith(" hrs"):
        return text[:-4].strip(), "hrs"
    if text.endswith("%"):
        return text[:-1].strip(), "%"
    if text.startswith("#"):
        return text, ""
    return text, ""


def _enrich_kpi(entry: dict[str, Any]) -> dict[str, Any]:
    weeks = entry.get("weeks") or []
    entry["bar_heights"] = _kpi_bar_heights(weeks)
    vn, vu = _split_kpi_value(entry.get("value"), entry.get("title", ""))
    entry["value_number"] = vn
    entry["value_unit"] = vu
    return entry


def _benchmark_panel(benchmark: dict[str, Any]) -> dict[str, Any]:
    axes = benchmark.get("axes") or []
    yours = benchmark.get("your_score") or []
    globals_ = benchmark.get("global_avg") or []
    scored: list[dict[str, Any]] = []
    for i, axis in enumerate(axes):
        score = int(yours[i]) if i < len(yours) else 70
        g = int(globals_[i]) if i < len(globals_) else 70
        scored.append({"label": axis, "score": score, "insight": "", "_delta": abs(score - g)})
    scored.sort(key=lambda x: x["_delta"], reverse=True)
    items = [{k: v for k, v in row.items() if k != "_delta"} for row in scored[:3]]
    if not items and axes:
        items = [
            {"label": axes[i], "score": int(yours[i]) if i < len(yours) else 70, "insight": ""}
            for i in range(min(3, len(axes)))
        ]
    return {"items": items}


def _living_or_display(dash: dict[str, Any], display_key: str, living_keys: list[str], default: Any) -> Any:
    for key in living_keys:
        if key in dash and dash[key] is not None:
            return dash[key]
    return _display_metric(dash, display_key, default)


def merge_doc_fields_to_dashboard_delta(fields: dict[str, Any]) -> dict[str, Any]:
    """Map generic pipeline structured_fields into tracker_dashboard delta."""
    delta: dict[str, Any] = {}
    skills = fields.get("skills")
    if isinstance(skills, dict):
        delta["skills_overview"] = [
            {"name": k, "pct": v} for k, v in skills.items() if isinstance(v, (int, float))
        ]
    elif isinstance(skills, list):
        rows = []
        for item in skills:
            if isinstance(item, dict) and item.get("name") is not None:
                rows.append({"name": str(item.get("name")), "pct": int(item.get("pct") or item.get("value") or 0)})
        if rows:
            delta["skills_overview"] = rows
    if fields.get("performance_score") is not None:
        delta["performance_score"] = fields["performance_score"]
    if fields.get("global_rank") is not None:
        delta["global_rank"] = fields["global_rank"]
    if fields.get("engagement_score") is not None:
        delta["engagement_score"] = fields["engagement_score"]
    if fields.get("attendance_pct") is not None:
        delta["attendance_pct"] = fields["attendance_pct"]
    if fields.get("benchmark"):
        delta["benchmark"] = fields["benchmark"]
    if fields.get("skill_distribution"):
        delta["skill_distribution"] = fields["skill_distribution"]
    return delta


@lru_cache(maxsize=1)
def _dashboard_extract_template() -> str:
    path = Path(__file__).resolve().parent.parent / "prompts" / "dashboard_extract.yaml"
    if not path.is_file():
        return ""
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return str(data.get("template") or "")


def extract_dashboard_delta(fields: dict[str, Any]) -> dict[str, Any] | None:
    """Optional insight extract for tracker_dashboard living report."""
    template = _dashboard_extract_template()
    if not template or not fields:
        return None
    from app.services.gemini_gateway import generate_json

    prompt = template.replace("{fields_json}", json.dumps(fields)[:8000])
    try:
        out = generate_json(prompt)
        if isinstance(out, dict) and out:
            return out
    except Exception:
        return None
    return None


def _display_metric(dash: dict[str, Any], key: str, default: Any) -> Any:
    dm = dash.get("display_metrics")
    if isinstance(dm, dict) and key in dm:
        return dm[key]
    return default


def _day0_empty_dashboard(facts: dict[str, Any], now_iso: str) -> dict[str, Any]:
    """Baseline dashboard for Day0 persona before any living tracker_dashboard exists."""
    axes = [
        "Technical Skills",
        "Problem Solving",
        "Communication",
        "Leadership",
        "Time Management",
        "Industry Knowledge",
    ]
    neutral = [50, 50, 50, 50, 50, 50]
    benchmark = {
        "axes": axes,
        "your_score": neutral,
        "regional_avg": [74, 75, 80, 68, 70, 65],
        "global_avg": [70, 72, 78, 65, 68, 62],
    }
    zero_card = {
        "trend_pct": 0,
        "progress_pct": 0,
        "last_updated": "Not started",
    }
    return {
        "generated_at": now_iso,
        "reports_as_of": now_iso,
        "welcome_name": facts.get("name", "Student"),
        "summary_cards": [
            {"title": "Completed Activities", "value": 0, "icon": "activities", **zero_card},
            {"title": "Meetings Attended", "value": 0, "icon": "meetings", **zero_card},
            {"title": "Performance Score", "value": 0, "icon": "score", **zero_card},
            {"title": "Avg. Learning Hours", "value": 0, "icon": "hours", **zero_card},
        ],
        "kpis": [],
        "global_benchmark": benchmark,
        "benchmark_panel": {"items": [{"label": a, "score": 50, "insight": "Baseline — complete onboarding to unlock insights."} for a in axes[:3]]},
        "performance_analysis": [],
        "learning_pathway": {"phases": []},
        "charts": {
            "activity_completion": {"subtitle": "No activity data yet", "months": [], "total": [], "completed": []},
            "skill_distribution": {"subtitle": "No skills data yet", "items": []},
            "performance_trend": {"weeks": [], "scores": []},
            "skill_growth": {"subtitle": "No growth data yet", "items": []},
            "activity_progress": {"months": [], "total": [], "completed": []},
        },
        "skills_overview": [],
        "recent_activities": [],
        "activity_reminders": {
            "upcoming_meetings": 0,
            "pending_activities": 0,
            "message": "Complete onboarding and upload documents to build your dashboard.",
            "cta_label": "Go to Onboarding",
        },
        "meeting_widgets": {
            "upcoming": 0,
            "completed": 0,
            "cancelled": 0,
            "reminder_text": "No meetings yet.",
            "event_dates": [],
        },
        "day0_baseline": True,
    }


def assemble_dashboard(db: Session, uid: str) -> dict[str, Any]:
    from app.db.models.students import Student
    from app.services.demo_utils import allow_sample_content, is_demo_day0_usn

    facts = student_facts(db, uid)
    dash = _dashboard_state(db, uid)
    prior = _prior_dashboard_snapshot(db, uid)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    last_time = now.strftime("%I:%M %p").lstrip("0")
    last_updated_today = f"Today, {last_time}"

    st = db.query(Student).filter(Student.uid == uid).first()
    samples = allow_sample_content(st.student_usn if st else None)
    evidence = None if samples else score_student(db, uid)
    if st and not samples and not dash:
        return _day0_empty_dashboard(facts, now_iso)
    if st and is_demo_day0_usn(st.student_usn) and not dash:
        return _day0_empty_dashboard(facts, now_iso)

    benchmark = _benchmark_from_swot(db, uid, dash) if samples or dash.get("benchmark") else {
        "axes": [],
        "your_score": [],
        "regional_avg": [],
        "global_avg": [],
    }
    if not samples:
        perf = float((evidence or {}).get("overall") or 0)
    elif dash.get("performance_score") is not None:
        perf = float(dash["performance_score"])
    else:
        perf = float(facts.get("performance_score") or 75)
    skills = _skills_overview(dash, benchmark, samples=samples)
    activities = facts.get("activities") or []
    meetings = facts.get("meetings") or []

    prior_completed = prior.get("activities_completed")
    act_trend = _trend_pct(facts.get("activities_completed", 0), prior_completed or 0)
    if prior_completed is None:
        act_trend = (12 if facts.get("activities_completed") else 0) if samples else 0

    month_labels, month_totals, month_completed = _month_buckets(activities, 6)
    ac_override = dash.get("activity_completion")
    if isinstance(ac_override, dict) and ac_override.get("months"):
        month_labels = list(ac_override["months"])
        month_totals = list(ac_override["total"])
        month_completed = list(ac_override["completed"])
    skill_dist = dash.get("skill_distribution") or (
        [
            {"name": "Technical", "value": 35},
            {"name": "Soft Skills", "value": 25},
            {"name": "Leadership", "value": 20},
            {"name": "Domain", "value": 20},
        ]
        if samples
        else []
    )

    completion_pct = float(facts.get("completion_pct", 0) or 0)
    activities_val = _living_or_display(
        dash, "activities_completed", ["activities_completed"], facts.get("activities_completed", 0)
    )
    meetings_val = _living_or_display(
        dash, "meetings_completed", ["meetings_completed"], facts.get("meetings_completed", 0)
    )
    if samples:
        avg_hours = _living_or_display(dash, "avg_learning_hours", ["avg_learning_hours", "learning_hours"], facts.get("learning_hours", 0))
        lh = _living_or_display(dash, "kpi_learning_hours", ["kpi_learning_hours"], facts.get("learning_hours", 0))
        skills_count = _living_or_display(
            dash, "skills_acquired", ["skills_acquired"], facts.get("activities_completed", 0) + 10
        )
        global_rank = int(_living_or_display(dash, "global_rank", ["global_rank"], dash.get("global_rank", 287)))
    else:
        avg_hours = stored_number(dash, "avg_learning_hours", "learning_hours")
        lh = stored_number(dash, "kpi_learning_hours", "learning_hours")
        skills_count = int((evidence or {}).get("skill_count") or 0)
        global_rank = int((evidence or {}).get("programme_rank") or 0)
    summary_cards = [
        {
            "title": "Completed Activities",
            "value": activities_val,
            "trend_pct": _display_metric(dash, "activities_trend_pct", act_trend),
            "progress_pct": _display_metric(dash, "activities_progress_pct", completion_pct or (72 if samples else 0)),
            "last_updated": last_updated_today,
            "icon": "activities",
        },
        {
            "title": "Meetings Attended",
            "value": meetings_val,
            "trend_pct": _display_metric(dash, "meetings_trend_pct", 8 if samples else 0),
            "progress_pct": _display_metric(
                dash, "meetings_progress_pct", (min(100, facts.get("meetings_completed", 0) * 20) or 85) if samples else min(100, facts.get("meetings_completed", 0) * 20)
            ),
            "last_updated": last_updated_today,
            "icon": "meetings",
        },
        {
            "title": "Performance Score",
            "value": round(perf if not samples else float(
                _living_or_display(dash, "performance_score", ["performance_score"], perf)
            ), 1),
            "trend_pct": _display_metric(dash, "performance_trend_pct", 6 if samples else 0),
            "progress_pct": _display_metric(
                dash,
                "performance_progress_pct",
                round(perf if not samples else float(
                    _living_or_display(dash, "performance_score", ["performance_score"], perf)
                ), 1),
            ),
            "last_updated": "Weekly calculation",
            "icon": "score",
        },
        {
            "title": "Avg. Learning Hours",
            "value": avg_hours,
            "trend_pct": _display_metric(
                dash, "avg_hours_trend_pct", ((-4 if facts.get("learning_hours", 0) < 20 else 4) if samples else 0)
            ),
            "progress_pct": _display_metric(
                dash, "avg_hours_progress_pct", (min(100, facts.get("learning_hours", 0) * 2) or 68) if samples else min(100, avg_hours * 2)
            ),
            "last_updated": "Weekly aggregate",
            "icon": "hours",
        },
    ]

    goal_pct = (
        float(facts.get("completion_pct") or 0)
        if not samples
        else _living_or_display(dash, "goal_completion_pct", ["goal_completion_pct"], facts.get("completion_pct", 72))
    )
    kpis_raw = [
        {
            "title": "Learning Hours",
            "value": f"{lh} hrs",
            "trend_pct": _display_metric(dash, "kpi_learning_hours_trend_pct", 12 if samples else 0),
            "weeks": _kpi_weeks(lh, prior.get("learning_hours")),
            "icon": "clock",
            "icon_tone": "clock",
        },
        {
            "title": "Skills Acquired",
            "value": str(skills_count),
            "trend_pct": _display_metric(dash, "skills_acquired_trend_pct", 5 if samples else 0),
            "weeks": _kpi_weeks(skills_count),
            "icon": "book",
            "icon_tone": "book",
        },
        {
            "title": "Goal Completion",
            "value": f"{goal_pct}%",
            "trend_pct": _display_metric(dash, "goal_completion_trend_pct", 8 if samples else 0),
            "weeks": _kpi_weeks(goal_pct),
            "icon": "target",
            "icon_tone": "target",
        },
        {
            "title": "Programme Rank" if not samples else "Global Rank",
            "value": f"#{global_rank}",
            "trend_pct": _display_metric(dash, "global_rank_trend_pct", 24 if samples else 0),
            "weeks": _kpi_weeks(global_rank, prior.get("global_rank")),
            "icon": "medal",
            "icon_tone": "medal",
        },
        {
            "title": "Engagement Score",
            "value": f"{int(dash.get('engagement_score') or (78 if samples else 0))}%",
            "trend_pct": 10 if samples else 0,
            "weeks": _kpi_weeks(dash.get("engagement_score") or (78 if samples else 0)),
            "icon": "chart",
            "icon_tone": "clock",
        },
        {
            "title": "Project Submissions",
            "value": str(facts.get("activities_completed", 0)),
            "trend_pct": 7 if samples else 0,
            "weeks": _kpi_weeks(facts.get("activities_completed", 0)),
            "icon": "tasks",
            "icon_tone": "book",
        },
        {
            "title": "Mentor Sessions",
            "value": str(facts.get("meetings_completed", 0)),
            "trend_pct": 4 if samples else 0,
            "weeks": _kpi_weeks(facts.get("meetings_completed", 0)),
            "icon": "users",
            "icon_tone": "target",
        },
        {
            "title": "Attendance Rate",
            "value": f"{int(_first_number(facts.get('attendance_pct'), dash.get('attendance_pct'), 92 if samples else 0))}%",
            "trend_pct": 3 if samples else 0,
            "weeks": _kpi_weeks(_first_number(facts.get("attendance_pct"), dash.get("attendance_pct"), 92 if samples else 0)),
            "icon": "check",
            "icon_tone": "medal",
        },
    ]
    kpis = [_enrich_kpi(dict(k)) for k in kpis_raw]

    event_dates = []
    for m in meetings:
        if m.meeting_date:
            event_dates.append(m.meeting_date.isoformat() if hasattr(m.meeting_date, "isoformat") else str(m.meeting_date))

    pending = facts.get("activities_pending", 0)
    upcoming = facts.get("meetings_upcoming", 0)

    payload: dict[str, Any] = {
        "generated_at": now_iso,
        "reports_as_of": now_iso,
        "welcome_name": facts.get("name", "Student"),
        "summary_cards": summary_cards,
        "kpis": kpis,
        "global_benchmark": benchmark,
        "benchmark_panel": _benchmark_panel(benchmark),
        "performance_analysis": _performance_rows(benchmark),
        "learning_pathway": {"phases": _pathway_phases(facts, dash) if samples or (dash.get("learning_pathway") or {}).get("phases") else []},
        "charts": {
            "activity_completion": {
                "subtitle": "Monthly activity completion statistics",
                "months": month_labels,
                "total": month_totals,
                "completed": month_completed,
            },
            "skill_distribution": {
                "subtitle": "Your skills by category",
                "items": skill_dist,
            },
            "performance_trend": _performance_trend_chart(dash, perf, samples=samples),
            "skill_growth": {
                "subtitle": "Improvement in your skills",
                "items": _skill_growth_items(dash, skills, prior, perf, samples=samples),
            },
            "activity_progress": _activity_progress_chart(activities),
        },
        "skills_overview": skills,
        "attained_skills": [
            row
            for row in (dash.get("attained_skills") or [])
            if isinstance(row, dict) and row.get("name")
        ],
        "recent_activities": [
            {**row, "source": "document"}
            for row in (dash.get("recent_activities") or [])
            if isinstance(row, dict) and row.get("title")
        ][:6],
        "activity_reminders": {
            "upcoming_meetings": upcoming,
            "pending_activities": pending,
            "message": f"You have {upcoming} upcoming meetings and {pending} pending activities",
            "cta_label": "Set Reminders",
        },
        "meeting_widgets": {
            "upcoming": upcoming,
            "completed": facts.get("meetings_completed", 0),
            "cancelled": facts.get("meetings_cancelled", 0),
            "reminder_text": f"You have {upcoming} upcoming meetings and {pending} pending activities",
            "event_dates": event_dates,
        },
    }
    return payload
