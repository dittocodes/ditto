"""Mock chart defaults for Analysis overview (matches Tracker UI reference)."""
from __future__ import annotations

DEFAULT_ACTIVITY_COMPLETION: dict = {
    "subtitle": "Monthly activity completion statistics",
    "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    "total": [15, 22, 20, 23, 26, 28],
    "completed": [12, 19, 17, 21, 24, 27],
}

DEFAULT_SKILL_DISTRIBUTION: dict = {
    "subtitle": "Your skills by category",
    "items": [
        {"name": "Technical", "value": 35},
        {"name": "Soft Skills", "value": 25},
        {"name": "Domain", "value": 20},
        {"name": "Leadership", "value": 20},
    ],
}

DEFAULT_PERFORMANCE_TREND: dict = {
    "subtitle": "Weekly performance score",
    "weeks": [f"W{i}" for i in range(1, 9)],
    "scores": [64, 68, 66, 72, 76, 78, 82, 88],
}

DEFAULT_SKILL_GROWTH_ITEMS: list[dict] = [
    {"skill": "Problem Solving", "previous": 50, "current": 75, "growth_pct": 50},
    {"skill": "Communication", "previous": 65, "current": 80, "growth_pct": 23},
    {"skill": "Technical", "previous": 60, "current": 85, "growth_pct": 42},
    {"skill": "Leadership", "previous": 45, "current": 65, "growth_pct": 44},
]

DEFAULT_ANALYSIS_REPORT_CARDS: list[dict] = [
    {
        "type": "swot",
        "title": "SWOT Analysis Report",
        "description": "Complete SWOT report with detailed analysis",
        "color": "yellow",
    },
    {
        "type": "progress",
        "title": "Progress Report",
        "description": "Detailed progress tracking over time",
        "color": "blue",
    },
    {
        "type": "academic",
        "title": "Academic Performance",
        "description": "Academic progress and grade analysis",
        "color": "purple",
    },
    {
        "type": "skills",
        "title": "Skills Assessment",
        "description": "Comprehensive skills evaluation",
        "color": "green",
    },
]

DEFAULT_ANALYSIS_RECOMMENDATIONS: list[str] = [
    "Complete pending activities before the due date.",
    "Review SWOT weaknesses with your mentor.",
    "Upload career documents to refresh your profile.",
]

DEFAULT_OVERVIEW_CTAS: dict = {
    "monthly_report": {
        "title": "Monthly Report",
        "description": "View your monthly performance report including completed activities and achievements.",
        "cta_label": "Download Report",
        "report_type": "progress",
    },
    "meeting_notes": {
        "title": "Meeting Notes",
        "description": "Access all your meeting notes and feedback from mentors.",
        "cta_label": "View All Notes",
    },
}

DEFAULT_SWOT_STRENGTHS: list[str] = [
    "Strong programming skills in Python and JavaScript",
    "Good understanding of data structures and algorithms",
    "Experience with web development frameworks",
    "Strong problem-solving abilities",
]

DEFAULT_SWOT_WEAKNESSES: list[str] = [
    "Database design needs further development",
    "Technical documentation can be improved",
    "Limited cloud computing exposure",
    "Time management can be more structured",
]

DEFAULT_SWOT_OPPORTUNITIES: list[str] = [
    "Cloud computing certifications",
    "Advanced database projects",
    "Collaborative software projects",
    "Research and technical writing",
]

DEFAULT_SWOT_THREATS: list[str] = [
    "Rapidly changing technology landscape",
    "Increasing technical skill requirements",
    "Competitive internship environment",
    "Need for continuous learning",
]

DEFAULT_MENTOR_RECOMMENDATIONS: list[str] = [
    "Focus on database design and cloud computing skills",
    "Participate in more collaborative coding projects",
    "Improve technical documentation skills",
    "Develop a structured approach to time management",
]

DEFAULT_ANALYSIS_KEY_METRICS: list[dict] = [
    {"label": "Activity Completion Rate", "pct": 75},
    {"label": "Meeting Attendance", "pct": 90},
    {"label": "Activity Quality Score", "pct": 82},
    {"label": "Feedback Implementation", "pct": 68},
]

DEFAULT_SKILLS_RECOMMENDATIONS: list[str] = [
    "Focus on improving database design skills by taking additional online courses.",
    "Participate in more collaborative projects to enhance teamwork abilities.",
    "Practice writing technical documentation to improve communication skills.",
]

DEFAULT_COMPARISON_CHART: list[dict] = [
    {"skill": "Technical", "previous": 70, "current": 85},
    {"skill": "Communication", "previous": 65, "current": 75},
    {"skill": "Problem Solving", "previous": 78, "current": 90},
    {"skill": "Leadership", "previous": 55, "current": 65},
    {"skill": "Domain Knowledge", "previous": 60, "current": 80},
]

DEFAULT_COMPARISON_IMPROVEMENTS: list[dict] = [
    {"label": "Domain Knowledge", "change_pct": 33.3, "score": 80, "previous_score": 60},
    {"label": "Technical", "change_pct": 21.4, "score": 85, "previous_score": 70},
]

DEFAULT_COMPARISON_FOCUS: list[dict] = [
    {"label": "Leadership", "change_pct": 18.2, "score": 65, "previous_score": 55},
    {"label": "Communication", "change_pct": 15.4, "score": 75, "previous_score": 65},
]

DEFAULT_COMPARISON_ACTIVITY: dict = {
    "subtitle": "Monthly activity totals vs completed",
    "months": ["Aug", "Sep", "Oct", "Nov"],
    "total": [3, 5, 4, 3],
    "completed": [2, 3, 2, 1],
}

DEFAULT_PERFORMANCE_ANALYSIS: list[dict] = [
    {
        "skill": "Technical Proficiency",
        "score": 78,
        "global_avg": 74,
        "vs_global": 4,
        "trend_pct": 4,
        "trend": "up",
        "narrative": (
            "Your technical skills are 5% above global averages, "
            "showing strong command of core technologies."
        ),
    },
    {
        "skill": "Problem Solving",
        "score": 85,
        "global_avg": 75,
        "vs_global": 10,
        "trend_pct": 13,
        "trend": "up",
        "narrative": "Exceptional problem solving abilities, placing you in the top 15% globally.",
    },
    {
        "skill": "Communication",
        "score": 65,
        "global_avg": 80,
        "vs_global": -15,
        "trend_pct": 18,
        "trend": "down",
        "narrative": (
            "Communication skills need improvement to meet global standards. "
            "Consider our advanced courses."
        ),
    },
    {
        "skill": "Professional Network",
        "score": 62,
        "global_avg": 68,
        "vs_global": -6,
        "trend_pct": 8,
        "trend": "down",
        "narrative": (
            "Building a stronger professional network will enhance your career opportunities."
        ),
    },
]

COMPARISON_PERIOD_OPTIONS: list[str] = ["1M", "3M", "6M", "1Y"]
