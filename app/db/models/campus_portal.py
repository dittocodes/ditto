"""Campus hub events, announcements, and blogs. New tables only."""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, JSON
from sqlalchemy.sql import func

from app.db.database import Base


class CampusEvent(Base):
    __tablename__ = "campus_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    creator_id = Column(String(255), index=True, nullable=False)
    creator_role = Column(String(16), nullable=False, default="mentor")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(16), nullable=False, default="offline")
    location_details = Column(String(255), nullable=True)
    visibility = Column(String(32), nullable=False, default="caseload_only")
    scheduled_at = Column(DateTime, nullable=False)
    linked_skills = Column(JSON, nullable=True)
    status = Column(String(16), nullable=False, default="scheduled")
    created_at = Column(DateTime, server_default=func.now())


class EventRSVP(Base):
    __tablename__ = "campus_event_rsvps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, index=True, nullable=False)
    student_uid = Column(String(64), index=True, nullable=False)
    status = Column(String(16), nullable=False, default="attending")
    joined_at = Column(DateTime, nullable=True)


class EventAttendance(Base):
    __tablename__ = "campus_event_attendance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, index=True, nullable=False)
    student_uid = Column(String(64), index=True, nullable=False)
    status = Column(String(16), nullable=False, default="present")
    verified_by = Column(String(255), nullable=True)
    verified_at = Column(DateTime, nullable=True)


class CampusAnnouncement(Base):
    __tablename__ = "campus_announcements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    author_id = Column(String(255), nullable=False)
    author_role = Column(String(16), nullable=False, default="mentor")
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class StudentBlog(Base):
    __tablename__ = "campus_student_blogs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_uid = Column(String(64), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    published_at = Column(DateTime, server_default=func.now())
