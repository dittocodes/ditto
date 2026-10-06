"""Pipeline integration smoke test (uses DEV_SQLITE when set)."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DEV_SQLITE", "1")


@pytest.fixture(scope="module")
def db_session():
    from app.db.database import Base, engine, SessionLocal
    from app.db.models import (  # noqa: F401 — full registry (same as seed)
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
    from app.services.uid_registry import mint_student_uid
    from app.core.password import hash_password

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    usn = "TEST-PIPELINE-001"
    st = db.query(Student).filter(Student.student_usn == usn).first()
    if not st:
        st = Student(
            student_usn=usn,
            student_email="test.pipe@jain.test",
            student_password=hash_password("Test123!"),
            student_name="Pipeline Test",
            uid=mint_student_uid(),
        )
        db.add(st)
        db.commit()
    yield db, st.uid
    db.close()


@patch("app.services.raw_vault_service.upload_bytes", return_value="https://example.com/doc")
def test_raw_vault_dedupe(mock_up, db_session):
    db, uid = db_session
    from app.services.raw_vault_service import store_raw

    data = b"sample-pdf-bytes"
    a = store_raw(db, uid=uid, doc_type="academic", file_bytes=data, filename="a.pdf")
    b = store_raw(db, uid=uid, doc_type="academic", file_bytes=data, filename="b.pdf")
    assert a.id == b.id


@patch("app.services.raw_vault_service.upload_bytes", return_value="https://example.com/doc2")
def test_job_idempotency(mock_up, db_session):
    db, uid = db_session
    from app.services.raw_vault_service import store_raw
    from app.api.v1.students import _enqueue

    raw = store_raw(db, uid=uid, doc_type="academic", file_bytes=b"unique-bytes", filename="x.pdf")
    j1 = _enqueue(db, uid, raw, "academic_report")
    j2 = _enqueue(db, uid, raw, "academic_report")
    assert j1.id == j2.id


def test_insight_overview(db_session):
    db, uid = db_session
    from app.services.gemini_insight_service import build_overview

    payload = build_overview(db, uid, use_gemini=False)
    assert payload["welcome_name"]
    assert len(payload["summary_cards"]) == 4
