"""OCR adapter — local text first, visual reading only when the file has no text."""
from __future__ import annotations

import io
import json
import re
import urllib.request

from app.services.gemini_gateway import generate_from_document

_MAX_BYTES = 8_000_000


def _mime_for(url: str, header: str) -> str:
    mime = (header or "").split(";")[0].strip().lower()
    if mime in ("image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"):
        return mime
    lower = (url or "").lower().split("?")[0]
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".gif"):
        return "image/gif"
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    return mime or "image/jpeg"


def _download(storage_ref: str) -> tuple[bytes, str]:
    if not storage_ref or not storage_ref.startswith("http"):
        return b"", ""
    req = urllib.request.Request(storage_ref, headers={"User-Agent": "MenteeTracker/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read(_MAX_BYTES + 1)
        if not data or len(data) > _MAX_BYTES:
            return b"", ""
        return data, _mime_for(storage_ref, resp.headers.get("Content-Type") or "")


def _parse_json_object(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start < 0 or end <= start:
            return {}
        data = json.loads(raw[start : end + 1])
    return data if isinstance(data, dict) else {}


def extract_id_card_fields(storage_ref: str) -> dict:
    """Read identity fields from the ID image itself."""
    data, mime = _download(storage_ref)
    if not data or not mime:
        return {}
    prompt = (
        "Read this college student ID card. Return JSON with keys "
        "structured_fields (object), confidence (0-1), category (string). "
        "structured_fields keys: student_name, student_usn, programme, semester, phone. "
        "Copy only text printed on the card. Use an empty string when a field is not visible."
    )
    raw = generate_from_document(prompt, data, mime, json_mode=True, tier="high")
    parsed = _parse_json_object(raw)
    fields = parsed.get("structured_fields") if isinstance(parsed.get("structured_fields"), dict) else parsed
    return fields if isinstance(fields, dict) else {}


def phone_from_text(text: str) -> str:
    match = re.search(r"(?:contact|phone|mobile)\s*(?:no\.?|number)?\s*[:\-]?\s*(\+?\d[\d\s\-]{8,16})", text or "", re.I)
    if not match:
        return ""
    digits = "".join(ch for ch in match.group(1) if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else ""


DOCUMENT_FIELD_GUIDE = (
    "structured_fields may include only wording printed on the document: "
    "title, issuer, program_name, course, skills_covered (a list of skill names), "
    "completion_date, date, score (a percent only when one is printed), "
    "org, role, bullets (a list), summary. "
    "Leave a key out when it is not printed. Do not invent a skill, date, percent, or person. "
    "Use group certificate for a course, award, diploma, or degree certificate. "
    "Use group academic for a marksheet or transcript, and do not add skills_covered for those. "
    "Use group career for a resume, internship, or offer. "
    "Use group activity for a club, event, or external activity."
)


def _pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        parts: list[str] = []
        for page in reader.pages[:6]:
            parts.append(page.extract_text() or "")
        return "\n".join(parts).strip()
    except Exception:
        return ""


def local_document_text(storage_ref: str) -> str:
    """Read text that is already in the file. Photos are left for the earlier read."""
    data, mime = _download(storage_ref)
    if mime == "application/pdf" and data:
        return _pdf_text(data)[:1500]
    return ""


def read_uploaded_document(storage_ref: str, doc_type: str) -> tuple[str, dict | None]:
    """Return document text, and a classification when the file was read visually.

    PDFs that already contain text skip the visual reader. Photos and scans are
    classified in that same visual read so they do not need a second request.
    """
    data, mime = _download(storage_ref)
    if not data:
        return "", None
    if mime == "application/pdf":
        text = _pdf_text(data)
        if len(text) >= 40:
            return text[:20000], None
    if not mime:
        return "", None
    kind = doc_type or "document"
    tier = "high" if kind == "id_card" else "lite"
    if kind == "inbox":
        prompt = (
            "Read this student document. Return JSON with keys: "
            "text (the visible text), "
            "group (one of academic, career, certificate, activity), "
            "category (a short label such as marklist, course_certificate, resume, volunteer), "
            f"{DOCUMENT_FIELD_GUIDE} "
            "confidence (0-1)."
        )
        try:
            parsed = _parse_json_object(generate_from_document(prompt, data, mime, json_mode=True, tier=tier))
        except Exception:
            return "", None
        return str(parsed.get("text") or "")[:20000], parsed
    prompt = (
        f"Extract all visible text from this {kind}. Return plain text only. "
        "Keep names, ID or roll numbers, programme, semester, and phone numbers exactly as printed."
    )
    try:
        return generate_from_document(prompt, data, mime, tier=tier), None
    except Exception:
        return "", None


def extract_text_from_document_url(storage_ref: str, doc_type: str) -> str:
    text, _analysis = read_uploaded_document(storage_ref, doc_type)
    return text or f"Document uploaded: {doc_type or 'document'}"
