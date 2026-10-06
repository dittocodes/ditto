"""Rebuild dashboard, profile, and analysis facts from stored documents."""
from __future__ import annotations

import logging
import re
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.student_platform import (
    AcademicRecord,
    CampusActivity,
    CareerRecord,
    LivingReport,
    ProcessingJob,
    RawVaultItem,
    StudentKnowledgeItem,
)
from app.db.models.students import Student
from app.services.demo_utils import allow_sample_content
from app.services.gemini_gateway import generate_json
from app.services.insight_cache import invalidate_uid
from app.services.living_report_service import write_report_keys

logger = logging.getLogger(__name__)

# Enough for courses, named skills, highlights, and two short paragraphs.
_OUTPUT_TOKENS = 1536
_EXTRACT_VERSION = 5
_refresh_waiting: set[str] = set()
_DOC_TARGETS = ("inbox", "academic_report", "career_report", "campus_report")
_GROUPS = ("academic", "certificate", "career", "activity")

_locks_guard = threading.Lock()
_uid_locks: dict[str, threading.Lock] = {}
_backfill_started = False


def _lock_for(uid: str) -> threading.Lock:
    with _locks_guard:
        lock = _uid_locks.get(uid)
        if lock is None:
            lock = threading.Lock()
            _uid_locks[uid] = lock
        return lock


def _group_for(item: StudentKnowledgeItem | None, category: str, default: str) -> str:
    if item is not None and item.doc_group in _GROUPS:
        return item.doc_group
    text = (category or "").lower().replace("-", " ").replace("_", " ")
    if "cert" in text or text in ("award", "workshop"):
        return "certificate"
    if any(word in text for word in ("resume", "intern", "offer", "career", "cv")):
        return "career"
    if "activ" in text or text in ("volunteer", "club", "event", "leadership"):
        return "activity"
    return default


def _excerpt(extra: Any, summary: str) -> str:
    parts: list[str] = []
    if summary and summary.strip() and not summary.lower().startswith("document uploaded"):
        parts.append(summary.strip())
    if isinstance(extra, dict):
        for key in ("summary", "text", "description", "skills", "programme", "issuer", "org"):
            value = extra.get(key)
            if isinstance(value, str) and value.strip():
                parts.append(value.strip())
            elif isinstance(value, list):
                parts.append(", ".join(str(item) for item in value[:8]))
    text = " ".join(parts)
    return " ".join(text.split())[:500]


def _bullets(extra: Any) -> list[str]:
    if not isinstance(extra, dict):
        return []
    raw = extra.get("bullets") or extra.get("highlights") or []
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    return [str(item)[:180] for item in raw[:6] if str(item).strip()]


def _note(db: Session, item: StudentKnowledgeItem | None, extra: Any) -> str:
    summary = _excerpt(extra, (item.summary if item else "") or "")
    if len(summary) >= 40 or item is None or not item.vault_id:
        return summary
    vault = db.query(RawVaultItem).filter(RawVaultItem.id == item.vault_id).first()
    if vault is None or not vault.storage_ref:
        return summary
    from app.services.ocr_service import local_document_text

    extra_text = local_document_text(vault.storage_ref)
    if not extra_text:
        return summary
    return " ".join(f"{summary} {extra_text}".split())[:500]


_MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_DATE_RE = re.compile(
    rf"("
    rf"\d{{4}}[-/]\d{{1,2}}[-/]\d{{1,2}}"
    rf"|\d{{1,2}}[-/]\d{{1,2}}[-/]\d{{2,4}}"
    rf"|{_MONTH}\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}"
    rf"|\d{{1,2}}(?:st|nd|rd|th)?\s+{_MONTH},?\s+\d{{4}}"
    rf"|{_MONTH}\s*[-–]\s*{_MONTH}\s+\d{{4}}"
    rf"|{_MONTH}\s+\d{{4}}"
    rf")",
    re.I,
)
_RANGE_RE = re.compile(rf"{_MONTH}\s*[-–]\s*({_MONTH})\s+(\d{{4}})", re.I)
_COURSE_RE = re.compile(
    r"successfully completing the course\s+(.+?)(?:\s+with a consolidated|\s+with a score|$)",
    re.I,
)
_GENERIC_TITLES = {
    "certificate of completion",
    "uploaded document",
    "document uploaded: inbox",
    "document uploaded: academic",
    "academic record",
    "career document",
}


def _printed_date(value: str | None) -> str:
    text = (value or "").strip()
    if not text or text.lower() in ("recorded", "uploaded document"):
        return ""
    match = _DATE_RE.search(text)
    if not match:
        return ""
    found = re.sub(r"(\d+)(?:st|nd|rd|th)\b", r"\1", match.group(1), flags=re.I)
    ranged = _RANGE_RE.search(found)
    if ranged:
        found = f"{ranged.group(1)} {ranged.group(2)}"
    return found.replace("Sept", "Sep").replace("sept", "sep")[:32]


def _printed_percent(value: str | None) -> int | None:
    match = re.search(r"(\d{1,3})\s*%", value or "")
    if not match:
        return None
    number = int(match.group(1))
    if 0 <= number <= 100:
        return number
    return None


def _collapse_words(text: str) -> str:
    parts = (text or "").split()
    kept: list[str] = []
    for part in parts:
        if kept and kept[-1].lower() == part.lower():
            continue
        kept.append(part)
    return " ".join(kept)


def _course_from_text(summary: str) -> str:
    match = _COURSE_RE.search(" ".join((summary or "").split()))
    if not match:
        return ""
    return " ".join(match.group(1).split())[:120]


def _source_name(issuer: str, filename: str, summary: str) -> str:
    blob = f"{filename} {summary}".lower()
    if "goldman sachs" in blob:
        return "Goldman Sachs"
    if "accenture" in blob:
        return "Accenture"
    if "nptel" in blob:
        return "NPTEL"
    return (issuer or "")[:80]


def _blocked_names(extra: Any) -> list[str]:
    if not isinstance(extra, dict):
        return []
    found: list[str] = []
    for key in ("recipient", "student_name", "awarded_to"):
        value = str(extra.get(key) or "").strip().lower()
        if value and value not in ("unknown", "uploaded document"):
            found.append(value)
    return found


def _certificate_facts(
    title: str,
    issuer: str,
    record_date: str | None,
    summary: str,
    extra: Any,
    filename: str,
) -> dict[str, Any] | None:
    fields = extra if isinstance(extra, dict) else {}
    date = (
        _printed_date(str(fields.get("completion_date") or fields.get("date") or record_date or ""))
        or _printed_date(summary)
    )
    covered: list[str] = []
    raw_skills = fields.get("skills_covered") or fields.get("skills") or []
    if isinstance(raw_skills, list):
        for item in raw_skills:
            text = item.get("name") if isinstance(item, dict) else str(item or "")
            text = str(text).strip()
            if text:
                covered.append(text[:80])
    program = str(fields.get("program_name") or fields.get("course") or "").strip()
    course = _course_from_text(summary)
    heading = program or course
    if not heading:
        cleaned = _collapse_words(title or "")
        if cleaned.lower() not in _GENERIC_TITLES:
            heading = cleaned
    blocked = _blocked_names(fields)
    names = [name for name in (covered or ([heading] if heading else [])) if name.lower() not in blocked]
    if not names:
        return None
    percent = _printed_percent(str(fields.get("score") or "")) if len(names) == 1 else None
    if percent is None and len(names) == 1:
        percent = _printed_percent(summary)
    source = _source_name(issuer, filename, summary) or (heading or names[0])
    skills = []
    for name in names:
        skill: dict[str, Any] = {
            "name": name[:80],
            "completed_on": date,
            "certificate": source[:120],
        }
        if percent is not None:
            skill["pct"] = percent
        skills.append(skill)
    return {
        "title": (heading or names[0])[:120],
        "issuer": source[:80],
        "completed_on": date,
        "summary": (summary or "")[:240],
        "skills": skills,
        "blocked_names": blocked,
    }


def _looks_like_certificate(group: str, category: str, title: str, summary: str, extra: Any) -> bool:
    if any(word in (category or "").lower() for word in ("mark", "transcript", "grade")):
        return False
    if _counts_as_certificate(group, category):
        return True
    fields = extra if isinstance(extra, dict) else {}
    blob = " ".join(
        [
            title or "",
            summary or "",
            str(fields.get("title") or ""),
            str(fields.get("program_name") or ""),
            str(fields.get("summary") or ""),
        ]
    ).lower()
    if any(word in blob for word in ("marksheet", "transcript", "grade card")):
        return False
    return "certificate" in blob or "successfully completing the course" in blob


def _counts_as_certificate(group: str, category: str) -> bool:
    text = (category or "").lower()
    if any(word in text for word in ("mark", "transcript", "grade")):
        return False
    if group == "certificate" or "cert" in text:
        return True
    return group == "academic" and any(word in text for word in ("award", "course", "diploma", "degree"))


def _date_sort_key(value: str) -> tuple:
    text = _printed_date(value).replace(".", "")
    if not text:
        return (0, "")
    for fmt in (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%b %d, %Y",
        "%B %d, %Y",
        "%d %b %Y",
        "%d %B %Y",
        "%b %Y",
        "%B %Y",
    ):
        try:
            return (1, datetime.strptime(text, fmt).date().isoformat())
        except ValueError:
            continue
    return (1, text)


def merge_attained_skills(certificates: list[dict[str, Any]], model_rows: list[Any]) -> list[dict[str, Any]]:
    blocked = {
        str(name).lower()
        for cert in certificates
        for name in (cert.get("blocked_names") or [])
    }
    extras: dict[str, list[dict[str, str]]] = {}
    for row in model_rows or []:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()[:80]
        certificate = str(row.get("certificate") or "").strip()[:120]
        if not name or name.lower() in blocked:
            continue
        extras.setdefault(certificate.lower(), []).append(
            {
                "name": name,
                "completed_on": _printed_date(str(row.get("completed_on") or "")),
                "certificate": certificate,
            }
        )

    attained: list[dict[str, Any]] = []
    for cert in certificates:
        title = str(cert.get("title") or "").strip()
        date = _printed_date(str(cert.get("completed_on") or ""))
        seeds = cert.get("skills") or []
        if not seeds and title and title.lower() not in _GENERIC_TITLES:
            seeds = [{"name": title, "completed_on": date, "certificate": cert.get("issuer") or title}]
        for seed in seeds:
            if not isinstance(seed, dict):
                continue
            name = str(seed.get("name") or "").strip()[:80]
            if not name or name.lower() in blocked:
                continue
            item: dict[str, Any] = {
                "name": name,
                "completed_on": _printed_date(str(seed.get("completed_on") or date)),
                "certificate": str(seed.get("certificate") or cert.get("issuer") or title)[:120],
            }
            if isinstance(seed.get("pct"), int):
                item["pct"] = seed["pct"]
            attained.append(item)
        for extra in extras.get(title.lower(), []):
            match = next((row for row in attained if row["name"].lower() == extra["name"].lower()), None)
            if match is None:
                attained.append(
                    {
                        "name": extra["name"],
                        "completed_on": extra["completed_on"] or date,
                        "certificate": str(cert.get("issuer") or title)[:120],
                    }
                )
            elif not match["completed_on"] and extra["completed_on"]:
                match["completed_on"] = extra["completed_on"]

    best: dict[str, dict[str, Any]] = {}
    for row in attained:
        key = row["name"].strip().lower()
        if not key:
            continue
        current = best.get(key)
        if current is None or _date_sort_key(row["completed_on"]) >= _date_sort_key(current["completed_on"]):
            if current and current.get("pct") is not None and row.get("pct") is None:
                row = {**row, "pct": current["pct"]}
            best[key] = row
    return list(best.values())[:24]


def _title(value: str | None, fallback: str) -> str:
    text = (value or "").strip()
    if not text or text.lower() == "uploaded document":
        return fallback
    return text[:120]


def collect_document_facts(db: Session, uid: str) -> dict[str, Any] | None:
    knowledge = (
        db.query(StudentKnowledgeItem)
        .filter(StudentKnowledgeItem.uid == uid, StudentKnowledgeItem.status == "stored")
        .all()
    )
    by_job = {row.job_id: row for row in knowledge if row.job_id}
    academics = db.query(AcademicRecord).filter(AcademicRecord.uid == uid).all()
    careers = db.query(CareerRecord).filter(CareerRecord.uid == uid).all()
    campus = db.query(CampusActivity).filter(CampusActivity.uid == uid).all()
    if not academics and not careers and not campus and not knowledge:
        return None

    honors: list[dict[str, str]] = []
    certificates: list[dict[str, str]] = []
    experience: list[dict[str, Any]] = []
    activities: list[dict[str, str]] = []
    evidence: list[dict[str, str]] = []
    has_marksheet = False

    def add_evidence(kind: str, title: str, category: str, issuer: str, summary: str) -> None:
        if len(evidence) >= 12:
            return
        evidence.append(
            {
                "kind": kind,
                "title": title[:120],
                "category": (category or "")[:64],
                "issuer": (issuer or "")[:80],
                "summary": (summary or "")[:500],
            }
        )

    def remember_certificate(title: str, issuer: str, record_date: str | None, summary: str, extra: Any, filename: str) -> None:
        built = _certificate_facts(title, issuer, record_date, summary, extra, filename)
        if not built:
            return
        certificates.append(built)
        honors.append({"title": built["title"], "term": built["completed_on"] or (built.get("issuer") or "")[:80]})

    for rec in academics:
        item = by_job.get(rec.source_job_id)
        group = _group_for(item, rec.category or "", "academic")
        title = _title(rec.title or (item.title if item else ""), "Academic record")
        summary = _note(db, item, rec.extra)
        filename = item.filename if item else ""
        if _looks_like_certificate(group, rec.category or "", title, summary, rec.extra):
            remember_certificate(title, rec.issuer or "", rec.record_date, summary, rec.extra, filename)
        elif group == "career":
            experience.append(
                {
                    "title": title,
                    "org": (rec.issuer or "")[:120],
                    "when": _printed_date(rec.record_date),
                    "bullets": _bullets(rec.extra),
                }
            )
        elif group == "activity":
            activities.append(
                {"title": title, "date": rec.record_date or "Recorded", "tag": (rec.category or "Activity")[:32], "status": "completed"}
            )
        else:
            text = (rec.category or "").lower()
            if any(word in text for word in ("mark", "transcript", "grade")):
                has_marksheet = True
        add_evidence(group, title, rec.category or "", rec.issuer or "", summary)

    for rec in careers:
        item = by_job.get(rec.source_job_id)
        group = _group_for(item, rec.category or "", "career")
        title = _title(rec.title or (item.title if item else ""), "Career document")
        summary = _note(db, item, rec.extra)
        filename = item.filename if item else ""
        if group == "activity":
            activities.append(
                {"title": title, "date": rec.record_date or "Recorded", "tag": (rec.category or "Activity")[:32], "status": "completed"}
            )
        elif _looks_like_certificate(group, rec.category or "", title, summary, rec.extra):
            remember_certificate(title, rec.org or "", rec.record_date, summary, rec.extra, filename)
        else:
            experience.append(
                {
                    "title": title,
                    "org": (rec.org or "")[:120],
                    "when": _printed_date(rec.record_date),
                    "bullets": _bullets(rec.extra),
                }
            )
        add_evidence(group, title, rec.category or "", rec.org or "", summary)

    for row in campus:
        title = _title(row.event_name, "External activity")
        activities.append(
            {
                "title": title,
                "date": row.record_date or "Recorded",
                "tag": (row.role or "Activity")[:32],
                "status": "completed",
            }
        )
        add_evidence("activity", title, row.role or "", "", "")

    honors = _unique_titles(honors)
    experience = _unique_experience(experience)
    activities = _unique_activities(activities)
    cards: list[dict[str, str]] = []
    if honors:
        cards.append(
            {"type": "academic", "title": "Certificates", "description": f"{len(honors)} on file", "color": "purple"}
        )
    academic_count = sum(1 for item in evidence if item["kind"] == "academic")
    if academic_count:
        cards.append(
            {
                "type": "academic",
                "title": "Academic records",
                "description": f"{academic_count} on file",
                "color": "purple",
            }
        )
    if experience:
        cards.append(
            {"type": "progress", "title": "Career documents", "description": f"{len(experience)} on file", "color": "blue"}
        )
    if activities:
        cards.append(
            {"type": "skills", "title": "External activities", "description": f"{len(activities)} on file", "color": "green"}
        )

    if not honors and not experience and not activities and not evidence:
        return None

    return {
        "honors": honors,
        "experience": experience,
        "activities": activities,
        "evidence": evidence,
        "has_marksheet": has_marksheet,
        "document_counts": {
            "certificates": len(honors),
            "internships": len(experience),
            "activities": len(activities),
        },
        "report_cards": cards,
        "certifications": [row["title"] for row in honors if row.get("title")],
        "certificates": _unique_certificates(certificates),
    }


def _unique_titles(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for row in rows:
        key = row.get("title") or ""
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out[:12]


def _unique_certificates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = str(row.get("title") or "").strip().lower()
        if not key:
            continue
        current = best.get(key)
        if current is None or _date_sort_key(str(row.get("completed_on") or "")) >= _date_sort_key(
            str(current.get("completed_on") or "")
        ):
            best[key] = row
    return list(best.values())[:24]


def _unique_experience(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        key = f"{row.get('title')}|{row.get('org')}"
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out[:8]


def _unique_activities(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for row in rows:
        key = row.get("title") or ""
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out[:8]


def accept_stated_scores(raw: Any, *, has_marksheet: bool) -> dict[str, Any]:
    """Keep only numbers the pages can show. Drop anything that was not stated."""
    if not isinstance(raw, dict):
        return {}
    accepted: dict[str, Any] = {}
    scale = raw.get("gpa_scale")
    gpa = _number(raw.get("gpa"))
    if has_marksheet and gpa is not None and 0 < gpa <= 10:
        if gpa <= 4:
            accepted["gpa"] = round(gpa, 2)
        elif scale in (10, "10", 10.0):
            accepted["gpa"] = round(gpa / 10 * 4, 2)
            accepted["cgpa_10"] = round(gpa, 2)

    trend = []
    for point in raw.get("gpa_trend") or []:
        if not isinstance(point, dict) or len(trend) >= 8:
            continue
        value = _number(point.get("gpa"))
        term = str(point.get("term") or "").strip()[:32]
        if not term or value is None or not (0 < value <= 4):
            continue
        trend.append({"term": term, "gpa": round(value, 2)})
    if has_marksheet and trend:
        accepted["gpa_trend"] = trend

    courses = []
    for course in raw.get("current_courses") or []:
        if not isinstance(course, dict) or len(courses) >= 8:
            continue
        name = str(course.get("name") or course.get("title") or "").strip()[:80]
        if not name:
            continue
        courses.append({"name": name, "grade": str(course.get("grade") or "")[:16]})
    if courses:
        accepted["current_courses"] = courses

    names: list[str] = []
    for item in raw.get("skill_names") or []:
        if len(names) >= 12:
            break
        if isinstance(item, str) and item.strip():
            names.append(item.strip()[:60])
        elif isinstance(item, dict) and str(item.get("name") or "").strip():
            names.append(str(item["name"]).strip()[:60])
    if names:
        accepted["skill_names"] = names

    certificate_skills = []
    for item in raw.get("certificate_skills") or []:
        if not isinstance(item, dict) or len(certificate_skills) >= 12:
            continue
        name = str(item.get("name") or "").strip()[:80]
        if not name:
            continue
        certificate_skills.append(
            {
                "name": name,
                "completed_on": _printed_date(str(item.get("completed_on") or "")),
                "certificate": str(item.get("certificate") or "").strip()[:120],
            }
        )
    if certificate_skills:
        accepted["certificate_skills"] = certificate_skills

    highlights = []
    for item in raw.get("highlights") or []:
        if not isinstance(item, dict) or len(highlights) >= 8:
            continue
        title = str(item.get("title") or "").strip()[:80]
        if not title:
            continue
        highlights.append({"title": title, "detail": str(item.get("detail") or "").strip()[:160]})
    if highlights:
        accepted["highlights"] = highlights

    experience = []
    for item in raw.get("experience") or []:
        if not isinstance(item, dict) or len(experience) >= 8:
            continue
        title = str(item.get("title") or "").strip()[:120]
        if not title:
            continue
        bullets = item.get("bullets") or []
        if isinstance(bullets, str):
            bullets = [bullets]
        experience.append(
            {
                "title": title,
                "org": str(item.get("org") or "").strip()[:120],
                "bullets": [str(line).strip()[:160] for line in bullets[:4] if str(line).strip()],
            }
        )
    if experience:
        accepted["experience"] = experience

    skills = _stated_percents(raw.get("skills_overview") or raw.get("competency_skills"))
    if skills:
        accepted["skills_overview"] = skills
    distribution = _stated_percents(raw.get("skill_distribution"), value_key="value")
    if distribution:
        accepted["skill_distribution"] = distribution

    score = _number(raw.get("performance_score"))
    if has_marksheet and score is not None and 0 <= score <= 100:
        accepted["performance_score"] = round(score, 1)

    goals = str(raw.get("goals") or "").strip()
    if goals:
        accepted["goals"] = goals[:400]
    narrative = str(raw.get("narrative") or "").strip()
    if narrative:
        accepted["narrative"] = narrative[:400]
    return accepted


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _stated_percents(rows: Any, value_key: str = "pct") -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or len(out) >= 8:
            continue
        name = str(row.get("name") or "").strip()[:80]
        raw = row.get(value_key)
        if raw is None and value_key != "pct":
            raw = row.get("pct")
        if raw is None:
            raw = row.get("score")
        if raw is None:
            raw = row.get("value")
        number = _number(raw)
        if not name or number is None or not (0 <= number <= 100):
            continue
        item: dict[str, Any] = {"name": name, value_key: int(round(number))}
        if value_key != "pct":
            item["pct"] = int(round(number))
        out.append(item)
    return out


def _flash_scores(facts: dict[str, Any]) -> dict[str, Any]:
    prompt = (
        "From these student document notes, return JSON only. "
        "Use only facts printed in the notes. Omit a score when it is not printed. "
        "Do not invent rank, attendance, or meetings. "
        "Keys allowed: gpa (number), gpa_scale (4 or 10), "
        "gpa_trend (up to 8 objects with term and gpa on a 4.0 scale), "
        "current_courses (up to 8 objects with name and grade), "
        "skill_names (up to 12 skill or tool names printed in the notes), "
        "certificate_skills (up to 12 objects with name, completed_on, and certificate; "
        "only skills and dates printed on a course or academic certificate, never marksheets; "
        "leave completed_on empty when no date is printed), "
        "skills_overview (up to 8 objects with name and pct, pct only if a number is printed), "
        "skill_distribution (up to 6 objects with name and value), "
        "experience (up to 6 objects with title, org, and up to 4 bullets), "
        "highlights (up to 8 objects with title and detail, one per document), "
        "performance_score (0-100, only if a marksheet prints it), "
        "goals (max 400 characters), narrative (max 400 characters). "
        f"Notes: {facts['evidence']}"
    )
    try:
        raw = generate_json(prompt, tier="lite", max_output_tokens=_OUTPUT_TOKENS)
    except Exception:
        logger.info("Document score pass skipped")
        return {}
    return accept_stated_scores(raw, has_marksheet=bool(facts.get("has_marksheet")))


def _documents_still_running(db: Session, uid: str) -> bool:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=2)
    rows = (
        db.query(ProcessingJob)
        .filter(
            ProcessingJob.uid == uid,
            ProcessingJob.report_target.in_(_DOC_TARGETS),
            ProcessingJob.status.in_(["queued", "retry", "processing"]),
        )
        .all()
    )
    for row in rows:
        if row.status != "processing":
            return True
        stamp = row.updated_at or row.created_at
        if stamp is not None and getattr(stamp, "tzinfo", None) is not None:
            stamp = stamp.replace(tzinfo=None)
        if stamp is None or stamp >= cutoff:
            return True
    return False


def refresh_from_documents(db: Session, uid: str) -> bool:
    student = db.query(Student).filter(Student.uid == uid).first()
    if student and allow_sample_content(student.student_usn):
        return False
    if _documents_still_running(db, uid):
        return False
    lock = _lock_for(uid)
    if not lock.acquire(blocking=False):
        return False
    try:
        facts = collect_document_facts(db, uid)
        if not facts:
            return False
        scored = _flash_scores(facts)
        narrative = scored.pop("narrative", None)
        attained = merge_attained_skills(facts.get("certificates") or [], scored.get("certificate_skills") or [])
        honors = []
        for honor in facts["honors"]:
            dates = [
                row["completed_on"]
                for row in attained
                if row.get("certificate") == honor.get("title") and row.get("completed_on")
            ]
            term = max(dates, key=_date_sort_key) if dates else (honor.get("term") or "")
            honors.append({"title": honor.get("title") or "", "term": term})
        experience = scored.get("experience") or facts["experience"]
        highlights = list(scored.get("highlights") or [])
        if not highlights:
            for row in honors[:4]:
                highlights.append({"title": row["title"], "detail": row.get("term") or "Certificate"})
            for row in facts["experience"][:4]:
                highlights.append({"title": row["title"], "detail": row.get("org") or "Career document"})
            for row in facts["activities"][:4]:
                highlights.append({"title": row["title"], "detail": row.get("tag") or "Activity"})
        if scored.get("skill_names"):
            highlights.insert(0, {"title": "Skills from your documents", "detail": ", ".join(scored["skill_names"][:12])})
        recent = [
            {"title": item["title"], "when": item.get("detail") or "From your documents"}
            for item in highlights
            if item.get("title")
        ]
        academic_keys: dict[str, Any] = {
            "honors": honors,
            "certifications": facts["certifications"],
        }
        for key in ("gpa", "cgpa_10", "gpa_trend", "current_courses"):
            if key in scored:
                academic_keys[key] = scored[key]
        career_keys: dict[str, Any] = {"experience": experience}
        if recent:
            career_keys["recent_activity"] = recent
        if scored.get("goals"):
            career_keys["goals"] = scored["goals"]
        dash_keys: dict[str, Any] = {
            "document_counts": facts["document_counts"],
            "report_cards": facts["report_cards"],
            "certifications": facts["certifications"],
            "extract_version": _EXTRACT_VERSION,
            "documents_refreshed_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "recent_activities": [
                {
                    "title": item["title"],
                    "description": item.get("detail") or "",
                    "status": "completed",
                    "status_tag": "Added",
                    "term_tag": "Document",
                    "progress_pct": 100,
                    "icon": "completed",
                }
                for item in highlights
                if item.get("title")
            ],
        }
        if attained:
            stored_skills = [
                {"name": row["name"], "completed_on": row.get("completed_on") or "", "certificate": row.get("certificate") or ""}
                for row in attained
            ]
            dash_keys["attained_skills"] = stored_skills
            dash_keys["skills_acquired"] = len(stored_skills)
            bars = [dict(row) for row in (scored.get("skills_overview") or []) if isinstance(row, dict)]
            seen = {str(row.get("name") or "").lower() for row in bars}
            for row in attained:
                if not isinstance(row.get("pct"), int):
                    continue
                if row["name"].lower() in seen:
                    continue
                bars.append({"name": row["name"], "pct": row["pct"]})
                seen.add(row["name"].lower())
            if bars:
                dash_keys["skills_overview"] = bars
        elif scored.get("skill_names"):
            dash_keys["skill_names"] = scored["skill_names"]
            dash_keys["skills_acquired"] = len(scored["skill_names"])
        if scored.get("skill_names"):
            dash_keys["skill_names"] = scored["skill_names"]
        for key in ("skill_distribution",):
            if key in scored:
                dash_keys[key] = scored[key]
        if "skills_overview" not in dash_keys and "skills_overview" in scored:
            dash_keys["skills_overview"] = scored["skills_overview"]
        from app.services.student_score import compute_evidence_score, evidence_for_uid, programme_rank

        evidence = evidence_for_uid(db, uid)
        if isinstance(academic_keys.get("gpa"), (int, float)) and float(academic_keys["gpa"]) > 0:
            evidence["gpa"] = float(academic_keys["gpa"])
        if isinstance(academic_keys.get("cgpa_10"), (int, float)) and float(academic_keys["cgpa_10"]) > 0:
            evidence["cgpa_10"] = float(academic_keys["cgpa_10"])
        stored_skills = dash_keys.get("attained_skills") or []
        if stored_skills:
            evidence["skill_count"] = len(stored_skills)
        bars = dash_keys.get("skills_overview") or evidence["printed_percents"]
        if isinstance(bars, list) and bars and isinstance(bars[0], dict):
            evidence["printed_percents"] = [
                float(row["pct"]) for row in bars if isinstance(row, dict) and isinstance(row.get("pct"), (int, float))
            ]
        experience_rows = career_keys.get("experience") or []
        evidence["experience_count"] = len(
            [row for row in experience_rows if isinstance(row, dict) and str(row.get("title") or "").strip()]
        )
        breakdown = compute_evidence_score(
            gpa=evidence["gpa"],
            cgpa_10=evidence["cgpa_10"],
            printed_percents=evidence["printed_percents"],
            skill_count=evidence["skill_count"],
            experience_count=evidence["experience_count"],
            activities_total=evidence["activities_total"],
            activities_completed=evidence["activities_completed"],
            meetings_completed=evidence["meetings_completed"],
            meetings_upcoming=evidence["meetings_upcoming"],
        )
        breakdown["programme_rank"] = programme_rank(db, uid, breakdown.get("overall"), evidence["program"])
        dash_keys["score_breakdown"] = breakdown
        if breakdown.get("overall") is not None:
            dash_keys["performance_score"] = breakdown["overall"]
        write_report_keys(db, uid=uid, report_type="academic_report", keys=academic_keys)
        write_report_keys(
            db,
            uid=uid,
            report_type="career_report",
            keys=career_keys,
            narrative=narrative if isinstance(narrative, str) else None,
        )
        write_report_keys(db, uid=uid, report_type="tracker_dashboard", keys=dash_keys)
        invalidate_uid(uid)
        return True
    finally:
        lock.release()


def maybe_refresh_after_documents(db: Session, uid: str) -> None:
    """Rebuild skills and the evidence score after a document is stored.

    If other files for this student are still being read, remember the account
    and score it once that batch is finished.
    """
    if _documents_still_running(db, uid):
        _refresh_waiting.add(uid)
        return
    try:
        done = refresh_from_documents(db, uid)
    except Exception:
        logger.exception("Document report refresh failed")
        _refresh_waiting.add(uid)
        return
    if done or not (_documents_still_running(db, uid) or _lock_for(uid).locked()):
        _refresh_waiting.discard(uid)
    else:
        _refresh_waiting.add(uid)


def backfill_document_reports(db: Session) -> None:
    """One pass for students who already have stored documents and no dashboard report."""
    global _backfill_started
    if _backfill_started:
        return
    _backfill_started = True
    uids = {
        row[0]
        for row in db.query(StudentKnowledgeItem.uid)
        .filter(StudentKnowledgeItem.status == "stored")
        .distinct()
    }
    uids.update(row[0] for row in db.query(AcademicRecord.uid).distinct())
    uids.update(row[0] for row in db.query(CareerRecord.uid).distinct())
    uids.update(row[0] for row in db.query(CampusActivity.uid).distinct())
    for uid in uids:
        student = db.query(Student).filter(Student.uid == uid).first()
        if student and allow_sample_content(student.student_usn):
            continue
        existing = (
            db.query(LivingReport)
            .filter(LivingReport.uid == uid, LivingReport.report_type == "tracker_dashboard")
            .first()
        )
        state = (existing.structured_state or {}) if existing else {}
        if state.get("extract_version") == _EXTRACT_VERSION and isinstance(state.get("score_breakdown"), dict):
            continue
        try:
            refresh_from_documents(db, uid)
        except Exception:
            logger.exception("Stored document refresh failed")


def _naive(value):
    if value is None:
        return None
    if getattr(value, "tzinfo", None) is not None:
        return value.replace(tzinfo=None)
    return value


def refresh_idle_students(db: Session) -> None:
    """Rebuild stats for every student whose stored files are newer than the dashboard."""
    uids = {
        row[0]
        for row in db.query(StudentKnowledgeItem.uid)
        .filter(StudentKnowledgeItem.status == "stored")
        .distinct()
    }
    uids.update(row[0] for row in db.query(AcademicRecord.uid).distinct())
    uids.update(row[0] for row in db.query(CareerRecord.uid).distinct())
    uids.update(row[0] for row in db.query(CampusActivity.uid).distinct())
    uids.update(_refresh_waiting)
    for uid in uids:
        student = db.query(Student).filter(Student.uid == uid).first()
        if student and allow_sample_content(student.student_usn):
            continue
        if _documents_still_running(db, uid):
            continue
        report = (
            db.query(LivingReport)
            .filter(LivingReport.uid == uid, LivingReport.report_type == "tracker_dashboard")
            .first()
        )
        state = (report.structured_state or {}) if report else {}
        newest_file = (
            db.query(StudentKnowledgeItem.created_at)
            .filter(StudentKnowledgeItem.uid == uid, StudentKnowledgeItem.status == "stored")
            .order_by(StudentKnowledgeItem.created_at.desc())
            .first()
        )
        newest_job = (
            db.query(ProcessingJob.updated_at)
            .filter(
                ProcessingJob.uid == uid,
                ProcessingJob.status == "completed",
                ProcessingJob.report_target.in_(_DOC_TARGETS),
            )
            .order_by(ProcessingJob.updated_at.desc())
            .first()
        )
        stamps = [item[0] for item in (newest_file, newest_job) if item and item[0] is not None]
        newest_at = max((_naive(stamp) for stamp in stamps), default=None)
        updated_at = _naive(report.updated_at) if report else None
        saved = state.get("documents_refreshed_at")
        if isinstance(saved, str) and saved:
            try:
                updated_at = _naive(datetime.fromisoformat(saved))
            except ValueError:
                pass
        version_ready = state.get("extract_version") == _EXTRACT_VERSION and isinstance(state.get("score_breakdown"), dict)
        file_is_newer = bool(newest_at and (updated_at is None or newest_at > updated_at))
        if version_ready and not file_is_newer and uid not in _refresh_waiting:
            continue
        try:
            if refresh_from_documents(db, uid):
                _refresh_waiting.discard(uid)
        except Exception:
            logger.exception("Stored document refresh failed")
