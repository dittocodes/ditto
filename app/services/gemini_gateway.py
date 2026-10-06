"""Insight model gateway with primary key, backoff, secondary key, and model failover."""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

from app.services.vendor_scrub import scrub_vendor_names

load_dotenv()
logger = logging.getLogger(__name__)

# Start on Gemini 2.5 Flash. If that call fails, try smaller Flash models that this key can use.
_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
)


def _configure(key: str | None) -> None:
    if key:
        genai.configure(api_key=key)


def _model_candidates(tier: str = "lite") -> list[str]:
    del tier
    return list(_MODELS)


def _call_with_timeout(fn, timeout_s: float):
    import threading

    box: dict[str, str] = {}
    err: dict[str, Exception] = {}

    def target() -> None:
        try:
            box["text"] = fn()
        except Exception as exc:
            err["e"] = exc

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout_s)
    if thread.is_alive():
        raise TimeoutError(f"Insight request timed out after {timeout_s}s")
    if "e" in err:
        raise err["e"]
    return box.get("text", "")


def _invoke(parts: Any, *, json_mode: bool = False, tier: str = "lite", max_output_tokens: int | None = None) -> str:
    from app.services.gemini_budget import assert_budget, record_usage

    assert_budget(estimated_tokens=800)
    primary = os.getenv("GEMINI_API_KEY")
    secondary = os.getenv("GEMINI_API_KEY_SECONDARY")
    last_err: Exception | None = None
    timeout_s = float(os.getenv("INSIGHT_REQUEST_TIMEOUT_SECONDS", "25"))

    def _call(model_name: str, key: str) -> str:
        _configure(key)
        model = genai.GenerativeModel(model_name)
        cfg: dict[str, Any] = {}
        if json_mode:
            cfg["response_mime_type"] = "application/json"
        if max_output_tokens:
            cfg["max_output_tokens"] = int(max_output_tokens)
        resp = model.generate_content(parts, generation_config=cfg or None)
        return (resp.text or "").strip()

    for key in [primary, secondary]:
        if not key:
            continue
        using_secondary = key == secondary and key != primary
        skip_key = False
        for model_name in _model_candidates(tier):
            for attempt in range(2):
                try:
                    text = _call_with_timeout(lambda m=model_name, k=key: _call(m, k), timeout_s)
                except TimeoutError as e:
                    last_err = e
                    break
                except Exception as e:
                    last_err = e
                    msg = str(e).lower()
                    if "403" in msg or "denied access" in msg or "permission" in msg:
                        skip_key = True
                        break
                    if "429" in msg or "quota" in msg or "resource exhausted" in msg:
                        break
                    if "404" in msg or "no longer available" in msg or "not found" in msg:
                        break
                    time.sleep(0.4 * (attempt + 1))
                    continue
                if text:
                    if using_secondary:
                        logger.warning("Insight request served via secondary API key")
                    if model_name != _MODELS[0]:
                        logger.warning("Insight request used a fallback model")
                    logger.info("Insight request served (%s)", tier)
                    record_usage(max(1, len(text) // 4))
                    return text
            if skip_key:
                break
    if last_err:
        raise RuntimeError(scrub_vendor_names(str(last_err))) from last_err
    raise RuntimeError("Insight service is not configured")


def _plain(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    items = getattr(value, "items", None)
    if callable(items):
        try:
            return {str(key): _plain(item) for key, item in value.items()}
        except Exception:
            pass
    return str(value)


def _read_model_turn(resp: Any) -> dict[str, Any]:
    candidates = getattr(resp, "candidates", None) or []
    if not candidates:
        return {"kind": "text", "text": (getattr(resp, "text", None) or "").strip()}
    content = getattr(candidates[0], "content", None)
    parts = getattr(content, "parts", None) or []
    texts: list[str] = []
    for part in parts:
        call = getattr(part, "function_call", None)
        name = str(getattr(call, "name", "") or "").strip() if call else ""
        if name:
            return {"kind": "call", "name": name, "args": _plain(getattr(call, "args", None) or {})}
        text = getattr(part, "text", None)
        if text:
            texts.append(str(text))
    return {"kind": "text", "text": "".join(texts).strip()}


def generate_with_tools(prompt: str, tools: list[dict], *, tier: str = "lite") -> dict[str, Any]:
    """Return text, or one function call. If tools are rejected, fall back to plain text."""
    from app.services.gemini_budget import assert_budget, record_usage

    if not tools:
        return {"kind": "text", "text": generate_text(prompt, tier=tier)}
    assert_budget(estimated_tokens=800)
    primary = os.getenv("GEMINI_API_KEY")
    secondary = os.getenv("GEMINI_API_KEY_SECONDARY")
    last_err: Exception | None = None
    timeout_s = float(os.getenv("INSIGHT_REQUEST_TIMEOUT_SECONDS", "25"))
    wrapped = [{"function_declarations": tools}]

    def _call(model_name: str, key: str) -> dict[str, Any]:
        _configure(key)
        model = genai.GenerativeModel(model_name, tools=wrapped)
        resp = model.generate_content(prompt)
        return _read_model_turn(resp)

    for key in [primary, secondary]:
        if not key:
            continue
        skip_key = False
        for model_name in _model_candidates(tier):
            try:
                turn = _call_with_timeout(lambda m=model_name, k=key: _call(m, k), timeout_s)
            except TimeoutError as exc:
                last_err = exc
                break
            except Exception as exc:
                last_err = exc
                msg = str(exc).lower()
                if "403" in msg or "denied access" in msg or "permission" in msg:
                    skip_key = True
                    break
                if any(token in msg for token in ("404", "not found", "invalid", "tool", "function")):
                    continue
                continue
            if not isinstance(turn, dict):
                continue
            if turn.get("kind") == "call" or str(turn.get("text") or "").strip():
                if model_name != _MODELS[0]:
                    logger.warning("Insight request used a fallback model")
                record_usage(max(1, len(json.dumps(turn)) // 4))
                return turn
        if skip_key:
            break
    try:
        return {"kind": "text", "text": generate_text(prompt, tier=tier)}
    except Exception:
        if last_err:
            raise RuntimeError(scrub_vendor_names(str(last_err))) from last_err
        raise


def generate_text(prompt: str, *, json_mode: bool = False, tier: str = "lite", max_output_tokens: int | None = None) -> str:
    return _invoke(prompt, json_mode=json_mode, tier=tier, max_output_tokens=max_output_tokens)


def generate_text_stream(prompt: str, *, tier: str = "lite"):
    """Yield reply text as the model produces it. Failover matches generate_text."""
    from app.services.gemini_budget import assert_budget, record_usage

    assert_budget(estimated_tokens=800)
    primary = os.getenv("GEMINI_API_KEY")
    secondary = os.getenv("GEMINI_API_KEY_SECONDARY")
    last_err: Exception | None = None

    for key in [primary, secondary]:
        if not key:
            continue
        skip_key = False
        for model_name in _model_candidates(tier):
            try:
                _configure(key)
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt, stream=True)
                pieces: list[str] = []
                for chunk in response:
                    text = (getattr(chunk, "text", None) or "").strip("\x00")
                    if not text:
                        continue
                    pieces.append(text)
                    yield text
                if pieces:
                    if model_name != _MODELS[0]:
                        logger.warning("Insight request used a fallback model")
                    logger.info("Insight request served (%s)", tier)
                    record_usage(max(1, sum(len(p) for p in pieces) // 4))
                    return
            except Exception as e:
                last_err = e
                msg = str(e).lower()
                if "403" in msg or "denied access" in msg or "permission" in msg:
                    skip_key = True
                    break
                continue
        if skip_key:
            break
    if last_err:
        raise RuntimeError(scrub_vendor_names(str(last_err))) from last_err
    raise RuntimeError("Insight service is not configured")


def generate_from_document(prompt: str, data: bytes, mime: str, *, json_mode: bool = False, tier: str = "lite") -> str:
    mime = (mime or "application/octet-stream").split(";")[0].strip().lower()
    if mime == "image/jpg":
        mime = "image/jpeg"
    return _invoke([prompt, {"mime_type": mime, "data": data}], json_mode=json_mode, tier=tier)


def generate_json(prompt: str, *, tier: str = "lite", max_output_tokens: int | None = None) -> dict[str, Any]:
    raw = generate_text(prompt, json_mode=True, tier=tier, max_output_tokens=max_output_tokens)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            return json.loads(raw[start : end + 1])
        raise
