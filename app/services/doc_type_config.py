"""Load doc_types.yaml for pipeline routing hints."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


@lru_cache(maxsize=1)
def load_doc_types() -> dict[str, Any]:
    path = _CONFIG_DIR / "doc_types.yaml"
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data if isinstance(data, dict) else {}


def report_target_for_doc_type(doc_type: str) -> str | None:
    row = load_doc_types().get(doc_type)
    if isinstance(row, dict):
        return row.get("report_target")
    return None


def categories_for_doc_type(doc_type: str) -> list[str]:
    row = load_doc_types().get(doc_type)
    if isinstance(row, dict):
        cats = row.get("categories") or []
        return [str(c) for c in cats]
    return []


def dashboard_merge_for_doc_type(doc_type: str) -> bool:
    row = load_doc_types().get(doc_type)
    return bool(isinstance(row, dict) and row.get("dashboard_merge"))
