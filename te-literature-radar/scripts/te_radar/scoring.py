from __future__ import annotations

from dataclasses import dataclass
import datetime as dt

from .records import PaperRecord


@dataclass(frozen=True)
class BaseScore:
    te_relevance: int
    research_quality: int
    research_fit: int
    recency: int
    gate_passed: bool
    evidence: list[str]

    @property
    def subtotal(self) -> int:
        return self.te_relevance + self.research_quality + self.research_fit + self.recency


@dataclass(frozen=True)
class ScoreBreakdown:
    te_relevance: int
    research_quality: int
    novelty: int
    research_fit: int
    recency: int

    @property
    def total(self) -> int:
        return self.te_relevance + self.research_quality + self.novelty + self.research_fit + self.recency


def _text(*parts) -> str:
    return " ".join(str(p) for p in parts if p).lower()


def _contains_any(text: str, terms: list[str]) -> list[str]:
    hits = []
    for term in terms:
        term_l = term.lower()
        if term_l and term_l in text:
            hits.append(term)
    return hits


def _distinct_group_hits(title: str, body: str, groups: dict[str, list[str]]):
    title_hits, body_hits = {}, {}
    for name, terms in groups.items():
        t = _contains_any(title, terms)
        b = _contains_any(body, terms)
        if t:
            title_hits[name] = t
        if b:
            body_hits[name] = b
    return title_hits, body_hits


def score_base(paper: PaperRecord, config: dict, *, window_end: dt.datetime) -> BaseScore:
    profile = config.get("research_profile", {})
    title = _text(paper.title)
    body = _text(paper.abstract, " ".join(paper.keywords), " ".join(paper.concepts))
    evidence = []

    primary = ["thermoelectric", "thermoelectricity", "seebeck effect"]
    primary_title = _contains_any(title, primary)
    primary_body = _contains_any(body, primary)

    transport = profile.get("transport", [])
    design = profile.get("design", [])
    data_driven = profile.get("data_driven", [])
    title_transport = _contains_any(title, transport)
    body_transport = _contains_any(body, transport)
    _, group_body = _distinct_group_hits(title, body, {"design": design, "data_driven": data_driven})

    relevance = 0
    if primary_title:
        relevance += 18
        evidence.append("primary TE anchor in title")
    elif primary_body:
        relevance += 12
        evidence.append("primary TE anchor in abstract/concepts")
    if title_transport:
        relevance += 6
        evidence.append("TE transport/performance term in title")
    if body_transport:
        relevance += 3
        evidence.append("TE transport/performance term in abstract/concepts")
    relevance += 2 * len(group_body)
    if group_body:
        evidence.append("TE design/data-driven support")
    relevance = min(30, relevance)

    context_terms = ["thermoelectric", "seebeck", "zt", "power factor"]
    context_hit = bool(_contains_any(title + " " + body, context_terms))
    transport_distinct = len(set(x.lower() for x in title_transport + body_transport))
    gate = bool(primary_title or primary_body or (transport_distinct >= 2 and context_hit))

    adjacent = ["anomalous nernst", "spin caloritronic", "spin-caloritronic"]
    if _contains_any(title + " " + body, adjacent) and not primary_title and transport_distinct < 2:
        gate = False
        evidence.append("adjacent-topic exclusion")

    tier_points = config.get("quality_tier_points", {})
    if paper.peer_review_status == "preprint":
        quality = min(10, int(tier_points.get("preprint", 8)))
    else:
        quality = int(tier_points.get(paper.source_tier, 12 if paper.peer_review_status == "peer_reviewed" else 8))
        if paper.abstract:
            quality += 1
        if (paper.doi or paper.id) and paper.url:
            quality += 1
        quality = min(30, quality)

    fit = 0
    haystack = title + " " + body
    priorities = profile.get("priority_topics", [])
    if _contains_any(title, priorities):
        fit += 3
    elif _contains_any(body, priorities):
        fit += 2
    watched = profile.get("watched_materials", [])
    if _contains_any(haystack, watched):
        fit += 2
    authors = " | ".join(paper.authors).lower()
    for entry in config.get("target_authors", []):
        name = entry if isinstance(entry, str) else entry.get("name", "")
        aliases = [name] if isinstance(entry, str) else [name] + entry.get("aliases", [])
        if any(a.lower() in authors for a in aliases if a):
            fit += 2
            break
    if _contains_any(haystack, design) or _contains_any(haystack, data_driven) or _contains_any(haystack, transport):
        fit += 1
    fit = min(10, fit)

    try:
        paper_date = dt.date.fromisoformat((paper.date or "")[:10])
        days = max(0, (window_end.date() - paper_date).days)
    except ValueError:
        days = 999999
    if days <= 2:
        recency = 10
    elif days <= 7:
        recency = 8
    elif days <= 14:
        recency = 6
    elif days <= 30:
        recency = 4
    elif days <= 90:
        recency = 2
    else:
        recency = 1

    return BaseScore(relevance, quality, fit, recency, gate, evidence)


def classify_grade(score: ScoreBreakdown, *, peer_review_status: str):
    total = score.total
    if peer_review_status == "preprint":
        if total >= 78 and score.te_relevance >= 27 and score.novelty >= 18:
            return "A"
        if total >= 72 and score.te_relevance >= 25 and score.novelty >= 16:
            return "B"
        if total >= 60 and score.te_relevance >= 22 and score.novelty >= 14:
            return "C"
        return None
    if total >= 80 and score.te_relevance >= 24 and (score.research_quality >= 24 or score.novelty >= 18):
        return "A"
    if total >= 65 and score.te_relevance >= 21 and (score.research_quality >= 18 or score.novelty >= 15):
        return "B"
    if total >= 50 and score.te_relevance >= 18:
        return "C"
    return None
