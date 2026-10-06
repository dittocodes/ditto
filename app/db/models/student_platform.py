"""Student-side redesign platform tables (Phases 0–12)."""
from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    DateTime,
    Boolean,
    Float,
    ForeignKey,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from app.db.database import Base


class StudentLink(Base):
    __tablename__ = "student_links"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    link_type = Column(String(32), nullable=False)
    url = Column(String(500), nullable=False)
    verified_bool = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)


class RawVaultItem(Base):
    __tablename__ = "raw_vault_items"
    id = Column(String(36), primary_key=True)
    uid = Column(String(64), index=True, nullable=False)
    doc_type = Column(String(64), nullable=False)
    storage_ref = Column(String(500), nullable=False)
    content_hash = Column(String(64), index=True, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id = Column(String(36), primary_key=True)
    uid = Column(String(64), index=True, nullable=False)
    raw_vault_item_id = Column(String(36), ForeignKey("raw_vault_items.id"), nullable=True)
    status = Column(String(32), default="queued", index=True)
    stage = Column(String(32), default="queued")
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    report_target = Column(String(64), nullable=True)
    idempotency_key = Column(String(128), unique=True, nullable=True)
    confidence = Column(Float, nullable=True)
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class PiiVaultEntry(Base):
    __tablename__ = "pii_vault"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    field_type = Column(String(64), nullable=False)
    encrypted_value = Column(Text, nullable=False)
    token_key = Column(String(64), nullable=False)


class LivingReport(Base):
    __tablename__ = "living_reports"
    __table_args__ = (UniqueConstraint("uid", "report_type", name="uq_living_report_uid_type"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    report_type = Column(String(64), nullable=False)
    structured_state = Column(JSON, nullable=True)
    narrative = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ReportSnapshot(Base):
    __tablename__ = "report_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    living_report_id = Column(Integer, ForeignKey("living_reports.id"))
    version = Column(Integer, nullable=False)
    storage_ref = Column(String(500), nullable=True)
    snapshot_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class AcademicRecord(Base):
    __tablename__ = "academic_records_v2"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    category = Column(String(64), nullable=False)
    title = Column(String(255), nullable=True)
    issuer = Column(String(255), nullable=True)
    record_date = Column(String(32), nullable=True)
    verified_bool = Column(Boolean, default=False)
    source_job_id = Column(String(36), nullable=True)
    extra = Column(JSON, nullable=True)


class CareerRecord(Base):
    __tablename__ = "career_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    category = Column(String(64), nullable=False)
    title = Column(String(255), nullable=True)
    org = Column(String(255), nullable=True)
    record_date = Column(String(32), nullable=True)
    status = Column(String(64), nullable=True)
    source_job_id = Column(String(36), nullable=True)
    extra = Column(JSON, nullable=True)


class SwotEntry(Base):
    __tablename__ = "swot_entries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    strengths = Column(JSON, nullable=True)
    weaknesses = Column(JSON, nullable=True)
    opportunities = Column(JSON, nullable=True)
    threats = Column(JSON, nullable=True)
    generated_at = Column(DateTime, server_default=func.now())
    source = Column(String(32), default="form")


class StudentKnowledgeItem(Base):
    """A student's stored document, with a category that can be corrected later."""

    __tablename__ = "student_knowledge_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    vault_id = Column(String(36), nullable=True)
    job_id = Column(String(36), nullable=True, index=True)
    filename = Column(String(255), nullable=True)
    title = Column(String(255), nullable=True)
    doc_group = Column(String(32), nullable=False, default="uncategorised")
    category = Column(String(64), nullable=True)
    category_source = Column(String(16), nullable=False, default="model")
    summary = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="reading")
    created_at = Column(DateTime, server_default=func.now())


class KnowledgeBaseEntry(Base):
    __tablename__ = "knowledge_base"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scope = Column(String(32), nullable=False)
    programme_id = Column(String(64), nullable=True)
    content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)


class StudentActivityV2(Base):
    __tablename__ = "activities_v2"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    origin = Column(String(32), default="mentor")
    linked_swot_item = Column(String(64), nullable=True)
    status = Column(String(32), default="pending")
    progress_pct = Column(Integer, default=0)
    due_date = Column(DateTime, nullable=True)
    priority = Column(String(32), nullable=True)
    term = Column(String(32), nullable=True)
    mentor_remarks = Column(Text, nullable=True)


class CampusActivity(Base):
    __tablename__ = "campus_activities"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    event_name = Column(String(255), nullable=True)
    role = Column(String(128), nullable=True)
    record_date = Column(String(32), nullable=True)
    evidence_ref = Column(String(500), nullable=True)
    verified_bool = Column(Boolean, default=False)


class DocumentGenerated(Base):
    __tablename__ = "documents_generated"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    doc_type = Column(String(64), nullable=False)
    storage_ref = Column(String(500), nullable=True)
    preview_json = Column(JSON, nullable=True)
    generated_at = Column(DateTime, server_default=func.now())
    source_report_versions = Column(JSON, nullable=True)


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String(36), primary_key=True)
    uid = Column(String(64), index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("chat_sessions.id"))
    uid = Column(String(64), index=True, nullable=False)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    cited_reports = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class ReidentifyAuditLog(Base):
    __tablename__ = "reidentify_audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), nullable=True)
    uid = Column(String(64), index=True, nullable=False)
    stage = Column(String(64), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ReviewQueueItem(Base):
    __tablename__ = "review_queue"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), index=True, nullable=False)
    job_id = Column(String(36), nullable=True)
    field_path = Column(String(255), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    status = Column(String(32), default="pending")
    created_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)
