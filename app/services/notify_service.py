"""In-app notifications after pipeline stages."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models.notifications import Notification
from app.db.models.students import Student


def notify_uid(db: Session, uid: str, title: str, message: str, category: str = "pipeline", link: str | None = None) -> None:
    st = db.query(Student).filter(Student.uid == uid).first()
    if not st:
        return
    db.add(
        Notification(
            student_usn=st.student_usn,
            title=title,
            message=message,
            category=category,
            link=link,
        )
    )
    db.commit()
