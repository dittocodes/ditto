from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_student
from app.services.job_queue import get_job

router = APIRouter()


@router.get("/jobs/{job_id}")
def job_status(job_id: str, db: Session = Depends(get_db), _user=Depends(get_current_student)):
    from app.services.vendor_scrub import scrub_vendor_names

    job = get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    stage = job.stage
    if stage == "gemini_analyse":
        stage = "document_analyse"
    result = job.result_json
    if isinstance(result, dict) and "gemini_summary" in result:
        result = dict(result)
        result["analysis_summary"] = result.pop("gemini_summary")
    return {
        "id": job.id,
        "status": job.status,
        "stage": stage,
        "confidence": job.confidence,
        "last_error": scrub_vendor_names(job.last_error) if job.last_error else None,
        "result": result,
    }
