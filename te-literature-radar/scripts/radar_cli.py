#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from te_radar.analysis import merge_analysis, validate_analysis
from te_radar.config import load_config
from te_radar.pipeline import fetch_candidates
from te_radar.state import load_state, update_success_state
from te_radar.time_window import resolve_search_window


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def parse_args():
    parser = argparse.ArgumentParser(description="TE Literature Radar")
    sub = parser.add_subparsers(dest="command", required=True)

    fetch = sub.add_parser("fetch")
    fetch.add_argument("--config", default="te-literature-radar.config.json")
    fetch.add_argument("--mode", choices=["auto", "lookback", "range"])
    fetch.add_argument("--lookback-days", type=int)
    fetch.add_argument("--start-date")
    fetch.add_argument("--end-date")
    fetch.add_argument("--advance-auto-state", action="store_true")

    validate = sub.add_parser("validate-analysis")
    validate.add_argument("--fetch", required=True)
    validate.add_argument("--analysis", required=True)

    merge = sub.add_parser("merge-analysis")
    merge.add_argument("--fetch", required=True)
    merge.add_argument("--analysis", required=True)
    merge.add_argument("--output", required=True)

    success = sub.add_parser("mark-success")
    success.add_argument("--config", required=True)
    success.add_argument("--fetch", required=True)
    success.add_argument("--final", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    if args.command == "fetch":
        config = load_config(Path(args.config))
        output_dir = Path(config.get("output_dir", "te-literature-radar-output"))
        state = load_state(output_dir / "state.json")
        window = resolve_search_window(
            config, state, mode=args.mode, lookback_days=args.lookback_days,
            start_date=args.start_date, end_date=args.end_date,
            advance_auto_state=args.advance_auto_state,
        )
        payload = fetch_candidates(config, state, window)
        stamp = payload["generated_at_utc"].replace(":", "").replace("+00:00", "Z")
        path = output_dir / "data" / f"fetch-{stamp}.json"
        write_json(path, payload)
        print(path)
        return

    fetch_payload = read_json(args.fetch)
    analysis_payload = read_json(args.analysis)
    if args.command == "validate-analysis":
        validate_analysis(fetch_payload, analysis_payload)
        print("valid")
        return
    if args.command == "merge-analysis":
        write_json(Path(args.output), merge_analysis(fetch_payload, analysis_payload))
        print(args.output)
        return
    if args.command == "mark-success":
        config = load_config(Path(args.config))
        final_payload = read_json(args.final)
        update_success_state(
            Path(config["output_dir"]) / "state.json",
            delivered_ids=[p["id"] for p in final_payload.get("papers", [])],
            completed_at=dt.datetime.now(dt.timezone.utc),
            advance_auto_state=bool(fetch_payload["search_window"].get("advance_auto_state")),
        )
        print(Path(config["output_dir"]) / "state.json")


if __name__ == "__main__":
    main()
