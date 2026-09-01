from __future__ import annotations

import json
from pathlib import Path


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"seen_ids": [], "last_success_utc": ""}
    with path.open("r", encoding="utf-8") as fh:
        state = json.load(fh)
    state.setdefault("seen_ids", [])
    state.setdefault("last_success_utc", "")
    return state


def update_success_state(path: Path, *, delivered_ids: list[str], completed_at, advance_auto_state: bool) -> None:
    if not advance_auto_state:
        return
    state = load_state(path)
    seen = set(state.get("seen_ids", []))
    seen.update(value for value in delivered_ids if value)
    state["seen_ids"] = sorted(seen)
    state["last_success_utc"] = completed_at.isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)
