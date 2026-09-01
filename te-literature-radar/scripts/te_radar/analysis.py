from __future__ import annotations

import copy
import re
from typing import Any

from .scoring import ScoreBreakdown, classify_grade

ALLOWED_NOVELTY_TYPES = {
    "new material", "new dopant/alloy design", "new mechanism", "new performance regime",
    "new experimental method", "new theory", "new ML/AI method",
    "new dataset/screening strategy", "incremental variant",
}
REQUIRED_SUMMARY_FIELDS = {"purpose", "innovation", "approach", "results", "mechanism", "significance", "limitations"}
_NUM_RE = re.compile(r"(?<![A-Za-z])[-+]?\d+(?:\.\d+)?(?:\s*(?:%|K|°C|C|W\s*m-?1\s*K-?1|W/mK|mW|µW|uW|S/cm|S/m|V/K|µV/K|uV/K))?", re.I)


def _normalize_number(token: str) -> str:
    token = token.replace("µ", "u").replace("°", "")
    return re.sub(r"\s+", "", token).lower()


def _numbers(text: str) -> set[str]:
    return {_normalize_number(m.group(0)) for m in _NUM_RE.finditer(text or "")}


def _source_evidence(paper: dict[str, Any]) -> str:
    return " ".join(str(paper.get(k, "")) for k in ["title", "abstract", "date", "source", "doi"])


def build_analysis_request(papers_with_base_scores: list[dict], *, limit: int) -> dict:
    papers = []
    for paper in papers_with_base_scores[:limit]:
        papers.append({k: copy.deepcopy(paper.get(k)) for k in [
            "id", "title", "authors", "source", "date", "doi", "url", "abstract",
            "keywords", "concepts", "peer_review_status", "base_score"
        ]})
    return {"evidence_basis": "title_abstract_metadata", "papers": papers,
            "instructions": "Assess novelty and summarize only from supplied evidence. Do not invent numerical results."}


def _analysis_text(entry: dict[str, Any]) -> str:
    summary = entry["summary"]
    parts = [entry["novelty"].get("reason", ""), entry.get("radar_note", "")]
    for key in ["purpose", "innovation", "approach", "mechanism", "significance"]:
        parts.append(summary.get(key, ""))
    parts.extend(summary.get("results") or [])
    parts.extend(summary.get("limitations") or [])
    return " ".join(str(x) for x in parts if x)


def validate_analysis(fetch_payload: dict, analysis_payload: dict) -> dict:
    candidates = {p["id"]: p for p in fetch_payload.get("analysis_candidates", [])}
    entries = analysis_payload.get("papers")
    if not isinstance(entries, list):
        raise ValueError("analysis.papers must be a list")
    seen = set()
    for entry in entries:
        pid = entry.get("id")
        if pid not in candidates:
            raise ValueError(f"analysis paper not in fetch candidates: {pid}")
        if pid in seen:
            raise ValueError(f"duplicate analysis id: {pid}")
        seen.add(pid)
        novelty = entry.get("novelty") or {}
        score = novelty.get("score")
        if not isinstance(score, int) or not 0 <= score <= 20:
            raise ValueError(f"novelty score out of range for {pid}")
        if any(t not in ALLOWED_NOVELTY_TYPES for t in novelty.get("types") or []):
            raise ValueError(f"unsupported novelty type for {pid}")
        if novelty.get("evidence_basis") != "title_abstract_metadata":
            raise ValueError(f"invalid evidence_basis for {pid}")
        summary = entry.get("summary") or {}
        missing = REQUIRED_SUMMARY_FIELDS - set(summary)
        if missing:
            raise ValueError(f"missing summary fields for {pid}: {sorted(missing)}")
        if not isinstance(summary.get("results"), list) or not isinstance(summary.get("limitations"), list):
            raise ValueError(f"results/limitations must be lists for {pid}")
        unsupported = sorted(_numbers(_analysis_text(entry)) - _numbers(_source_evidence(candidates[pid])))
        if unsupported:
            raise ValueError(f"unsupported numerical claim for {pid}: {unsupported[0]}")
    missing_entries = set(candidates) - seen
    if missing_entries:
        raise ValueError(f"missing analysis for candidates: {sorted(missing_entries)}")
    return analysis_payload


def merge_analysis(fetch_payload: dict, analysis_payload: dict) -> dict:
    validate_analysis(fetch_payload, analysis_payload)
    analyses = {p["id"]: p for p in analysis_payload["papers"]}
    merged = copy.deepcopy(fetch_payload)
    final_papers = []
    for paper in merged.get("analysis_candidates", []):
        entry = analyses[paper["id"]]
        base = paper["base_score"]
        breakdown = ScoreBreakdown(int(base["te_relevance"]), int(base["research_quality"]), int(entry["novelty"]["score"]), int(base["research_fit"]), int(base["recency"]))
        grade = classify_grade(breakdown, peer_review_status=paper.get("peer_review_status", "unknown"))
        if not grade:
            continue
        combined = copy.deepcopy(paper)
        combined["novelty"] = copy.deepcopy(entry["novelty"])
        combined["summary"] = copy.deepcopy(entry["summary"])
        combined["radar_note"] = entry.get("radar_note", "")
        combined["radar_score"] = {"te_relevance": breakdown.te_relevance, "research_quality": breakdown.research_quality,
                                   "novelty": breakdown.novelty, "research_fit": breakdown.research_fit,
                                   "recency": breakdown.recency, "total": breakdown.total, "grade": grade}
        final_papers.append(combined)
    final_papers.sort(key=lambda p: ("ABC".index(p["radar_score"]["grade"]), -p["radar_score"]["total"], p.get("date", "")))
    merged["papers"] = final_papers
    merged["paper_count"] = len(final_papers)
    return merged
