"""Unit tests for dashboard_mapper (DEV_SQLITE)."""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DEV_SQLITE", "1")


@pytest.fixture
def db_session():
    from app.db.database import Base, engine, SessionLocal
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
    from app.db.models.students import Student
    from app.db.models.student_platform import LivingReport, ReportSnapshot, StudentActivityV2
    from app.services.uid_registry import mint_student_uid
    from app.core.password import hash_password
    from app.services.dashboard_mapper import TRACKER_DASHBOARD_REPORT

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    usn = "TEST-DASH-001"
    st = db.query(Student).filter(Student.student_usn == usn).first()
    if not st:
        st = Student(
            student_usn=usn,
            student_email="dash@test.jain.test",
            student_password=hash_password("Test123!"),
            student_name="Dash Test",
            uid=mint_student_uid(),
            semester=3,
        )
        db.add(st)
        db.commit()
    uid = st.uid
    db.query(ReportSnapshot).filter(
        ReportSnapshot.living_report_id.in_(
            db.query(LivingReport.id).filter(LivingReport.uid == uid, LivingReport.report_type == TRACKER_DASHBOARD_REPORT)
        )
    ).delete(synchronize_session=False)
    db.query(LivingReport).filter(LivingReport.uid == uid, LivingReport.report_type == TRACKER_DASHBOARD_REPORT).delete()
    db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).delete()
    db.commit()
    today = date.today()
    db.add(
        StudentActivityV2(
            uid=uid,
            title="Sample task",
            description="Done",
            status="completed",
            term="long-term",
            progress_pct=100,
            due_date=today - timedelta(days=5),
        )
    )
    db.add(
        StudentActivityV2(
            uid=uid,
            title="Pending task",
            status="in_progress",
            term="mid-term",
            progress_pct=40,
            due_date=today + timedelta(days=10),
        )
    )
    lr = LivingReport(
        uid=uid,
        report_type=TRACKER_DASHBOARD_REPORT,
        structured_state={"skills_overview": [{"name": "Programming", "pct": 90}], "performance_score": 88},
        narrative="fixture",
        version=2,
    )
    db.add(lr)
    db.commit()
    db.refresh(lr)
    db.add(
        ReportSnapshot(
            living_report_id=lr.id,
            version=1,
            snapshot_json={"skills_overview": [{"name": "Programming", "pct": 75}]},
        )
    )
    db.add(
        ReportSnapshot(
            living_report_id=lr.id,
            version=2,
            snapshot_json={"skills_overview": [{"name": "Programming", "pct": 90}]},
        )
    )
    db.commit()
    yield db, uid
    db.close()


def test_assemble_dashboard_shape(db_session):
    db, uid = db_session
    from app.services.dashboard_mapper import assemble_dashboard

    payload = assemble_dashboard(db, uid)
    assert len(payload["summary_cards"]) == 4
    assert len(payload["kpis"]) == 8
    assert len(payload["performance_analysis"]) == 4
    assert all(len(k.get("weeks") or []) == 4 for k in payload["kpis"])
    assert all(len(k.get("bar_heights") or []) == 4 for k in payload["kpis"])
    assert payload["benchmark_panel"]["items"]
    assert len(payload["benchmark_panel"]["items"]) <= 3
    perf_card = next(c for c in payload["summary_cards"] if c["title"] == "Performance Score")
    assert float(perf_card["value"]) == 88.0
    assert "activity_reminders" in payload
    assert "activity_progress" in payload["charts"]
    assert payload["charts"]["skill_growth"]["items"]
    tags = {a.get("term_tag") for a in payload["recent_activities"]}
    assert "Long-term" in tags
    assert "Mid-term" in tags


def test_skill_growth_uses_prior_snapshot(db_session):
    db, uid = db_session
    from app.services.dashboard_mapper import assemble_dashboard

    payload = assemble_dashboard(db, uid)
    growth = payload["charts"]["skill_growth"]["items"]
    tech = next(g for g in growth if g["skill"] == "Technical")
    assert tech["previous"] == 75
    assert tech["current"] == 90
    assert tech["growth_pct"] >= 0


def test_merge_doc_fields_to_dashboard_delta():
    from app.services.dashboard_mapper import merge_doc_fields_to_dashboard_delta

    delta = merge_doc_fields_to_dashboard_delta(
        {"skills": {"Programming": 80}, "performance_score": 77, "engagement_score": 81, "attendance_pct": 93}
    )
    assert delta["performance_score"] == 77
    assert delta["engagement_score"] == 81
    assert delta["attendance_pct"] == 93
    assert delta["skills_overview"][0]["name"] == "Programming"
