"""Seed mentor, admin, and meetings so mentor/admin flows work locally."""
from __future__ import annotations

import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.password import hash_password
from app.db.database import SessionLocal, engine, Base
from app.db.models.registry import import_all_models
from app.db.models.admin import Admin
from app.db.models.meetings import Meetings
from app.db.models.mentors import Mentor
from app.db.models.students import Student

import_all_models()

from app.data.mock_tracker_meetings import MOCK_TRACKER_MEETINGS
from app.data.demo_personas import DEMO_USNS

SAMPLE_USN = "JAIN-SAMPLE-2026-001"
DEMO_MEETING_USNS = [SAMPLE_USN, *DEMO_USNS]
MENTOR_ID = "MENTOR-SAMPLE-001"
MENTOR_MICHAEL_ID = "MENTOR-SAMPLE-002"
ADMIN_ID = "ADMIN-SAMPLE-001"
ROLE_PASSWORD = "SampleTest123!"


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        mentor = db.query(Mentor).filter_by(mentor_id=MENTOR_ID).first()
        if not mentor:
            mentor = Mentor(
                mentor_id=MENTOR_ID,
                mentor_name="Dr. Sarah Johnson",
                mentor_department="Computer Science and IT",
                mentor_email="sample.mentor@jain.test",
                mentor_phoneno="9999999001",
                mentor_password=hash_password(ROLE_PASSWORD),
            )
            db.add(mentor)
        else:
            mentor.mentor_password = hash_password(ROLE_PASSWORD)
            mentor.mentor_name = "Dr. Sarah Johnson"

        mentor_m = db.query(Mentor).filter_by(mentor_id=MENTOR_MICHAEL_ID).first()
        if not mentor_m:
            mentor_m = Mentor(
                mentor_id=MENTOR_MICHAEL_ID,
                mentor_name="Prof. Michael Roberts",
                mentor_department="Computer Science and IT",
                mentor_email="michael.roberts@jain.test",
                mentor_phoneno="9999999003",
                mentor_password=hash_password(ROLE_PASSWORD),
            )
            db.add(mentor_m)
        else:
            mentor_m.mentor_name = "Prof. Michael Roberts"

        admin = db.query(Admin).filter_by(admin_id=ADMIN_ID).first()
        if not admin:
            admin = Admin(
                admin_id=ADMIN_ID,
                admin_name="Sample Admin",
                admin_department="Central Admin",
                admin_campus="Main Campus",
                admin_email="sample.admin@jain.test",
                admin_phoneno="9999999002",
                admin_password=hash_password(ROLE_PASSWORD),
            )
            db.add(admin)
        else:
            admin.admin_password = hash_password(ROLE_PASSWORD)

        for demo_usn in DEMO_MEETING_USNS:
            row = db.query(Student).filter_by(student_usn=demo_usn).first()
            if row:
                row.assigned_mentor = MENTOR_ID
                if not row.student_phoneno:
                    row.student_phoneno = "9999999000"

        db.commit()

        for meet_usn in DEMO_MEETING_USNS:
            st = db.query(Student).filter_by(student_usn=meet_usn).first()
            if not st:
                continue
            db.query(Meetings).filter(Meetings.student_usn == meet_usn).delete()
            mentor_map = {"sarah": MENTOR_ID, "michael": MENTOR_MICHAEL_ID}
            for spec in MOCK_TRACKER_MEETINGS:
                db.add(
                    Meetings(
                        id=str(uuid.uuid4()),
                        mentor_id=mentor_map[spec["mentor_key"]],
                        student_usn=meet_usn,
                        meeting_date=spec["meeting_date"],
                        venue=spec["venue"],
                        status=spec["status"],
                        attendance=spec.get("attendance"),
                        agenda=spec["agenda"],
                        duration=spec["duration"],
                        meeting_mode=spec["meeting_mode"],
                        google_meet_link=spec.get("google_meet_link"),
                        progress_notes=spec.get("progress_notes"),
                    )
                )
            db.commit()

        print(
            f"Local roles ready:\n"
            f"  Mentor login: {MENTOR_ID} / {ROLE_PASSWORD}\n"
            f"  Admin login:  {ADMIN_ID} / {ROLE_PASSWORD}\n"
            f"  Students {', '.join(DEMO_MEETING_USNS)} assigned to {MENTOR_ID} with sample meetings"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
