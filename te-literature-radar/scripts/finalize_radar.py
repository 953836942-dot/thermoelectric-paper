#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from render_digest import render_markdown
from send_digest import build_message, load_smtp_password, markdown_to_html, send_message
from te_radar.analysis import merge_analysis, validate_analysis
from te_radar.config import load_config
from te_radar.state import update_success_state


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def finalize(config: dict, fetch_payload: dict, analysis_payload: dict, *, output_dir: Path, send_func=send_message, password_loader=load_smtp_password) -> dict:
    validate_analysis(fetch_payload, analysis_payload)
    final_payload = merge_analysis(fetch_payload, analysis_payload)
    date_label = (fetch_payload.get("generated_at_utc") or dt.datetime.now(dt.timezone.utc).isoformat())[:10]
    final_json = output_dir / "final" / f"{date_label}.json"
    digest_path = output_dir / f"{date_label}.md"

    final_text = json.dumps(final_payload, ensure_ascii=False, indent=2) + "\n"
    digest_text = render_markdown(final_payload)
    final_json.parent.mkdir(parents=True, exist_ok=True)
    digest_path.parent.mkdir(parents=True, exist_ok=True)
    final_json.write_text(final_text, encoding="utf-8")
    digest_path.write_text(digest_text, encoding="utf-8")

    email_config = config.get("email") or {}
    sent = False
    if email_config.get("enabled"):
        message = build_message(email_config, f"TE Literature Radar - {date_label}", digest_text, markdown_to_html(digest_text))
        password = password_loader(email_config, Path(config.get("_config_dir", ".")))
        send_func(email_config, message, password)
        sent = True

    advance = bool((fetch_payload.get("search_window") or {}).get("advance_auto_state"))
    update_success_state(
        output_dir / "state.json",
        delivered_ids=[p["id"] for p in final_payload.get("papers", [])],
        completed_at=dt.datetime.now(dt.timezone.utc),
        advance_auto_state=advance,
    )
    return {"final_json": str(final_json), "digest": str(digest_path), "sent": sent, "marked_success": advance, "paper_count": len(final_payload.get("papers", []))}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--config", required=True); p.add_argument("--fetch", required=True); p.add_argument("--analysis", required=True)
    args = p.parse_args()
    config_path = Path(args.config)
    config = load_config(config_path); config["_config_dir"] = str(config_path.parent)
    fetch_payload = json.loads(Path(args.fetch).read_text(encoding="utf-8"))
    analysis_payload = json.loads(Path(args.analysis).read_text(encoding="utf-8"))
    result = finalize(config, fetch_payload, analysis_payload, output_dir=Path(config.get("output_dir", "te-literature-radar-output")))
    for key, value in result.items(): print(f"{key}={value}")

if __name__ == "__main__": main()
