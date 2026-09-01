from __future__ import annotations

import urllib.error
import urllib.parse
import xml.etree.ElementTree as ET

from .common import http_get, stable_id, strip_markup
from ..records import PaperRecord, SourceResult

ATOM = "{http://www.w3.org/2005/Atom}"


def fetch_arxiv(config, window) -> SourceResult:
    cfg = config.get("arxiv", {})
    if not cfg.get("enabled", True):
        return SourceResult([], [])
    rows = int(config.get("search", {}).get("per_query_rows", 50))
    papers, errors = [], []
    for query in cfg.get("queries", []):
        params = {"search_query": f'all:"{query}"', "start": "0", "max_results": str(rows), "sortBy": "submittedDate", "sortOrder": "descending"}
        url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(params)
        try:
            root = ET.fromstring(http_get(url, accept="application/atom+xml, text/xml").decode("utf-8"))
        except (urllib.error.URLError, ET.ParseError, TimeoutError) as exc:
            errors.append(f"arXiv {query}: {exc}")
            continue
        for entry in root.findall(f"{ATOM}entry"):
            published = (entry.findtext(f"{ATOM}published") or "")[:10]
            updated = (entry.findtext(f"{ATOM}updated") or "")[:10]
            date = published or updated
            if date and not (window.start.date().isoformat() <= date <= window.end.date().isoformat()):
                continue
            entry_id = entry.findtext(f"{ATOM}id") or ""
            authors = [a.findtext(f"{ATOM}name") or "" for a in entry.findall(f"{ATOM}author")]
            papers.append(PaperRecord(
                id=stable_id("arxiv", entry_id), title=strip_markup(entry.findtext(f"{ATOM}title")),
                authors=[a for a in authors if a], source="arXiv", source_kind="preprint",
                peer_review_status="preprint", source_tier="preprint", date=date, doi="", url=entry_id,
                abstract=strip_markup(entry.findtext(f"{ATOM}summary")), keywords=[], concepts=[], raw_source="arxiv",
                notes=["Preprint — not peer reviewed"]
            ))
    return SourceResult(papers, errors)
