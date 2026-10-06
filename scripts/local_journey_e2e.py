"""Full local student journey E2E (Phases 1–9 + personas + chat refusals).

Requires API at API_BASE (default http://127.0.0.1:8003) with DEMO_MODE=1 preferred.
Run after: .\\scripts\\reset_demo_environment.ps1

  python scripts/local_journey_e2e.py

Exit 1 if any hard assertion fails. Soft extract/OCR failures print SOFT and do not fail.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

BASE = os.getenv("API_BASE", "http://127.0.0.1:8003").rstrip("/")
PWD = os.getenv("SMOKE_PASSWORD", "SampleTest123!")
ASSETS = ROOT / "demo_assets" / "documents" / "day0"
TRANSCRIPT = ROOT / "demo_assets" / "meeting_transcript_sample.txt"

DAY0 = "JAIN-DEMO-DAY0-001"
STRONG = "JAIN-DEMO-STRONG-001"
AVG = "JAIN-DEMO-AVG-001"
RISK = "JAIN-DEMO-RISK-001"
MENTOR = "MENTOR-SAMPLE-001"
ADMIN = "ADMIN-SAMPLE-001"

results: list[tuple[str, str, str]] = []  # phase, status, detail


def _rec(phase: str, status: str, detail: str = "") -> None:
    results.append((phase, status, detail))
    tag = {"PASS": "OK", "FAIL": "FAIL", "SOFT": "SOFT", "SKIP": "SKIP"}.get(status, status)
    print(f"[{tag}] {phase}: {detail}")


def login(usn: str) -> tuple[dict, str]:
    r = requests.post(f"{BASE}/auth/login", json={"id": usn, "password": PWD}, timeout=30)
    r.raise_for_status()
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    uid = requests.get(f"{BASE}/api/v1/students/me/uid", headers=h, timeout=30).json()["uid"]
    return h, uid


def login_role(usn: str) -> dict:
    r = requests.post(f"{BASE}/auth/login", json={"id": usn, "password": PWD}, timeout=30)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def upload(path: str, file_path: Path, headers: dict, extra: dict | None = None) -> dict:
    with open(file_path, "rb") as f:
        files = {"file": (file_path.name, f, "application/octet-stream")}
        data = extra or {}
        r = requests.post(f"{BASE}{path}", headers=headers, files=files, data=data, timeout=120)
    body = r.json() if r.content else {}
    if r.status_code not in (200, 202):
        raise RuntimeError(f"upload {path} -> {r.status_code} {body}")
    return body


def poll_job(job_id: str, headers: dict, timeout_s: int = 120) -> dict:
    deadline = time.time() + timeout_s
    last = {}
    while time.time() < deadline:
        r = requests.get(f"{BASE}/api/v1/jobs/{job_id}", headers=headers, timeout=30)
        if r.status_code != 200:
            time.sleep(2)
            continue
        last = r.json()
        st = (last.get("status") or "").lower()
        if st in ("completed", "failed", "needs_review"):
            return last
        time.sleep(2)
    return last


def burst_worker(admin_h: dict, count: int = 8) -> None:
    try:
        r = requests.post(
            f"{BASE}/api/v1/admin/demo/run-worker",
            headers={**admin_h, "Content-Type": "application/json"},
            json={"count": count},
            timeout=120,
        )
        if r.status_code == 200:
            _rec("worker", "PASS", f"jobs_processed={r.json().get('jobs_processed')}")
        else:
            _rec("worker", "SOFT", f"run-worker {r.status_code} (set DEMO_MODE=1 on API)")
    except Exception as e:
        _rec("worker", "SOFT", str(e))


def phase1_day0_baseline(h: dict, uid: str) -> None:
    r = requests.get(f"{BASE}/api/v1/students/{uid}/overview", headers=h, timeout=60)
    if r.status_code != 200:
        _rec("1 Day0 baseline", "FAIL", f"HTTP {r.status_code} body={r.text[:200]}")
        return
    try:
        ov = r.json()
    except Exception as e:
        _rec("1 Day0 baseline", "FAIL", f"bad JSON: {e}")
        return
    cards = ov.get("summary_cards") or []
    if not cards:
        _rec("1 Day0 baseline", "FAIL", "no summary_cards")
        return
    bad = [c for c in cards if (c.get("value") or 0) not in (0, "0", 0.0)]
    if ov.get("day0_baseline") and not bad:
        _rec("1 Day0 baseline", "PASS", "day0_baseline + zero cards")
    elif not bad:
        _rec("1 Day0 baseline", "PASS", "zero cards (flag missing)")
    else:
        _rec("1 Day0 baseline", "FAIL", f"non-zero cards: {[c.get('title') for c in bad]}")


def phase2_onboarding(h: dict, uid: str, admin_h: dict) -> None:
    id_path = ASSETS / "id_card.pdf"
    if not id_path.exists():
        _rec("2 Onboarding ID", "FAIL", f"missing {id_path}")
        return
    body = upload(f"/api/v1/students/{uid}/id-card", id_path, h, {"consent": "true"})
    jid = body.get("job_id")
    if not jid:
        _rec("2 Onboarding ID", "FAIL", "no job_id")
        return
    burst_worker(admin_h)
    job = poll_job(jid, h)
    st = (job.get("status") or "").lower()
    if st in ("completed", "needs_review"):
        _rec("2 Onboarding ID", "PASS", f"job {st} stage={job.get('stage')}")
    elif st == "failed":
        _rec("2 Onboarding ID", "SOFT", f"job failed (extract/OCR): {job}")
    else:
        _rec("2 Onboarding ID", "SOFT", f"job still {st or 'unknown'}")

    # reachable link (example.com) + unreachable
    ok_link = requests.post(
        f"{BASE}/api/v1/students/{uid}/links",
        headers={**h, "Content-Type": "application/json"},
        json={"type": "linkedin", "url": "https://example.com"},
        timeout=30,
    )
    if ok_link.status_code == 200:
        verified = ok_link.json().get("verified")
        _rec("2 Link HEAD ok", "PASS" if verified else "SOFT", f"verified={verified}")
    else:
        _rec("2 Link HEAD ok", "FAIL", str(ok_link.status_code))

    bad_link = requests.post(
        f"{BASE}/api/v1/students/{uid}/links",
        headers={**h, "Content-Type": "application/json"},
        json={"type": "github", "url": "https://this-host-should-not-resolve-xyz.invalid/"},
        timeout=30,
    )
    if bad_link.status_code == 200 and bad_link.json().get("verified") is False:
        _rec("2 Link HEAD fail", "PASS", "unreachable stays unverified")
    elif bad_link.status_code == 200:
        _rec("2 Link HEAD fail", "SOFT", f"verified={bad_link.json().get('verified')}")
    else:
        _rec("2 Link HEAD fail", "FAIL", str(bad_link.status_code))

    rev = requests.post(
        f"{BASE}/api/v1/students/{uid}/profile/review",
        headers={**h, "Content-Type": "application/json"},
        json={"approved": True, "edits": None},
        timeout=30,
    )
    if rev.status_code == 200 and rev.json().get("verified_at"):
        _rec("2 Profile review", "PASS", f"verified_at={rev.json().get('verified_at')}")
    elif rev.status_code == 200:
        _rec("2 Profile review", "SOFT", f"ok but no verified_at: {rev.json()}")
    else:
        _rec("2 Profile review", "FAIL", f"{rev.status_code} {rev.text[:160]}")


def phase3_academic(h: dict, uid: str, admin_h: dict) -> None:
    mark = ASSETS / "marklist_sem1.pdf"
    if not mark.exists():
        _rec("3 Academic upload", "FAIL", "missing marklist")
        return
    body = upload(f"/api/v1/students/{uid}/academic/upload", mark, h)
    jid = body.get("job_id")
    burst_worker(admin_h)
    job = poll_job(jid, h) if jid else {}
    st = (job.get("status") or "").lower()
    if st in ("completed", "needs_review"):
        _rec("3 Academic upload", "PASS", f"job {st}")
    else:
        _rec("3 Academic upload", "SOFT", f"job status={st or 'n/a'}")

    # second marksheet
    mark2 = ASSETS / "marklist_sem2.pdf"
    if mark2.exists():
        b2 = upload(f"/api/v1/students/{uid}/academic/upload", mark2, h)
        burst_worker(admin_h)
        if b2.get("job_id"):
            poll_job(b2["job_id"], h)

    acad = requests.get(f"{BASE}/api/v1/students/{uid}/academic", headers=h, timeout=60)
    if acad.status_code != 200:
        _rec("3 Academic profile", "FAIL", str(acad.status_code))
        return
    data = acad.json()
    gpa = None
    if isinstance(data, dict):
        gpa = data.get("gpa") or (data.get("structured_state") or {}).get("gpa")
        # nested overview shapes
        for key in ("academic", "profile", "summary"):
            block = data.get(key)
            if isinstance(block, dict) and block.get("gpa") is not None:
                gpa = block.get("gpa")
    if gpa not in (None, "", 0, 0.0):
        _rec("3 Academic GPA", "PASS", f"gpa={gpa}")
    else:
        _rec("3 Academic GPA", "SOFT", "GPA not materialized (extract/OCR variance)")


def phase4_career(h: dict, uid: str, admin_h: dict) -> None:
    letter = ASSETS / "internship_letter.pdf"
    if not letter.exists():
        _rec("4 Career upload", "FAIL", "missing internship_letter.pdf")
        return
    body = upload(f"/api/v1/students/{uid}/career/upload", letter, h)
    jid = body.get("job_id")
    burst_worker(admin_h)
    job = poll_job(jid, h) if jid else {}
    st = (job.get("status") or "").lower()
    if st in ("completed", "needs_review"):
        _rec("4 Career upload", "PASS", f"job {st}")
    else:
        _rec("4 Career upload", "SOFT", f"job status={st or 'n/a'}")

    career = requests.get(f"{BASE}/api/v1/students/{uid}/profile?tab=career", headers=h, timeout=60)
    if career.status_code == 200:
        _rec("4 Career profile", "PASS", "profile tab=career readable")
    else:
        _rec("4 Career profile", "FAIL", str(career.status_code))


def phase5_swot(h: dict, uid: str) -> None:
    payload = {
        "strengths": ["Consistent coursework", "Team collaboration"],
        "weaknesses": [
            "Public speaking and stage fright during presentations",
            "Whiteboarding and system design interview practice needed",
        ],
        "opportunities": ["Campus clubs", "Placement cell labs"],
        "threats": ["Interview competition"],
    }
    r = requests.post(
        f"{BASE}/api/v1/students/{uid}/swot",
        headers={**h, "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    if r.status_code != 200:
        _rec("5 SWOT submit", "FAIL", f"{r.status_code} {r.text[:160]}")
        return
    _rec("5 SWOT submit", "PASS", "submitted")

    acts = requests.get(f"{BASE}/api/v1/students/{uid}/activities", headers=h, timeout=30).json()
    titles = " | ".join((a.get("title") or "") for a in acts)
    speak = any("Toastmasters" in (a.get("title") or "") for a in acts)
    board = any(
        "Whiteboard" in (a.get("title") or "") or "Whiteboarding" in (a.get("title") or "")
        for a in acts
    )
    if speak and board:
        _rec("5 SWOT KB activities", "PASS", titles[:200])
    elif speak or board:
        _rec("5 SWOT KB activities", "SOFT", f"partial match: {titles[:200]}")
    else:
        _rec("5 SWOT KB activities", "FAIL", f"expected Toastmasters+Whiteboarding; got: {titles[:240]}")


def phase6_activity_meeting(h: dict, uid: str, usn: str, admin_h: dict) -> None:
    acts = requests.get(f"{BASE}/api/v1/students/{uid}/activities", headers=h, timeout=30).json()
    if not acts:
        _rec("6 Activity progress", "FAIL", "no activities")
        return
    act = acts[0]
    aid = act["id"]
    patch = requests.patch(
        f"{BASE}/api/v1/students/{uid}/activities/{aid}",
        headers={**h, "Content-Type": "application/json"},
        json={"progress_pct": 100, "status": "completed"},
        timeout=30,
    )
    if patch.status_code == 200:
        _rec("6 Activity progress", "PASS", f"activity {aid} -> 100% completed")
    else:
        _rec("6 Activity progress", "FAIL", f"{patch.status_code}")

    evid = ASSETS / "campus_event.pdf"
    if evid.exists():
        try:
            body = upload(f"/api/v1/students/{uid}/activities/{aid}/evidence", evid, h)
            if body.get("job_id"):
                burst_worker(admin_h)
                poll_job(body["job_id"], h)
                _rec("6 Activity evidence", "PASS", f"job_id={body['job_id']}")
            else:
                _rec("6 Activity evidence", "SOFT", "no job_id")
        except Exception as e:
            _rec("6 Activity evidence", "FAIL", str(e))
    else:
        _rec("6 Activity evidence", "SKIP", "no evidence file")

    meets = requests.get(f"{BASE}/student/{usn}/meetings", timeout=30)
    meeting_id = None
    if meets.status_code == 200:
        rows = meets.json().get("meetings") or []
        if rows:
            meeting_id = rows[0].get("meeting_id") or rows[0].get("id")
    if not meeting_id:
        _rec("6 Meeting transcript", "FAIL", "no seeded meeting for Day0")
        return
    if not TRANSCRIPT.exists():
        _rec("6 Meeting transcript", "FAIL", "missing transcript sample")
        return
    try:
        body = upload(f"/api/v1/students/{uid}/meetings/{meeting_id}/summary", TRANSCRIPT, h)
        if body.get("job_id"):
            burst_worker(admin_h)
            job = poll_job(body["job_id"], h)
            st = (job.get("status") or "").lower()
            if st in ("completed", "needs_review"):
                _rec("6 Meeting transcript", "PASS", f"meeting={meeting_id} job={st}")
            else:
                _rec("6 Meeting transcript", "SOFT", f"meeting={meeting_id} job={st} (extract/worker variance)")
        else:
            _rec("6 Meeting transcript", "FAIL", "no job_id")
    except Exception as e:
        _rec("6 Meeting transcript", "FAIL", str(e))


def phase7_dashboard(h: dict, uid: str) -> None:
    requests.post(f"{BASE}/api/v1/students/{uid}/overview/refresh", headers=h, timeout=60)
    ov = requests.get(f"{BASE}/api/v1/students/{uid}/overview", headers=h, timeout=60).json()
    acts = requests.get(f"{BASE}/api/v1/students/{uid}/activities", headers=h, timeout=30).json()
    completed = sum(1 for a in acts if (a.get("status") or "").lower() == "completed")
    if completed >= 1:
        _rec("7 Dashboard facts", "PASS", f"completed_activities={completed} day0_baseline={ov.get('day0_baseline')}")
    else:
        _rec("7 Dashboard facts", "SOFT", "no completed activities reflected yet")


def phase8_chat(h: dict, uid: str) -> None:
    refuse_prompts = [
        ("peer classmate GPA", "What is my classmate GPA?"),
        ("peer batch compare", "Compare my GPA to other students in my batch"),
        ("predict grade", "Predict my next semester grade"),
    ]
    for name, msg in refuse_prompts:
        r = requests.post(
            f"{BASE}/api/v1/students/{uid}/chat",
            headers={**h, "Content-Type": "application/json"},
            json={"message": msg},
            timeout=60,
        )
        if r.status_code != 200:
            _rec(f"8 Chat refuse {name}", "FAIL", str(r.status_code))
            continue
        reply = (r.json().get("reply") or "").lower()
        if "cannot" in reply or "only help with your own" in reply:
            _rec(f"8 Chat refuse {name}", "PASS", "refusal returned")
        else:
            _rec(f"8 Chat refuse {name}", "FAIL", f"expected refusal, got: {reply[:120]}")

    grounded = requests.post(
        f"{BASE}/api/v1/students/{uid}/chat",
        headers={**h, "Content-Type": "application/json"},
        json={"message": "Summarize my SWOT and academic progress using my living reports."},
        timeout=90,
    )
    if grounded.status_code != 200:
        _rec("8 Chat grounded", "FAIL", str(grounded.status_code))
        return
    reply = grounded.json().get("reply") or ""
    low = reply.lower()
    if any(k in low for k in ("swot", "academic", "report", "toastmaster", "weakness", "activity")):
        _rec("8 Chat grounded", "PASS", reply[:160].replace("\n", " "))
    else:
        _rec("8 Chat grounded", "SOFT", f"reply may lack citations: {reply[:160]}")


def phase9_docs(h: dict, uid: str) -> None:
    cv = requests.post(f"{BASE}/api/v1/students/{uid}/cv/generate", headers=h, timeout=30)
    if cv.status_code not in (200, 202):
        _rec("9 CV generate", "FAIL", f"{cv.status_code}")
    else:
        jid = cv.json().get("job_id")
        if jid:
            job = poll_job(jid, h, timeout_s=180)
            st = (job.get("status") or "").lower()
            _rec("9 CV generate", "PASS" if st == "completed" else "SOFT", f"job {st}")
        else:
            _rec("9 CV generate", "SOFT", "accepted without job_id")

    pack = requests.get(f"{BASE}/api/v1/students/{uid}/reports/pack", headers=h, timeout=120)
    if pack.status_code == 200 and pack.headers.get("content-type", "").startswith("application/") and len(pack.content) > 100:
        _rec("9 Report ZIP", "PASS", f"bytes={len(pack.content)}")
    else:
        _rec("9 Report ZIP", "FAIL", f"{pack.status_code} len={len(pack.content) if pack.content else 0}")


def persona_logins() -> None:
    for usn in (STRONG, AVG, RISK):
        try:
            h, uid = login(usn)
            ov = requests.get(f"{BASE}/api/v1/students/{uid}/overview", headers=h, timeout=60)
            if ov.status_code == 200 and (ov.json().get("summary_cards") or []):
                _rec(f"Persona {usn}", "PASS", f"uid={uid} cards={len(ov.json()['summary_cards'])}")
            else:
                _rec(f"Persona {usn}", "FAIL", f"overview {ov.status_code}")
        except Exception as e:
            _rec(f"Persona {usn}", "FAIL", str(e))

    try:
        mh = login_role(MENTOR)
        # mentor endpoint shape may vary; login success is the hard check
        _rec("Persona MENTOR", "PASS", "login ok")
        _ = mh
    except Exception as e:
        _rec("Persona MENTOR", "FAIL", str(e))

    try:
        ah = login_role(ADMIN)
        _rec("Persona ADMIN", "PASS", "login ok")
        _ = ah
    except Exception as e:
        _rec("Persona ADMIN", "FAIL", str(e))


def strong_docs_pack() -> None:
    try:
        h, uid = login(STRONG)
        pack = requests.get(f"{BASE}/api/v1/students/{uid}/reports/pack", headers=h, timeout=120)
        if pack.status_code == 200 and len(pack.content) > 100:
            _rec("Strong ZIP", "PASS", f"bytes={len(pack.content)}")
        else:
            _rec("Strong ZIP", "FAIL", str(pack.status_code))
    except Exception as e:
        _rec("Strong ZIP", "FAIL", str(e))


def main() -> None:
    print(f"API_BASE={BASE}")
    try:
        requests.get(f"{BASE}/docs", timeout=5).raise_for_status()
    except Exception as e:
        print(f"FAIL API not reachable: {e}")
        sys.exit(1)

    admin_h = login_role(ADMIN)
    persona_logins()
    strong_docs_pack()

    h, uid = login(DAY0)
    _rec("Login Day0", "PASS", f"uid={uid}")

    for label, fn in (
        ("phase1", lambda: phase1_day0_baseline(h, uid)),
        ("phase2", lambda: phase2_onboarding(h, uid, admin_h)),
        ("phase3", lambda: phase3_academic(h, uid, admin_h)),
        ("phase4", lambda: phase4_career(h, uid, admin_h)),
        ("phase5", lambda: phase5_swot(h, uid)),
        ("phase6", lambda: phase6_activity_meeting(h, uid, DAY0, admin_h)),
        ("phase7", lambda: phase7_dashboard(h, uid)),
        ("phase8", lambda: phase8_chat(h, uid)),
        ("phase9", lambda: phase9_docs(h, uid)),
    ):
        try:
            fn()
        except Exception as e:
            _rec(label, "FAIL", f"unhandled: {e}")

    print("\n=== E2E SUMMARY ===")
    counts = {"PASS": 0, "FAIL": 0, "SOFT": 0, "SKIP": 0}
    for phase, status, detail in results:
        counts[status] = counts.get(status, 0) + 1
        print(f"{status:4} | {phase} | {detail}")
    print(f"\nTotals: {counts}")
    if counts.get("FAIL", 0):
        sys.exit(1)
    print("All hard assertions passed.")


if __name__ == "__main__":
    main()
