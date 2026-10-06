"""Mint and resolve STU-prefixed ULIDs for pipeline identity."""
from __future__ import annotations

import uuid
from sqlalchemy.orm import Session

from app.db.models.students import Student


def mint_student_uid() -> str:
    """STU- + 26-char ULID-like id (time-sortable via uuid7 when available)."""
    try:
        from ulid import ULID

        return f"STU-{ULID()}"
    except ImportError:
        return f"STU-{uuid.uuid4().hex[:26].upper()}"


def ensure_student_uid(db: Session, student_usn: str) -> str:
    student = db.query(Student).filter(Student.student_usn == student_usn).first()
    if not student:
        raise ValueError(f"Student not found: {student_usn}")
    if getattr(student, "uid", None):
        return student.uid
    uid = mint_student_uid()
    student.uid = uid
    db.commit()
    db.refresh(student)
    return uid


def resolve_uid(db: Session, student_usn: str) -> str | None:
    student = db.query(Student).filter(Student.student_usn == student_usn).first()
    if not student:
        return None
    return getattr(student, "uid", None)
