"""Mock meetings for Tracker meetings page (sample student)."""
from __future__ import annotations

from datetime import datetime

# mentor_id keys resolved in seed script
MOCK_TRACKER_MEETINGS: list[dict] = [
    {
        "mentor_key": "sarah",
        "agenda": "Monthly Progress Review",
        "meeting_date": datetime(2026, 11, 15, 14, 0, 0),
        "venue": "Room 302",
        "duration": 45,
        "status": "approved",
        "meeting_mode": "online",
        "google_meet_link": "https://meet.google.com/sample-progress-review",
        "attendance": "pending",
    },
    {
        "mentor_key": "michael",
        "agenda": "Career Guidance Session",
        "meeting_date": datetime(2026, 12, 1, 15, 0, 0),
        "venue": "Room 205",
        "duration": 30,
        "status": "scheduled",
        "meeting_mode": "offline",
        "google_meet_link": None,
        "attendance": "pending",
    },
    {
        "mentor_key": "michael",
        "agenda": "SWOT Analysis Discussion",
        "meeting_date": datetime(2026, 11, 25, 9, 15, 0),
        "venue": "Online",
        "duration": 45,
        "status": "approved",
        "meeting_mode": "online",
        "google_meet_link": "https://meet.google.com/sample-swot",
        "attendance": "pending",
    },
    {
        "mentor_key": "sarah",
        "agenda": "Mid-semester Check-in",
        "meeting_date": datetime(2026, 8, 10, 11, 0, 0),
        "venue": "Room 302",
        "duration": 45,
        "status": "completed",
        "meeting_mode": "offline",
        "google_meet_link": None,
        "attendance": "present",
        "progress_notes": "Strong progress on technical activities.",
    },
    {
        "mentor_key": "sarah",
        "agenda": "Kickoff Mentoring Session",
        "meeting_date": datetime(2026, 7, 5, 10, 30, 0),
        "venue": "Room 302",
        "duration": 60,
        "status": "completed",
        "meeting_mode": "offline",
        "google_meet_link": None,
        "attendance": "present",
        "progress_notes": "Good start on activities.",
    },
]
