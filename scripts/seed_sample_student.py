"""Seed sample student for Tracker redesign QA."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.password import hash_password
from app.db.database import SessionLocal, engine, Base
from app.db.models.registry import import_all_models
from app.db.models.students import Student
from app.db.models.student_platform import StudentActivityV2, SwotEntry
from app.services.uid_registry import mint_student_uid, ensure_student_uid
from app.services.living_report_service import upsert_living_report
from app.data.mock_tracker_activities import MOCK_TRACKER_ACTIVITIES
from app.data.mock_tracker_profile import DEFAULT_CAREER_GOAL

import_all_models()

TRACKER_DASHBOARD = "tracker_dashboard"


SAMPLE_USN = "JAIN-SAMPLE-2026-001"
SAMPLE_EMAIL = "sample.student@jain.test"
SAMPLE_PASSWORD = "SampleTest123!"


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        st = db.query(Student).filter(Student.student_usn == SAMPLE_USN).first()
        if not st:
            st = Student(
                student_usn=SAMPLE_USN,
                student_email=SAMPLE_EMAIL,
                student_password=hash_password(SAMPLE_PASSWORD),
                student_name="Alex Sample",
                student_program="Computer Science",
                semester=3,
                uid=mint_student_uid(),
                verified_at=datetime.utcnow(),
            )
            db.add(st)
            db.commit()
        else:
            ensure_student_uid(db, SAMPLE_USN)
            st.student_password = hash_password(SAMPLE_PASSWORD)
            if not st.student_email:
                st.student_email = SAMPLE_EMAIL
            if not st.student_name:
                st.student_name = "Alex Sample"
            elif st.student_name == "Sample Student":
                st.student_name = "Alex Sample"
            db.commit()
            db.refresh(st)

        uid = st.uid
        db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).delete()
        for act in MOCK_TRACKER_ACTIVITIES:
            db.add(
                StudentActivityV2(
                    uid=uid,
                    title=act["title"],
                    description=act["description"],
                    origin="ai",
                    term=act["term"],
                    progress_pct=act["progress_pct"],
                    status=act["status"],
                    due_date=act["due_date"],
                )
            )
        if not db.query(SwotEntry).filter(SwotEntry.uid == uid).first():
            db.add(
                SwotEntry(
                    uid=uid,
                    strengths=[
                        "Strong programming skills in Python and JavaScript",
                        "Good understanding of data structures and algorithms",
                        "Experience with web development frameworks",
                        "Strong problem-solving abilities",
                    ],
                    weaknesses=[
                        "Database design needs further development",
                        "Technical documentation can be improved",
                        "Limited cloud computing exposure",
                        "Time management can be more structured",
                    ],
                    opportunities=[
                        "Cloud computing certifications",
                        "Advanced database projects",
                        "Collaborative software projects",
                        "Research and technical writing",
                    ],
                    threats=[
                        "Rapidly changing technology landscape",
                        "Increasing technical skill requirements",
                        "Competitive internship environment",
                        "Need for continuous learning",
                    ],
                    source="seed",
                    generated_at=datetime(2023, 10, 15),
                )
            )
        upsert_living_report(db, uid=uid, report_type="academic_report", delta={
            "gpa": 3.8,
            "required_credits_earned": 65,
            "required_credits_total": 100,
            "elective_credits_earned": 21,
            "elective_credits_total": 30,
            "competency_score": 4.8,
        }, narrative_hint="Sample academic report")
        upsert_living_report(
            db,
            uid=uid,
            report_type="career_report",
            delta={"focus": "Software engineering", "goals": DEFAULT_CAREER_GOAL},
            narrative_hint=DEFAULT_CAREER_GOAL,
        )
        upsert_living_report(db, uid=uid, report_type="swot_report", delta={"strengths": ["Python"]}, narrative_hint="SWOT seed")
        upsert_living_report(db, uid=uid, report_type="campus_report", delta={"events": 2}, narrative_hint="Campus seed")

        dash_delta = {
            "performance_score": 85.7,
            "global_rank": 287,
            "display_metrics": {
                "activities_completed": 24,
                "meetings_completed": 18,
                "avg_learning_hours": 32,
                "activities_progress_pct": 72,
                "meetings_progress_pct": 85,
                "performance_progress_pct": 85.7,
                "avg_hours_progress_pct": 68,
                "activities_trend_pct": 12,
                "meetings_trend_pct": 8,
                "performance_trend_pct": 6,
                "avg_hours_trend_pct": -4,
                "kpi_learning_hours": 128,
                "kpi_learning_hours_trend_pct": 12,
                "skills_acquired": 14,
                "skills_acquired_trend_pct": 5,
                "goal_completion_pct": 72,
                "goal_completion_trend_pct": 8,
                "global_rank_trend_pct": 24,
            },
            "skills_overview": [
                {"name": "Programming", "pct": 85},
                {"name": "Data Analysis", "pct": 70},
                {"name": "Database Design", "pct": 55},
                {"name": "Web Development", "pct": 80},
                {"name": "Algorithms", "pct": 65},
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
                "scores": [64, 68, 66, 72, 76, 78, 82, 88],
            },
            "skill_growth_items": [
                {"skill": "Problem Solving", "previous": 50, "current": 75, "growth_pct": 50},
                {"skill": "Communication", "previous": 65, "current": 80, "growth_pct": 23},
                {"skill": "Technical", "previous": 60, "current": 85, "growth_pct": 42},
                {"skill": "Leadership", "previous": 45, "current": 65, "growth_pct": 44},
            ],
            "growth_analysis": [
                {"label": "Technical Growth", "pct": 42},
                {"label": "Soft Skills", "pct": 23},
            ],
            "activities_metric": "8/15",
            "meetings_metric": "6/10",
            "activities_trend": "↑ +3 this month",
            "meetings_trend": "↑ +2 this month",
            "achievements_semester": [
                {"title": "Research Paper Submission", "status": "Completed"},
                {"title": "Python Certification", "status": "Completed"},
                {"title": "Web Development Project", "status": "In Progress"},
            ],
            "recent_activity": [
                {"title": "Progress Meeting Attended", "when": "Today, 10:30 AM"},
                {"title": "Project Milestone Completed", "when": "Yesterday, 2:15 PM"},
            ],
            "performance_indicators": [
                {"label": "Top 10% in Department", "tone": "green"},
                {"label": "85% Activity Completion", "tone": "blue"},
                {"label": "92% Meeting Attendance", "tone": "purple"},
                {"label": "3 Certifications", "tone": "orange"},
            ],
            "mentor_recommendations": [
                "Focus on database design and cloud computing skills",
                "Participate in more collaborative coding projects",
                "Improve technical documentation skills",
                "Develop a structured approach to time management",
            ],
            "key_metrics": [
                {"label": "Activity Completion Rate", "pct": 75},
                {"label": "Meeting Attendance", "pct": 90},
                {"label": "Activity Quality Score", "pct": 82},
                {"label": "Feedback Implementation", "pct": 68},
            ],
            "skills_recommendations": [
                "Focus on improving database design skills by taking additional online courses.",
                "Participate in more collaborative projects to enhance teamwork abilities.",
                "Practice writing technical documentation to improve communication skills.",
            ],
            "comparison_chart": [
                {"skill": "Technical", "previous": 70, "current": 85},
                {"skill": "Communication", "previous": 65, "current": 75},
                {"skill": "Problem Solving", "previous": 78, "current": 90},
                {"skill": "Leadership", "previous": 55, "current": 65},
                {"skill": "Domain Knowledge", "previous": 60, "current": 80},
            ],
            "comparison_improvements": [
                {"label": "Domain Knowledge", "change_pct": 33.3, "score": 80, "previous_score": 60},
                {"label": "Technical", "change_pct": 21.4, "score": 85, "previous_score": 70},
            ],
            "comparison_focus": [
                {"label": "Leadership", "change_pct": 18.2, "score": 65, "previous_score": 55},
                {"label": "Communication", "change_pct": 15.4, "score": 75, "previous_score": 65},
            ],
            "comparison_activity": {
                "months": ["Aug", "Sep", "Oct", "Nov"],
                "total": [3, 5, 4, 3],
                "completed": [2, 3, 2, 1],
            },
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
        upsert_living_report(db, uid=uid, report_type=TRACKER_DASHBOARD, delta=dash_delta, narrative_hint="Dashboard seed")

        from app.db.models.student_platform import KnowledgeBaseEntry, StudentLink

        if not db.query(KnowledgeBaseEntry).first():
            db.add(KnowledgeBaseEntry(scope="global", content="Practice communication skills weekly."))
            db.add(KnowledgeBaseEntry(scope="programme", programme_id="CS", content="Complete internship before final year."))
        if not db.query(StudentLink).filter(StudentLink.uid == uid).first():
            db.add(StudentLink(uid=uid, link_type="linkedin", url="https://linkedin.com/in/alex-johnson", verified_bool=True))
            db.add(StudentLink(uid=uid, link_type="portfolio", url="https://portfolio.example.com", verified_bool=True))
            db.add(StudentLink(uid=uid, link_type="github", url="https://github.com/alexjohnson", verified_bool=True))
        st.student_name = st.student_name or "Alex Johnson"
        if st.student_name == "Alex Sample":
            st.student_name = "Alex Johnson"
        st.student_program = st.student_program or "Computer Science"
        st.student_batch = st.student_batch or "2022-2026"
        st.student_phoneno = st.student_phoneno or "5551234567"
        st.mother_contact = st.mother_contact or "5559876543"
        st.semester = st.semester or 3
        if not st.verified_at:
            st.verified_at = datetime.utcnow()
        db.commit()
        print(f"Sample student ready: USN={SAMPLE_USN} uid={uid} password={SAMPLE_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
