# TE Literature Radar Design

Date: 2026-09-01

## 1. Goal

Build a maintainable `te-literature-radar` Codex Skill and scheduled literature-monitoring workflow for thermoelectric research. The first version should automatically discover recent literature, remove duplicates, rank it by thermoelectric relevance and research quality, let Codex judge novelty from the available evidence, generate a concise but useful research summary, and optionally deliver the result by email.

The design deliberately starts from the lightweight architecture of `lishn6/daily-econ-literature-radar` rather than extending the current PaperEcho production path. The existing `PaperEcho Thermoelectric Weekly` workflow on `main` remains untouched while the new radar is developed and validated on `feature/te-literature-radar`.

## 2. Scope

### In scope for V1

- A Codex Skill named `te-literature-radar`.
- Literature discovery from:
  - Crossref.
  - OpenAlex.
  - arXiv/preprint sources.
  - configurable RSS/Atom feeds.
- Persistent state so recurring runs do not repeatedly deliver the same paper.
- DOI-first deduplication with title/author fallback.
- Three time-window modes: `auto`, `lookback`, and `range`.
- Thermoelectric-specific relevance filtering.
- A 100-point scoring model:
  - TE relevance: 30.
  - research quality: 30.
  - novelty: 20.
  - user research fit: 10.
  - recency: 10.
- A/B/C delivery classification.
- High-quality peer-reviewed papers prioritized by default.
- Preprints accepted only when strongly relevant and clearly novel; all preprints must be explicitly labeled as not peer reviewed.
- Codex-generated structured summaries for selected papers.
- Markdown digest and HTML email output.
- Compatibility with Codex Automation, cron, or another scheduler.
- A configurable search window for manual historical or retrospective searches.

### Explicitly out of scope for V1

- Zotero writeback.
- Full PaperEcho-style recovery stages.
- A user-feedback learning model.
- A persistent relational/vector database.
- Automatic paywalled PDF downloading.
- Unverified extraction of results from papers that the workflow cannot actually access.
- Automatic merging into the existing PaperEcho production workflow.

These may be added later after the lightweight radar is stable.

## 3. Product behavior

The normal scheduled flow is:

```text
Codex Automation / scheduler
        ↓
$te-literature-radar
        ↓
load configuration + previous successful state
        ↓
resolve search window
        ↓
Crossref + OpenAlex + arXiv + RSS
        ↓
normalize metadata
        ↓
deduplicate
        ↓
remove already processed papers
        ↓
TE relevance gate
        ↓
deterministic base scoring
        ↓
Codex novelty and research-value assessment
        ↓
A / B / C classification
        ↓
structured paper summaries
        ↓
Markdown + HTML email
        ↓
mark success only after final delivery succeeds
```

The scheduled workflow performs one run when invoked. The scheduler, not the Python program, determines whether it runs weekly, daily, or at another cadence.

## 4. Search-time model

The search-window API must support three modes.

### 4.1 `auto`

Default for recurring automation.

- Start from the timestamp/date associated with the most recent successful run.
- Apply a configurable overlap, default 48 hours, before the last successful boundary.
- Search from that overlapped boundary through the current run time.
- Deduplicate against persistent state so the overlap does not produce repeated delivery.
- If there is no prior successful state, use the configured first-run lookback, default 7 days.

This mode is intended to reduce missed papers caused by delayed indexing in Crossref, OpenAlex, arXiv, or publisher feeds.

### 4.2 `lookback`

Manual or scheduled retrospective search.

Example behavior:

```text
mode = lookback
lookback_days = 30
```

Search the most recent 30 days from the current run time.

A manual lookback run must not silently corrupt or move the normal recurring `auto` boundary unless the user explicitly chooses to mark that run as the new recurring-success state.

### 4.3 `range`

Explicit historical interval.

Example behavior:

```text
mode = range
start_date = 2026-01-01
end_date = 2026-06-30
```

The workflow searches only that interval. As with `lookback`, historical range runs should not silently change the recurring automation state.

## 5. Search strategy

The first stage intentionally searches broadly enough to avoid missing important thermoelectric work, then narrows with relevance and quality gates.

### 5.1 Core concepts

Initial high-priority concepts include:

- thermoelectric
- Seebeck effect
- thermoelectric material
- thermoelectric properties

### 5.2 Transport and performance concepts

- figure of merit
- zT
- power factor
- Seebeck coefficient
- electrical conductivity
- thermal conductivity
- lattice thermal conductivity
- carrier transport
- phonon transport

### 5.3 Materials-design concepts

- doping
- co-doping
- alloying
- band engineering
- band convergence
- resonant level
- defect engineering
- carrier concentration
- phonon scattering
- nanostructuring

### 5.4 Data-driven and discovery concepts

- machine learning thermoelectric
- AI thermoelectric
- materials informatics thermoelectric
- composition property prediction
- thermoelectric prediction
- high-throughput thermoelectric
- materials discovery thermoelectric

Search phrases are discovery aids rather than simple acceptance conditions. A paper does not qualify merely because one of these phrases appears once.

## 6. TE relevance gate

Before journal prestige or novelty can elevate a paper, the paper must pass a thermoelectric relevance gate.

A paper should pass when the title, abstract, subject metadata, source context, or trusted structured metadata indicates that thermoelectric behavior is a real research objective or core result.

Examples that should normally pass:

- thermoelectric material synthesis or optimization.
- Seebeck/transport mechanism studies where thermoelectric performance is central.
- zT, power-factor, carrier, or lattice-thermal-conductivity optimization aimed at TE performance.
- thermoelectric device studies with substantive materials/performance content.
- machine-learning, AI, or high-throughput work aimed at TE property prediction or materials discovery.

Examples that should normally fail unless TE significance is explicit:

- a paper that only mentions Seebeck or thermoelectricity in background text.
- unrelated photovoltaic, battery, photodetector, or generic thermal-management work.
- anomalous Nernst or spin-caloritronic work where conventional thermoelectric performance is not the target, unless configured as a watched adjacent topic.

A high-impact journal must never override failure of this relevance gate.

## 7. Research-quality policy

Research quality contributes 30/100 points.

### 7.1 Default quality threshold

The normal push target is approximately `Advanced Functional Materials` level or above. This is a practical quality baseline, not a rigid journal whitelist.

Typical high-priority journal families may include, where relevant:

- Nature.
- Science.
- Nature Materials.
- Nature Energy.
- Nature Communications.
- Science Advances.
- Energy & Environmental Science.
- Joule.
- Advanced Materials.
- Advanced Energy Materials.
- Advanced Functional Materials.
- other journals of comparable standing or exceptional relevance to thermoelectrics.

The exact monitored journal list remains configurable rather than hard-coded into ranking logic.

### 7.2 Lower-tier exception

A paper below the normal journal baseline may still enter A or B if its novelty and TE relevance are unusually strong. Examples include:

- a genuinely new TE material family.
- a clearly new transport mechanism with convincing evidence.
- a major performance jump or previously unseen operating regime.
- a strong new ML/AI method or dataset for TE materials.
- a result that directly changes how a major TE research problem can be approached.

Thus journal quality raises confidence but does not replace scientific judgment.

### 7.3 Preprints

Preprints are allowed under policy A:

- peer-reviewed high-quality work is prioritized.
- preprints must pass a stricter TE-relevance and novelty threshold.
- the digest must display `Preprint — not peer reviewed` prominently.
- preprints should not receive the same research-quality score as comparable peer-reviewed work merely because they come from a famous group or institution.

## 8. Scoring model

Every candidate that passes the TE relevance gate receives a score out of 100.

| Dimension | Weight | Meaning |
| --- | ---: | --- |
| TE relevance | 30 | How central thermoelectric science is to the actual paper. |
| Research quality | 30 | Venue/peer review plus evidence of a complete, credible study. |
| Novelty | 20 | How substantively new the material, mechanism, method, dataset, or result appears. |
| Research fit | 10 | Match to configured user priorities such as doping, transport, materials discovery, composition-property ML, B factor, or specific TE families. |
| Recency | 10 | Preference for genuinely new papers within the selected search window. |

### 8.1 Deterministic vs Codex judgment

The Python layer should calculate what can be calculated reproducibly:

- source type.
- peer-review/preprint status where available.
- target-journal membership.
- keyword and concept matches.
- publication date.
- watched-author matches.
- duplicate status.
- configured research-priority matches.

Codex should evaluate the aspects that need scientific interpretation:

- novelty.
- whether the stated novelty is substantive or incremental.
- whether the available evidence supports A/B/C promotion.
- the practical significance to thermoelectric research.

Codex must only judge from evidence actually supplied to it. If only title and abstract are available, the output must say that the novelty judgment is based on title/abstract/metadata, not full-text review.

## 9. A/B/C classification

### A — Read first / 必看

A paper is A when it is strongly thermoelectric, scientifically strong, and either highly innovative or unusually well matched to configured research priorities.

A papers should receive the longest summaries and appear first.

### B — Strong relevance / 值得关注

A paper is B when it is clearly relevant and credible, but the novelty, quality, or direct user fit is lower than the A tier.

B papers still receive structured summaries.

### C — Browse / 浏览即可

A paper is C when it remains relevant enough to record, but is peripheral, incremental, lower quality, or less aligned with the configured research agenda.

C papers should normally appear in a compact table/list at the end rather than consume the main digest.

There is no requirement to deliver every candidate. Papers that fail the TE gate are excluded rather than forced into C.

## 10. Paper summary schema

Every A and B paper should be summarized with the following fields.

### 10.1 Purpose

What problem does the paper aim to solve, and why does that problem matter?

### 10.2 Innovation

What is substantively new relative to the established approach?

The summary should distinguish among:

- new material.
- new dopant/alloy design.
- new mechanism.
- new performance regime or record.
- new experimental method.
- new theory.
- new ML/AI method.
- new dataset or screening strategy.
- incremental variant of an existing approach.

### 10.3 How the problem was addressed

Summarize the main route used by the authors, for example:

- synthesis/material design.
- characterization.
- transport analysis.
- first-principles or other theory.
- machine learning / AI.
- high-throughput screening.
- device design.

### 10.4 Results

Report the concrete effect/results available in the source evidence, such as:

- zT.
- power factor.
- Seebeck coefficient.
- electrical conductivity.
- lattice/total thermal conductivity.
- carrier concentration or mobility.
- optimum composition/doping level.
- operating temperature.
- relative improvement against a stated baseline.

Never invent numerical values. If an exact value is not present in the accessible source evidence, omit it or explicitly state that the available metadata does not provide it.

### 10.5 Mechanism

When supported by the source, summarize why the result occurred, such as:

- band convergence.
- resonant levels.
- carrier concentration optimization.
- defect or alloy scattering.
- phonon softening.
- nanostructure/interface effects.
- entropy or lattice effects.

### 10.6 Significance

Explain what the result changes or enables for future TE research. Avoid generic claims such as “this is important” without explaining why.

### 10.7 Limitations / caution

Identify limitations visible from the available evidence, for example:

- one material family only.
- narrow temperature range.
- no stability test.
- computational-only validation.
- small ML dataset.
- weak external validation.
- unclear split methodology.
- preprint status.

### 10.8 Radar assessment

Display:

```text
Grade: A / B / C
TE relevance: x/30
Research quality: x/30
Novelty: x/20
Research fit: x/10
Recency: x/10
Total: x/100
```

Then add one short sentence answering either:

- why this paper is worth reading now, or
- why it can safely remain a lower-priority browse item.

## 11. Default research profile

The V1 configuration should ship with a broad TE profile centered on:

- thermoelectric materials.
- Seebeck effect and transport.
- zT and power-factor optimization.
- doping and co-doping optimization.
- band/defect/phonon engineering.
- carrier and phonon transport.
- machine learning / AI for thermoelectrics.
- composition-to-property prediction.
- materials discovery and high-throughput screening.

The configuration should remain editable so materials systems, authors, and subfields can be added without changing code.

## 12. Sources and adapters

### Crossref

Use for authoritative DOI/journal metadata and target-journal monitoring through verified ISSNs.

### OpenAlex

Use for broad discovery across materials-science publications, author/source metadata, concepts, and overlapping literature coverage.

### arXiv / preprint source

Use for new methods and emerging work, especially data-driven materials discovery and ML/AI topics. Preprint status must propagate to ranking and output.

### RSS/Atom

Use for publisher, journal, society, or other trusted feeds that provide useful early notification.

Source adapters should normalize into a shared paper record rather than leak source-specific fields into the ranking layer.

## 13. Deduplication and state

Primary identity order:

1. normalized DOI.
2. normalized source-specific stable ID where trustworthy.
3. normalized title plus primary-author fallback.

Persistent state must record already successfully delivered paper identities.

The workflow should only mark a scheduled run successful after its final required output/delivery has completed. This preserves retry behavior if fetching or email delivery fails.

Manual `lookback` and `range` searches must be able to run without unintentionally advancing the scheduled `auto` cursor.

## 14. Output

### Markdown digest

Main human-readable artifact and plain-text email fallback.

Suggested sections:

1. Run metadata and search window.
2. A — 必看.
3. B — 值得关注.
4. C — 浏览即可.
5. Search/source warnings.
6. Papers excluded from novelty analysis because evidence was insufficient, when relevant.

### HTML email

Readable HTML rendering of the same content, with A/B/C visual hierarchy and prominent preprint labels.

The HTML email must not contain claims unsupported by the structured analysis record.

### Structured JSON

Retain a machine-readable fetch/ranking/analysis artifact to make the workflow auditable and extensible later.

## 15. Automation

The Skill should be callable directly by Codex and compatible with a scheduler.

A normal weekly automation may invoke the full pipeline once per week in `auto` mode. The exact weekday and time belong to the scheduler configuration, not the Skill's ranking logic.

The code must also support manual commands for:

- a normal auto run.
- a recent-N-days lookback run.
- an explicit date-range run.
- fetch/rank without sending email for review/debugging.

## 16. Error handling

- One source failing must not automatically invalidate successful data from other sources; source errors should be recorded in the output.
- The run should fail when the required final delivery cannot be produced.
- State must not advance after a failed required delivery.
- Invalid date ranges or contradictory time-window parameters must fail before network access.
- Missing optional abstracts must be marked as title-only/metadata-only rather than filled in by inference.
- Codex novelty analysis must never be represented as full-paper analysis when only title/abstract evidence was available.

## 17. Testing requirements

V1 must include automated tests for at least:

- `auto`, `lookback`, and `range` time-window resolution.
- 48-hour overlap behavior.
- manual historical search not advancing auto state by default.
- DOI dedupe.
- title/author fallback dedupe.
- TE relevance gating independent of journal prestige.
- peer-reviewed vs preprint quality handling.
- lower-tier high-novelty exception behavior.
- A/B/C classification boundaries.
- no fabricated result numbers when evidence lacks a value.
- source failure degradation.
- state advancement only after successful final delivery.

Tests must mock external network, email, and Codex/LLM behavior rather than contacting real services.

## 18. Compatibility and migration

The existing repository's PaperEcho weekly monitor remains available on `main` during development. The new Skill should be implemented as a separable workflow so it can be compared against the existing monitor before any migration decision.

No existing production workflow should be deleted in the first implementation phase.

A later migration can be considered only after the new radar demonstrates:

- reliable source coverage.
- acceptable false-positive and false-negative behavior.
- stable A/B/C judgments.
- useful summaries.
- correct recurring state behavior.
- successful scheduled delivery.

## 19. Success criteria

The V1 design is successful when a scheduled run can:

1. search the configured TE sources for the selected interval.
2. deduplicate new records and avoid re-delivering prior successful papers.
3. exclude papers that are not genuinely thermoelectric even if published in prestigious venues.
4. prioritize roughly AFM-level-and-above peer-reviewed work.
5. retain unusually innovative lower-tier work.
6. retain highly relevant, novel preprints with an explicit warning.
7. produce reproducible base scores plus evidence-bounded Codex novelty judgments.
8. classify papers into A/B/C.
9. summarize purpose, innovation, approach, results, mechanism, significance, limitations, and radar score without inventing evidence.
10. support `auto`, `lookback`, and `range` searches.
11. generate Markdown and HTML-email-ready output.
12. leave the current PaperEcho production path unchanged until a later explicit migration decision.
