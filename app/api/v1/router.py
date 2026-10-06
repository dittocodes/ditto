from fastapi import APIRouter

from app.api.v1 import students, jobs, chat, mentor, mentor_workspace, admin_kb, admin_compliance, campus_portal

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(students.router, tags=["Student v1"])
api_router.include_router(jobs.router, tags=["Jobs v1"])
api_router.include_router(chat.router, tags=["Chat v1"])
api_router.include_router(mentor.router, tags=["Mentor v1"])
api_router.include_router(mentor_workspace.router, tags=["Mentor workspace"])
api_router.include_router(admin_kb.router, tags=["Admin KB v1"])
api_router.include_router(admin_compliance.router, tags=["Admin compliance v1"])
api_router.include_router(campus_portal.router, tags=["Campus hub"])
