"""Daily Gemini usage cap (GEMINI_DAILY_BUDGET token units, default disabled)."""
from __future__ import annotations

import os
from datetime import date

_day: date | None = None
_used: int = 0


def _daily_limit() -> int | None:
    raw = os.getenv("GEMINI_DAILY_BUDGET", "").strip()
    if not raw:
        return None
    try:
        return max(0, int(raw))
    except ValueError:
        return None


def _reset_if_new_day() -> None:
    global _day, _used
    today = date.today()
    if _day != today:
        _day = today
        _used = 0


def assert_budget(*, estimated_tokens: int = 0) -> None:
    limit = _daily_limit()
    if limit is None:
        return
    _reset_if_new_day()
    if _used + estimated_tokens > limit:
        raise RuntimeError("Daily insight processing budget exceeded")


def record_usage(token_units: int) -> None:
    _reset_if_new_day()
    global _used
    _used += max(0, token_units)
