"""Write docs/design/DASHBOARD_PAYLOAD.example.json from DEV_SQLITE fixture student."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DEV_SQLITE", "1")

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
from app.db.database import SessionLocal
from app.db.models.students import Student
from app.services.dashboard_mapper import assemble_dashboard


def main() -> None:
    db = SessionLocal()
    st = db.query(Student).filter(Student.student_usn == "TEST-DASH-001").first()
    if not st:
        raise SystemExit("Run pytest tests/test_dashboard_mapper.py first to create TEST-DASH-001")
    payload = assemble_dashboard(db, st.uid)
    out = ROOT / "docs" / "design" / "DASHBOARD_PAYLOAD.example.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    db.close()
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
