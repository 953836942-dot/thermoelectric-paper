from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class PaperRecord:
    id: str
    title: str
    authors: list[str]
    source: str
    source_kind: str
    peer_review_status: str
    source_tier: str
    date: str
    doi: str
    url: str
    abstract: str
    keywords: list[str]
    concepts: list[str]
    raw_source: str
    notes: list[str] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


@dataclass
class SourceResult:
    papers: list[PaperRecord]
    errors: list[str]
