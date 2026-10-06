"""Optional dual-write from pipeline academic records to legacy academic_performance."""
from __future__ import annotations

import os
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.academic_performance import AcademicPerformance
from app.db.models.students import Student


def shadow_write_academic(db: Session, *, uid: str, fields: dict[str, Any]) -> None:
    if os.getenv("SHADOW_WRITE_LEGACY", "").lower() not in ("1", "true", "yes"):
        return
    student = db.query(Student).filter(Student.uid == uid).first()
    if not student:
        return
    course = str(fields.get("title") or fields.get("course") or "Uploaded record")[:255]
    semester = int(fields.get("semester") or student.semester or 1)
    grade = str(fields.get("grade") or fields.get("gpa") or "")[:50] or None
    db.add(
        AcademicPerformance(
            student_usn=student.student_usn,
            semester=semester,
            course=course,
            grade=grade,
        )
    )
