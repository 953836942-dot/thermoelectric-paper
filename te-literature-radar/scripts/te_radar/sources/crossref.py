from __future__ import annotations

import json
import urllib.error
import urllib.parse

from .common import first, http_get, normalize_crossref_date, stable_id, strip_markup
from ..records import PaperRecord, SourceResult


def _item_date(item):
    for field in ["published-online", "published-print", "published", "created"]:
        value = normalize_crossref_date(item.get(field))
        if value:
            return value
    return ""


def fetch_crossref(config, window) -> SourceResult:
    rows = int(config.get("search", {}).get("per_query_rows", 50))
    papers, errors = [], []
    for journal in config.get("target_journals", []):
        for issn in journal.get("issn", []):
            params = {
                "filter": f"issn:{issn},from-pub-date:{window.start.date().isoformat()},until-pub-date:{window.end.date().isoformat()},type:journal-article",
                "sort": "published", "order": "desc", "rows": str(rows),
                "select": "DOI,title,author,published-print,published-online,published,created,container-title,abstract,subject,URL,ISSN",
            }
            url = "https://api.crossref.org/works?" + urllib.parse.urlencode(params)
            try:
                payload = json.loads(http_get(url).decode("utf-8"))
            except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
                errors.append(f"Crossref {journal.get('name', issn)}: {exc}")
                continue
            for item in payload.get("message", {}).get("items", []):
                title = first(item.get("title"))
                doi = item.get("DOI") or ""
                authors = [" ".join(filter(None, [a.get("given", ""), a.get("family", "")])).strip() for a in item.get("author") or []]
                source = first(item.get("container-title")) or journal.get("name", "")
                papers.append(PaperRecord(
                    id=stable_id("doi", doi) if doi else stable_id("crossref", f"{source}|{title}"),
                    title=title, authors=[a for a in authors if a], source=source, source_kind="journal",
                    peer_review_status="peer_reviewed", source_tier=journal.get("tier", "unknown"),
                    date=_item_date(item), doi=doi, url=item.get("URL", ""), abstract=strip_markup(item.get("abstract")),
                    keywords=[str(x) for x in item.get("subject") or []], concepts=[], raw_source="crossref", notes=[]
                ))
    return SourceResult(papers, errors)
