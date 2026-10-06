"""Generate Tracker analysis PDFs (ReportLab)."""
from __future__ import annotations

from io import BytesIO
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.db.models.student_platform import AcademicRecord, LivingReport, SwotEntry
from app.services.dashboard_mapper import _month_buckets, student_facts

REPORT_TITLES = {
    "swot": "SWOT Analysis Report",
    "progress": "Progress Report",
    "academic": "Academic Performance",
    "skills": "Skills Assessment",
}


def build_tracker_report_pdf(title: str, student_name: str, sections: list[tuple[str, list[str]]]) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 50
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, title)
    y -= 22
    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Student: {student_name}")
    y -= 28
    for heading, lines in sections:
        c.setFont("Helvetica-Bold", 13)
        c.drawString(50, y, heading)
        y -= 18
        c.setFont("Helvetica", 10)
        for line in lines:
            for chunk in _wrap(line, 90):
                if y < 60:
                    c.showPage()
                    y = height - 50
                c.drawString(55, y, chunk)
                y -= 14
        y -= 8
    c.save()
    return buf.getvalue()


def _lines(values: list[Any], empty: str) -> list[str]:
    rows = [str(item).strip() for item in values if str(item or "").strip() and str(item).strip().lower() != "none"]
    return rows or [empty]


def sections_for_student(db: Session, uid: str, report_type: str) -> list[tuple[str, list[str]]]:
    if report_type == "swot":
        swot = db.query(SwotEntry).filter(SwotEntry.uid == uid).order_by(SwotEntry.generated_at.desc()).first()
        blocks = {
            "Strengths": list(swot.strengths or []) if swot else [],
            "Weaknesses": list(swot.weaknesses or []) if swot else [],
            "Opportunities": list(swot.opportunities or []) if swot else [],
            "Threats": list(swot.threats or []) if swot else [],
        }
        return [(name, _lines(items, "None recorded.")) for name, items in blocks.items()]

    if report_type == "academic":
        records = db.query(AcademicRecord).filter(AcademicRecord.uid == uid).order_by(AcademicRecord.id.desc()).all()
        lines = []
        for row in records:
            parts = [row.title or "Record", row.category or "", row.issuer or "", row.record_date or ""]
            lines.append(" · ".join(part for part in parts if part))
        return [("Stored academic records", _lines(lines, "No academic records stored yet."))]

    if report_type == "skills":
        report = (
            db.query(LivingReport)
            .filter(LivingReport.uid == uid, LivingReport.report_type == "tracker_dashboard")
            .first()
        )
        state = report.structured_state if report and isinstance(report.structured_state, dict) else {}
        lines = []
        for item in state.get("attained_skills") or []:
            if not isinstance(item, dict) or not item.get("name"):
                continue
            detail = [str(item["name"])]
            if item.get("certificate"):
                detail.append(str(item["certificate"]))
            if item.get("completed_on"):
                detail.append(str(item["completed_on"]))
            if isinstance(item.get("pct"), (int, float)):
                detail.append(f"{item['pct']}%")
            lines.append(" · ".join(detail))
        return [("Skills read from documents", _lines(lines, "No skills have been read from your documents yet."))]

    facts = student_facts(db, uid)
    summary = [
        f"Activities completed: {facts.get('activities_completed', 0)} of {facts.get('activities_total', 0)}",
        f"Completion: {facts.get('completion_pct', 0)}%",
        f"Meetings completed: {facts.get('meetings_completed', 0)}",
        f"Meetings upcoming: {facts.get('meetings_upcoming', 0)}",
        f"Meetings cancelled: {facts.get('meetings_cancelled', 0)}",
    ]
    if facts.get("attendance_pct") is not None:
        summary.append(f"Attendance, last 30 days: {facts['attendance_pct']}%")
    labels, totals, completed = _month_buckets(list(facts.get("activities") or []), 6)
    months = [
        f"{label}: {done} completed of {total}"
        for label, total, done in zip(labels, totals, completed)
        if total
    ]
    return [
        ("Progress", summary),
        ("Months with activities due", _lines(months, "No activities have a due date yet.")),
    ]


def report_sections_from_payload(report_type: str, payload: dict[str, Any]) -> list[tuple[str, list[str]]]:
    if report_type == "swot":
        swot = payload.get("swot") or payload.get("structured_state") or {}
        return [
            ("Strengths", [str(x) for x in (swot.get("strengths") or [])]),
            ("Weaknesses", [str(x) for x in (swot.get("weaknesses") or [])]),
            ("Opportunities", [str(x) for x in (swot.get("opportunities") or [])]),
            ("Threats", [str(x) for x in (swot.get("threats") or [])]),
        ]
    if report_type == "academic":
        ac = payload.get("academic") or {}
        return [
            ("Academic profile", [f"GPA: {ac.get('gpa')}", f"Standing: {ac.get('standing')}"]),
            ("Records", [f"{r.get('title')} ({r.get('category')})" for r in ac.get("records", [])]),
        ]
    overview = payload
    cards = overview.get("summary_cards") or []
    return [
        ("Summary", [f"{c.get('title')}: {c.get('value')}" for c in cards]),
        ("Generated", [str(overview.get("generated_at", ""))]),
    ]


def _wrap(text: str, width: int) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        test = " ".join(cur + [w])
        if len(test) > width and cur:
            lines.append(" ".join(cur))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        lines.append(" ".join(cur))
    return lines or [""]
