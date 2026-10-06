"""Demo mode helpers."""
from __future__ import annotations

import os

from app.data.demo_personas import DEMO_USNS, SAMPLE_ACCOUNT_USNS


def demo_mode_enabled() -> bool:
    return os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes")


def is_demo_usn(usn: str | None) -> bool:
    return bool(usn and usn in DEMO_USNS)


def is_sample_account(usn: str | None) -> bool:
    """Seeded demo and sample students. Blank test accounts are not included."""
    return bool(usn and usn in SAMPLE_ACCOUNT_USNS)


def is_demo_day0_usn(usn: str | None) -> bool:
    """Empty-baseline students: seeded Day0 plus fresh blank test accounts."""
    if not usn:
        return False
    return usn == "JAIN-DEMO-DAY0-001" or usn.startswith("JAIN-BLANK-")


def allow_sample_content(usn: str | None) -> bool:
    """Seeded demo personas keep sample charts. Day 0 and real signups do not."""
    return is_demo_usn(usn) and not is_demo_day0_usn(usn)
