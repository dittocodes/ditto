"""PII classify/mask (Phase 1)."""
from __future__ import annotations

import re


def mask_pii(text: str) -> tuple[str, list[tuple[str, str]]]:
    tokens: list[tuple[str, str]] = []
    masked = text or ""
    patterns = [
        (r"[A-Z][a-z]+ [A-Z][a-z]+", "PII_NAME"),
        (r"\b\d{2}[/-]\d{2}[/-]\d{2,4}\b", "PII_DOB"),
        (r"\b\d{10,12}\b", "PII_ROLL"),
        (r"\b\+?\d{10,13}\b", "PII_PHONE"),
    ]
    idx = 1
    for pat, label in patterns:
        for m in re.finditer(pat, masked):
            tok = f"<<{label}_{idx}>>"
            tokens.append((tok, m.group(0)))
            masked = masked.replace(m.group(0), tok, 1)
            idx += 1
    return masked, tokens
