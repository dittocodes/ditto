"""Read a mentor document and merge only printed profile facts."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.mentor_platform import MentorProfile
from app.services.gemini_gateway import generate_from_document, generate_text
from app.services.ocr_service import _parse_json_object, _pdf_text

_PROMPT = (
    "Read this mentor document. Return JSON with only facts printed on it. "
    "Keys: title, bio, expertise (list of skill names), "
    "education (list of objects with degree, institution, year), "
    "awards (list of objects with name, year), "
    "experience (list of objects with role, org, summary), "
    "publications (list of printed titles), "
    "group (one of certificate, academic, career, activity), "
    "category (a short label), summary (one sentence). "
    "Leave a key out when it is not printed. Do not invent a skill, date, award, or person. "
    "Do not use a person's name as a skill."
)


def _clean_list(value: Any) -> list:
    if not isinstance(value, list):
        return []
    kept = []
    for item in value:
        if isinstance(item, str) and item.strip():
            kept.append(item.strip())
        elif isinstance(item, dict):
            cleaned = {k: v for k, v in item.items() if v not in (None, "", [])}
            if cleaned:
                kept.append(cleaned)
    return kept


def read_mentor_document(data: bytes, mime: str) -> dict:
    text = _pdf_text(data) if mime == "application/pdf" else ""
    try:
        if len(text) >= 40:
            raw = generate_text(_PROMPT + "\n\nDocument text:\n" + text[:12000], json_mode=True, tier="lite")
        elif data and mime:
            raw = generate_from_document(_PROMPT, data, mime, json_mode=True, tier="lite")
        else:
            return {}
    except Exception:
        return {}
    parsed = _parse_json_object(raw if isinstance(raw, str) else json.dumps(raw))
    return parsed if isinstance(parsed, dict) else {}


def _merge_named(current: list, incoming: list, key: str) -> list:
    seen = set()
    out = []
    for item in list(current or []) + list(incoming or []):
        if isinstance(item, str):
            token = item.strip().lower()
            label = item.strip()
        elif isinstance(item, dict):
            token = str(item.get(key) or item.get("degree") or item.get("role") or "").strip().lower()
            label = item
        else:
            continue
        if not token or token in seen:
            continue
        seen.add(token)
        out.append(label)
    return out


def apply_mentor_extract(db: Session, mentor_id: str, extracted: dict) -> MentorProfile:
    row = db.query(MentorProfile).filter(MentorProfile.mentor_id == mentor_id).first()
    if row is None:
        row = MentorProfile(mentor_id=mentor_id, expertise=[], education=[], awards=[], experience=[], publications=[])
        db.add(row)
    title = str(extracted.get("title") or "").strip()
    bio = str(extracted.get("bio") or "").strip()
    if title and not row.title:
        row.title = title[:255]
    if bio and not row.bio:
        row.bio = bio
    row.expertise = _merge_named(row.expertise or [], _clean_list(extracted.get("expertise")), "name")
    row.education = _merge_named(row.education or [], _clean_list(extracted.get("education")), "degree")
    row.awards = _merge_named(row.awards or [], _clean_list(extracted.get("awards")), "name")
    row.experience = _merge_named(row.experience or [], _clean_list(extracted.get("experience")), "role")
    row.publications = _merge_named(row.publications or [], _clean_list(extracted.get("publications")), "name")
    return row
