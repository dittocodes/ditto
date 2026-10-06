"""Strip vendor / model brand names from text shown to clients or stored in job errors."""
from __future__ import annotations

import re

_VENDOR_PATTERNS = (
    (re.compile(r"\bgoogle\.generativeai\b", re.I), "insight service"),
    (re.compile(r"\bgenerativeai\b", re.I), "insight service"),
    (re.compile(r"\bGenerativeModel\b"), "Model"),
    (re.compile(r"\bgemini(?:[-\s]?[a-z0-9.]*)?\b", re.I), "insight service"),
    (re.compile(r"\bopenai\b", re.I), "insight service"),
    (re.compile(r"\bclaude\b", re.I), "insight service"),
    (re.compile(r"\bgpt-?[0-9o]*\b", re.I), "insight service"),
    (re.compile(r"\bGEMINI_[A-Z0-9_]+\b"), "INSIGHT_CONFIG"),
    (re.compile(r"\bAI\s+analysis\b", re.I), "Document analysis"),
    (re.compile(r"\bAI\s+model\b", re.I), "analysis model"),
    (re.compile(r"insight service-flash\b", re.I), "insight service"),
    (re.compile(r"insight service\.Model\b", re.I), "insight service"),
)


def scrub_vendor_names(text: str | None, *, fallback: str = "Processing unavailable. Please try again later.") -> str:
    if not text:
        return fallback
    out = str(text)
    for pat, repl in _VENDOR_PATTERNS:
        out = pat.sub(repl, out)
    out = re.sub(r"\s{2,}", " ", out).strip()
    return out or fallback
