"""JSON-safe result helpers for the PythonGrader Pyodide harness."""

from __future__ import annotations

import traceback
from typing import Any, Optional


MAX_TRACEBACK_CHARS = 8000
MAX_MESSAGE_CHARS = 2000


def truncate(text: Optional[str], limit: int) -> str:
    if not text:
        return ""
    text = str(text)
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n... [truncated]"


def format_exception(exc: BaseException) -> dict[str, str]:
    """Return a sanitized exception payload for the browser."""
    tb = "".join(
        traceback.format_exception(type(exc), exc, exc.__traceback__)
    )
    return {
        "type": type(exc).__name__,
        "message": truncate(str(exc), MAX_MESSAGE_CHARS),
        "traceback": truncate(tb, MAX_TRACEBACK_CHARS),
    }


def safe_str(value: Any, limit: int = MAX_MESSAGE_CHARS) -> str:
    try:
        return truncate("" if value is None else str(value), limit)
    except Exception:
        return "<unprintable>"
