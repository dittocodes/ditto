"""Immutable raw document storage metadata + Cloudinary upload."""
from __future__ import annotations

import hashlib
import uuid

from sqlalchemy.orm import Session

from app.db.models.student_platform import RawVaultItem
from app.services.cloudinary_service import upload_bytes


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def store_raw(
    db: Session,
    *,
    uid: str,
    doc_type: str,
    file_bytes: bytes,
    filename: str,
) -> RawVaultItem:
    ch = content_hash(file_bytes)
    existing = (
        db.query(RawVaultItem)
        .filter(RawVaultItem.uid == uid, RawVaultItem.content_hash == ch)
        .first()
    )
    if existing:
        return existing

    key = f"raw_vault/{uid}/{doc_type}/{filename}"
    url = upload_bytes(file_bytes, key)
    item = RawVaultItem(
        id=str(uuid.uuid4()),
        uid=uid,
        doc_type=doc_type,
        storage_ref=url,
        content_hash=ch,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
