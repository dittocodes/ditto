"""Mentor v1 — patch student activities (Phase 7)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_mentor
from app.db.database import get_db
from app.db.models.students import Student
from app.db.models.student_platform import StudentActivityV2

router = APIRouter()


class MentorActivityPatch(BaseModel):
    progress_pct: Optional[int] = None
    status: Optional[str] = None
    mentor_remarks: Optional[str] = None


@router.get("/mentor/students/{uid}/activities")
def mentor_list_activities(
    uid: str,
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.uid == uid).first()
    if not student or student.assigned_mentor != current.get("mentor_id"):
        raise HTTPException(status_code=403, detail="Not assigned to this student")
    rows = db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "status": r.status,
            "progress_pct": r.progress_pct,
            "due_date": r.due_date.isoformat() if r.due_date else None,
            "mentor_remarks": r.mentor_remarks,
        }
        for r in rows
    ]


@router.patch("/mentor/students/{uid}/activities/{activity_id}")
def mentor_patch_activity(
    uid: str,
    activity_id: int,
    body: MentorActivityPatch,
    current: dict = Depends(get_current_mentor),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.uid == uid).first()
    if not student or student.assigned_mentor != current.get("mentor_id"):
        raise HTTPException(status_code=403, detail="Not assigned to this student")
    row = (
        db.query(StudentActivityV2)
        .filter(StudentActivityV2.id == activity_id, StudentActivityV2.uid == uid)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    if body.progress_pct is not None:
        row.progress_pct = body.progress_pct
    if body.status:
        row.status = body.status
    if body.mentor_remarks is not None:
        row.mentor_remarks = body.mentor_remarks
    db.commit()
    return {"ok": True}
