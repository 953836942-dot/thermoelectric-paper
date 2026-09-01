from __future__ import annotations

import datetime as dt

from .dedupe import dedupe_records, paper_identity
from .scoring import score_base
from .sources.arxiv import fetch_arxiv
from .sources.crossref import fetch_crossref
from .sources.openalex import fetch_openalex
from .sources.rss import fetch_rss

DEFAULT_FETCHERS = [fetch_crossref, fetch_openalex, fetch_arxiv, fetch_rss]


def fetch_candidates(config, state, window, *, source_fetchers=None) -> dict:
    all_papers, errors = [], []
    for fetcher in source_fetchers or DEFAULT_FETCHERS:
        result = fetcher(config, window)
        all_papers.extend(result.papers)
        errors.extend(result.errors)
    deduped = dedupe_records(all_papers)
    seen = set(state.get("seen_ids", [])) if window.mode == "auto" else set()
    fresh = [p for p in deduped if paper_identity(p) not in seen]
    gated = []
    for paper in fresh:
        base = score_base(paper, config, window_end=window.end)
        if not base.gate_passed:
            continue
        item = paper.to_dict()
        item["id"] = paper_identity(paper)
        item["base_score"] = {
            "te_relevance": base.te_relevance,
            "research_quality": base.research_quality,
            "research_fit": base.research_fit,
            "recency": base.recency,
            "subtotal": base.subtotal,
            "evidence": base.evidence,
        }
        gated.append(item)
    gated.sort(key=lambda p: (p["base_score"]["subtotal"], p.get("date", "")), reverse=True)
    limit = int(config.get("search", {}).get("analysis_candidate_limit", 30))
    return {
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "search_window": {"mode": window.mode, "start": window.start.isoformat(), "end": window.end.isoformat(), "advance_auto_state": window.advance_auto_state},
        "candidate_count": len(all_papers),
        "deduped_count": len(deduped),
        "fresh_count": len(fresh),
        "gated_count": len(gated),
        "analysis_candidates": gated[:limit],
        "errors": errors,
    }
