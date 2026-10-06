"""Create draft activities from SWOT weaknesses (Phase 6→7), grounded in Knowledge Base."""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models.student_platform import KnowledgeBaseEntry, StudentActivityV2
from app.db.models.students import Student

# Keyword groups → preferred activity title prefix when KB matches
_SPEAKING_KEYS = ("speak", "stage", "fright", "present", "anxiety", "toastmaster", "debate", "communicat")
_INTERVIEW_KEYS = ("interview", "whiteboard", "system design", "placement", "technical interview")


def _kb_candidates(db: Session, uid: str) -> list[KnowledgeBaseEntry]:
    st = db.query(Student).filter(Student.uid == uid).first()
    prog = (st.student_program if st else "") or "CS"
    programme_id = "CS" if "computer" in prog.lower() else prog[:8]
    rows = (
        db.query(KnowledgeBaseEntry)
        .filter(
            KnowledgeBaseEntry.scope.in_(("global", "swot", "campus"))
            | (
                (KnowledgeBaseEntry.scope == "programme")
                & (KnowledgeBaseEntry.programme_id == programme_id)
            )
        )
        .all()
    )
    return rows or db.query(KnowledgeBaseEntry).limit(20).all()


def _score_kb(content: str, weakness: str) -> int:
    w = weakness.lower()
    c = (content or "").lower()
    score = 0
    for token in w.replace(",", " ").split():
        t = token.strip()
        if len(t) >= 4 and t in c:
            score += 2
    for keys in (_SPEAKING_KEYS, _INTERVIEW_KEYS):
        if any(k in w for k in keys) and any(k in c for k in keys):
            score += 10
    return score


def _pick_kb(candidates: list[KnowledgeBaseEntry], weakness: str) -> KnowledgeBaseEntry | None:
    if not candidates:
        return None
    ranked = sorted(candidates, key=lambda r: _score_kb(r.content or "", weakness), reverse=True)
    best = ranked[0]
    if _score_kb(best.content or "", weakness) > 0:
        return best
    return candidates[0]


def _activity_title(weakness: str, kb_content: str) -> str:
    w = weakness.lower()
    kb = (kb_content or "").lower()
    if any(k in w for k in _SPEAKING_KEYS) or "toastmaster" in kb:
        return "Attend Campus Toastmasters sessions"
    if any(k in w for k in _INTERVIEW_KEYS) or "whiteboard" in kb or "system design" in kb:
        return "Complete System Design and Cloud Whiteboarding exercises"
    short = weakness.strip()[:80]
    return f"Improve: {short}"


def generate_activities_from_swot(db: Session, uid: str, weaknesses: list[str]) -> int:
    candidates = _kb_candidates(db, uid)
    created = 0
    for w in weaknesses[:5]:
        title_src = w.strip()[:200]
        if not title_src:
            continue
        kb = _pick_kb(candidates, title_src)
        kb_text = kb.content if kb else ""
        act_title = _activity_title(title_src, kb_text)
        exists = (
            db.query(StudentActivityV2)
            .filter(StudentActivityV2.uid == uid, StudentActivityV2.title == act_title)
            .first()
        )
        if exists:
            continue
        desc = f"Activity linked to SWOT weakness: {title_src}"
        if kb_text:
            desc = f"{desc} Campus resource: {kb_text}"
        db.add(
            StudentActivityV2(
                uid=uid,
                title=act_title,
                description=desc,
                origin="ai",
                linked_swot_item=title_src[:64],
                status="pending",
                progress_pct=0,
                priority="medium",
                term="short",
                due_date=datetime.utcnow() + timedelta(days=21),
            )
        )
        created += 1
    if created:
        db.commit()
    return created
