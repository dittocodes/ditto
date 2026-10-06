"""Day0 local journey smoke: env checks + zero overview baseline.

Requires API running (default http://127.0.0.1:8003). Upload/extract phases are skipped.
"""
from __future__ import annotations

import os
import sys

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

BASE = os.getenv("API_BASE", "http://127.0.0.1:8003")
USN = os.getenv("SMOKE_USN", "JAIN-DEMO-DAY0-001")
PWD = os.getenv("SMOKE_PASSWORD", "SampleTest123!")


def _check_env() -> None:
    demo = os.getenv("DEMO_MODE", "")
    if demo and demo not in ("1", "true", "True", "yes"):
        print(f"WARN DEMO_MODE={demo!r} (expected 1 for demo worker shortcuts)")
    else:
        print(f"OK env DEMO_MODE={demo or '(unset — set DEMO_MODE=1 on API process)'}")
    poll = os.getenv("WORKER_POLL_SECONDS", "")
    print(f"OK env WORKER_POLL_SECONDS={poll or '(unset — API may use default; prefer 5)'}")
    if os.getenv("DEV_SQLITE"):
        print("WARN DEV_SQLITE is set in this shell; reset script clears it — ensure API was not started with it")


def main() -> None:
    _check_env()
    try:
        health = requests.get(f"{BASE}/docs", timeout=5)
        print(f"OK API reachable {BASE} ({health.status_code})")
    except requests.RequestException as e:
        print(f"FAIL API not reachable at {BASE}: {e}")
        sys.exit(1)

    r = requests.post(f"{BASE}/auth/login", json={"id": USN, "password": PWD}, timeout=30)
    if r.status_code != 200:
        print(f"FAIL login {USN}: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    uid = requests.get(f"{BASE}/api/v1/students/me/uid", headers=h, timeout=30).json()["uid"]
    print(f"OK login {USN} uid={uid}")

    overview = requests.get(f"{BASE}/api/v1/students/{uid}/overview", headers=h, timeout=60)
    if overview.status_code != 200:
        print(f"FAIL overview {overview.status_code}")
        sys.exit(1)
    data = overview.json()
    cards = data.get("summary_cards") or []
    if len(cards) < 1:
        print("FAIL expected summary_cards on Day0 overview")
        sys.exit(1)
    nonzero = [c for c in cards if (c.get("value") or 0) not in (0, "0", 0.0)]
    if nonzero and not data.get("day0_baseline"):
        # After journey uploads, Day0 may leave baseline; only enforce zeros when baseline flag set
        # or when no tracker_dashboard yet (fresh reset).
        print(f"WARN overview has non-zero cards (journey may already have data): {[c.get('title') for c in nonzero]}")
    elif nonzero and data.get("day0_baseline"):
        print(f"FAIL day0_baseline but non-zero cards: {nonzero}")
        sys.exit(1)
    else:
        for c in cards:
            val = c.get("value")
            if val not in (0, "0", 0.0):
                print(f"FAIL card {c.get('title')} value={val} (expected 0)")
                sys.exit(1)
        print("OK Day0 overview summary cards are zero")

    if data.get("day0_baseline"):
        print("OK day0_baseline flag present")
    else:
        print("WARN day0_baseline missing (tracker_dashboard may already exist for this uid)")

    acts = requests.get(f"{BASE}/api/v1/students/{uid}/activities", headers=h, timeout=30)
    acts.raise_for_status()
    print(f"OK activities list ({len(acts.json())} rows)")

    print("Day0 local journey smoke passed (upload phases skipped).")
    print("Full protocol: docs/LOCAL_STUDENT_JOURNEY.md")


if __name__ == "__main__":
    main()
