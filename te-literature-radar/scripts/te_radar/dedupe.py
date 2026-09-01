from __future__ import annotations

import re
from dataclasses import replace

from .records import PaperRecord


def normalize_doi(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", value)
    return value.rstrip(" .")


def _norm_text(value: str) -> str:
    value = re.sub(r"[^a-z0-9 ]+", " ", (value or "").lower())
    return re.sub(r"\s+", " ", value).strip()


def paper_identity(paper: PaperRecord) -> str:
    doi = normalize_doi(paper.doi)
    if doi:
        return f"doi:{doi}"
    if paper.id and ":" in paper.id:
        return paper.id.strip().lower()
    first_author = _norm_text(paper.authors[0]) if paper.authors else ""
    return f"title:{_norm_text(paper.title)}|{first_author}"


def _richer_text(left: str, right: str) -> str:
    return right if len((right or "").strip()) > len((left or "").strip()) else left


def _merge(left: PaperRecord, right: PaperRecord) -> PaperRecord:
    doi = normalize_doi(left.doi or right.doi)
    ids = [value for value in [paper_identity(left), paper_identity(right)] if value]
    notes = list(dict.fromkeys(left.notes + right.notes))
    if left.source != right.source:
        notes.append("Possible duplicate or multi-source record.")
    source = " / ".join(dict.fromkeys([s for s in [left.source, right.source] if s]))
    return replace(
        left,
        id=f"doi:{doi}" if doi else ids[0],
        source=source or left.source,
        doi=doi,
        url=left.url or right.url,
        date=left.date or right.date,
        abstract=_richer_text(left.abstract, right.abstract),
        keywords=list(dict.fromkeys(left.keywords + right.keywords)),
        concepts=list(dict.fromkeys(left.concepts + right.concepts)),
        notes=list(dict.fromkeys(notes)),
    )


def dedupe_records(papers: list[PaperRecord]) -> list[PaperRecord]:
    by_key: dict[str, PaperRecord] = {}
    aliases: dict[str, str] = {}
    for paper in papers:
        doi_key = f"doi:{normalize_doi(paper.doi)}" if normalize_doi(paper.doi) else ""
        fallback = f"title:{_norm_text(paper.title)}|{_norm_text(paper.authors[0]) if paper.authors else ''}"
        key = aliases.get(doi_key) or aliases.get(fallback) or doi_key or fallback
        if key in by_key:
            merged = _merge(by_key[key], paper)
            by_key[key] = merged
            final = paper_identity(merged)
            aliases[fallback] = key
            if doi_key:
                aliases[doi_key] = key
            aliases[final] = key
        else:
            by_key[key] = paper
            aliases[fallback] = key
            if doi_key:
                aliases[doi_key] = key
    return list(by_key.values())
