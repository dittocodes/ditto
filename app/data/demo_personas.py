"""Synthetic demo persona constants (no real PII)."""
from __future__ import annotations

DEMO_PASSWORD = "SampleTest123!"

DEMO_USNS = [
    "JAIN-DEMO-DAY0-001",
    "JAIN-DEMO-STRONG-001",
    "JAIN-DEMO-AVG-001",
    "JAIN-DEMO-RISK-001",
]

SAMPLE_ACCOUNT_USNS = [
    *DEMO_USNS,
    "JAIN-SAMPLE-2026-001",
]

PERSONAS = {
    "JAIN-DEMO-DAY0-001": {
        "name": "Jordan Demo",
        "email": "jordan.day0@jain.test",
        "program": "Computer Science",
        "semester": 1,
        "day0": True,
    },
    "JAIN-DEMO-STRONG-001": {
        "name": "Alex Strong",
        "email": "alex.strong@jain.test",
        "program": "Computer Science",
        "semester": 3,
        "gpa": 3.8,
        "performance_score": 85.7,
    },
    "JAIN-DEMO-AVG-001": {
        "name": "Sam Average",
        "email": "sam.avg@jain.test",
        "program": "Computer Science",
        "semester": 3,
        "gpa": 3.2,
        "performance_score": 68.0,
    },
    "JAIN-DEMO-RISK-001": {
        "name": "Riley AtRisk",
        "email": "riley.risk@jain.test",
        "program": "Computer Science",
        "semester": 3,
        "gpa": 2.4,
        "performance_score": 52.0,
    },
}

DEMO_KB_ENTRIES = [
    (
        "global",
        None,
        "Campus Toastmasters Club meets Tuesdays at Student Center; provides structured speech training "
        "for stage fright and public speaking anxiety.",
    ),
    (
        "global",
        None,
        "Placement cell runs System Design and Cloud Whiteboarding practice labs every Friday for "
        "technical interview preparation.",
    ),
    ("global", None, "Join the CodeCraft club weekly hack nights in Lab B-204."),
    ("global", None, "Campus career fair runs every March — register via the student portal."),
    ("programme", "CS", "Complete a cloud certification via the Jain AWS Academy lab."),
    ("programme", "CS", "Database Design workshop series — Wednesdays 4pm, Room 302."),
    ("programme", "CS", "Internship applications open in semester 5 — use the career cell mentor slot."),
    ("programme", "CS", "IEEE student chapter hosts project showcases each November."),
]
