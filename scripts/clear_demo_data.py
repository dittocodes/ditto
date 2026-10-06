"""Clear demo persona platform data and re-seed."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import Session

from app.db.database import SessionLocal, engine, Base
from app.db.models.registry import import_all_models
from app.db.models.students import Student
from app.db.models.student_platform import (
    AcademicRecord,
    CareerRecord,
    ChatMessage,
    ChatSession,
    DocumentGenerated,
    LivingReport,
    PiiVaultEntry,
    ProcessingJob,
    RawVaultItem,
    ReidentifyAuditLog,
    ReportSnapshot,
    ReviewQueueItem,
    StudentActivityV2,
    StudentLink,
    SwotEntry,
)
from app.data.demo_personas import DEMO_USNS
from app.services.insight_cache import invalidate_uid

import_all_models()


def _demo_uids(db: Session) -> list[str]:
    uids = []
    for usn in DEMO_USNS:
        st = db.query(Student).filter(Student.student_usn == usn).first()
        if st and st.uid:
            uids.append(st.uid)
    return uids


def clear_demo_data(db: Session) -> None:
    uids = _demo_uids(db)
    if not uids:
        return
    for uid in uids:
        db.query(ReviewQueueItem).filter(ReviewQueueItem.uid == uid).delete()
        db.query(ReidentifyAuditLog).filter(ReidentifyAuditLog.uid == uid).delete()
        db.query(PiiVaultEntry).filter(PiiVaultEntry.uid == uid).delete()
        db.query(ProcessingJob).filter(ProcessingJob.uid == uid).delete()
        db.query(RawVaultItem).filter(RawVaultItem.uid == uid).delete()
        db.query(DocumentGenerated).filter(DocumentGenerated.uid == uid).delete()
        db.query(StudentActivityV2).filter(StudentActivityV2.uid == uid).delete()
        db.query(StudentLink).filter(StudentLink.uid == uid).delete()
        db.query(SwotEntry).filter(SwotEntry.uid == uid).delete()
        db.query(AcademicRecord).filter(AcademicRecord.uid == uid).delete()
        db.query(CareerRecord).filter(CareerRecord.uid == uid).delete()
        db.query(ChatMessage).filter(ChatMessage.uid == uid).delete()
        db.query(ChatSession).filter(ChatSession.uid == uid).delete()
        reports = db.query(LivingReport).filter(LivingReport.uid == uid).all()
        for r in reports:
            db.query(ReportSnapshot).filter(ReportSnapshot.living_report_id == r.id).delete()
        db.query(LivingReport).filter(LivingReport.uid == uid).delete()
        invalidate_uid(uid)
    db.commit()


def clear_demo_uploads() -> None:
    uploads = ROOT / "uploads"
    if not uploads.is_dir():
        return
    for sub in ("cv", "raw"):
        p = uploads / sub
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
            p.mkdir(parents=True, exist_ok=True)


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        clear_demo_data(db)
        clear_demo_uploads()
        print("Demo platform data cleared.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
