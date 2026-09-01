from __future__ import annotations

import datetime as dt
import email.utils
import html
import re
import urllib.request
from typing import Any

USER_AGENT = "te-literature-radar/0.1"


def http_get(url: str, *, accept: str = "application/json", timeout: int = 30) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def strip_markup(value: str | None) -> str:
    if not value:
        return ""
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def first(value: Any) -> str:
    if isinstance(value, list) and value:
        return str(value[0])
    return value if isinstance(value, str) else ""


def normalize_crossref_date(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        return value[:10]
    if isinstance(value, dict):
        parts = value.get("date-parts") or []
        if parts and parts[0]:
            nums = list(parts[0]) + [1, 1]
            try:
                return dt.date(int(nums[0]), int(nums[1]), int(nums[2])).isoformat()
            except ValueError:
                return ""
    return ""


def parse_feed_date(value: str | None) -> str:
    if not value:
        return ""
    try:
        parsed = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return value[:10]
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc).date().isoformat()


def within_window(date_str: str, window) -> bool:
    if not date_str:
        return True
    try:
        day = dt.date.fromisoformat(date_str[:10])
    except ValueError:
        return True
    return window.start.date() <= day <= window.end.date()


def extract_doi(text: str) -> str:
    match = re.search(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+\b", text or "", re.I)
    return match.group(0).rstrip(".") if match else ""


def stable_id(prefix: str, value: str) -> str:
    normalized = re.sub(r"\s+", " ", value or "").strip().lower()
    return f"{prefix}:{normalized}"
