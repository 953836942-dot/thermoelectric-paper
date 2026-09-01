# TE Literature Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `te-literature-radar` Codex Skill that discovers thermoelectric literature from Crossref, OpenAlex, arXiv, and RSS; supports `auto`/`lookback`/`range` time windows; performs deterministic TE/quality/research-fit/recency scoring; asks Codex to judge novelty and summarize evidence; classifies A/B/C; and renders/sends a weekly digest without altering the existing PaperEcho production workflow.

**Architecture:** Keep the lightweight standard-library approach of `lishn6/daily-econ-literature-radar`, but split the previous monolithic fetch/rank script into focused modules. Source adapters normalize into one `PaperRecord`; deterministic code owns time windows, dedupe, TE relevance, quality, research fit, recency, final score, grade, rendering, state, and SMTP. Codex owns only evidence-bounded novelty and scientific-summary fields through a strict JSON analysis contract that is validated before output.

**Tech Stack:** Python 3.11+ standard library (`urllib`, `xml.etree.ElementTree`, `json`, `dataclasses`, `unittest`, `smtplib`); Codex Skill files (`SKILL.md`, `agents/openai.yaml`); JSON configuration/state; Markdown + HTML email. No paid API, database, vector store, Zotero integration, or third-party Python dependency in V1.

**Spec:** `docs/superpowers/specs/2026-09-01-te-literature-radar-design.md`

## Global Constraints

- Develop only on `feature/te-literature-radar`; do not delete or alter the existing PaperEcho production workflow during V1.
- Skill name is exactly `te-literature-radar`.
- V1 sources are Crossref, OpenAlex, arXiv/preprint, and configurable RSS/Atom.
- Search-window modes are exactly `auto`, `lookback`, and `range`.
- `auto` uses the previous successful run with a default 48-hour overlap; first run defaults to 7 days.
- Manual `lookback` and `range` runs do not mutate recurring auto state unless explicitly requested.
- Score weights are exactly: TE relevance 30, research quality 30, novelty 20, research fit 10, recency 10.
- A/B/C is computed deterministically from the five scores; Codex does not directly assign the final grade.
- Normal push quality target is approximately Advanced Functional Materials level or above, but lower-tier work may enter on unusually high novelty and TE relevance.
- Preprints are permitted only under the stricter policy and must display `Preprint — not peer reviewed`.
- No numerical result may appear in generated analysis unless the number exists in the supplied source evidence.
- If only title/abstract/metadata are available, the report must say that novelty judgment is based on title/abstract/metadata rather than full text.
- External network, SMTP, and Codex/LLM behavior must be mocked in automated tests.
- V1 remains Python-standard-library only.

---

## Target File Structure

```text
te-literature-radar.config.example.json
te-literature-radar/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── scoring-policy.md
│   ├── analysis-contract.md
│   └── source-policy.md
└── scripts/
    ├── radar_cli.py
    ├── render_digest.py
    ├── send_digest.py
    ├── finalize_radar.py
    └── te_radar/
        ├── __init__.py
        ├── config.py
        ├── time_window.py
        ├── records.py
        ├── state.py
        ├── dedupe.py
        ├── scoring.py
        ├── analysis.py
        ├── pipeline.py
        └── sources/
            ├── __init__.py
            ├── common.py
            ├── crossref.py
            ├── openalex.py
            ├── arxiv.py
            └── rss.py
tests/
└── te_literature_radar/
    ├── __init__.py
    ├── helpers.py
    ├── test_time_window.py
    ├── test_dedupe_state.py
    ├── test_sources.py
    ├── test_scoring.py
    ├── test_analysis.py
    ├── test_render_email.py
    └── test_pipeline.py
```

`te-literature-radar/scripts/te_radar/` is the importable implementation package. Thin CLI scripts remain at `scripts/` so Codex and schedulers have stable commands to call.

---

### Task 1: Create the Skill skeleton, config schema, and time-window engine

**Files:**
- Create: `te-literature-radar.config.example.json`
- Create: `te-literature-radar/scripts/te_radar/__init__.py`
- Create: `te-literature-radar/scripts/te_radar/config.py`
- Create: `te-literature-radar/scripts/te_radar/time_window.py`
- Create: `tests/te_literature_radar/__init__.py`
- Create: `tests/te_literature_radar/helpers.py`
- Create: `tests/te_literature_radar/test_time_window.py`

**Interfaces:**
- Produces: `load_config(path: Path) -> dict[str, Any]`
- Produces: `validate_config(config: dict[str, Any]) -> None`
- Produces: `SearchWindow(mode: str, start: datetime, end: datetime, advance_auto_state: bool)`
- Produces: `resolve_search_window(config, state, *, mode=None, lookback_days=None, start_date=None, end_date=None, now=None, advance_auto_state=False) -> SearchWindow`
- Later tasks consume `SearchWindow` for every source query and state decision.

- [ ] **Step 1: Write failing tests for `auto`, `lookback`, `range`, overlap, and invalid combinations**

```python
# tests/te_literature_radar/test_time_window.py
import datetime as dt
import unittest

from helpers import import_te_radar

te_radar = import_te_radar()
from te_radar.time_window import resolve_search_window

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 9, 1, 22, 0, tzinfo=UTC)

class SearchWindowTests(unittest.TestCase):
    def test_auto_uses_48_hour_overlap(self):
        config = {"search": {"first_run_lookback_days": 7, "overlap_hours": 48}}
        state = {"last_success_utc": "2026-08-25T22:00:00+00:00"}
        window = resolve_search_window(config, state, mode="auto", now=NOW)
        self.assertEqual(window.start, dt.datetime(2026, 8, 23, 22, 0, tzinfo=UTC))
        self.assertEqual(window.end, NOW)
        self.assertTrue(window.advance_auto_state)

    def test_auto_first_run_uses_seven_days(self):
        config = {"search": {"first_run_lookback_days": 7, "overlap_hours": 48}}
        window = resolve_search_window(config, {}, mode="auto", now=NOW)
        self.assertEqual(window.start, NOW - dt.timedelta(days=7))

    def test_lookback_does_not_advance_state_by_default(self):
        window = resolve_search_window({}, {}, mode="lookback", lookback_days=30, now=NOW)
        self.assertEqual(window.start, NOW - dt.timedelta(days=30))
        self.assertFalse(window.advance_auto_state)

    def test_range_uses_explicit_dates(self):
        window = resolve_search_window(
            {}, {}, mode="range", start_date="2026-01-01", end_date="2026-06-30", now=NOW
        )
        self.assertEqual(window.start.date().isoformat(), "2026-01-01")
        self.assertEqual(window.end.date().isoformat(), "2026-06-30")
        self.assertFalse(window.advance_auto_state)

    def test_range_rejects_reverse_dates(self):
        with self.assertRaises(ValueError):
            resolve_search_window({}, {}, mode="range", start_date="2026-06-30", end_date="2026-01-01", now=NOW)

    def test_lookback_rejects_range_arguments(self):
        with self.assertRaises(ValueError):
            resolve_search_window({}, {}, mode="lookback", lookback_days=7, start_date="2026-01-01", now=NOW)
```

- [ ] **Step 2: Run the tests and verify they fail because the package does not exist**

Run:

```bash
python3 -m unittest tests.te_literature_radar.test_time_window -v
```

Expected: import/module failure for `te_radar.time_window`.

- [ ] **Step 3: Implement `SearchWindow` and strict mode validation**

```python
# te-literature-radar/scripts/te_radar/time_window.py
from dataclasses import dataclass
import datetime as dt

UTC = dt.timezone.utc

@dataclass(frozen=True)
class SearchWindow:
    mode: str
    start: dt.datetime
    end: dt.datetime
    advance_auto_state: bool


def resolve_search_window(config, state, *, mode=None, lookback_days=None,
                          start_date=None, end_date=None, now=None,
                          advance_auto_state=False):
    now = now or dt.datetime.now(UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    search = config.get("search", {})
    mode = mode or search.get("mode", "auto")
    if mode == "auto":
        if any(value is not None for value in [lookback_days, start_date, end_date]):
            raise ValueError("auto mode cannot use lookback/range arguments")
        last = state.get("last_success_utc")
        if last:
            boundary = dt.datetime.fromisoformat(last)
            if boundary.tzinfo is None:
                boundary = boundary.replace(tzinfo=UTC)
            start = boundary.astimezone(UTC) - dt.timedelta(hours=int(search.get("overlap_hours", 48)))
        else:
            start = now - dt.timedelta(days=int(search.get("first_run_lookback_days", 7)))
        return SearchWindow("auto", start, now, True)
    if mode == "lookback":
        if start_date is not None or end_date is not None:
            raise ValueError("lookback mode cannot use range dates")
        days = int(lookback_days if lookback_days is not None else search.get("lookback_days", 7))
        if days <= 0:
            raise ValueError("lookback_days must be positive")
        return SearchWindow("lookback", now - dt.timedelta(days=days), now, bool(advance_auto_state))
    if mode == "range":
        if lookback_days is not None or not start_date or not end_date:
            raise ValueError("range mode requires start_date and end_date only")
        start = dt.datetime.fromisoformat(start_date).replace(tzinfo=UTC)
        end = dt.datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, tzinfo=UTC)
        if end < start:
            raise ValueError("end_date must not precede start_date")
        return SearchWindow("range", start, end, bool(advance_auto_state))
    raise ValueError(f"unsupported search mode: {mode}")
```

- [ ] **Step 4: Add the initial config with the approved TE profile and no economics fields**

The JSON must include these top-level sections and exact defaults:

```json
{
  "timezone": "Australia/Brisbane",
  "output_dir": "te-literature-radar-output",
  "language": "zh-CN",
  "search": {
    "mode": "auto",
    "first_run_lookback_days": 7,
    "overlap_hours": 48,
    "per_query_rows": 50,
    "analysis_candidate_limit": 30
  },
  "research_profile": {
    "core": ["thermoelectric", "Seebeck effect", "thermoelectric material", "thermoelectric properties"],
    "transport": ["figure of merit", "zT", "power factor", "Seebeck coefficient", "electrical conductivity", "thermal conductivity", "lattice thermal conductivity", "carrier transport", "phonon transport"],
    "design": ["doping", "co-doping", "alloying", "band engineering", "band convergence", "resonant level", "defect engineering", "carrier concentration", "phonon scattering", "nanostructuring"],
    "data_driven": ["machine learning thermoelectric", "AI thermoelectric", "materials informatics thermoelectric", "composition property prediction", "thermoelectric prediction", "high-throughput thermoelectric", "materials discovery thermoelectric"],
    "priority_topics": ["doping optimization", "composition-property prediction", "B factor", "quality factor", "weighted mobility", "materials discovery", "machine learning"]
  },
  "quality_tier_points": {"premier": 28, "elite": 26, "high": 24, "solid": 16, "standard": 12, "preprint": 8},
  "target_journals": [],
  "target_authors": [],
  "openalex": {"enabled": true, "mailto": "", "queries": []},
  "arxiv": {"enabled": true, "queries": []},
  "rss_feeds": [],
  "email": {"enabled": false, "smtp_host": "smtp.gmail.com", "smtp_port": 587, "smtp_username": "", "smtp_password_env": "TE_RADAR_GMAIL_APP_PASSWORD", "smtp_password_file": ".secrets/gmail_app_password", "use_starttls": true, "from": "", "to": ""}
}
```

`load_config()` merges no hidden economics defaults; `validate_config()` must reject missing scoring weights, invalid search values, or an enabled email block without recipient/sender information.

- [ ] **Step 5: Run the time-window tests and config smoke check**

Run:

```bash
python3 -m unittest tests.te_literature_radar.test_time_window -v
python3 - <<'PY'
from pathlib import Path
import sys
sys.path.insert(0, str(Path('te-literature-radar/scripts').resolve()))
from te_radar.config import load_config, validate_config
cfg = load_config(Path('te-literature-radar.config.example.json'))
validate_config(cfg)
print(cfg['research_profile']['core'])
PY
```

Expected: all tests pass; output contains `thermoelectric` and `Seebeck effect`.

- [ ] **Step 6: Commit Task 1**

```bash
git add te-literature-radar.config.example.json te-literature-radar/scripts/te_radar tests/te_literature_radar
git commit -m "feat: add TE radar config and search windows"
```

---

### Task 2: Add normalized records, DOI/title-author dedupe, and non-destructive state

**Files:**
- Create: `te-literature-radar/scripts/te_radar/records.py`
- Create: `te-literature-radar/scripts/te_radar/dedupe.py`
- Create: `te-literature-radar/scripts/te_radar/state.py`
- Create: `tests/te_literature_radar/test_dedupe_state.py`

**Interfaces:**
- Produces: `PaperRecord`
- Produces: `SourceResult`
- Produces: `normalize_doi(value: str) -> str`
- Produces: `paper_identity(paper: PaperRecord) -> str`
- Produces: `dedupe_records(papers: list[PaperRecord]) -> list[PaperRecord]`
- Produces: `load_state(path: Path) -> dict[str, Any]`
- Produces: `update_success_state(path: Path, *, delivered_ids: list[str], completed_at: datetime, advance_auto_state: bool) -> None`

- [ ] **Step 1: Write failing identity/state tests**

```python
# tests/te_literature_radar/test_dedupe_state.py
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

from helpers import import_te_radar
import_te_radar()
from te_radar.records import PaperRecord
from te_radar.dedupe import dedupe_records, paper_identity
from te_radar.state import load_state, update_success_state

class DedupeStateTests(unittest.TestCase):
    def paper(self, **kw):
        base = dict(
            id="", title="Thermoelectric transport in PbTe", authors=["A. Author"],
            source="Example", source_kind="journal", peer_review_status="peer_reviewed",
            source_tier="high", date="2026-08-30", doi="", url="", abstract="",
            keywords=[], concepts=[], raw_source="test", notes=[]
        )
        base.update(kw)
        return PaperRecord(**base)

    def test_doi_is_primary_identity_and_normalized(self):
        a = self.paper(doi="https://doi.org/10.1000/ABC.1")
        b = self.paper(doi="10.1000/abc.1", source="Second source")
        merged = dedupe_records([a, b])
        self.assertEqual(len(merged), 1)
        self.assertEqual(paper_identity(merged[0]), "doi:10.1000/abc.1")

    def test_title_primary_author_fallback(self):
        a = self.paper(title="High-zT PbTe: A Study", authors=["Jane Doe"])
        b = self.paper(title="High zT PbTe A Study", authors=["Jane Doe"])
        self.assertEqual(len(dedupe_records([a, b])), 1)

    def test_manual_success_can_leave_auto_cursor_unchanged(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.json"
            path.write_text(json.dumps({"seen_ids": ["old"], "last_success_utc": "2026-08-25T00:00:00+00:00"}))
            update_success_state(path, delivered_ids=["new"], completed_at=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc), advance_auto_state=False)
            state = load_state(path)
            self.assertEqual(state["last_success_utc"], "2026-08-25T00:00:00+00:00")
            self.assertEqual(state["seen_ids"], ["old"])

    def test_auto_success_updates_seen_and_cursor(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.json"
            update_success_state(path, delivered_ids=["doi:10.1/x"], completed_at=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc), advance_auto_state=True)
            state = load_state(path)
            self.assertIn("doi:10.1/x", state["seen_ids"])
            self.assertTrue(state["last_success_utc"].startswith("2026-09-01"))
```

- [ ] **Step 2: Run tests and verify failure**

```bash
python3 -m unittest tests.te_literature_radar.test_dedupe_state -v
```

Expected: missing record/dedupe/state modules.

- [ ] **Step 3: Implement the shared record contract**

```python
# te-literature-radar/scripts/te_radar/records.py
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
```

Use `peer_review_status` values exactly `peer_reviewed`, `preprint`, or `unknown`.

- [ ] **Step 4: Implement dedupe merge semantics**

`paper_identity()` must use normalized DOI first, then a trustworthy existing `id`, then normalized title + first author. `dedupe_records()` must preserve the richer abstract, union keywords/concepts/notes, retain a DOI when either source has one, and record multiple source names without losing the first source's provenance.

- [ ] **Step 5: Implement state with no mutation for default historical runs**

`update_success_state(..., advance_auto_state=False)` must perform no write at all. This deliberately makes manual lookback/range runs observational by default. Only an `auto` run or explicit override may append seen IDs and advance `last_success_utc`.

- [ ] **Step 6: Run tests and commit**

```bash
python3 -m unittest tests.te_literature_radar.test_dedupe_state -v
git add te-literature-radar/scripts/te_radar tests/te_literature_radar/test_dedupe_state.py
git commit -m "feat: add TE radar identity and state"
```

---

### Task 3: Implement Crossref, RSS, OpenAlex, and arXiv adapters behind one source interface

**Files:**
- Create: `te-literature-radar/scripts/te_radar/sources/__init__.py`
- Create: `te-literature-radar/scripts/te_radar/sources/common.py`
- Create: `te-literature-radar/scripts/te_radar/sources/crossref.py`
- Create: `te-literature-radar/scripts/te_radar/sources/rss.py`
- Create: `te-literature-radar/scripts/te_radar/sources/openalex.py`
- Create: `te-literature-radar/scripts/te_radar/sources/arxiv.py`
- Create: `tests/te_literature_radar/test_sources.py`

**Interfaces:**
- Produces: `http_get(url: str, *, accept: str, timeout: int = 30) -> bytes`
- Produces: `fetch_crossref(config, window) -> SourceResult`
- Produces: `fetch_rss(config, window) -> SourceResult`
- Produces: `fetch_openalex(config, window) -> SourceResult`
- Produces: `fetch_arxiv(config, window) -> SourceResult`
- Every adapter returns only normalized `PaperRecord` objects.

- [ ] **Step 1: Write fixture-based adapter tests with mocked HTTP**

Use `unittest.mock.patch` on each module's `http_get`. Fixtures should include:

```python
CROSSREF_FIXTURE = {
    "message": {"items": [{
        "DOI": "10.1000/te.1",
        "title": ["High-performance thermoelectric PbTe"],
        "author": [{"given": "A", "family": "Author"}],
        "published-online": {"date-parts": [[2026, 8, 30]]},
        "container-title": ["Advanced Functional Materials"],
        "abstract": "<jats:p>Thermoelectric zT reaches 1.8.</jats:p>",
        "subject": ["Materials Science"],
        "URL": "https://doi.org/10.1000/te.1"
    }]}
}

OPENALEX_FIXTURE = {
    "results": [{
        "id": "https://openalex.org/W1",
        "doi": "https://doi.org/10.1000/te.2",
        "title": "Machine learning discovery of thermoelectric compounds",
        "publication_date": "2026-08-31",
        "authorships": [{"author": {"display_name": "B. Author"}}],
        "primary_location": {"source": {"display_name": "Advanced Materials"}, "landing_page_url": "https://example.test/paper"},
        "abstract_inverted_index": {"Thermoelectric": [0], "screening": [1], "materials": [2]},
        "concepts": [{"display_name": "Thermoelectricity"}]
    }],
    "meta": {"next_cursor": None}
}
```

For arXiv, include Atom XML with a `2026-08-31T...Z` published date and assert `peer_review_status == "preprint"`. For RSS, include one item inside the window and one outside it and assert client-side date filtering.

- [ ] **Step 2: Run source tests and verify missing-adapter failures**

```bash
python3 -m unittest tests.te_literature_radar.test_sources -v
```

- [ ] **Step 3: Implement common HTTP and text normalization**

`common.py` should contain `http_get`, `strip_markup`, DOI extraction, ISO date helpers, and a configurable User-Agent. HTTP must be injectable/patchable at module boundaries so tests never access the network.

- [ ] **Step 4: Implement Crossref as target-journal monitoring**

For every configured journal ISSN, query Crossref `/works` with both `from-pub-date` and `until-pub-date`, `type:journal-article`, sorted newest-first. Map configured journal `tier` to `PaperRecord.source_tier`; set `peer_review_status="peer_reviewed"`.

- [ ] **Step 5: Implement generic RSS/Atom feeds**

Parse RSS and Atom, normalize title/link/date/summary/authors, and filter records against `window.start <= published <= window.end`. A feed failure returns an error string and does not raise out of the adapter.

- [ ] **Step 6: Implement OpenAlex broad discovery with cursor paging**

Use configured search phrases. Build queries equivalent to:

```text
https://api.openalex.org/works?search=<query>&filter=from_publication_date:<start>,to_publication_date:<end>&per-page=<rows>&cursor=*
```

If `openalex.mailto` is configured, include it. Reconstruct abstracts from `abstract_inverted_index` by placing each token at its indexed positions. Continue cursor paging until `next_cursor` is absent or the configured per-query result cap is reached.

OpenAlex records are `peer_reviewed` when the work type/source metadata indicates a journal article; otherwise use `unknown` unless the location is explicitly a repository/preprint server.

- [ ] **Step 7: Implement arXiv discovery as explicit preprint source**

Use Atom API queries from config, newest first. Filter by published/updated timestamp into the selected window. Every arXiv record must set:

```python
peer_review_status = "preprint"
source_tier = "preprint"
notes = ["Preprint — not peer reviewed"]
```

- [ ] **Step 8: Run tests and commit**

```bash
python3 -m unittest tests.te_literature_radar.test_sources -v
git add te-literature-radar/scripts/te_radar/sources tests/te_literature_radar/test_sources.py
git commit -m "feat: add TE literature source adapters"
```

---

### Task 4: Replace economics ranking with TE relevance, quality, research-fit, recency, and deterministic A/B/C rules

**Files:**
- Create: `te-literature-radar/scripts/te_radar/scoring.py`
- Create: `te-literature-radar/references/scoring-policy.md`
- Create: `tests/te_literature_radar/test_scoring.py`

**Interfaces:**
- Produces: `BaseScore(te_relevance: int, research_quality: int, research_fit: int, recency: int, gate_passed: bool, evidence: list[str])`
- Produces: `score_base(paper: PaperRecord, config: dict, *, window_end: datetime) -> BaseScore`
- Produces: `ScoreBreakdown(te_relevance, research_quality, novelty, research_fit, recency)` with `total` property
- Produces: `classify_grade(score: ScoreBreakdown, *, peer_review_status: str) -> str | None`

- [ ] **Step 1: Write failing tests that prove journal prestige cannot bypass TE relevance**

```python
# tests/te_literature_radar/test_scoring.py
import datetime as dt
import unittest

from helpers import import_te_radar
import_te_radar()
from te_radar.records import PaperRecord
from te_radar.scoring import ScoreBreakdown, classify_grade, score_base

class ScoringTests(unittest.TestCase):
    def paper(self, **kw):
        base = dict(id="x", title="", authors=["A"], source="Nature", source_kind="journal",
                    peer_review_status="peer_reviewed", source_tier="premier", date="2026-08-31",
                    doi="10.1/x", url="", abstract="", keywords=[], concepts=[], raw_source="test", notes=[])
        base.update(kw)
        return PaperRecord(**base)

    def test_prestigious_non_te_paper_fails_gate(self):
        paper = self.paper(title="Anomalous Nernst response in a magnetic film",
                           abstract="We study spin-caloritronic transport without thermoelectric material optimization.")
        cfg = {"research_profile": {"core": ["thermoelectric", "Seebeck effect"], "transport": ["zT", "power factor"], "design": [], "data_driven": [], "priority_topics": []},
               "quality_tier_points": {"premier": 28}}
        base = score_base(paper, cfg, window_end=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc))
        self.assertFalse(base.gate_passed)

    def test_core_te_paper_passes_gate(self):
        paper = self.paper(title="High-performance thermoelectric PbTe",
                           abstract="Seebeck coefficient, power factor and zT are optimized by doping.")
        cfg = {"research_profile": {"core": ["thermoelectric", "Seebeck effect"], "transport": ["zT", "power factor"], "design": ["doping"], "data_driven": [], "priority_topics": ["doping"]},
               "quality_tier_points": {"premier": 28}}
        base = score_base(paper, cfg, window_end=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc))
        self.assertTrue(base.gate_passed)
        self.assertLessEqual(base.te_relevance, 30)
        self.assertLessEqual(base.research_quality, 30)

    def test_lower_tier_high_novelty_can_be_a(self):
        score = ScoreBreakdown(30, 16, 20, 10, 10)
        self.assertEqual(classify_grade(score, peer_review_status="peer_reviewed"), "A")

    def test_preprint_has_stricter_a_threshold(self):
        self.assertNotEqual(classify_grade(ScoreBreakdown(25, 8, 17, 10, 10), peer_review_status="preprint"), "A")
        self.assertEqual(classify_grade(ScoreBreakdown(28, 8, 19, 10, 10), peer_review_status="preprint"), "A")
```

- [ ] **Step 2: Run scoring tests and verify failure**

```bash
python3 -m unittest tests.te_literature_radar.test_scoring -v
```

- [ ] **Step 3: Implement TE relevance with a hard gate and 30-point cap**

Use normalized title and evidence body. The deterministic rule is:

```text
Primary TE anchor in title: +18
Primary TE anchor in abstract/concepts: +12
Transport/performance term in title: +6
Transport/performance term in abstract/concepts: +3
Design/data-driven TE-supporting term: +2 each distinct group
Cap: 30
```

The gate passes only when either:

1. a primary TE anchor (`thermoelectric`, `thermoelectricity`, `Seebeck effect`) appears in title/abstract/concepts; or
2. at least two distinct TE transport/performance concepts appear and the paper has an explicit configured TE context term.

Configured adjacent-topic exclusions such as anomalous Nernst/spin caloritronics must remain excluded unless a primary TE anchor makes conventional TE performance central. The test above must fail the gate even though the source is `premier`.

- [ ] **Step 4: Implement quality as transparent tier points plus metadata completeness**

Quality calculation:

```text
Configured venue tier base:
  premier = 28
  elite = 26
  high = 24      # AFM-level practical baseline
  solid = 16
  standard = 12
  preprint = 8
  unknown peer-reviewed = 12
  unknown status = 8

Completeness adjustment:
  abstract present: +1
  DOI or stable source ID plus usable URL: +1

Cap: 30
Preprints may never exceed 10 quality points in V1.
```

- [ ] **Step 5: Implement research-fit and recency**

Research fit is capped at 10: +3 for a priority-topic title hit, +2 for an abstract/concept hit, +2 watched-material/system hit, +2 watched-author hit, +1 data-driven/doping/transport category overlap.

Recency relative to `window_end`:

```text
0–2 days: 10
3–7 days: 8
8–14 days: 6
15–30 days: 4
31–90 days: 2
older: 1
```

- [ ] **Step 6: Implement exact final grade rules**

Peer-reviewed/unknown-status rules:

```text
A: total >= 80 AND relevance >= 24 AND (quality >= 24 OR novelty >= 18)
B: total >= 65 AND relevance >= 21 AND (quality >= 18 OR novelty >= 15)
C: total >= 50 AND relevance >= 18
otherwise: excluded from delivered A/B/C
```

Preprint rules:

```text
A: total >= 84 AND relevance >= 27 AND novelty >= 18
B: total >= 76 AND relevance >= 25 AND novelty >= 16
C: total >= 60 AND relevance >= 22 AND novelty >= 14
otherwise: excluded
```

These thresholds encode the approved policy: high-quality journals are favored; unusually innovative lower-tier papers may still rise; preprints require stronger relevance/novelty.

- [ ] **Step 7: Document the scoring policy and run tests**

`scoring-policy.md` must reproduce the weights, hard relevance gate, quality tier mapping, A/B/C thresholds, and preprint warning policy exactly.

```bash
python3 -m unittest tests.te_literature_radar.test_scoring -v
git add te-literature-radar/scripts/te_radar/scoring.py te-literature-radar/references/scoring-policy.md tests/te_literature_radar/test_scoring.py
git commit -m "feat: add thermoelectric scoring policy"
```

---

### Task 5: Define the Codex novelty/summary contract and reject unsupported numerical claims

**Files:**
- Create: `te-literature-radar/scripts/te_radar/analysis.py`
- Create: `te-literature-radar/references/analysis-contract.md`
- Create: `tests/te_literature_radar/test_analysis.py`

**Interfaces:**
- Produces: `build_analysis_request(papers_with_base_scores: list[dict], *, limit: int) -> dict`
- Produces: `validate_analysis(fetch_payload: dict, analysis_payload: dict) -> dict`
- Produces: `merge_analysis(fetch_payload: dict, analysis_payload: dict) -> dict`
- `merge_analysis` computes total and A/B/C after validated Codex novelty scores are supplied.

- [ ] **Step 1: Write failing tests for score bounds, evidence basis, missing papers, and fabricated numbers**

```python
# tests/te_literature_radar/test_analysis.py
import unittest
from helpers import import_te_radar
import_te_radar()
from te_radar.analysis import validate_analysis

FETCH = {
    "analysis_candidates": [{
        "id": "doi:10.1/x",
        "title": "Thermoelectric PbTe",
        "abstract": "The maximum zT reaches 1.8 at 800 K.",
        "date": "2026-08-30",
        "source": "Advanced Functional Materials",
        "base_score": {"te_relevance": 30, "research_quality": 25, "research_fit": 8, "recency": 10}
    }]
}

class AnalysisTests(unittest.TestCase):
    def good(self):
        return {"papers": [{
            "id": "doi:10.1/x",
            "novelty": {"score": 16, "types": ["doping design"], "reason": "A distinct design strategy is reported.", "evidence_basis": "title_abstract_metadata"},
            "summary": {
                "purpose": "Improve thermoelectric PbTe.",
                "innovation": "Uses a distinct design strategy.",
                "approach": "Material design and transport measurements.",
                "results": ["Maximum zT reaches 1.8 at 800 K."],
                "mechanism": "The abstract attributes the improvement to carrier optimization.",
                "significance": "Provides a route for PbTe optimization.",
                "limitations": ["Judgment is based on title/abstract/metadata, not full text."]
            },
            "radar_note": "Worth reading for its PbTe optimization strategy."
        }]}

    def test_valid_analysis_passes(self):
        validate_analysis(FETCH, self.good())

    def test_novelty_above_20_is_rejected(self):
        bad = self.good(); bad["papers"][0]["novelty"]["score"] = 21
        with self.assertRaises(ValueError):
            validate_analysis(FETCH, bad)

    def test_unsupported_result_number_is_rejected(self):
        bad = self.good(); bad["papers"][0]["summary"]["results"] = ["Maximum zT reaches 2.4 at 800 K."]
        with self.assertRaises(ValueError):
            validate_analysis(FETCH, bad)
```

- [ ] **Step 2: Run tests and verify failure**

```bash
python3 -m unittest tests.te_literature_radar.test_analysis -v
```

- [ ] **Step 3: Implement the analysis request and exact JSON contract**

Each Codex analysis entry must have this shape:

```json
{
  "id": "doi:...",
  "novelty": {
    "score": 0,
    "types": ["new material", "new mechanism", "new ML/AI method"],
    "reason": "...",
    "evidence_basis": "title_abstract_metadata"
  },
  "summary": {
    "purpose": "...",
    "innovation": "...",
    "approach": "...",
    "results": ["..."],
    "mechanism": "...",
    "significance": "...",
    "limitations": ["..."]
  },
  "radar_note": "..."
}
```

Allowed novelty types are exactly:

```text
new material
new dopant/alloy design
new mechanism
new performance regime
new experimental method
new theory
new ML/AI method
new dataset/screening strategy
incremental variant
```

`evidence_basis` is `title_abstract_metadata` in V1 unless a future explicitly validated full-text source is added.

- [ ] **Step 4: Implement evidence-bounded numeric validation**

Build source evidence from title + abstract + publication date + source metadata. Extract numeric tokens using one shared regex. Every numeric token in Codex-generated `purpose`, `innovation`, `approach`, `results`, `mechanism`, `significance`, `limitations`, and `radar_note` must also appear in the source evidence after normalized whitespace/unit handling. Reject the entire analysis payload on the first unsupported number.

This check must make the `2.4` test fail because only `1.8` and `800` exist in source evidence.

- [ ] **Step 5: Make the final grade deterministic after novelty validation**

`merge_analysis()` combines the four deterministic dimensions from `base_score` with `novelty.score`, computes `total`, calls `classify_grade()`, and stores:

```json
"radar_score": {
  "te_relevance": 30,
  "research_quality": 25,
  "novelty": 16,
  "research_fit": 8,
  "recency": 10,
  "total": 89,
  "grade": "A"
}
```

Codex must not be allowed to provide or override `total` or `grade`.

- [ ] **Step 6: Document Codex instructions and run tests**

`analysis-contract.md` must tell Codex to answer the approved fields: purpose, innovation, how solved, results, mechanism, significance, limitations, and radar note. It must explicitly say: do not infer missing numerical results; do not claim full-paper review; use `incremental variant` when novelty is mainly a small variant.

```bash
python3 -m unittest tests.te_literature_radar.test_analysis -v
git add te-literature-radar/scripts/te_radar/analysis.py te-literature-radar/references/analysis-contract.md tests/te_literature_radar/test_analysis.py
git commit -m "feat: add evidence-bounded Codex analysis contract"
```

---

### Task 6: Build source aggregation, freshness filtering, base scoring, and fetch JSON CLI

**Files:**
- Create: `te-literature-radar/scripts/te_radar/pipeline.py`
- Create: `te-literature-radar/scripts/radar_cli.py`
- Create: `tests/te_literature_radar/test_pipeline.py`

**Interfaces:**
- Produces: `fetch_candidates(config, state, window, *, source_fetchers=None) -> dict`
- CLI commands:
  - `radar_cli.py fetch`
  - `radar_cli.py validate-analysis`
  - `radar_cli.py merge-analysis`
  - `radar_cli.py mark-success`

- [ ] **Step 1: Write a mocked end-to-end fetch test with one source failure**

```python
class PipelineTests(unittest.TestCase):
    def test_one_source_failure_does_not_discard_other_sources(self):
        def good_source(config, window):
            return SourceResult([make_te_paper(id="doi:10.1/a")], [])
        def bad_source(config, window):
            return SourceResult([], ["OpenAlex: temporary failure"])
        payload = fetch_candidates(TEST_CONFIG, {}, TEST_WINDOW, source_fetchers=[good_source, bad_source])
        self.assertEqual(payload["candidate_count"], 1)
        self.assertEqual(len(payload["errors"]), 1)
        self.assertEqual(len(payload["analysis_candidates"]), 1)

    def test_seen_auto_paper_is_not_reanalyzed(self):
        payload = fetch_candidates(TEST_CONFIG, {"seen_ids": ["doi:10.1/a"]}, TEST_WINDOW,
                                   source_fetchers=[lambda c, w: SourceResult([make_te_paper(id="doi:10.1/a")], [])])
        self.assertEqual(payload["fresh_count"], 0)
```

- [ ] **Step 2: Run pipeline tests and verify failure**

```bash
python3 -m unittest tests.te_literature_radar.test_pipeline -v
```

- [ ] **Step 3: Implement aggregation order**

`fetch_candidates()` must execute:

```text
all enabled source adapters
→ concatenate normalized records
→ dedupe
→ remove seen IDs only for recurring-auto semantics
→ TE relevance gate
→ deterministic base scoring
→ sort by deterministic subtotal descending, then publication date descending
→ cap at search.analysis_candidate_limit (default 30)
→ emit fetch JSON
```

The fetch payload must contain:

```json
{
  "generated_at_utc": "...",
  "search_window": {"mode": "auto", "start": "...", "end": "...", "advance_auto_state": true},
  "candidate_count": 0,
  "deduped_count": 0,
  "fresh_count": 0,
  "gated_count": 0,
  "analysis_candidates": [],
  "errors": []
}
```

Each analysis candidate includes `base_score` and the source evidence fields Codex may inspect.

- [ ] **Step 4: Implement CLI time-window overrides**

`fetch` arguments:

```text
--config PATH
--mode auto|lookback|range
--lookback-days N
--start-date YYYY-MM-DD
--end-date YYYY-MM-DD
--advance-auto-state
```

Invalid combinations must fail before any source fetcher is invoked.

- [ ] **Step 5: Implement analysis validation/merge CLI commands**

Examples:

```bash
python3 te-literature-radar/scripts/radar_cli.py validate-analysis --fetch FETCH.json --analysis ANALYSIS.json
python3 te-literature-radar/scripts/radar_cli.py merge-analysis --fetch FETCH.json --analysis ANALYSIS.json --output FINAL.json
```

- [ ] **Step 6: Run all tests so far and commit**

```bash
python3 -m unittest discover -s tests/te_literature_radar -v
git add te-literature-radar/scripts/radar_cli.py te-literature-radar/scripts/te_radar/pipeline.py tests/te_literature_radar/test_pipeline.py
git commit -m "feat: add TE radar fetch pipeline"
```

---

### Task 7: Render A/B/C Markdown and evidence-consistent HTML email

**Files:**
- Create: `te-literature-radar/scripts/render_digest.py`
- Create: `te-literature-radar/scripts/send_digest.py`
- Create: `tests/te_literature_radar/test_render_email.py`

**Interfaces:**
- Produces: `render_markdown(payload: dict) -> str`
- Produces: `markdown_to_html(markdown: str) -> str`
- Produces: `build_message(email_config, subject, body, html_body) -> EmailMessage`
- Produces: `send_message(email_config, message, password) -> None`

- [ ] **Step 1: Write render tests for A/B/C hierarchy and preprint warning**

```python
class RenderTests(unittest.TestCase):
    def test_digest_has_approved_summary_sections(self):
        text = render_markdown(FINAL_PAYLOAD_WITH_A_AND_B)
        self.assertIn("## A — 必看", text)
        self.assertIn("## B — 值得关注", text)
        self.assertIn("## C — 浏览即可", text)
        self.assertIn("**目的**", text)
        self.assertIn("**创新**", text)
        self.assertIn("**如何解决**", text)
        self.assertIn("**效果**", text)
        self.assertIn("**机制**", text)
        self.assertIn("**意义**", text)
        self.assertIn("**局限/注意**", text)

    def test_preprint_warning_is_prominent(self):
        text = render_markdown(FINAL_PAYLOAD_WITH_PREPRINT)
        self.assertIn("Preprint — not peer reviewed", text)
```

- [ ] **Step 2: Implement Markdown structure**

Order exactly:

1. `# TE Literature Radar — YYYY-MM-DD`
2. Search-window/source summary.
3. `## A — 必看` with full structured summary.
4. `## B — 值得关注` with full structured summary.
5. `## C — 浏览即可` as compact table/list: title, source, date, total, one-line radar note.
6. `## Source / Fetch Notes` when errors exist.

A/B paper cards must display bibliographic link plus exact score breakdown:

```text
TE relevance x/30 | Quality x/30 | Novelty x/20 | Research fit x/10 | Recency x/10 | Total x/100
```

- [ ] **Step 3: Adapt the original SMTP sender without adding dependencies**

Keep environment-variable or ignored-file password loading. Subject default becomes:

```text
TE Literature Radar - YYYY-MM-DD
```

HTML should preserve A/B/C section headings, score line, and a visibly distinct preprint warning. Do not introduce an external CSS or JavaScript dependency; email remains self-contained HTML.

- [ ] **Step 4: Mock SMTP and verify no real connection**

Patch `smtplib.SMTP`; assert `starttls`, `login`, and `send_message` are invoked with configured values. Also test `--dry-run` does not instantiate SMTP.

- [ ] **Step 5: Run tests and commit**

```bash
python3 -m unittest tests.te_literature_radar.test_render_email -v
git add te-literature-radar/scripts/render_digest.py te-literature-radar/scripts/send_digest.py tests/te_literature_radar/test_render_email.py
git commit -m "feat: render and email TE radar digest"
```

---

### Task 8: Add finalization semantics so state advances only after required delivery succeeds

**Files:**
- Create: `te-literature-radar/scripts/finalize_radar.py`
- Modify: `tests/te_literature_radar/test_pipeline.py`

**Interfaces:**
- Produces CLI:
  - `finalize_radar.py --config CONFIG --fetch FETCH.json --analysis ANALYSIS.json [--skip-send]`
- Finalizer validates analysis, merges scores/grades, renders Markdown, optionally sends email, and only then marks success when `search_window.advance_auto_state == true`.

- [ ] **Step 1: Add failing success/failure state tests**

Add two integration tests with temporary files and mocked sender:

```python
def test_state_advances_after_successful_required_email(self):
    # email enabled; sender mock succeeds
    # assert state last_success_utc changes and delivered IDs are written


def test_state_does_not_advance_when_email_send_fails(self):
    # sender mock raises RuntimeError
    # assert state file remains unchanged
```

Also add:

```python
def test_email_disabled_render_success_can_complete_auto_run(self):
    # email.enabled false; successful render is final required delivery
    # auto run advances state
```

- [ ] **Step 2: Implement finalization order**

Exact order:

```text
read fetch JSON
→ read analysis JSON
→ validate analysis
→ merge novelty + deterministic scores + grades
→ write final structured JSON
→ render Markdown
→ if email.enabled: send email and require success
→ if auto/explicit advance_auto_state: update state with delivered A/B/C IDs and completion time
→ print final artifact paths
```

A failed validation/render/send exits non-zero and leaves state untouched.

- [ ] **Step 3: Ensure manual modes stay observational by default**

A `lookback` or `range` fetch without `--advance-auto-state` must still produce final JSON/Markdown/email when requested, but `finalize_radar.py` must not write `state.json`.

- [ ] **Step 4: Run full test suite and commit**

```bash
python3 -m unittest discover -s tests/te_literature_radar -v
git add te-literature-radar/scripts/finalize_radar.py tests/te_literature_radar/test_pipeline.py
git commit -m "feat: finalize TE radar with safe state updates"
```

---

### Task 9: Add the Codex Skill instructions, source policy, and practical default journal/search configuration

**Files:**
- Create: `te-literature-radar/SKILL.md`
- Create: `te-literature-radar/agents/openai.yaml`
- Create: `te-literature-radar/references/source-policy.md`
- Modify: `te-literature-radar.config.example.json`

**Interfaces:**
- The Skill orchestrates the deterministic scripts and the Codex analysis step.
- Default prompt: `Run my thermoelectric literature radar, assess novelty from the supplied evidence, and produce the A/B/C digest.`

- [ ] **Step 1: Write `SKILL.md` as the authoritative Codex runbook**

The standard auto flow must tell Codex to:

```text
1. Read config and references/scoring-policy.md + references/analysis-contract.md.
2. Run radar_cli.py fetch --mode auto.
3. Read only analysis_candidates from the returned fetch JSON.
4. For every candidate, produce the exact analysis JSON contract.
5. Run radar_cli.py validate-analysis.
6. If validation fails, correct only the unsupported/missing analysis field and revalidate; never invent missing evidence.
7. Run finalize_radar.py.
8. Report artifact paths and counts.
```

Manual examples must be included exactly:

```bash
# Last 30 days; do not disturb weekly auto state
python3 te-literature-radar/scripts/radar_cli.py fetch --config te-literature-radar.config.json --mode lookback --lookback-days 30

# Explicit historical interval; do not disturb weekly auto state
python3 te-literature-radar/scripts/radar_cli.py fetch --config te-literature-radar.config.json --mode range --start-date 2026-01-01 --end-date 2026-06-30
```

- [ ] **Step 2: Define initial OpenAlex/arXiv query sets from the approved search strategy**

Populate defaults with a small, non-redundant set such as:

```json
"openalex": {
  "enabled": true,
  "mailto": "",
  "queries": [
    "thermoelectric materials",
    "Seebeck thermoelectric",
    "thermoelectric zT power factor",
    "thermoelectric doping band engineering",
    "thermoelectric machine learning materials discovery"
  ]
},
"arxiv": {
  "enabled": true,
  "queries": [
    "thermoelectric",
    "Seebeck thermoelectric",
    "thermoelectric machine learning",
    "thermoelectric materials discovery"
  ]
}
```

Do not expand into dozens of near-duplicate queries in V1; dedupe coverage should come from multiple sources, not query spam.

- [ ] **Step 3: Add initial quality-journal entries only after verifying ISSNs**

Verify each configured ISSN against Crossref journal metadata or the publisher record before committing. The initial journal-name set should include at least:

```text
Nature
Science
Nature Materials
Nature Energy
Nature Communications
Science Advances
Energy & Environmental Science
Joule
Advanced Materials
Advanced Energy Materials
Advanced Functional Materials
```

Assign tiers consistently:

```text
premier: Nature, Science, Nature Materials, Nature Energy
elite: Nature Communications, Science Advances, Energy & Environmental Science, Joule, Advanced Materials
high: Advanced Energy Materials, Advanced Functional Materials
```

If an ISSN cannot be verified during implementation, omit that journal from the Crossref ISSN list rather than guessing; OpenAlex discovery still provides broad coverage.

- [ ] **Step 4: Add source policy documentation**

`source-policy.md` must state:

- Crossref = DOI/target-journal metadata.
- OpenAlex = broad materials discovery.
- arXiv = early/preprint discovery with stricter grading.
- RSS = optional publisher/society early notification.
- No paywalled PDF download in V1.
- Missing abstracts remain `metadata-only`; Codex must not infer findings.

- [ ] **Step 5: Add `agents/openai.yaml`**

```yaml
display_name: TE Literature Radar
short_description: Discover, rank, and summarize high-quality thermoelectric literature.
default_prompt: Run my thermoelectric literature radar, assess novelty from the supplied evidence, and produce the A/B/C digest.
```

- [ ] **Step 6: Commit Skill/config docs**

```bash
git add te-literature-radar/SKILL.md te-literature-radar/agents te-literature-radar/references/source-policy.md te-literature-radar.config.example.json
git commit -m "feat: package TE literature radar as Codex skill"
```

---

### Task 10: Add regression verification, user documentation, and keep existing production workflows untouched

**Files:**
- Modify: `README.md`
- Create: `docs/te-literature-radar.md`
- Modify: `tests/te_literature_radar/test_pipeline.py`
- Do not modify: `.github/workflows/paperecho-weekly.yml`, `.github/workflows/thermoelectric-weekly.yml`, `.github/workflows/paper-digest-stock-smoke.yml` in this task.

**Interfaces:**
- Documentation explains how Codex Automation invokes the Skill; scheduling cadence remains external to ranking logic.

- [ ] **Step 1: Add a full mocked V1 acceptance test**

The test must inject four fake source adapters containing:

1. an AFM-level strongly relevant TE paper.
2. a premier-journal non-TE false positive.
3. a lower-tier peer-reviewed TE paper with novelty 20.
4. a highly relevant arXiv preprint with novelty 19.

After mocked Codex analysis is merged, assert:

```text
premier non-TE paper is absent
AFM-level TE paper is A or B according to supplied novelty
lower-tier high-novelty paper can reach A/B
preprint uses stricter rule and carries warning
final Markdown contains only evidence-supported numeric results
```

- [ ] **Step 2: Add one regression assertion that existing workflow files are unchanged from branch base**

Run before final commit:

```bash
git diff main...HEAD -- .github/workflows/paperecho-weekly.yml .github/workflows/thermoelectric-weekly.yml .github/workflows/paper-digest-stock-smoke.yml
```

Expected: no diff.

- [ ] **Step 3: Document local/manual use**

`docs/te-literature-radar.md` must cover:

- copy `te-literature-radar.config.example.json` to `te-literature-radar.config.json`.
- edit research topics, authors, journals, email.
- auto fetch command.
- 30-day lookback command.
- explicit range command.
- Skill analysis/finalization sequence.
- output/state locations.
- SMTP secret handling.
- explanation that `lookback`/`range` do not change weekly auto state unless explicitly overridden.

- [ ] **Step 4: Document Codex Automation integration without hard-coding a schedule**

Provide an automation prompt equivalent to:

```text
Use $te-literature-radar with te-literature-radar.config.json in auto mode. Fetch new thermoelectric literature, assess novelty only from supplied evidence, validate the analysis, finalize the A/B/C digest, and send email if email is enabled.
```

Explain that the user may choose weekly, daily, or another schedule in Codex; the Skill itself performs exactly one run when invoked.

- [ ] **Step 5: Update README without replacing the existing PaperEcho instructions**

Add a clearly labeled experimental/new section linking to `docs/te-literature-radar.md`. Keep the current PaperEcho Thermoelectric Weekly instructions intact until an explicit migration decision is made after comparison.

- [ ] **Step 6: Run final verification**

```bash
python3 -m unittest discover -s tests/te_literature_radar -v
python3 -m compileall -q te-literature-radar/scripts
git diff --check
git diff main...HEAD -- .github/workflows/paperecho-weekly.yml .github/workflows/thermoelectric-weekly.yml .github/workflows/paper-digest-stock-smoke.yml
```

Expected:

- all TE radar tests pass.
- Python compilation passes.
- `git diff --check` emits no errors.
- existing three workflow files have no diff.

- [ ] **Step 7: Commit documentation and acceptance coverage**

```bash
git add README.md docs/te-literature-radar.md tests/te_literature_radar
git commit -m "docs: document TE literature radar workflow"
```

---

## Final Implementation Review Checklist

Before calling implementation complete, verify every item against the approved spec:

- [ ] Crossref source implemented and tested.
- [ ] OpenAlex source implemented and tested.
- [ ] arXiv/preprint source implemented and tested.
- [ ] Configurable RSS/Atom source implemented and tested.
- [ ] `auto`, `lookback`, `range` implemented.
- [ ] 48-hour default overlap implemented.
- [ ] Manual historical runs do not mutate auto state by default.
- [ ] DOI-first and title/author fallback dedupe implemented.
- [ ] TE relevance hard gate runs before prestige can matter.
- [ ] Score weights are 30/30/20/10/10.
- [ ] AFM-level quality baseline represented by `high` tier.
- [ ] Lower-tier high-novelty exception is test-covered.
- [ ] Preprint A/B/C thresholds are stricter and warning is rendered.
- [ ] Codex novelty score is 0–20 and evidence-bounded.
- [ ] Final A/B/C is deterministic code, not an unvalidated Codex label.
- [ ] Purpose, innovation, approach, results, mechanism, significance, limitations, and radar note are present for A/B.
- [ ] Unsupported generated numerical claims fail validation.
- [ ] Source failures degrade gracefully and appear in notes.
- [ ] State advances only after required final delivery succeeds.
- [ ] Markdown and HTML email output are tested.
- [ ] Skill can be invoked by Codex Automation for one scheduled run.
- [ ] Existing PaperEcho production workflows remain unchanged.
