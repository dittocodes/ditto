"""Mock activities matching Tracker Activities page design."""
from __future__ import annotations

from datetime import datetime

MOCK_TRACKER_ACTIVITIES: list[dict] = [
    {
        "title": "Develop a detailed study plan",
        "description": (
            "Create a structured schedule that prioritizes chemistry and biostatistics, "
            "incorporating regular review sessions and practice problems. This will immediately "
            "address your weaknesses in these subjects and improve exam readiness."
        ),
        "term": "short-term",
        "status": "pending",
        "progress_pct": 0,
        "due_date": datetime(2026, 10, 11),
    },
    {
        "title": "Seek tutoring or supplemental instruction",
        "description": (
            "Identify resources offered by the college for chemistry and biostatistics, such as "
            "tutoring centers or workshops. Actively utilize these resources to improve your "
            "understanding and confidence."
        ),
        "term": "short-term",
        "status": "in_progress",
        "progress_pct": 25,
        "due_date": datetime(2026, 10, 7),
    },
    {
        "title": "Limit social media usage",
        "description": (
            "Establish specific times for social media engagement and stick to them rigorously. "
            "Explore apps or browser extensions that limit access to social media during study times."
        ),
        "term": "short-term",
        "status": "in_progress",
        "progress_pct": 40,
        "due_date": datetime(2026, 10, 4),
    },
    {
        "title": "Join a study group",
        "description": (
            "Find classmates who are also struggling with chemistry or biostatistics to create a "
            "collaborative learning environment. This will provide peer support and motivation."
        ),
        "term": "mid-term",
        "status": "pending",
        "progress_pct": 0,
        "due_date": datetime(2026, 10, 27),
    },
    {
        "title": "Enroll in a computer coding course",
        "description": (
            "Tackle your low confidence in computer coding by taking a beginner's course. "
            "This will help you develop essential skills for research work."
        ),
        "term": "mid-term",
        "status": "in_progress",
        "progress_pct": 15,
        "due_date": datetime(2026, 11, 11),
    },
    {
        "title": "Seek mentorship from a research professor",
        "description": (
            "Connect with a professor whose research interests align with your own to receive "
            "guidance and support in navigating the research process."
        ),
        "term": "mid-term",
        "status": "pending",
        "progress_pct": 0,
        "due_date": datetime(2026, 11, 26),
    },
    {
        "title": "Undertake independent research project",
        "description": (
            "Apply your knowledge and skills by participating in a research project, even if it's "
            "a small-scale endeavor. This will build your confidence and experience in research."
        ),
        "term": "long-term",
        "status": "pending",
        "progress_pct": 0,
        "due_date": datetime(2026, 12, 26),
    },
    {
        "title": "Develop professional networking",
        "description": (
            "Attend research conferences and workshops to meet researchers in your field and build "
            "professional contacts. This is invaluable for future career prospects."
        ),
        "term": "long-term",
        "status": "in_progress",
        "progress_pct": 10,
        "due_date": datetime(2027, 1, 25),
    },
    {
        "title": "Consider additional coursework in statistics or data analysis",
        "description": (
            "To further strengthen your skills, consider taking additional courses that focus on "
            "data analysis techniques relevant to your research interests. This will make you a "
            "more competitive candidate for research opportunities."
        ),
        "term": "long-term",
        "status": "pending",
        "progress_pct": 0,
        "due_date": datetime(2027, 3, 26),
    },
]
