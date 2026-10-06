"""API v1 auth: JWT USN must match path uid owner."""
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_student
from app.db.database import get_db
from app.db.models.students import Student


async def get_student_by_uid(
    uid: str,
    current: dict = Depends(get_current_student),
    db: Session = Depends(get_db),
) -> Student:
    student = db.query(Student).filter(Student.uid == uid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student UID not found")
    if student.student_usn != current["student_usn"]:
        raise HTTPException(status_code=403, detail="Not authorized for this student")
    return student


async def get_uid_for_current_student(
    current: dict = Depends(get_current_student),
    db: Session = Depends(get_db),
) -> str:
    from app.services.uid_registry import ensure_student_uid

    return ensure_student_uid(db, current["student_usn"])
