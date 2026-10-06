"""Generate synthetic PDF/text demo documents (no real student data)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.data.demo_personas import DEMO_USNS, PERSONAS

ASSETS = ROOT / "demo_assets" / "documents"
SHARED = ASSETS / "shared"


def _pdf(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=letter)
    y = 750
    for line in lines:
        c.drawString(72, y, line[:90])
        y -= 16
        if y < 72:
            c.showPage()
            y = 750
    c.save()


def _persona_docs(usn: str, folder: Path) -> None:
    meta = PERSONAS[usn]
    name = meta["name"]
    program = meta["program"]
    lines_header = [
        "JAIN UNIVERSITY — SYNTHETIC DEMO DOCUMENT",
        f"Student: {name}",
        f"USN: {usn}",
        f"Programme: {program}",
        "This file is fictional for product demonstration only.",
    ]
    _pdf(folder / "id_card.pdf", lines_header + ["Document type: Student ID card", "Valid: 2024-2028"])
    _pdf(
        folder / "marklist_sem1.pdf",
        lines_header
        + ["Semester 1 Marklist", "Data Structures: A", "Programming: A-", "Mathematics: B+"],
    )
    _pdf(
        folder / "marklist_sem2.pdf",
        lines_header
        + ["Semester 2 Marklist", "Algorithms: B+", "Database Systems: A-", "OS: B"],
    )
    _pdf(folder / "cert_python.pdf", lines_header + ["Certificate: Python Programming", "Grade: Distinction"])
    _pdf(folder / "cert_web.pdf", lines_header + ["Certificate: Web Development", "Grade: Merit"])
    _pdf(folder / "cert_database.pdf", lines_header + ["Certificate: Database Design", "Grade: Pass"])
    _pdf(
        folder / "conference_proof.pdf",
        lines_header + ["Conference: Tech Summit 2025", "Poster: ML for Campus Analytics"],
    )
    _pdf(
        folder / "internship_letter.pdf",
        lines_header + ["Internship: TechStart Inc.", "Role: Web Developer Intern", "Duration: Jun-Aug 2025"],
    )
    _pdf(
        folder / "project_report.pdf",
        lines_header + ["Project: Student Tracker Module", "Supervisor: Dr. Demo Mentor"],
    )
    _pdf(
        folder / "campus_event.pdf",
        lines_header + ["Campus Event: Hackathon 2025", "Team placement: 2nd"],
    )


def main() -> None:
    SHARED.mkdir(parents=True, exist_ok=True)
    _pdf(
        SHARED / "marklist_conflict_v2.pdf",
        [
            "JAIN UNIVERSITY — SYNTHETIC DEMO DOCUMENT",
            "USN: JAIN-DEMO-DAY0-001",
            "Corrected Marklist — Database Systems grade: F (conflicts with prior B+)",
            "Use for review queue demonstration.",
        ],
    )
    messy = SHARED / "messy_scan_skewed.txt"
    messy.write_text(
        "SYNTHETIC OCR CHALLENGE\n"
        "Name: Jordan Demo\nUSN: JAIN-DEMO-DAY0-001\n"
        "~~~ skewed scan ~~~ low contrast ~~~ grade: ? ~~\n",
        encoding="utf-8",
    )
    for usn in DEMO_USNS:
        slug = usn.replace("JAIN-DEMO-", "").replace("-001", "").lower()
        _persona_docs(usn, ASSETS / slug)
    transcript = ROOT / "demo_assets" / "meeting_transcript_sample.txt"
    transcript.parent.mkdir(parents=True, exist_ok=True)
    transcript.write_text(
        "Mentor: Welcome Jordan, let's review your semester goals.\n"
        "Student: I want to improve database design and join CodeCraft club.\n"
        "Mentor: Action items: complete DB workshop, submit project milestone by Friday.\n"
        "Student: Agreed. I'll register for the Wednesday lab session.\n",
        encoding="utf-8",
    )
    print(f"Demo documents written under {ASSETS}")


if __name__ == "__main__":
    main()
