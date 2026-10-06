"""Tests for grounded Gemini dashboard copy merge."""
from __future__ import annotations

import copy

from app.services.gemini_insight_service import merge_gemini_dashboard_copy


def _base_payload():
    return {
        "summary_cards": [{"title": "Completed Activities", "value": 24, "trend_pct": 12, "progress_pct": 72}],
        "kpis": [{"title": "Learning Hours", "value": "128 hrs", "trend_pct": 12, "weeks": [100, 110, 120, 128], "bar_heights": [20, 25, 30, 35]}],
        "performance_analysis": [
            {"skill": "Technical Skills", "score": 82, "global_avg": 70, "trend": "up", "trend_pct": 5, "narrative": "Base narrative."},
        ],
        "benchmark_panel": {"items": [{"label": "Technical Skills", "score": 82, "insight": ""}]},
        "activity_reminders": {"message": "Original message", "pending_activities": 3, "upcoming_meetings": 2},
        "meeting_widgets": {"reminder_text": "Original reminder", "upcoming": 2},
        "learning_pathway": {"phases": [{"title": "Foundation Skills", "subtitle": "Old sub"}]},
    }


def test_merge_accepts_narrative_and_insight_only():
    base = _base_payload()
    gem = {
        "performance_analysis": [
            {"skill": "Technical Skills", "score": 82, "global_avg": 70, "trend": "up", "trend_pct": 5, "narrative": "Gemini improved narrative."},
        ],
        "benchmark_panel": {"items": [{"label": "Technical Skills", "score": 82, "insight": "Strong vs global avg."}]},
        "activity_reminders": {"message": "Welcome back! 3 activities and 2 meetings pending."},
        "meeting_widgets": {"reminder_text": "You have 2 meetings coming up."},
        "learning_pathway": {"phases": [{"title": "Foundation Skills", "subtitle": "Gemini subtitle."}]},
    }
    out = merge_gemini_dashboard_copy(base, gem)
    assert out["performance_analysis"][0]["narrative"] == "Gemini improved narrative."
    assert out["benchmark_panel"]["items"][0]["insight"] == "Strong vs global avg."
    assert out["summary_cards"] == base["summary_cards"]
    assert out["kpis"] == base["kpis"]


def test_merge_rejects_score_changes():
    base = _base_payload()
    gem = {
        "performance_analysis": [
            {"skill": "Technical Skills", "score": 99, "narrative": "Hacked score."},
        ],
        "benchmark_panel": {"items": [{"label": "Technical Skills", "score": 50, "insight": "Wrong score."}]},
    }
    out = merge_gemini_dashboard_copy(base, gem)
    assert out["performance_analysis"][0]["score"] == 82
    assert out["performance_analysis"][0]["narrative"] == "Base narrative."
    assert out["benchmark_panel"]["items"][0]["score"] == 82
    assert out["benchmark_panel"]["items"][0]["insight"] == ""


def test_merge_does_not_mutate_base():
    base = _base_payload()
    snapshot = copy.deepcopy(base)
    merge_gemini_dashboard_copy(base, {"activity_reminders": {"message": "New msg"}})
    assert base == snapshot
