from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REQUIRED_SCORE_WEIGHTS = {
    "te_relevance": 30,
    "research_quality": 30,
    "novelty": 20,
    "research_fit": 10,
    "recency": 10,
}


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        config = json.load(fh)
    validate_config(config)
    return config


def validate_config(config: dict[str, Any]) -> None:
    search = config.get("search") or {}
    if search.get("mode", "auto") not in {"auto", "lookback", "range"}:
        raise ValueError("search.mode must be auto, lookback, or range")
    if int(search.get("first_run_lookback_days", 7)) <= 0:
        raise ValueError("search.first_run_lookback_days must be positive")
    if int(search.get("overlap_hours", 48)) < 0:
        raise ValueError("search.overlap_hours cannot be negative")

    weights = config.get("score_weights")
    if weights != REQUIRED_SCORE_WEIGHTS:
        raise ValueError(f"score_weights must equal {REQUIRED_SCORE_WEIGHTS}")

    email = config.get("email") or {}
    if email.get("enabled"):
        sender = email.get("from") or email.get("smtp_username")
        recipient = email.get("to")
        if not sender or not recipient:
            raise ValueError("enabled email requires sender and recipient")
