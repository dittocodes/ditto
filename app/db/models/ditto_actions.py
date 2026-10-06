"""Proposed Ditto actions. A write runs only after the signed-in user confirms."""
from sqlalchemy import Column, DateTime, JSON, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class ChatActionProposal(Base):
    __tablename__ = "chat_action_proposals"

    id = Column(String(36), primary_key=True)
    actor_role = Column(String(16), nullable=False, index=True)
    actor_id = Column(String(255), nullable=False, index=True)
    tool_name = Column(String(64), nullable=False)
    args_json = Column(JSON, nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    result_text = Column(Text, nullable=True)
    summary = Column(String(500), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
