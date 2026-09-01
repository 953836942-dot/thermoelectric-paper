#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def render_markdown(payload: dict) -> str:
    date_label = (payload.get("generated_at_utc") or "")[:10] or "unknown"
    window = payload.get("search_window") or {}
    lines = [f"# TE Literature Radar — {date_label}", "",
             f"Search window: {window.get('start','?')} → {window.get('end','?')} ({window.get('mode','?')})", "",
             f"Candidates: {payload.get('candidate_count',0)} | Fresh: {payload.get('fresh_count',0)} | Delivered: {payload.get('paper_count',len(payload.get('papers',[])))}", ""]
    papers = payload.get("papers") or []
    for grade, title in [("A", "## A — 必看"), ("B", "## B — 值得关注")]:
        lines += [title, ""]
        subset = [p for p in papers if p.get("radar_score",{}).get("grade") == grade]
        if not subset:
            lines += ["None.", ""]
        for i, p in enumerate(subset, 1):
            lines += _render_full(i, p)
    lines += ["## C — 浏览即可", ""]
    c = [p for p in papers if p.get("radar_score",{}).get("grade") == "C"]
    if c:
        lines += ["| Paper | Source | Date | Score | Why it matters |", "| --- | --- | --- | ---: | --- |"]
        for p in c:
            link = p.get("url") or (f"https://doi.org/{p['doi']}" if p.get("doi") else "")
            title = p.get("title","Untitled")
            title = f"[{title}]({link})" if link else title
            lines.append(f"| {title} | {p.get('source','')} | {p.get('date','')} | {p['radar_score']['total']}/100 | {p.get('radar_note','')} |")
        lines.append("")
    else:
        lines += ["None.", ""]
    errors = payload.get("errors") or []
    if errors:
        lines += ["## Source / Fetch Notes", ""] + [f"- {e}" for e in errors] + [""]
    return "\n".join(lines)


def _render_full(index: int, p: dict) -> list[str]:
    score = p["radar_score"]
    summary = p.get("summary") or {}
    link = p.get("url") or (f"https://doi.org/{p['doi']}" if p.get("doi") else "")
    title = p.get("title", "Untitled")
    heading = f"### {index}. [{title}]({link})" if link else f"### {index}. {title}"
    lines = [heading, "", f"- **Source:** {p.get('source','Unknown')} ({p.get('date','Unknown')})"]
    if p.get("peer_review_status") == "preprint":
        lines.append("- **⚠ Preprint — not peer reviewed**")
    lines += [f"- **Score:** TE relevance {score['te_relevance']}/30 | Quality {score['research_quality']}/30 | Novelty {score['novelty']}/20 | Research fit {score['research_fit']}/10 | Recency {score['recency']}/10 | **Total {score['total']}/100**", "",
              f"**目的**：{summary.get('purpose','')}", "", f"**创新**：{summary.get('innovation','')}", "",
              f"**如何解决**：{summary.get('approach','')}", "", "**效果**："]
    results = summary.get("results") or []
    lines += [f"- {r}" for r in results] if results else ["- Available metadata does not provide an exact result value."]
    lines += ["", f"**机制**：{summary.get('mechanism','')}", "", f"**意义**：{summary.get('significance','')}", "", "**局限/注意**："]
    limitations = summary.get("limitations") or []
    lines += [f"- {x}" for x in limitations] if limitations else ["- No specific limitation was stated in the supplied metadata."]
    lines += ["", f"**Radar 判断**：{p.get('radar_note','')}", ""]
    return lines


def main():
    p = argparse.ArgumentParser()
    p.add_argument("data"); p.add_argument("--output")
    args = p.parse_args()
    payload = json.loads(Path(args.data).read_text(encoding="utf-8"))
    output = Path(args.output) if args.output else Path(args.data).with_suffix(".md")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_markdown(payload), encoding="utf-8")
    print(output)

if __name__ == "__main__": main()
