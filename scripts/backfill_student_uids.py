"""Backfill Student.uid for rows missing pipeline identity."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.db.models.students import Student
from app.services.uid_registry import ensure_student_uid


def main() -> None:
    db = SessionLocal()
    try:
        rows = db.query(Student).filter((Student.uid == None) | (Student.uid == "")).all()  # noqa: E711
        count = 0
        for st in rows:
            ensure_student_uid(db, st.student_usn)
            count += 1
        print(f"Backfilled UID for {count} student(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
