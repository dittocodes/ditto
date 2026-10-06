"""Assemble Analysis page API payloads (overview, skills, comparison, reports)."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.data.mock_tracker_analysis import (
    DEFAULT_ACTIVITY_COMPLETION,
    DEFAULT_ANALYSIS_RECOMMENDATIONS,
    DEFAULT_ANALYSIS_REPORT_CARDS,
    DEFAULT_COMPARISON_ACTIVITY,
    DEFAULT_COMPARISON_CHART,
    DEFAULT_COMPARISON_FOCUS,
    DEFAULT_COMPARISON_IMPROVEMENTS,
    DEFAULT_MENTOR_RECOMMENDATIONS,
    DEFAULT_OVERVIEW_CTAS,
    DEFAULT_PERFORMANCE_ANALYSIS,
    DEFAULT_PERFORMANCE_TREND,
    DEFAULT_SKILL_DISTRIBUTION,
    DEFAULT_SKILL_GROWTH_ITEMS,
    DEFAULT_SKILLS_RECOMMENDATIONS,
    DEFAULT_SWOT_OPPORTUNITIES,
    DEFAULT_SWOT_STRENGTHS,
    DEFAULT_SWOT_THREATS,
    DEFAULT_SWOT_WEAKNESSES,
    COMPARISON_PERIOD_OPTIONS,
)
from app.data.mock_tracker_profile import (
    DEFAULT_ACHIEVEMENTS_SEMESTER,
    DEFAULT_PERFORMANCE_INDICATORS,
    DEFAULT_PROFILE_SKILLS,
    DEFAULT_RECENT_ACTIVITY,
)
from app.db.models.student_platform import LivingReport, ReportSnapshot, SwotEntry
from app.db.models.students import Student
from app.services.demo_utils import allow_sample_content
from app.services.living_report_service import get_report
from app.services.profile_dashboard_service import (
    _normalize_growth_analysis,
    activity_task_counts,
    meeting_counts,
    profile_skill_breakdown,
)

TRACKER_DASHBOARD = "tracker_dashboard"


def _samples(db: Session, uid: str) -> bool:
    st = db.query(Student).filter(Student.uid == uid).first()
    return allow_sample_content(st.student_usn if st else None)


def _dashboard_state(db: Session, uid: str) -> dict[str, Any]:
    report = get_report(db, uid, TRACKER_DASHBOARD)
    return dict((report.structured_state or {}) if report else {})


def _activity_completion_sparse(block: dict[str, Any] | None) -> bool:
    if not block:
        return True
    totals = block.get("total") or []
    if not totals:
        return True
    return max(int(x or 0) for x in totals) <= 1


def enrich_analysis_charts(charts: dict[str, Any] | None, dash: dict[str, Any], *, samples: bool = True) -> dict[str, Any]:
    """Ensure Analysis overview charts match reference UI when DB series are sparse."""
    out = copy.deepcopy(charts or {})

    ac = dash.get("activity_completion")
    if isinstance(ac, dict) and ac.get("months"):
        out["activity_completion"] = {
            "subtitle": ac.get("subtitle") or DEFAULT_ACTIVITY_COMPLETION["subtitle"],
            "months": list(ac["months"]),
            "total": list(ac["total"]),
            "completed": list(ac["completed"]),
        }
    elif samples and _activity_completion_sparse(out.get("activity_completion")):
        out["activity_completion"] = dict(DEFAULT_ACTIVITY_COMPLETION)

    sd = dash.get("skill_distribution")
    if isinstance(sd, list) and sd:
        out["skill_distribution"] = {
            "subtitle": DEFAULT_SKILL_DISTRIBUTION["subtitle"],
            "items": list(sd),
        }
    elif samples and not (out.get("skill_distribution") or {}).get("items"):
        out["skill_distribution"] = dict(DEFAULT_SKILL_DISTRIBUTION)

    pt = dash.get("performance_trend")
    if isinstance(pt, dict) and pt.get("scores"):
        out["performance_trend"] = {
            "subtitle": pt.get("subtitle") or DEFAULT_PERFORMANCE_TREND["subtitle"],
            "weeks": list(pt.get("weeks") or DEFAULT_PERFORMANCE_TREND["weeks"]),
            "scores": list(pt["scores"]),
        }
    elif samples and not (out.get("performance_trend") or {}).get("scores"):
        out["performance_trend"] = dict(DEFAULT_PERFORMANCE_TREND)

    sg = dash.get("skill_growth_items")
    if isinstance(sg, list) and sg:
        out["skill_growth"] = {
            "subtitle": "Improvement in your skills",
            "items": list(sg),
        }
    else:
        items = (out.get("skill_growth") or {}).get("items")
        if samples and not items:
            out["skill_growth"] = {
                "subtitle": "Improvement in your skills",
                "items": list(DEFAULT_SKILL_GROWTH_ITEMS),
            }

    if not out.get("activity_progress") and out.get("activity_completion"):
        out["activity_progress"] = {
            "subtitle": "Monthly activity totals vs completed",
            "months": out["activity_completion"]["months"][-4:],
            "total": out["activity_completion"]["total"][-4:],
            "completed": out["activity_completion"]["completed"][-4:],
        }

    return out


def build_analytics_sidebar(
    db: Session,
    uid: str,
    facts: dict[str, Any],
    overview: dict[str, Any],
    dash: dict[str, Any],
    *,
    samples: bool = True,
) -> dict[str, Any]:
    skills = profile_skill_breakdown(db, uid)
    act_done, act_total, _, _ = activity_task_counts(db, uid)
    usn = facts.get("usn") or ""
    meet_done, _, _ = meeting_counts(db, usn)
    act_cap = max(15, act_total or 15) if samples else (act_total or 0)
    completion = int(facts.get("completion_pct", 72 if samples else 0) or (72 if samples else 0))

    growth_raw = dash.get("growth_analysis")
    if growth_raw is None:
        skill_growth = (overview.get("charts") or {}).get("skill_growth", {})
        growth_items = skill_growth.get("items") if isinstance(skill_growth, dict) else skill_growth
        growth_rows = [
            {"label": f"{g.get('skill', 'Skill')} Growth", "pct": int(g.get("growth_pct", 0))}
            for g in (growth_items or [])[:2]
        ]
        growth_raw = growth_rows if len(growth_rows) >= 2 else None
    growth_analysis = _normalize_growth_analysis(growth_raw) if samples or growth_raw else []

    achievements = dash.get("achievements_semester")
    if not achievements:
        achievements = []
        for a in (overview.get("recent_activities") or [])[:3]:
            st = str(a.get("status_tag") or a.get("status") or "In Progress").lower()
            tag = "Completed" if "complete" in st else "In Progress"
            achievements.append({"title": a.get("title", "Activity"), "status": tag})
        if samples and not achievements:
            achievements = [dict(x) for x in DEFAULT_ACHIEVEMENTS_SEMESTER]

    recent = dash.get("recent_activity")
    if not recent:
        recent = []
        for i, a in enumerate((overview.get("recent_activities") or [])[:2]):
            recent.append(
                {
                    "title": a.get("title", "Activity update"),
                    "when": "Today, 10:30 AM" if i == 0 else "Yesterday, 2:15 PM",
                }
            )
        if samples and not recent:
            recent = [dict(x) for x in DEFAULT_RECENT_ACTIVITY]

    badges = dash.get("performance_indicators")
    if samples and not badges:
        badges = [dict(x) for x in DEFAULT_PERFORMANCE_INDICATORS]
        if completion:
            badges = [
                badges[0],
                {"label": f"{min(99, max(completion, 85))}% Activity Completion", "tone": "blue"},
                badges[2],
                badges[3],
            ]

    return {
        "title": "Analytics Report",
        "subtitle": "Summary of your performance metrics",
        "activities": {
            "value": dash.get("activities_metric") or f"{act_done}/{act_cap}",
            "trend": dash.get("activities_trend") or ("↑ +3 this month" if samples else ""),
        },
        "meetings": {
            "value": dash.get("meetings_metric") or f"{meet_done}/{10 if samples else 0}",
            "trend": dash.get("meetings_trend") or ("↑ +2 this month" if samples else ""),
        },
        "skill_breakdown": skills[:5],
        "badges": badges or [],
        "achievements_semester": achievements,
        "recent_activity": recent,
        "growth_analysis": growth_analysis,
    }


def comparison_metric_items(
    categories: list[str],
    current: list[Any],
    previous: list[Any],
    *,
    pick: str,
    limit: int = 2,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for i, label in enumerate(categories):
        if i >= len(current) or i >= len(previous):
            continue
        score = int(current[i] or 0)
        prev = int(previous[i] or 0)
        change_pct = round((score - prev) / prev * 100, 1) if prev else 0.0
        rows.append({"label": label, "change_pct": change_pct, "score": score, "previous_score": prev})
    if pick == "improve":
        positive = [r for r in rows if r["change_pct"] > 0]
        positive.sort(key=lambda x: x["change_pct"], reverse=True)
        chosen = positive[:limit]
    else:
        rows.sort(key=lambda x: x["score"])
        chosen = rows[:limit]
    if len(chosen) < limit:
        defaults_improve = [
            {"label": "Domain Knowledge", "change_pct": 33.3, "score": 82, "previous_score": 61},
            {"label": "Technical Skills", "change_pct": 21.4, "score": 85, "previous_score": 70},
        ]
        defaults_focus = [
            {"label": "Leadership", "change_pct": 18.2, "score": 75, "previous_score": 63},
            {"label": "Communication", "change_pct": 15.4, "score": 80, "previous_score": 69},
        ]
        pool = defaults_improve if pick == "improve" else defaults_focus
        for item in pool:
            if len(chosen) >= limit:
                break
            if not any(c["label"] == item["label"] for c in chosen):
                chosen.append(item)
    return chosen[:limit]


def _swot_list(swot: SwotEntry | None, key: str, defaults: list[str]) -> list[str]:
    if not swot:
        return list(defaults)
    raw = getattr(swot, key, None) or []
    items = [str(x).strip() for x in raw if str(x).strip()]
    return items if items else list(defaults)


def _format_swot_updated(swot: SwotEntry | None) -> str:
    if swot and swot.generated_at:
        return swot.generated_at.strftime("%b %d, %Y")
    return datetime.now(timezone.utc).strftime("%b %d, %Y")


def _resolve_key_metrics(dash: dict[str, Any], facts: dict[str, Any], *, samples: bool = True, parts: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    raw = dash.get("key_metrics")
    if samples and isinstance(raw, list) and raw:
        return [{"label": m["label"], "pct": int(m.get("pct", 0))} for m in raw if m.get("label")]
    if not samples:
        return [
            {"label": part["label"], "pct": int(round(part["score"]))}
            for part in (parts or [])
            if part.get("label") and isinstance(part.get("score"), (int, float))
        ]
    completion = int(facts.get("completion_pct") or 0) or 75
    meet_pct = min(99, max(90, int(facts.get("meetings_completed", 0) or 0) * 15))
    return [
        {"label": "Activity Completion Rate", "pct": completion},
        {"label": "Meeting Attendance", "pct": meet_pct},
        {"label": "Activity Quality Score", "pct": 82},
        {"label": "Feedback Implementation", "pct": 68},
    ]


def build_skills_tab_payload(
    db: Session,
    uid: str,
    facts: dict[str, Any],
    dash: dict[str, Any],
    swot: SwotEntry | None,
    *,
    samples: bool = True,
) -> dict[str, Any]:
    empty: list[str] = []
    strengths = _swot_list(swot, "strengths", DEFAULT_SWOT_STRENGTHS if samples else empty)
    weaknesses = _swot_list(swot, "weaknesses", DEFAULT_SWOT_WEAKNESSES if samples else empty)
    opportunities = _swot_list(swot, "opportunities", DEFAULT_SWOT_OPPORTUNITIES if samples else empty)
    threats = _swot_list(swot, "threats", DEFAULT_SWOT_THREATS if samples else empty)
    mentor_recs = list(dash.get("mentor_recommendations") or (DEFAULT_MENTOR_RECOMMENDATIONS if samples else []))
    recommendations = list(
        dash.get("skills_recommendations")
        or dash.get("recommendations")
        or (DEFAULT_SKILLS_RECOMMENDATIONS if samples else [])
    )
    skills = profile_skill_breakdown(db, uid)
    if samples and len(skills) < 5:
        skills = [dict(x) for x in DEFAULT_PROFILE_SKILLS]
    parts = None
    if not samples:
        from app.services.student_score import score_student

        parts = score_student(db, uid).get("parts") or []

    return {
        "swot": {
            "updated": _format_swot_updated(swot),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "opportunities": opportunities,
            "threats": threats,
            "mentor_recommendations": mentor_recs,
        },
        "swot_tabs": {
            "S": strengths,
            "W": weaknesses,
            "O": opportunities,
            "T": threats,
        },
        "key_metrics": _resolve_key_metrics(dash, facts, samples=samples, parts=parts),
        "skill_assessment": skills,
        "mentor_recommendations": mentor_recs,
        "recommendations": recommendations,
    }


def _merge_global_benchmark(
    overview: dict[str, Any],
    dash: dict[str, Any],
    benchmark_from_swot_fn,
    db: Session,
    uid: str,
) -> dict[str, Any]:
    benchmark = dict(overview.get("global_benchmark") or benchmark_from_swot_fn(db, uid))
    override = dash.get("benchmark")
    if isinstance(override, dict):
        for key in ("axes", "your_score", "regional_avg", "global_avg"):
            if override.get(key):
                benchmark[key] = list(override[key]) if isinstance(override[key], list) else override[key]
    return benchmark


def _comparison_rows_from_benchmark(benchmark: dict[str, Any]) -> list[dict[str, Any]]:
    axes = benchmark.get("axes") or []
    current = benchmark.get("your_score") or []
    previous = benchmark.get("regional_avg") or []
    short_names = {
        "Technical Skills": "Technical",
        "Industry Knowledge": "Domain Knowledge",
    }
    rows: list[dict[str, Any]] = []
    for i, axis in enumerate(axes[:5]):
        label = short_names.get(axis, axis.replace(" Skills", "") if isinstance(axis, str) else f"Skill {i + 1}")
        rows.append(
            {
                "skill": label,
                "previous": int(previous[i] if i < len(previous) else max(50, (current[i] if i < len(current) else 70) - 10)),
                "current": int(current[i] if i < len(current) else 70),
            }
        )
    return rows


def build_comparison_tab_payload(
    db: Session,
    uid: str,
    overview: dict[str, Any],
    dash: dict[str, Any],
    *,
    benchmark_from_swot_fn,
    performance_analysis_fn,
    samples: bool = True,
) -> dict[str, Any]:
    benchmark = _merge_global_benchmark(overview, dash, benchmark_from_swot_fn, db, uid)

    chart_rows = dash.get("comparison_chart")
    if not isinstance(chart_rows, list) or not chart_rows:
        chart_rows = _comparison_rows_from_benchmark(benchmark)
        if samples and len(chart_rows) < 5:
            chart_rows = list(DEFAULT_COMPARISON_CHART)

    categories = [str(r.get("skill", "")) for r in chart_rows]
    current = [int(r.get("current", 0)) for r in chart_rows]
    previous = [int(r.get("previous", 0)) for r in chart_rows]

    snaps = (
        db.query(ReportSnapshot)
        .join(LivingReport, ReportSnapshot.living_report_id == LivingReport.id)
        .filter(LivingReport.uid == uid)
        .order_by(ReportSnapshot.id.desc())
        .limit(2)
        .all()
    )
    if len(snaps) >= 2 and snaps[1].snapshot_json and not dash.get("comparison_chart"):
        snap_prev = snaps[1].snapshot_json.get("your_score") if isinstance(snaps[1].snapshot_json, dict) else None
        if isinstance(snap_prev, list) and len(snap_prev) >= len(current):
            previous = [int(x) for x in snap_prev[: len(current)]]

    improvement_items = dash.get("comparison_improvements") or (list(DEFAULT_COMPARISON_IMPROVEMENTS) if samples else [])
    focus_items = dash.get("comparison_focus") or (list(DEFAULT_COMPARISON_FOCUS) if samples else [])

    activity = dash.get("comparison_activity")
    if not isinstance(activity, dict) or not activity.get("months"):
        charts = enrich_analysis_charts(overview.get("charts"), dash, samples=samples)
        activity = charts.get("activity_progress") or (dict(DEFAULT_COMPARISON_ACTIVITY) if samples else {})
        if activity.get("months") and len(activity["months"]) > 4:
            activity = {
                "subtitle": activity.get("subtitle"),
                "months": activity["months"][-4:],
                "total": activity["total"][-4:],
                "completed": activity["completed"][-4:],
            }
        elif samples and not activity.get("months"):
            activity = dict(DEFAULT_COMPARISON_ACTIVITY)

    perf = dash.get("performance_analysis")
    if samples and (not isinstance(perf, list) or not perf):
        perf = list(DEFAULT_PERFORMANCE_ANALYSIS)
    elif not isinstance(perf, list):
        perf = []

    selected_range = dash.get("comparison_range") or "1M"

    return {
        "comparison": {
            "range": selected_range,
            "period_options": list(COMPARISON_PERIOD_OPTIONS),
            "compare_note": f"Comparing current data with {selected_range} ago",
            "view_modes": ["visual", "data"],
            "categories": categories,
            "current": current,
            "previous": previous,
            "chart_rows": chart_rows,
            "improvement_items": improvement_items,
            "focus_items": focus_items,
            "improvements": [x["label"] for x in improvement_items],
            "focus_areas": [x["label"] for x in focus_items],
        },
        "global_benchmark": benchmark,
        "performance_analysis": perf,
        "activity_progress": activity,
    }


def build_analysis_tab_payload(
    db: Session,
    uid: str,
    tab: str,
    overview: dict[str, Any],
    facts: dict[str, Any],
    *,
    performance_analysis_fn,
    benchmark_from_swot_fn,
) -> dict[str, Any]:
    """Build one Analysis tab response (merged into cached analysis payload)."""
    dash = _dashboard_state(db, uid)
    swot = db.query(SwotEntry).filter(SwotEntry.uid == uid).order_by(SwotEntry.generated_at.desc()).first()
    samples = _samples(db, uid)
    base: dict[str, Any] = {"tab": tab, "generated_at": datetime.now(timezone.utc).isoformat()}

    if tab == "overview":
        enriched = copy.deepcopy(overview)
        enriched["charts"] = enrich_analysis_charts(overview.get("charts"), dash, samples=samples)
        base.update(enriched)
        base["analytics_panel"] = {
            "activities": facts.get("activities_total"),
            "meetings": facts.get("meetings_completed"),
            "achievements": len(overview.get("recent_activities", [])),
        }
        base["analytics_sidebar"] = build_analytics_sidebar(db, uid, facts, overview, dash, samples=samples)
        base["overview_ctas"] = dict(DEFAULT_OVERVIEW_CTAS) if samples else {}

    elif tab == "skills":
        base.update(build_skills_tab_payload(db, uid, facts, dash, swot, samples=samples))

    elif tab == "comparison":
        base.update(
            build_comparison_tab_payload(
                db,
                uid,
                overview,
                dash,
                benchmark_from_swot_fn=benchmark_from_swot_fn,
                performance_analysis_fn=performance_analysis_fn,
                samples=samples,
            )
        )

    elif tab == "reports":
        base["report_cards"] = list(DEFAULT_ANALYSIS_REPORT_CARDS)

    return base
