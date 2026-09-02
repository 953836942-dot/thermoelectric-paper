# TE Literature Radar Standalone Open-Source Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the validated TE Literature Radar from the mixed `thermoelectric-paper` repository into a clean, public, standalone source repository that another researcher can clone, configure, test, and use with Python/Codex without any PaperEcho files or private credentials.

**Architecture:** Treat the existing `feature/te-literature-radar` implementation as the behavioral source of truth, but rebuild its distribution layout so the current inner `te-literature-radar/` directory becomes the standalone repository root. Preserve all deterministic search/scoring/state behavior, change only standalone paths and release documentation, add licensing/security/sample-output assets, then re-run the complete test suite against the extracted repository itself before publishing it.

**Tech Stack:** Python 3.11+ standard library; Codex repository Skill (`SKILL.md`, `agents/openai.yaml`); JSON configuration/state; Markdown/HTML output; Git/GitHub.

**Spec:** `docs/superpowers/specs/2026-09-02-te-literature-radar-open-source-repo-design.md`

## Global Constraints

- New public repository name: `953836942-dot/te-literature-radar`.
- Repository description: `A Codex-assisted open-source radar for discovering, ranking, and summarizing high-quality thermoelectric literature.`
- Default branch: `main`.
- Source edition only; do not add one-click install, plugin publishing, GUI, Zotero, database/vector store, paywalled PDF downloading, or scheduled GitHub Actions.
- Runtime remains Python 3.11+ standard library only; do not add third-party Python dependencies.
- Preserve existing TE Radar behavior unless a standalone-path bug is exposed by tests.
- Preserve Crossref, OpenAlex, arXiv, and RSS adapters.
- Preserve score weights exactly: relevance 30, quality 30, novelty 20, research fit 10, recency 10.
- Preserve deterministic A/B/C grading; Codex does not directly assign final grade.
- Preserve `auto`, `lookback`, and `range` semantics, including the default 48-hour auto overlap.
- Preserve evidence-bounded numeric validation and the rule that metadata/abstract analysis is not full-text review.
- Preserve stricter preprint thresholds and explicit `Preprint — not peer reviewed` labeling.
- Email remains disabled by default.
- Private `config.json`, `.secrets/`, `.env*`, and generated output must be ignored by git.
- Standalone repository must not contain PaperEcho files, old weekly workflows, thermoelectric project-specific research files, or superpowers development documents.
- Project license is MIT, copyright `Copyright (c) 2026 953836942-dot`.
- `THIRD_PARTY_NOTICES.md` must preserve attribution to `lishn6/daily-econ-literature-radar` and its MIT notice.
- Current GitHub connector cannot create a new repository. Execution must stop at the one-time repository-creation handoff, ask the user to create an empty public `953836942-dot/te-literature-radar` repository, then resume automatically once that repository is visible to the connector.

---

## Target Standalone File Structure

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
│   ├── __init__.py
│   ├── helpers.py
│   ├── test_analysis.py
│   ├── test_dedupe_state.py
│   ├── test_pipeline.py
│   ├── test_render_email.py
│   ├── test_scoring.py
│   ├── test_sources.py
│   ├── test_time_window.py
│   └── test_release_layout.py
└── example-output/
    ├── sample-digest.md
    └── sample-final.json
```

---

### Task 1: Build an isolated standalone source tree from the validated feature branch

**Source files:**
- Copy from `thermoelectric-paper@feature/te-literature-radar`: `te-literature-radar/scripts/**`
- Copy from: `te-literature-radar/references/**`
- Copy from: `te-literature-radar/agents/**`
- Copy from: `te-literature-radar/SKILL.md`
- Copy/rename from: `te-literature-radar.config.example.json` → `config.example.json`
- Copy from: `tests/te_literature_radar/**` → `tests/**`

**Destination:**
- Local isolated staging root, e.g. `/mnt/data/te-literature-radar-standalone/`, before any new GitHub repository is populated.

**Interfaces:**
- Produces a standalone filesystem tree where `scripts/`, `tests/`, `SKILL.md`, and `config.example.json` all exist directly at repository root.
- Later tasks modify only this staging tree until the release gate passes.

- [ ] **Step 1: Materialize/copy only the approved TE Radar files into the staging root**

The copy map is exact:

```text
old: te-literature-radar/SKILL.md                  → new: SKILL.md
old: te-literature-radar/agents/openai.yaml       → new: agents/openai.yaml
old: te-literature-radar/references/*             → new: references/*
old: te-literature-radar/scripts/*                → new: scripts/*
old: te-literature-radar.config.example.json      → new: config.example.json
old: tests/te_literature_radar/*                  → new: tests/*
```

Do not copy:

```text
.github/
configs/
paperecho-config/
paperecho-patch/
scripts/ from the mixed repository root
docs/superpowers/
README.md from the mixed repository
```

- [ ] **Step 2: Assert the staged top-level layout before modifying content**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('/mnt/data/te-literature-radar-standalone')
required = {
    'SKILL.md', 'config.example.json', 'agents', 'references', 'scripts', 'tests'
}
missing = sorted(required - {p.name for p in root.iterdir()})
assert not missing, missing
for forbidden in ['paperecho-config', 'paperecho-patch', '.github', 'configs']:
    assert not (root / forbidden).exists(), forbidden
print('standalone layout seed: OK')
PY
```

Expected: `standalone layout seed: OK`.

- [ ] **Step 3: Run the copied tests before any standalone path edits**

Run from the staging root:

```bash
python3 -m unittest discover -s tests -v
```

Expected: tests that are path-independent pass; any failures must be only standalone-path assumptions and must be recorded before fixes.

- [ ] **Step 4: Record the source commit used for extraction**

Create a local release note variable/file during execution recording the exact source feature-branch commit SHA. Use it in the initial import commit message, for example:

```text
Initial standalone import from thermoelectric-paper feature/te-literature-radar @ <SOURCE_SHA>
```

No source-development plan/spec files are copied into the standalone repository.

---

### Task 2: Normalize every path and config name for standalone-root execution

**Files:**
- Modify: `SKILL.md`
- Modify: `scripts/radar_cli.py` only if a root-relative assumption is discovered
- Modify: `scripts/finalize_radar.py` only if a root-relative assumption is discovered
- Modify: `tests/helpers.py`
- Modify copied tests only where old mixed-repository paths remain
- Create: `tests/test_release_layout.py`

**Interfaces:**
- Produces working repository-root commands:
  - `python3 scripts/radar_cli.py fetch --config config.json ...`
  - `python3 scripts/finalize_radar.py --config config.json ...`
- `SKILL.md` consumes only standalone-root paths.

- [ ] **Step 1: Write failing release-layout/path tests before changing `SKILL.md`**

Create `tests/test_release_layout.py`:

```python
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReleaseLayoutTests(unittest.TestCase):
    def test_required_release_files_exist(self):
        for relative in [
            'SKILL.md', 'config.example.json',
            'scripts/radar_cli.py', 'scripts/finalize_radar.py',
            'references/scoring-policy.md',
            'references/analysis-contract.md',
            'references/source-policy.md',
        ]:
            self.assertTrue((ROOT / relative).is_file(), relative)

    def test_skill_uses_standalone_paths(self):
        text = (ROOT / 'SKILL.md').read_text(encoding='utf-8')
        self.assertNotIn('te-literature-radar/scripts/', text)
        self.assertNotIn('te-literature-radar.config.json', text)
        self.assertIn('python3 scripts/radar_cli.py', text)
        self.assertIn('--config config.json', text)

    def test_no_mixed_repository_directories(self):
        for forbidden in ['paperecho-config', 'paperecho-patch', 'configs']:
            self.assertFalse((ROOT / forbidden).exists(), forbidden)
```

- [ ] **Step 2: Run the new test and verify the old Skill paths fail**

```bash
python3 -m unittest tests.test_release_layout -v
```

Expected before edits: `test_skill_uses_standalone_paths` fails because copied `SKILL.md` still contains the mixed-repository prefix.

- [ ] **Step 3: Replace all old Skill command paths**

Use these exact standalone commands in `SKILL.md`:

```bash
python3 scripts/radar_cli.py fetch --config config.json --mode auto
python3 scripts/radar_cli.py validate-analysis --fetch FETCH.json --analysis ANALYSIS.json
python3 scripts/finalize_radar.py --config config.json --fetch FETCH.json --analysis ANALYSIS.json
python3 scripts/radar_cli.py fetch --config config.json --mode lookback --lookback-days 30
python3 scripts/radar_cli.py fetch --config config.json --mode range --start-date 2026-01-01 --end-date 2026-06-30
```

Do not keep `te-literature-radar/` path prefixes in any user-facing command.

- [ ] **Step 4: Make test importing independent of the old parent repository**

`tests/helpers.py` must resolve the standalone root with:

```python
from pathlib import Path
import sys


def import_te_radar():
    root = Path(__file__).resolve().parents[1]
    scripts = root / 'scripts'
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    import te_radar
    return te_radar
```

No test may refer to `parents[2] / 'te-literature-radar'` after extraction.

- [ ] **Step 5: Search the complete standalone tree for stale mixed-repository paths**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('.')
needles = ['te-literature-radar/scripts/', 'te-literature-radar.config.json', 'thermoelectric-paper']
for path in root.rglob('*'):
    if not path.is_file() or '.git' in path.parts:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    for needle in needles:
        if needle in text:
            print(path, needle)
PY
```

Expected after path normalization: no executable/docs path references remain to the old mixed layout. The string `thermoelectric-paper` may appear only in local extraction provenance before publication; it must not be present in the final public tree unless intentionally cited in development history, which this spec excludes.

- [ ] **Step 6: Run all tests**

```bash
python3 -m unittest discover -s tests -v
```

Expected: all copied tests plus `test_release_layout.py` pass.

---

### Task 3: Add open-source licensing, attribution, git-ignore, and security release checks

**Files:**
- Create: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `.gitignore`
- Modify: `config.example.json` only if a real/personal value is discovered
- Modify: `tests/test_release_layout.py`

**Interfaces:**
- Public users may safely copy `config.example.json` to `config.json` without exposing secrets by default.
- Git ignores private config, credentials, environment files, caches, and generated output.

- [ ] **Step 1: Extend release-layout tests for security files**

Add:

```python
    def test_gitignore_protects_private_runtime_files(self):
        rules = set((ROOT / '.gitignore').read_text(encoding='utf-8').splitlines())
        for required in [
            'config.json', 'te-literature-radar.config.json',
            '.secrets/', '.env', '.env.*', 'te-literature-radar-output/',
            '__pycache__/', '*.pyc', '.DS_Store'
        ]:
            self.assertIn(required, rules)

    def test_example_config_does_not_enable_email(self):
        import json
        cfg = json.loads((ROOT / 'config.example.json').read_text(encoding='utf-8'))
        self.assertFalse(cfg['email']['enabled'])
        self.assertEqual(cfg['email']['smtp_username'], '')
        self.assertEqual(cfg['email']['from'], '')
        self.assertEqual(cfg['email']['to'], '')
```

- [ ] **Step 2: Create `.gitignore` exactly with safe public defaults**

```gitignore
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

- [ ] **Step 3: Create the project MIT `LICENSE`**

Use the standard MIT text headed:

```text
MIT License

Copyright (c) 2026 953836942-dot
```

Follow it with the standard MIT permission, warranty, and liability paragraphs unchanged.

- [ ] **Step 4: Create `THIRD_PARTY_NOTICES.md` with upstream attribution**

The file must contain:

```markdown
# Third-Party Notices

## daily-econ-literature-radar

TE Literature Radar was inspired by and partially adapted from the architecture of:

- Project: `lishn6/daily-econ-literature-radar`
- Source: https://github.com/lishn6/daily-econ-literature-radar
- License: MIT
- Upstream copyright: Copyright (c) 2026 lishn6

The TE-specific search policy, thermoelectric relevance gate, scoring model,
Codex evidence contract, preprint policy, time-window behavior, and release
packaging are maintained independently by this project. Upstream attribution
does not imply endorsement of this project by the upstream author.

The upstream MIT permission notice applies to any substantial portions adapted
from that project:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

Do not claim that `lishn6` authored the TE-specific implementation.

- [ ] **Step 5: Add a lightweight secret-pattern release scan**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import re
root = Path('.')
patterns = {
    'gmail_app_password_literal': re.compile(r'(?i)gmail.{0,20}app.{0,20}password\s*[:=]\s*["\'][^"\']{8,}'),
    'generic_api_key_literal': re.compile(r'(?i)(api[_ -]?key|token|secret)\s*[:=]\s*["\'][A-Za-z0-9_\-]{16,}["\']'),
}
found = []
for path in root.rglob('*'):
    if not path.is_file() or '.git' in path.parts:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    for name, pattern in patterns.items():
        if pattern.search(text):
            found.append((str(path), name))
assert not found, found
print('secret-pattern scan: OK')
PY
```

Expected: `secret-pattern scan: OK`.

- [ ] **Step 6: Run release-layout tests again**

```bash
python3 -m unittest tests.test_release_layout -v
```

Expected: all release/security checks pass.

---

### Task 4: Write public English/Chinese documentation and synthetic example outputs

**Files:**
- Create: `README.md`
- Create: `README.zh-CN.md`
- Create: `example-output/sample-final.json`
- Create: `example-output/sample-digest.md`
- Modify: `tests/test_release_layout.py`

**Interfaces:**
- README Quick Start is executable from repository root.
- Synthetic sample output demonstrates the format without presenting invented data as real science.

- [ ] **Step 1: Add documentation existence/content tests**

Add to `tests/test_release_layout.py`:

```python
    def test_public_readmes_have_required_commands(self):
        english = (ROOT / 'README.md').read_text(encoding='utf-8')
        chinese = (ROOT / 'README.zh-CN.md').read_text(encoding='utf-8')
        command = 'python3 scripts/radar_cli.py fetch --config config.json --mode lookback --lookback-days 7'
        self.assertIn('cp config.example.json config.json', english)
        self.assertIn(command, english)
        self.assertIn('$te-literature-radar', english)
        self.assertIn(command, chinese)
        self.assertIn('README.zh-CN.md', english)

    def test_synthetic_examples_are_clearly_labeled(self):
        digest = (ROOT / 'example-output/sample-digest.md').read_text(encoding='utf-8')
        final = (ROOT / 'example-output/sample-final.json').read_text(encoding='utf-8')
        self.assertIn('SYNTHETIC EXAMPLE', digest)
        self.assertIn('synthetic', final.lower())
```

- [ ] **Step 2: Write `README.md` with this exact section order**

```markdown
# TE Literature Radar
[Chinese README link]

## What it does
## How it works
## Trust and evidence rules
## Requirements
## 5-minute Quick Start
## Use with Codex
## Search time windows
## Configuration
## Optional email delivery
## Outputs
## Synthetic example output
## Tests
## Privacy and credential safety
## Known limitations
## License and attribution
```

The Quick Start must contain:

```bash
git clone https://github.com/953836942-dot/te-literature-radar.git
cd te-literature-radar
cp config.example.json config.json
python3 scripts/radar_cli.py fetch --config config.json --mode lookback --lookback-days 7
```

The README must explicitly say that this last command produces deterministic candidate/fetch output only; the full novelty/scientific-summary stage is performed by Codex using `$te-literature-radar`.

- [ ] **Step 3: Document all three time modes in both READMEs**

Use these commands:

```bash
# recurring state-aware search
python3 scripts/radar_cli.py fetch --config config.json --mode auto

# recent N days, no recurring-state mutation by default
python3 scripts/radar_cli.py fetch --config config.json --mode lookback --lookback-days 30

# explicit historical interval
python3 scripts/radar_cli.py fetch --config config.json --mode range --start-date 2026-01-01 --end-date 2026-06-30
```

- [ ] **Step 4: Document the Codex workflow accurately**

The README must explain:

```text
Open/clone the repository in Codex
→ invoke $te-literature-radar using config.json
→ deterministic fetch
→ Codex novelty/summary JSON from supplied evidence
→ validator rejects unsupported numbers
→ deterministic final A/B/C grading
→ Markdown/HTML email output
```

Do not say that merely cloning the repository globally installs the Skill.

- [ ] **Step 5: Create `sample-final.json` with synthetic A/B/C/preprint entries**

The JSON must contain a top-level marker:

```json
{
  "example_kind": "synthetic demonstration; not real scientific literature",
  "papers": []
}
```

Include four fictional entries:

```text
A: "Synthetic high-zT telluride study"
B: "Synthetic carrier-optimization study"
C: "Synthetic peripheral TE device study"
Preprint: "Synthetic ML screening preprint"
```

Use fictional identifiers such as:

```text
doi:10.0000/synthetic.a
https://example.invalid/synthetic-a
```

Do not use titles, authors, abstracts, or numerical claims copied from a real paper.

- [ ] **Step 6: Create `sample-digest.md` rendered from the same fictional records**

First line:

```markdown
> **SYNTHETIC EXAMPLE — all papers and scientific claims below are fictional and only demonstrate output formatting.**
```

Show A/B/C headings, score breakdowns, purpose, innovation, approach, result, mechanism, significance, limitations, radar note, and the explicit preprint warning.

- [ ] **Step 7: Run documentation tests**

```bash
python3 -m unittest tests.test_release_layout -v
```

Expected: all documentation/layout tests pass.

---

### Task 5: Run the complete standalone release gate before any public repository upload

**Files:**
- No new behavior files unless a test exposes a standalone bug.
- Modify tests/code only to fix failures proven by this standalone release gate.

**Interfaces:**
- Produces a verified staging tree ready for a coherent initial public commit.

- [ ] **Step 1: Validate the example config using production config code**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import sys
sys.path.insert(0, str((Path('.') / 'scripts').resolve()))
from te_radar.config import load_config, validate_config
cfg = load_config(Path('config.example.json'))
validate_config(cfg)
assert cfg['score_weights'] == {
    'te_relevance': 30,
    'research_quality': 30,
    'novelty': 20,
    'research_fit': 10,
    'recency': 10,
}
assert cfg['email']['enabled'] is False
print('config validation: OK')
PY
```

Expected: `config validation: OK`.

- [ ] **Step 2: Run the complete unit test suite**

```bash
python3 -m unittest discover -s tests -v
```

Expected: zero failures/errors.

- [ ] **Step 3: Compile every Python file**

```bash
python3 -m compileall -q scripts
```

Expected: exit code 0.

- [ ] **Step 4: Verify no external calls occur in tests**

Review `tests/test_sources.py` and other source-related tests for `unittest.mock.patch` of HTTP access. Then run tests in an environment where real network access is not required. Any test that attempts Crossref/OpenAlex/arXiv/RSS live access is a release blocker.

- [ ] **Step 5: Verify the public tree contains no PaperEcho/mixed-repo artifacts**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('.')
forbidden_names = {
    'paperecho-config', 'paperecho-patch', 'research-directions.toml',
    'researchers.toml', 'paper-digest-stock-smoke.yml',
    'paperecho-weekly.yml', 'thermoelectric-weekly.yml'
}
hits = [str(p) for p in root.rglob('*') if p.name in forbidden_names]
assert not hits, hits
print('PaperEcho/mixed-repo scan: OK')
PY
```

Expected: `PaperEcho/mixed-repo scan: OK`.

- [ ] **Step 6: Re-run the secret-pattern scan and release-layout tests**

Run the Task 3 secret scan and:

```bash
python3 -m unittest tests.test_release_layout -v
```

Expected: both pass.

- [ ] **Step 7: Capture a release manifest**

Before upload, record locally:

```bash
find . -type f -not -path './.git/*' | sort
```

Review the list manually against the target structure. No development spec/plan file is allowed in the standalone tree.

---

### Task 6: Create the empty public GitHub repository through a one-time user handoff

**Files:** none.

**Constraint:** The currently available GitHub connector has no repository-creation action.

- [ ] **Step 1: Stop and ask the user to create exactly one empty repository**

Required GitHub UI values:

```text
Owner: 953836942-dot
Repository name: te-literature-radar
Visibility: Public
Description: A Codex-assisted open-source radar for discovering, ranking, and summarizing high-quality thermoelectric literature.
Initialize repository with README: No
Add .gitignore: None
Choose a license: None
```

The repository must be empty so the verified staging tree can be imported coherently.

- [ ] **Step 2: Wait until `953836942-dot/te-literature-radar` is visible to the GitHub connector**

Verify with repository lookup. Do not create a similarly named replacement repository.

- [ ] **Step 3: Confirm it is public and empty before upload**

Required checks:

```text
repository_full_name == 953836942-dot/te-literature-radar
visibility == public
default_branch/main may not yet exist because repository is empty
```

If the user accidentally initialized it with a README/license, do not overwrite unrelated history without approval; instead adjust the import approach explicitly.

---

### Task 7: Populate the new repository as one coherent initial source import

**Files:** all verified standalone release files from Tasks 1–5.

**Interfaces:**
- Produces public `main` containing the exact verified standalone tree.

- [ ] **Step 1: Upload the verified tree without adding extra files**

Preferred initial history:

```text
Initial standalone TE Literature Radar source edition
```

The commit/body/provenance note should mention that the standalone code was extracted from the validated TE Radar feature implementation, but public repository contents must remain independent of the old PaperEcho project.

- [ ] **Step 2: Verify the remote root contains exactly the expected public categories**

Expected top-level items:

```text
.gitignore
LICENSE
README.md
README.zh-CN.md
THIRD_PARTY_NOTICES.md
SKILL.md
agents/
config.example.json
example-output/
references/
scripts/
tests/
```

No `.github/workflows/` is added in this phase.

- [ ] **Step 3: Fetch and inspect critical remote files**

Verify remotely:

```text
README.md
README.zh-CN.md
LICENSE
THIRD_PARTY_NOTICES.md
.gitignore
config.example.json
SKILL.md
scripts/radar_cli.py
scripts/te_radar/sources/openalex.py
tests/test_release_layout.py
```

Ensure the remote bytes correspond to the verified staging versions.

---

### Task 8: Re-verify the published repository and produce the shareable handoff

**Files:** no new behavior files unless remote verification finds a publication error.

- [ ] **Step 1: Obtain a fresh working copy of the published repository when network/container access permits**

Run:

```bash
git clone https://github.com/953836942-dot/te-literature-radar.git /mnt/data/te-literature-radar-release-check
cd /mnt/data/te-literature-radar-release-check
```

If container DNS prevents cloning, use GitHub connector file retrieval to reconstruct the published tree for focused verification and clearly report that full clone verification was blocked by environment DNS rather than silently claiming it ran.

- [ ] **Step 2: Run the full test suite on the published copy**

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q scripts
```

Expected: zero test failures/errors and compile exit 0.

- [ ] **Step 3: Re-run config/security/layout checks on the published copy**

Required:

```text
config validation: OK
secret-pattern scan: OK
PaperEcho/mixed-repo scan: OK
all test_release_layout tests PASS
```

- [ ] **Step 4: Check the actual user Quick Start against the public file layout**

Confirm every file referenced by:

```bash
cp config.example.json config.json
python3 scripts/radar_cli.py fetch --config config.json --mode lookback --lookback-days 7
```

exists on `main`.

Do not run a real network fetch merely to prove release packaging if network access is unavailable; the adapter tests are mocked. A separate live-source smoke test may be performed later when public network access is available.

- [ ] **Step 5: Provide the final source-edition handoff**

Report:

```text
Repository: https://github.com/953836942-dot/te-literature-radar
Edition: open-source source-code edition
License: MIT
Runtime: Python 3.11+
Core sources: Crossref + OpenAlex + arXiv + RSS
Codex integration: repository Skill $te-literature-radar
One-click install: intentionally not included yet
```

Also give the two first-use commands and point to `README.zh-CN.md` for Chinese instructions.

---

## Final Release Checklist

Before saying the standalone source edition is ready to share:

- [ ] Public repository is exactly `953836942-dot/te-literature-radar`.
- [ ] Visibility is public.
- [ ] Default branch is `main`.
- [ ] No PaperEcho code/config/workflow is present.
- [ ] No superpowers spec/plan development files are present.
- [ ] `README.md` is the English public entry point.
- [ ] `README.zh-CN.md` exists.
- [ ] README Quick Start uses standalone paths.
- [ ] `SKILL.md` uses standalone paths.
- [ ] `config.example.json` validates.
- [ ] Real config/secrets/output are git-ignored.
- [ ] Email is disabled by default.
- [ ] MIT `LICENSE` exists.
- [ ] `THIRD_PARTY_NOTICES.md` preserves upstream MIT attribution.
- [ ] Synthetic examples are clearly labeled and contain no real paper content.
- [ ] Crossref/OpenAlex/arXiv/RSS tests remain mocked.
- [ ] Full standalone unit suite passes.
- [ ] `compileall` passes.
- [ ] Secret-pattern scan passes.
- [ ] Mixed-repository/PaperEcho scan passes.
- [ ] Published remote critical files match the verified staging tree.
- [ ] No one-click installer, GUI, Zotero, database, full-text downloader, or scheduled GitHub Actions has been added.
