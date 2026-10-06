"""Print sample USN and verify login row exists."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app.db.database import SessionLocal
from app.db.models import student_platform  # noqa: F401
from app.db.models import counseling, activities, mentors, meetings  # noqa: F401

SAMPLE = "JAIN-SAMPLE-2026-001"


def main() -> None:
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT student_usn, student_email FROM students WHERE student_usn = :u"),
            {"u": SAMPLE},
        ).first()
        print("connection: ok")
        print("sample_usn:", SAMPLE)
        print("exists:", bool(row))
        if row:
            print("email:", row[1])
    finally:
        db.close()


if __name__ == "__main__":
    main()
