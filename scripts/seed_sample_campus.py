"""Sample campus events, attendance, proofs, and activities for sample accounts only."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.data.demo_personas import SAMPLE_ACCOUNT_USNS
from app.db.database import SessionLocal
from app.db.models.campus_portal import CampusAnnouncement, CampusEvent, EventAttendance, EventRSVP, StudentBlog
from app.db.models.registry import import_all_models
from app.db.models.student_platform import CampusActivity, StudentActivityV2, SwotEntry
from app.db.models.students import Student
from app.services.campus_sync import mark_and_sync

import_all_models()

HOST = "DEMO-MENTOR"

EVENTS = [
    {
        "title": "CodeCraft Hack Night",
        "description": "Weekly build night in the CS lab. Bring a laptop.",
        "event_type": "offline",
        "location_details": "Lab B-204",
        "scheduled_at": datetime(2026, 9, 12, 16, 0),
        "linked_skills": ["Programming", "Teamwork"],
        "status": "ended",
    },
    {
        "title": "Database Design Workshop",
        "description": "Hands-on schema design. Room opens at 3:45.",
        "event_type": "offline",
        "location_details": "Room 302",
        "scheduled_at": datetime(2026, 9, 24, 16, 0),
        "linked_skills": ["Database Design"],
        "status": "ended",
    },
    {
        "title": "System Design Practice",
        "description": "Online whiteboard session for interview practice.",
        "event_type": "online",
        "location_details": "System Design Lab",
        "scheduled_at": datetime(2026, 10, 2, 15, 0),
        "linked_skills": ["System Design"],
        "status": "ended",
    },
    {
        "title": "Career Fair Briefing",
        "description": "How to use the October career fair, including what to bring.",
        "event_type": "offline",
        "location_details": "Student Center",
        "scheduled_at": datetime(2026, 10, 21, 10, 0),
        "linked_skills": ["Communication"],
        "status": "scheduled",
    },
    {
        "title": "IEEE Showcase Rehearsal",
        "description": "Online run-through before the November project showcase.",
        "event_type": "online",
        "location_details": "IEEE Rehearsal Room",
        "scheduled_at": datetime(2026, 11, 8, 17, 0),
        "linked_skills": ["Web Development"],
        "status": "scheduled",
    },
]

# present / absent applies to ended events. rsvp applies to upcoming events.
ATTENDANCE = {
    "JAIN-DEMO-STRONG-001": {
        "CodeCraft Hack Night": "present",
        "Database Design Workshop": "present",
        "System Design Practice": "present",
        "Career Fair Briefing": "rsvp",
        "IEEE Showcase Rehearsal": "rsvp",
    },
    "JAIN-DEMO-AVG-001": {
        "CodeCraft Hack Night": "present",
        "Database Design Workshop": "absent",
        "System Design Practice": "present",
        "Career Fair Briefing": "rsvp",
    },
    "JAIN-DEMO-RISK-001": {
        "CodeCraft Hack Night": "absent",
        "Database Design Workshop": "present",
        "System Design Practice": "absent",
        "IEEE Showcase Rehearsal": "rsvp",
    },
    "JAIN-DEMO-DAY0-001": {
        "CodeCraft Hack Night": "present",
        "Career Fair Briefing": "rsvp",
    },
    "JAIN-SAMPLE-2026-001": {
        "CodeCraft Hack Night": "present",
        "Database Design Workshop": "present",
        "System Design Practice": "absent",
        "Career Fair Briefing": "rsvp",
        "IEEE Showcase Rehearsal": "rsvp",
    },
}

TASKS = {
    "JAIN-DEMO-STRONG-001": [
        ("Present the CodeCraft project demo", "completed", 100, "short-term", datetime(2026, 9, 20)),
        ("Complete the database workshop sheet", "completed", 100, "short-term", datetime(2026, 9, 30)),
        ("Prepare the career fair profile", "in_progress", 80, "mid-term", datetime(2026, 10, 18)),
    ],
    "JAIN-DEMO-AVG-001": [
        ("Present the CodeCraft project demo", "completed", 100, "short-term", datetime(2026, 9, 20)),
        ("Complete the database workshop sheet", "in_progress", 45, "short-term", datetime(2026, 10, 12)),
        ("Prepare the career fair profile", "pending", 10, "mid-term", datetime(2026, 10, 18)),
    ],
    "JAIN-DEMO-RISK-001": [
        ("Present the CodeCraft project demo", "pending", 0, "short-term", datetime(2026, 9, 20)),
        ("Complete the database workshop sheet", "in_progress", 15, "short-term", datetime(2026, 10, 12)),
        ("Prepare the career fair profile", "pending", 0, "mid-term", datetime(2026, 10, 18)),
    ],
    "JAIN-DEMO-DAY0-001": [
        ("Visit the campus club fair", "completed", 100, "short-term", datetime(2026, 9, 5)),
        ("Prepare the career fair profile", "pending", 0, "short-term", datetime(2026, 10, 18)),
    ],
    "JAIN-SAMPLE-2026-001": [
        ("Present the CodeCraft project demo", "completed", 100, "short-term", datetime(2026, 9, 20)),
        ("Complete the database workshop sheet", "in_progress", 60, "short-term", datetime(2026, 10, 12)),
        ("Prepare the career fair profile", "in_progress", 40, "mid-term", datetime(2026, 10, 18)),
    ],
}

PROOFS = {
    "JAIN-DEMO-STRONG-001": ("City hackathon volunteer desk", "Organiser", "2026-08-15", True),
    "JAIN-DEMO-AVG-001": ("Campus blood donation camp", "Volunteer", "2026-08-20", True),
    "JAIN-DEMO-RISK-001": ("Department sports day", "Participant", "2026-08-28", False),
    "JAIN-DEMO-DAY0-001": ("Orientation club fair", "Visitor", "2026-09-01", False),
    "JAIN-SAMPLE-2026-001": ("Department tech talk", "Speaker", "2026-07-30", True),
}


def _students(db) -> dict[str, Student]:
    rows = db.query(Student).filter(Student.student_usn.in_(SAMPLE_ACCOUNT_USNS)).all()
    found = {row.student_usn: row for row in rows}
    missing = [usn for usn in SAMPLE_ACCOUNT_USNS if usn not in found or not found[usn].uid]
    if missing:
        raise SystemExit(f"Missing sample students: {', '.join(missing)}")
    return found


def _events(db) -> dict[str, CampusEvent]:
    found: dict[str, CampusEvent] = {}
    for spec in EVENTS:
        row = (
            db.query(CampusEvent)
            .filter(CampusEvent.creator_id == HOST, CampusEvent.title == spec["title"])
            .first()
        )
        if row is None:
            row = CampusEvent(creator_id=HOST, creator_role="mentor", visibility="sample_accounts", **spec)
            db.add(row)
            db.commit()
            db.refresh(row)
        else:
            row.description = spec["description"]
            row.event_type = spec["event_type"]
            row.location_details = spec["location_details"]
            row.scheduled_at = spec["scheduled_at"]
            row.linked_skills = spec["linked_skills"]
            row.status = spec["status"]
            row.visibility = "sample_accounts"
            db.commit()
        found[spec["title"]] = row
    return found


def _attendance(db, students: dict[str, Student], events: dict[str, CampusEvent]) -> None:
    for usn, plan in ATTENDANCE.items():
        student = students[usn]
        for title, action in plan.items():
            event = events[title]
            if action in {"present", "absent"}:
                mark_and_sync(db, event, student, action, HOST)
            if action in {"present", "rsvp"} or (action == "absent" and event.status != "ended"):
                row = (
                    db.query(EventRSVP)
                    .filter(EventRSVP.event_id == event.id, EventRSVP.student_uid == student.uid)
                    .first()
                )
                if row is None:
                    row = EventRSVP(event_id=event.id, student_uid=student.uid, status="attending")
                    db.add(row)
                row.status = "attending"
                if event.event_type == "online" and action == "present":
                    row.joined_at = event.scheduled_at
            elif action == "absent":
                row = (
                    db.query(EventRSVP)
                    .filter(EventRSVP.event_id == event.id, EventRSVP.student_uid == student.uid)
                    .first()
                )
                if row is not None:
                    db.delete(row)
    db.commit()


def _tasks(db, students: dict[str, Student]) -> None:
    for usn, items in TASKS.items():
        uid = students[usn].uid
        for title, status, progress, term, due in items:
            row = (
                db.query(StudentActivityV2)
                .filter(StudentActivityV2.uid == uid, StudentActivityV2.title == title)
                .first()
            )
            if row is None:
                row = StudentActivityV2(uid=uid, title=title, origin="mentor")
                db.add(row)
            row.description = "Sample campus follow-up for this student."
            row.status = status
            row.progress_pct = progress
            row.term = term
            row.due_date = due
    db.commit()


def _proofs(db, students: dict[str, Student]) -> None:
    for usn, (name, role, when, verified) in PROOFS.items():
        uid = students[usn].uid
        ref = f"sample-proof-{usn}"
        row = (
            db.query(CampusActivity)
            .filter(CampusActivity.uid == uid, CampusActivity.evidence_ref == ref)
            .first()
        )
        if row is None:
            row = CampusActivity(uid=uid, evidence_ref=ref)
            db.add(row)
        row.event_name = name
        row.role = role
        row.record_date = when
        row.verified_bool = verified
    db.commit()


def _hub(db, students: dict[str, Student]) -> None:
    now = datetime.now().replace(second=0, microsecond=0)
    notes = [
        (
            "SAMPLE-ADMIN",
            "admin",
            True,
            now - timedelta(hours=2),
            "URGENT: Admin\nFinal Semester Lab Exam Schedule Published\n\nThe official timetable for Semester 5 practicals is now live. Please verify your batch assignments.",
        ),
        (
            "SAMPLE-DEPT",
            "dept_head",
            False,
            (now - timedelta(days=1)).replace(hour=10, minute=0),
            "INFO: Dept Head (CSE)\nBlock 3 WiFi Maintenance\n\nNetwork access in CSE Block 3 will be down this Friday from 2:00 PM to 4:00 PM.",
        ),
        (
            "SAMPLE-MENTOR",
            "mentor",
            False,
            datetime(2026, 10, 5, 18, 0),
            "UPDATE: Mentor Parvathi\nReminder: AWS Certification Submission\n\nIf you completed the AWS Cloud Practitioner track, upload your proofs by Monday end of day.",
        ),
    ]
    for author_id, role, pinned, when, content in notes:
        row = db.query(CampusAnnouncement).filter(CampusAnnouncement.author_id == author_id).first()
        if row is None:
            row = CampusAnnouncement(author_id=author_id)
            db.add(row)
        row.author_role = role
        row.content = content
        row.is_pinned = pinned
        row.created_at = when

    upcoming = [
        ("AI for Biology: AlphaFold", "Guest lecture and workshop", "online", "LiveKit Room 4A", datetime(2026, 10, 12, 14, 0), ["Bio-AI", "Python"], "Mentor Ditto Mohan"),
        ("SIH Team Formation Mixer", "Smart India Hackathon prep", "offline", "Main Auditorium", datetime(2026, 10, 14, 10, 0), ["Leadership", "Development"], "E-Cell JAIN"),
        ("Toastmasters Meetup", "Overcoming stage fright", "offline", "Block B, Room 402", datetime(2026, 10, 15, 16, 0), ["Public Speaking"], "Campus Debate Club"),
        ("AWS Cloud Practitioner Clinic", "Lab hour for the certification track", "offline", "AWS Academy Lab", datetime(2026, 10, 18, 11, 0), ["Cloud"], "Mentor Parvathi"),
        ("System Design Friday Lab", "Whiteboard practice for placements", "online", "System Design Lab", datetime(2026, 10, 23, 15, 0), ["System Design"], "Placement Cell"),
        ("CodeCraft Weekly Hack Night", "Bring a laptop. Lab opens at 3:45.", "offline", "Lab B-204", datetime(2026, 10, 28, 16, 0), ["Programming", "Teamwork"], "CodeCraft Club"),
    ]
    for title, description, kind, place, when, skills, host in upcoming:
        row = db.query(CampusEvent).filter(CampusEvent.title == title, CampusEvent.visibility == "sample_accounts").first()
        if row is None:
            row = CampusEvent(title=title, visibility="sample_accounts", creator_role="mentor")
            db.add(row)
        row.creator_id = host
        row.description = description
        row.event_type = kind
        row.location_details = place
        row.scheduled_at = when
        row.linked_skills = skills
        row.status = "scheduled"
        row.visibility = "sample_accounts"
    db.commit()

    saved = {
        row.title: row
        for row in db.query(CampusEvent).filter(CampusEvent.visibility == "sample_accounts").all()
    }
    for usn, student in students.items():
        for title in ("AI for Biology: AlphaFold", "SIH Team Formation Mixer", "Toastmasters Meetup"):
            event = saved[title]
            if title == "AI for Biology: AlphaFold" and usn in {"JAIN-DEMO-STRONG-001", "JAIN-SAMPLE-2026-001"}:
                mark_and_sync(db, event, student, "present", HOST)
            rsvp = (
                db.query(EventRSVP)
                .filter(EventRSVP.event_id == event.id, EventRSVP.student_uid == student.uid)
                .first()
            )
            if rsvp is None:
                rsvp = EventRSVP(event_id=event.id, student_uid=student.uid, status="attending")
                db.add(rsvp)
            rsvp.status = "attending"

    blogs = [
        ("Demystifying Retrieval-Augmented Generation (RAG)", "By Neha Sharma | Sem 5 | 6 min read\nA beginner-friendly guide to how a project team used a document index and a chat flow."),
        ("Surviving the Goldman Sachs virtual job simulation", "By Alex Kumar | Sem 5 | 4 min read\nKey takeaways from the software engineering simulation and how to prep a resume before the career fair."),
        ("What AlphaFold changed in our lab notebook", "By Priya Patel | Sem 5 | 5 min read\nHow a biology workshop turned protein questions into Python notebooks a mentor can review."),
        ("How we split the SIH problem statement", "By Rohan Gupta | Sem 6 | 7 min read\nA practical way to divide a hackathon brief so leadership, design, and development do not collide."),
        ("A quieter week after Toastmasters", "By Meera Iyer | Sem 3 | 3 min read\nStage fright did not vanish. The meetup gave me a repeatable opening and a reason to work on speaking."),
        ("Notes from the AWS Cloud Practitioner labs", "By Arjun Rao | Sem 5 | 5 min read\nWhat to finish before Monday if your mentor asked for the cloud track proof."),
        ("Database design mistakes I stopped making", "By Sana Qureshi | Sem 4 | 4 min read\nThree schema habits from the Room 302 workshop that made later projects easier to explain."),
        ("Writing a resume for the October career fair", "By Alex Kumar | Sem 5 | 4 min read\nA short checklist for the Student Center briefing: projects, skills, and one story you can say aloud."),
        ("An off-campus hackathon still needs a proof", "By Neha Sharma | Sem 5 | 3 min read\nEvents hosted here are tracked from attendance. Anything outside the college still goes in My uploads."),
        ("Python for sequence notebooks", "By Priya Patel | Sem 5 | 6 min read\nA lab note on cleaning a small sequence file before the AlphaFold session."),
        ("Leadership in a four-person team", "By Rohan Gupta | Sem 6 | 4 min read\nWhat the mixer is for: roles, a shared repo, and one person who watches the clock."),
        ("What I wish I knew before the first mentor meeting", "By Meera Iyer | Sem 3 | 5 min read\nBring one question, one unfinished task, and the campus event you already plan to attend."),
    ]
    owners = [students[usn].uid for usn in SAMPLE_ACCOUNT_USNS]
    for index, (title, content) in enumerate(blogs):
        row = db.query(StudentBlog).filter(StudentBlog.title == title).first()
        if row is None:
            row = StudentBlog(student_uid=owners[index % len(owners)], title=title)
            db.add(row)
        row.student_uid = owners[index % len(owners)]
        row.content = content
        row.published_at = datetime(2026, 9, 18 + index, 9 + (index % 5), 0)

    for student in students.values():
        swot = db.query(SwotEntry).filter(SwotEntry.uid == student.uid).first()
        if swot is None:
            continue
        weak = [str(item) for item in (swot.weaknesses or [])]
        if "Public speaking" not in weak:
            swot.weaknesses = [*weak, "Public speaking"]
    db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        students = _students(db)
        events = _events(db)
        _attendance(db, students, events)
        _tasks(db, students)
        _proofs(db, students)
        _hub(db, students)
        blank = db.query(Student).filter(Student.student_usn == "JAIN-BLANK-001").first()
        blank_events = 0
        if blank:
            blank_events = (
                db.query(CampusActivity).filter(CampusActivity.uid == blank.uid).count()
            )
        print(f"Sample events: {len(events)}")
        for usn in SAMPLE_ACCOUNT_USNS:
            uid = students[usn].uid
            marks = db.query(EventAttendance).filter(EventAttendance.student_uid == uid).count()
            tasks = db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).count()
            print(f"{usn} attendance={marks} activities={tasks}")
        print(f"Blank campus rows: {blank_events}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
