"""Mentor profile, documents, and mentee messages. New tables only."""
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON
from sqlalchemy.sql import func

from app.db.database import Base


class MentorProfile(Base):
    __tablename__ = "mentor_profiles"

    mentor_id = Column(String(255), primary_key=True)
    title = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    institution = Column(String(255), nullable=True)
    expertise = Column(JSON, nullable=True)
    education = Column(JSON, nullable=True)
    awards = Column(JSON, nullable=True)
    experience = Column(JSON, nullable=True)
    publications = Column(JSON, nullable=True)


class MentorKnowledgeItem(Base):
    __tablename__ = "mentor_knowledge_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mentor_id = Column(String(255), index=True, nullable=False)
    filename = Column(String(255), nullable=True)
    stored_name = Column(String(255), nullable=True)
    doc_group = Column(String(32), nullable=False, default="uncategorised")
    category = Column(String(64), nullable=True)
    category_source = Column(String(16), nullable=False, default="model")
    summary = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="reading")
    extracted = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class MentorChatSession(Base):
    __tablename__ = "mentor_chat_sessions"

    id = Column(String(36), primary_key=True)
    mentor_id = Column(String(255), index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class MentorChatMessage(Base):
    __tablename__ = "mentor_chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), index=True, nullable=False)
    mentor_id = Column(String(255), index=True, nullable=False)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class MentorMessage(Base):
    __tablename__ = "mentor_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mentor_id = Column(String(255), index=True, nullable=False)
    student_usn = Column(String(255), index=True, nullable=False)
    sender = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
