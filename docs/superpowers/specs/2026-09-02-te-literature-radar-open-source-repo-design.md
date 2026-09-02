# TE Literature Radar Standalone Open-Source Repository Design

Date: 2026-09-02

## 1. Goal

Create a separate public GitHub repository named `te-literature-radar` that contains only the TE Literature Radar source distribution. The repository must be understandable and runnable by another researcher without needing the existing `thermoelectric-paper` repository or its PaperEcho workflows.

This is the open-source source-code edition only. It is not the later one-click install/package edition.

## 2. Distribution model

The repository is a source repository that users clone or open in Codex.

```text
GitHub: te-literature-radar
        ↓
clone / open repository in Codex
        ↓
copy config.example.json → config.json
        ↓
run Python scripts and/or use $te-literature-radar
        ↓
Crossref + OpenAlex + arXiv + RSS
        ↓
Codex evidence-bounded novelty/summary step
        ↓
validated A/B/C digest
```

GitHub stores and versions the source. The repository itself is not a hosted web application, daemon, or GUI.

## 3. Repository contents

The standalone repository must contain only files needed to understand, configure, test, and run the TE Literature Radar.

Target structure:

```text
te-literature-radar/
├── README.md
├── README.zh-CN.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── .gitignore
├── config.example.json
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── scoring-policy.md
│   ├── analysis-contract.md
│   └── source-policy.md
├── scripts/
│   ├── radar_cli.py
│   ├── finalize_radar.py
│   ├── render_digest.py
│   ├── send_digest.py
│   └── te_radar/
│       ├── __init__.py
│       ├── analysis.py
│       ├── config.py
│       ├── dedupe.py
│       ├── pipeline.py
│       ├── records.py
│       ├── scoring.py
│       ├── state.py
│       ├── time_window.py
│       └── sources/
│           ├── __init__.py
│           ├── arxiv.py
│           ├── common.py
│           ├── crossref.py
│           ├── openalex.py
│           └── rss.py
├── tests/
│   ├── helpers.py
│   ├── test_analysis.py
│   ├── test_dedupe_state.py
│   ├── test_pipeline.py
│   ├── test_render_email.py
│   ├── test_scoring.py
│   ├── test_sources.py
│   └── test_time_window.py
└── example-output/
    ├── sample-digest.md
    └── sample-final.json
```

The standalone repository must not contain the existing PaperEcho code, PaperEcho patches/configs, old GitHub Actions workflows, unrelated thermoelectric research files, or the superpowers planning documents used to build it.

## 4. License and attribution

### 4.1 Project license

Use the MIT License for the standalone project.

The project license should identify the new repository copyright holder as:

```text
Copyright (c) 2026 953836942-dot
```

### 4.2 Upstream attribution

The project was inspired by and partially adapted from `lishn6/daily-econ-literature-radar`, which is distributed under the MIT License with `Copyright (c) 2026 lishn6`.

The new repository must include `THIRD_PARTY_NOTICES.md` containing:

- the upstream repository name and GitHub URL;
- a statement that the TE version was inspired by/adapted from its literature-radar architecture;
- the upstream MIT copyright notice and permission notice, sufficient to preserve attribution for any substantial portions adapted from that project.

The new project must not imply that `lishn6` authored or endorsed the TE-specific implementation.

## 5. Security and private configuration boundary

The public repository must never require or encourage committing personal credentials.

`.gitignore` must exclude at least:

```text
config.json
te-literature-radar.config.json
.secrets/
.env
.env.*
te-literature-radar-output/
__pycache__/
*.pyc
.DS_Store
```

`config.example.json` must contain no real email address, API secret, password, personal identifier, or private endpoint.

SMTP passwords must only be read from:

1. the configured environment variable; or
2. an ignored local `.secrets/` file.

Email must remain disabled by default.

## 6. Runtime requirements

V1 remains Python standard-library only.

Required runtime:

- Python 3.11 or newer.
- Internet access to public metadata endpoints when performing real searches.
- No paid API is required for Crossref, OpenAlex, arXiv, or RSS discovery.
- Codex is required only for the novelty/scientific-summary stage in the documented Skill workflow; deterministic fetch/scoring components remain ordinary Python code.

Do not add a third-party package manager dependency merely for distribution. No `requirements.txt` is required when there are no external Python packages.

## 7. README requirements

### 7.1 Primary README

`README.md` is the main public entry point and should be in English for broad reuse. It must include:

1. One-paragraph description.
2. What it does.
3. Architecture diagram in text.
4. Key trust/safety rules.
5. Requirements.
6. Five-minute Quick Start.
7. Running with Codex Skill.
8. Running deterministic/manual searches.
9. `auto`, `lookback`, and `range` examples.
10. Configuration fields users usually change.
11. Optional email setup.
12. Test command.
13. Output files.
14. Privacy/security warning.
15. Known limitations.
16. License and attribution.
17. Link to `README.zh-CN.md`.

### 7.2 Chinese README

`README.zh-CN.md` should provide the same essential setup/use information in Chinese, but does not need to duplicate every implementation detail word-for-word.

## 8. Quick Start behavior

The README should make the basic source workflow executable from the repository root.

```bash
cp config.example.json config.json
python3 scripts/radar_cli.py fetch --config config.json --mode lookback --lookback-days 7
```

The first command creates a private local configuration ignored by git.

The second command performs deterministic discovery/filtering and outputs a fetch JSON. It does not pretend to complete the Codex novelty-analysis step by itself.

For the full Codex workflow, the README should instruct the user to open the repository in Codex and invoke the repository Skill `$te-literature-radar` using `config.json`.

## 9. Configuration defaults

The standalone `config.example.json` should retain the approved TE defaults:

- `thermoelectric` and `Seebeck effect` core concepts;
- TE transport and performance concepts;
- doping/band/defect/phonon engineering concepts;
- ML/AI/materials-discovery concepts;
- scoring weights 30/30/20/10/10;
- verified high-quality target journal ISSNs;
- OpenAlex and arXiv enabled;
- RSS optional;
- email disabled.

The default language may remain `zh-CN`, because the current scientific summaries are intended to be readable by the initial user, but README must explain that this is configurable.

## 10. Example output

The public repository should include synthetic examples only.

`example-output/sample-final.json` and `example-output/sample-digest.md` must:

- use invented paper titles/authors/DOIs/URLs or clearly synthetic identifiers;
- demonstrate A, B, C and preprint labels;
- contain no copied paywalled full text;
- show the purpose/innovation/approach/results/mechanism/significance/limitations structure;
- demonstrate score breakdowns;
- avoid implying the examples are real scientific claims.

The README must label these files as synthetic demonstrations.

## 11. Source behavior retained from the approved TE Radar

The standalone repository must preserve the already-approved implementation behavior:

- Crossref, OpenAlex, arXiv, RSS adapters.
- DOI-first deduplication and title/author fallback.
- `auto`, `lookback`, `range` time windows.
- 48-hour overlap for recurring `auto` mode.
- manual historical searches do not advance recurring state by default.
- hard TE relevance gate before journal prestige.
- score dimensions: relevance 30, quality 30, novelty 20, research fit 10, recency 10.
- peer-reviewed work prioritized.
- lower-tier high-novelty exception allowed.
- preprints explicitly marked and held to stricter thresholds.
- Codex cannot set final total or A/B/C directly.
- generated numerical scientific claims must be present in supplied evidence.
- title/abstract/metadata analysis must not be represented as full-text review.
- state advances only after required final output/delivery succeeds.

No behavior change is intended as part of repository extraction unless a standalone-path bug is found by tests.

## 12. Path normalization for standalone repository

The current source lives under `te-literature-radar/...` inside the mixed repository. In the standalone repository, that inner directory becomes the repository root.

Therefore commands and documentation must change from:

```text
python3 te-literature-radar/scripts/radar_cli.py ...
```

to:

```text
python3 scripts/radar_cli.py ...
```

`SKILL.md` must also use standalone-root paths.

Tests must prove the standalone paths work.

## 13. Testing and release gate

Before calling the standalone source edition ready, perform all of the following against the new repository itself:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q scripts
```

Additional release checks:

- `config.example.json` parses and validates.
- `.gitignore` contains the private config, `.secrets`, `.env`, and output patterns.
- `README.md` Quick Start commands reference files that actually exist.
- `SKILL.md` contains no old mixed-repository path prefix.
- search source tests remain fully mocked.
- no test contacts external services.
- no secret-like credential value is committed.
- standalone repository contains no PaperEcho files.

## 14. GitHub repository settings

Create a new public repository:

```text
953836942-dot/te-literature-radar
```

Repository description:

```text
A Codex-assisted open-source radar for discovering, ranking, and summarizing high-quality thermoelectric literature.
```

Default branch: `main`.

The first public source edition should be committed directly as a coherent initial import into the new repository after local/isolated verification. No GitHub Release or one-click installer is required in this phase.

## 15. Explicit non-goals

Do not include in this source-edition task:

- one-click Codex Skill installation;
- plugin/package marketplace publishing;
- GUI or web application;
- Zotero integration;
- database/vector store;
- automatic full-text/paywalled PDF downloading;
- GitHub Actions scheduled weekly delivery;
- migration or deletion of the old PaperEcho workflows;
- merging the feature branch into the old mixed repository solely to publish the standalone project.

These can be considered separately after the source repository has been used and validated.

## 16. Success criteria

The source edition is ready when another researcher can:

1. open the public repository and understand the project from the README;
2. clone it without any unrelated PaperEcho files;
3. copy `config.example.json` to ignored `config.json`;
4. run a deterministic 7-day fetch using the documented command;
5. customize research topics, journals, authors, dates, and optional email settings without editing Python code;
6. open the repository in Codex and use `$te-literature-radar` for novelty assessment and final A/B/C summaries;
7. run the complete local unit-test suite successfully;
8. inspect MIT licensing and upstream attribution;
9. avoid committing credentials by following defaults and `.gitignore`;
10. share the GitHub URL with another researcher as the supported open-source source-code distribution.
