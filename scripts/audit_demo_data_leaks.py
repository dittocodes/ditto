"""Assert demo persona payloads align with living reports (local smoke)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.database import SessionLocal
from app.db.models.registry import import_all_models
from app.db.models.students import Student
from app.data.demo_personas import DEMO_USNS, PERSONAS
from app.services.gemini_insight_service import build_overview, build_profile
from app.services.living_report_service import get_report

import_all_models()


def main() -> int:
    db = SessionLocal()
    errors: list[str] = []
    try:
        for usn in DEMO_USNS:
            st = db.query(Student).filter(Student.student_usn == usn).first()
            if not st or not st.uid:
                errors.append(f"Missing student row for {usn}")
                continue
            uid = st.uid
            meta = PERSONAS[usn]
            dash = get_report(db, uid, "tracker_dashboard")
            acad = get_report(db, uid, "academic_report")
            if meta.get("day0"):
                if dash:
                    errors.append(f"{usn}: day0 should have no tracker_dashboard living report")
                if st.verified_at:
                    errors.append(f"{usn}: day0 should not be verified")
            else:
                if not dash:
                    errors.append(f"{usn}: expected tracker_dashboard living report")
                if not acad:
                    errors.append(f"{usn}: expected academic_report living report")
                expected_gpa = float(meta.get("gpa", 0))
                actual_gpa = float((acad.structured_state or {}).get("gpa", 0)) if acad else 0
                if abs(actual_gpa - expected_gpa) > 0.01:
                    errors.append(f"{usn}: GPA {actual_gpa} != seed {expected_gpa}")
            overview = build_overview(db, uid, use_gemini=False)
            perf = overview.get("performance_score") or (overview.get("display_metrics") or {}).get(
                "performance_progress_pct"
            )
            if not meta.get("day0") and meta.get("performance_score"):
                if perf and abs(float(perf) - float(meta["performance_score"])) > 2:
                    errors.append(f"{usn}: overview performance {perf} vs seed {meta['performance_score']}")
            if meta.get("day0"):
                prof = build_profile(db, uid, "overview")
                if prof.get("honors"):
                    errors.append(f"{usn}: day0 profile should not show seeded honors")
            print(f"OK checked {usn} uid={uid}")
    finally:
        db.close()
    if errors:
        print("AUDIT FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("Demo data audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
