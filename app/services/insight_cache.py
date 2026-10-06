"""In-process TTL cache for Tracker insight payloads (Redis optional)."""
from __future__ import annotations

import json
import os
import time
from typing import Any

_TTL_SEC = int(os.getenv("INSIGHT_CACHE_TTL", "900"))
_store: dict[str, tuple[float, Any]] = {}


def cache_key(uid: str, kind: str, tab: str | None = None, version: int = 0) -> str:
    return f"{uid}:{kind}:{tab or ''}:{version}"


def _redis_client():
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        return None
    try:
        import redis

        return redis.from_url(url, decode_responses=True)
    except Exception:
        return None


def get(key: str) -> Any | None:
    r = _redis_client()
    if r:
        try:
            raw = r.get(f"insight:{key}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    row = _store.get(key)
    if not row:
        return None
    expires, val = row
    if time.time() > expires:
        _store.pop(key, None)
        return None
    return val


def set(key: str, value: Any) -> None:
    r = _redis_client()
    if r:
        try:
            r.setex(f"insight:{key}", _TTL_SEC, json.dumps(value, default=str))
        except Exception:
            pass
    _store[key] = (time.time() + _TTL_SEC, value)


def invalidate_uid(uid: str) -> None:
    prefix = f"{uid}:"
    r = _redis_client()
    if r:
        try:
            for k in r.scan_iter(match=f"insight:{prefix}*"):
                r.delete(k)
        except Exception:
            pass
    for k in list(_store.keys()):
        if k.startswith(prefix):
            _store.pop(k, None)
