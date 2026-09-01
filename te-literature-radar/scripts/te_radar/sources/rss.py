from __future__ import annotations

import urllib.error
import xml.etree.ElementTree as ET

from .common import extract_doi, http_get, parse_feed_date, stable_id, strip_markup, within_window
from ..records import PaperRecord, SourceResult


def _child_text(item, suffix):
    for child in item:
        if child.tag.lower().endswith(suffix.lower()):
            return child.text or ""
    return ""


def fetch_rss(config, window) -> SourceResult:
    papers, errors = [], []
    rows = int(config.get("search", {}).get("per_query_rows", 50))
    for feed in config.get("rss_feeds", []):
        url = feed.get("url", "")
        if not url:
            errors.append(f"RSS {feed.get('name', '<unnamed>')}: missing url")
            continue
        try:
            root = ET.fromstring(http_get(url, accept="application/rss+xml, application/atom+xml, text/xml").decode("utf-8"))
        except (urllib.error.URLError, ET.ParseError, TimeoutError) as exc:
            errors.append(f"RSS {feed.get('name', url)}: {exc}")
            continue
        items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
        for item in items[: rows * 2]:
            title = strip_markup(_child_text(item, "title"))
            link = _child_text(item, "link")
            if not link:
                for child in item:
                    if child.tag.lower().endswith("link"):
                        link = child.attrib.get("href", "")
                        if link:
                            break
            raw_date = _child_text(item, "pubDate") or _child_text(item, "published") or _child_text(item, "updated")
            date = parse_feed_date(raw_date)
            if not within_window(date, window):
                continue
            summary = strip_markup(_child_text(item, "description") or _child_text(item, "summary") or _child_text(item, "content"))
            authors = []
            for child in item.iter():
                if child.tag.lower().endswith(("creator", "author", "name")):
                    value = strip_markup(child.text)
                    if value and value not in authors:
                        authors.append(value)
            doi = extract_doi(link + " " + summary)
            status = feed.get("peer_review_status", "peer_reviewed")
            papers.append(PaperRecord(
                id=stable_id("doi", doi) if doi else stable_id("url", link or f"{feed.get('name')}|{title}"),
                title=title, authors=authors, source=feed.get("name", "RSS"), source_kind="rss",
                peer_review_status=status, source_tier=feed.get("tier", "unknown"), date=date, doi=doi, url=link,
                abstract=summary, keywords=[str(x) for x in feed.get("keywords", [])], concepts=[], raw_source="rss", notes=[]
            ))
            if len(papers) >= rows:
                break
    return SourceResult(papers, errors)
