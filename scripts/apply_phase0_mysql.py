"""Apply Phase 0 student columns + create_all for new tracker tables."""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from sqlalchemy import text

from app.db.database import Base, engine
from app.db.models import (  # noqa: F401
    counseling,
    activities,
    query,
    mentors,
    admin,
    login,
    forgot_password,
    MCA_assignments,
    meetings,
    mentee_competency_report,
    psychometric_responses,
    report,
    swot,
    competencies,
    activities_tracking,
    activity_submissions,
    attendance,
    committee_member,
    academic_performance,
    pf16_responses,
    ibp_responses,
    experience_learning,
    email_logs,
    internal_marks,
    employability,
    alumni_sessions,
    expert_sessions,
    notifications,
    student_platform,
)

ALTERS = [
    "ALTER TABLE students ADD COLUMN uid VARCHAR(64) NULL",
    "ALTER TABLE students ADD COLUMN institution_id VARCHAR(64) NULL",
    "ALTER TABLE students ADD COLUMN programme_id VARCHAR(64) NULL",
    "ALTER TABLE students ADD COLUMN batch_id VARCHAR(64) NULL",
    "ALTER TABLE students ADD COLUMN verified_at DATETIME NULL",
]


def main() -> None:
    with engine.begin() as conn:
        for stmt in ALTERS:
            col = stmt.split()[5]
            try:
                conn.execute(text(stmt))
                print(f"Added column: {col}")
            except Exception as e:
                if "1060" in str(e) or "Duplicate column" in str(e):
                    print(f"Column exists: {col}")
                else:
                    raise
        try:
            conn.execute(text("CREATE UNIQUE INDEX idx_students_uid ON students(uid)"))
            print("Index idx_students_uid created")
        except Exception as e:
            if "1061" in str(e) or "Duplicate key" in str(e):
                print("Index idx_students_uid already exists")
            else:
                raise
    Base.metadata.create_all(bind=engine)
    print("create_all completed")


if __name__ == "__main__":
    main()
