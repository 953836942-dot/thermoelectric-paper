from __future__ import annotations

import json
import urllib.error
import urllib.parse

from .common import http_get, stable_id
from ..records import PaperRecord, SourceResult


def _abstract(index):
    if not index:
        return ""
    positions = []
    for token, idxs in index.items():
        for pos in idxs:
            positions.append((int(pos), token))
    return " ".join(token for _, token in sorted(positions))


def fetch_openalex(config, window) -> SourceResult:
    cfg = config.get("openalex", {})
    if not cfg.get("enabled", True):
        return SourceResult([], [])
    rows = min(int(config.get("search", {}).get("per_query_rows", 50)), 200)
    papers, errors = [], []
    configured_tiers = {str(j.get("name", "")).strip().lower(): j.get("tier", "unknown") for j in config.get("target_journals", []) if j.get("name")}
    for query in cfg.get("queries", []):
        cursor = "*"
        remaining = rows
        while cursor and remaining > 0:
            params = {
                "search": query,
                "filter": f"from_publication_date:{window.start.date().isoformat()},to_publication_date:{window.end.date().isoformat()}",
                "per-page": str(min(remaining, 200)),
                "cursor": cursor,
            }
            if cfg.get("mailto"):
                params["mailto"] = cfg["mailto"]
            url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
            try:
                payload = json.loads(http_get(url).decode("utf-8"))
            except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
                errors.append(f"OpenAlex {query}: {exc}")
                break
            results = payload.get("results") or []
            for item in results:
                location = item.get("primary_location") or {}
                source_obj = location.get("source") or {}
                source = source_obj.get("display_name") or "OpenAlex"
                doi = (item.get("doi") or "").replace("https://doi.org/", "")
                work_type = (item.get("type") or "").lower()
                host_type = (source_obj.get("type") or "").lower()
                if "preprint" in host_type or "repository" in host_type:
                    status, tier = "preprint", "preprint"
                elif work_type in {"article", "journal-article"} or source_obj:
                    status = "peer_reviewed"
                    tier = configured_tiers.get(source.strip().lower(), "unknown")
                else:
                    status, tier = "unknown", "unknown"
                papers.append(PaperRecord(
                    id=stable_id("doi", doi) if doi else stable_id("openalex", item.get("id", "")),
                    title=item.get("title") or "",
                    authors=[a.get("author", {}).get("display_name", "") for a in item.get("authorships") or [] if a.get("author", {}).get("display_name")],
                    source=source, source_kind="journal" if status == "peer_reviewed" else "openalex",
                    peer_review_status=status, source_tier=tier, date=item.get("publication_date") or "",
                    doi=doi, url=location.get("landing_page_url") or item.get("id", ""),
                    abstract=_abstract(item.get("abstract_inverted_index")), keywords=[],
                    concepts=[c.get("display_name", "") for c in item.get("concepts") or [] if c.get("display_name")],
                    raw_source="openalex", notes=["Preprint — not peer reviewed"] if status == "preprint" else []
                ))
            remaining -= len(results)
            cursor = (payload.get("meta") or {}).get("next_cursor")
            if not results:
                break
    return SourceResult(papers, errors)
