"""Live smoke: login + core v1 GET endpoints for sample student."""
from __future__ import annotations

import os
import sys

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")
USN = os.getenv("SMOKE_USN", "JAIN-SAMPLE-2026-001")
PWD = os.getenv("SMOKE_PASSWORD", "SampleTest123!")


def main() -> None:
    r = requests.post(f"{BASE}/auth/login", json={"id": USN, "password": PWD}, timeout=30)
    r.raise_for_status()
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    uid = requests.get(f"{BASE}/api/v1/students/me/uid", headers=h, timeout=30).json()["uid"]
    checks = [
        f"/api/v1/students/{uid}/overview",
        f"/api/v1/students/{uid}/profile?tab=academic",
        f"/api/v1/students/{uid}/analysis?tab=skills",
        f"/api/v1/students/{uid}/analysis?tab=reports",
        f"/api/v1/students/{uid}/activities",
        f"/api/v1/students/{uid}/swot",
        f"/api/v1/students/{uid}/campus",
    ]
    failed = []
    overview = None
    for path in checks:
        res = requests.get(f"{BASE}{path}", headers=h, timeout=60)
        ok = res.status_code == 200
        print(f"{'OK' if ok else 'FAIL'} {res.status_code} {path}")
        if not ok:
            failed.append(path)
        elif path.endswith("/overview"):
            overview = res.json()
    if overview:
        assert_overview(overview)
    if failed:
        sys.exit(1)
    print("All tracker API smoke checks passed.")


def assert_overview(data: dict) -> None:
    assert len(data.get("summary_cards") or []) == 4
    assert len(data.get("kpis") or []) == 4
    assert len(data.get("performance_analysis") or []) == 4
    for k in data.get("kpis") or []:
        weeks = k.get("weeks") or []
        assert len(weeks) == 4, f"KPI weeks expected 4, got {len(weeks)}"
    charts = data.get("charts") or {}
    for key in ("activity_completion", "skill_distribution", "performance_trend", "skill_growth", "activity_progress"):
        assert key in charts, f"missing charts.{key}"
    assert data.get("activity_reminders") is not None
    mw = data.get("meeting_widgets") or {}
    assert "event_dates" in mw


if __name__ == "__main__":
    main()
