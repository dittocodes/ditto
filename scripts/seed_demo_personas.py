"""Seed demo personas for client presentations."""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.password import hash_password
from app.db.database import SessionLocal, engine, Base
from app.db.models.registry import import_all_models
from app.db.models.students import Student
from app.db.models.student_platform import (
    DocumentGenerated,
    KnowledgeBaseEntry,
    StudentActivityV2,
    StudentLink,
    SwotEntry,
)
from app.data.demo_personas import DEMO_KB_ENTRIES, DEMO_PASSWORD, DEMO_USNS, PERSONAS
from app.data.mock_tracker_activities import MOCK_TRACKER_ACTIVITIES
from app.data.mock_tracker_profile import DEFAULT_CAREER_GOAL
from app.services.uid_registry import ensure_student_uid, mint_student_uid
from app.services.living_report_service import upsert_living_report
from app.services.gemini_insight_service import build_profile
from app.services.report_pdf_service import build_tracker_report_pdf, report_sections_from_payload
from app.services.insight_cache import invalidate_uid

import_all_models()

TRACKER_DASHBOARD = "tracker_dashboard"


def _dash_delta(gpa: float, performance_score: float, scale: float = 1.0) -> dict:
    act_done = int(24 * scale)
    meet_done = int(18 * scale)
    return {
        "performance_score": performance_score,
        "global_rank": int(287 / scale) if scale >= 1 else 420,
        "display_metrics": {
            "activities_completed": act_done,
            "meetings_completed": meet_done,
            "avg_learning_hours": int(32 * scale),
            "activities_progress_pct": int(72 * scale),
            "meetings_progress_pct": int(85 * scale),
            "performance_progress_pct": performance_score,
            "avg_hours_progress_pct": int(68 * scale),
            "activities_trend_pct": 12 if scale >= 0.9 else -5,
            "meetings_trend_pct": 8 if scale >= 0.9 else -3,
            "performance_trend_pct": 6 if scale >= 0.9 else -8,
            "avg_hours_trend_pct": -4,
            "kpi_learning_hours": int(128 * scale),
            "kpi_learning_hours_trend_pct": 12,
            "skills_acquired": int(14 * scale),
            "skills_acquired_trend_pct": 5,
            "goal_completion_pct": int(72 * scale),
            "goal_completion_trend_pct": 8,
            "global_rank_trend_pct": 24 if scale >= 1 else -12,
        },
        "skills_overview": [
            {"name": "Programming", "pct": min(100, int(85 * scale))},
            {"name": "Data Analysis", "pct": min(100, int(70 * scale))},
            {"name": "Database Design", "pct": min(100, int(55 * scale))},
            {"name": "Web Development", "pct": min(100, int(80 * scale))},
            {"name": "Algorithms", "pct": min(100, int(65 * scale))},
        ],
        "skill_distribution": [
            {"name": "Technical", "value": 35},
            {"name": "Soft Skills", "value": 25},
            {"name": "Leadership", "value": 20},
            {"name": "Domain", "value": 20},
        ],
        "activity_completion": {
            "months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            "total": [15, 22, 20, 23, 26, 28],
            "completed": [12, 19, 17, 21, 24, 27],
        },
        "performance_trend": {
            "weeks": ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
            "scores": [64, 68, 66, 72, 76, 78, 82, int(performance_score)],
        },
        "skill_growth_items": [
            {"skill": "Problem Solving", "previous": 50, "current": int(75 * scale), "growth_pct": 50},
            {"skill": "Communication", "previous": 65, "current": int(80 * scale), "growth_pct": 23},
            {"skill": "Technical", "previous": 60, "current": int(85 * scale), "growth_pct": 42},
            {"skill": "Leadership", "previous": 45, "current": int(65 * scale), "growth_pct": 44},
        ],
        "benchmark": {
            "axes": [
                "Technical Skills",
                "Problem Solving",
                "Communication",
                "Leadership",
                "Time Management",
                "Industry Knowledge",
            ],
            "your_score": [78, 85, 65, 70, 72, 68],
            "regional_avg": [74, 75, 80, 68, 70, 65],
            "global_avg": [70, 72, 78, 65, 68, 62],
        },
    }


def _ensure_student(db, usn: str) -> Student:
    meta = PERSONAS[usn]
    st = db.query(Student).filter(Student.student_usn == usn).first()
    if not st:
        st = Student(
            student_usn=usn,
            student_email=meta["email"],
            student_password=hash_password(DEMO_PASSWORD),
            student_name=meta["name"],
            student_program=meta["program"],
            semester=meta["semester"],
            uid=mint_student_uid(),
            assigned_mentor="MENTOR-SAMPLE-001",
        )
        db.add(st)
        db.commit()
    else:
        ensure_student_uid(db, usn)
        st.student_password = hash_password(DEMO_PASSWORD)
        st.student_email = meta["email"]
        st.student_name = meta["name"]
        st.student_program = meta["program"]
        st.semester = meta["semester"]
        st.assigned_mentor = "MENTOR-SAMPLE-001"
        db.commit()
        db.refresh(st)
    return st


def _seed_kb(db) -> None:
    for scope, programme_id, content in DEMO_KB_ENTRIES:
        exists = (
            db.query(KnowledgeBaseEntry)
            .filter(KnowledgeBaseEntry.scope == scope, KnowledgeBaseEntry.content == content)
            .first()
        )
        if not exists:
            db.add(
                KnowledgeBaseEntry(
                    scope=scope,
                    programme_id=programme_id,
                    content=content,
                )
            )
    db.commit()


def _seed_day0(db, st: Student) -> None:
    st.verified_at = None
    db.commit()
    uid = st.uid


def _seed_full(db, st: Student, gpa: float, performance_score: float, scale: float) -> None:
    uid = st.uid
    st.verified_at = datetime.utcnow()
    db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).delete()
    for act in MOCK_TRACKER_ACTIVITIES[: int(9 * scale) or 3]:
        db.add(
            StudentActivityV2(
                uid=uid,
                title=act["title"],
                description=act["description"],
                origin="ai",
                term=act["term"],
                progress_pct=int(act["progress_pct"] * scale),
                status=act["status"],
                due_date=act["due_date"],
            )
        )
    if not db.query(SwotEntry).filter(SwotEntry.uid == uid).first():
        db.add(
            SwotEntry(
                uid=uid,
                strengths=["Strong programming", "Problem solving"],
                weaknesses=["Database design", "Time management"],
                opportunities=["Cloud certifications", "CodeCraft club"],
                threats=["Fast-changing tech stack"],
                source="seed",
            )
        )
    upsert_living_report(
        db,
        uid=uid,
        report_type="academic_report",
        delta={
            "gpa": gpa,
            "required_credits_earned": int(65 * scale),
            "required_credits_total": 100,
            "elective_credits_earned": int(21 * scale),
            "elective_credits_total": 30,
            "competency_score": round(min(5.0, 3.0 + gpa / 2), 1),
        },
        narrative_hint="Demo academic report",
    )
    upsert_living_report(
        db,
        uid=uid,
        report_type="career_report",
        delta={"focus": "Software engineering", "goals": DEFAULT_CAREER_GOAL},
        narrative_hint=DEFAULT_CAREER_GOAL,
    )
    upsert_living_report(
        db,
        uid=uid,
        report_type=TRACKER_DASHBOARD,
        delta=_dash_delta(gpa, performance_score, scale),
        narrative_hint="Demo dashboard",
    )
    upsert_living_report(
        db,
        uid=uid,
        report_type="meeting_summary",
        delta={
            "summary": "Reviewed semester goals; focus on database design and CodeCraft club.",
            "action_items": [
                "Complete DB workshop Wednesdays 4pm Room 302",
                "Submit project milestone by Friday",
            ],
            "meeting_id": "demo-seed",
        },
        narrative_hint="Seeded mentor meeting summary for demo fallback",
    )
    if not db.query(StudentLink).filter(StudentLink.uid == uid).first():
        db.add(StudentLink(uid=uid, link_type="linkedin", url="https://linkedin.com/in/demo", verified_bool=True))
        db.add(StudentLink(uid=uid, link_type="github", url="https://github.com/demo", verified_bool=True))
    db.commit()


def _pregen_cv(db, st: Student) -> None:
    uid = st.uid
    db.query(DocumentGenerated).filter(DocumentGenerated.uid == uid, DocumentGenerated.doc_type == "cv").delete()
    preview = build_profile(db, uid, "documents")
    sections = report_sections_from_payload("progress", preview)
    pdf = build_tracker_report_pdf(
        title="Curriculum Vitae",
        student_name=st.student_name or st.student_usn,
        sections=sections,
    )
    out_dir = Path("uploads") / "cv"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{uid}_demo_seed.pdf"
    path.write_bytes(pdf)
    db.add(
        DocumentGenerated(
            uid=uid,
            doc_type="cv",
            storage_ref=str(path),
            preview_json=preview,
            generated_at=datetime.utcnow(),
        )
    )
    db.commit()


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_kb(db)
        for usn in DEMO_USNS:
            st = _ensure_student(db, usn)
            meta = PERSONAS[usn]
            if meta.get("day0"):
                _seed_day0(db, st)
            else:
                gpa = float(meta.get("gpa", 3.5))
                perf = float(meta.get("performance_score", 70))
                scale = 1.0 if perf >= 80 else (0.75 if perf >= 65 else 0.5)
                _seed_full(db, st, gpa, perf, scale)
                if usn == "JAIN-DEMO-STRONG-001":
                    _pregen_cv(db, st)
            invalidate_uid(st.uid)
            print(f"Demo persona: {usn} uid={st.uid}")
        print(f"Password for all demo students: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
