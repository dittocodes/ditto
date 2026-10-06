"""Poll and run processing jobs."""
from __future__ import annotations

import logging
import os

from app.db.database import SessionLocal
from app.services.job_queue import claim_next_job
from app.services.pipeline_processor import process_job

logger = logging.getLogger(__name__)


def run_worker_once() -> bool:
    db = SessionLocal()
    try:
        job = claim_next_job(db)
        if not job:
            return False
        process_job(db, job)
        return True
    finally:
        db.close()


def run_worker_loop(max_iterations: int = 50) -> None:
    from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait

    db = SessionLocal()
    try:
        from app.services.document_report_refresh import backfill_document_reports

        backfill_document_reports(db)
    except Exception:
        logger.exception("Stored document refresh failed")
    finally:
        db.close()

    workers = max(1, min(int(os.getenv("WORKER_CONCURRENCY", "3")), 4))
    if workers == 1:
        for _ in range(max_iterations):
            if not run_worker_once():
                break
    else:
        completed = 0
        with ThreadPoolExecutor(max_workers=workers) as pool:
            pending = {pool.submit(run_worker_once) for _ in range(min(workers, max_iterations))}
            while pending and completed < max_iterations:
                done, pending = wait(pending, return_when=FIRST_COMPLETED)
                for fut in done:
                    try:
                        worked = bool(fut.result())
                    except Exception:
                        logger.exception("Document job failed before it could finish")
                        worked = False
                    if not worked:
                        continue
                    completed += 1
                    if completed < max_iterations:
                        pending.add(pool.submit(run_worker_once))

    db = SessionLocal()
    try:
        from app.services.document_report_refresh import refresh_idle_students

        refresh_idle_students(db)
    except Exception:
        logger.exception("Stored document refresh failed")
    finally:
        db.close()
