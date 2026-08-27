# PaperEcho Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a reproducible 7-day side-by-side evaluation in which stock paper-digest collects thermoelectric candidates and pinned stock PaperEcho grades the exact same candidate set into A/B/C/D and produces a local weekly report.

**Architecture:** Keep the existing paper-digest workflow untouched. Add a repository-side converter that flattens `paper-digest/output/latest.json` into PaperEcho Local JSON input, add thermoelectric PaperEcho control configuration under `paperecho-config/`, and add a dedicated GitHub Actions workflow that runs paper-digest fresh collection, converts candidates, runs the official pinned PaperEcho Local launcher (`--check` then `--run`), and uploads both outputs plus a comparison summary.

**Tech Stack:** GitHub Actions, Python 3.12 for stock paper-digest, Node.js 20/npm for PaperEcho, Node built-in test runner for repository-side adapters, JSON/TOML configuration.

**Spec:** `docs/superpowers/specs/2026-08-27-paperecho-migration-design.md`

## Global Constraints

- Do not modify PaperEcho upstream source code.
- Pin PaperEcho to upstream commit `87a49927306e347553e74b5fbc7b48de8ca09055` for reproducibility.
- Keep current paper-digest workflows/configuration intact during evaluation.
- Preserve the existing thermoelectric interests: doping optimization, weighted mobility / B factor / quality factor, carrier concentration, band convergence, composition-to-property ML, Bi2Te3, GeTe, PbTe, SnSe, Ag2Se, Mg3Sb2, half-Heusler, skutterudite, performance engineering, and researcher watchlists.
- Secrets must live only in GitHub Actions secrets, never in repository files or chat.
- Phase 1 uses PaperEcho Local only and must not require Zotero or any secret.
- The comparison candidate window is 168 hours (7 days), matching the current paper-digest configuration.

---

## File Structure

- Create `scripts/paperecho/convert-paper-digest.mjs` — deterministic adapter from paper-digest `latest.json` to PaperEcho Local JSON input; deduplicates by canonical identifier and preserves source metadata.
- Create `scripts/paperecho/compare-results.mjs` — reads paper-digest `latest.json` and PaperEcho `state/papers.json`, writes Markdown/JSON comparison metrics and top selections.
- Create `tests/paperecho/convert-paper-digest.test.mjs` — adapter tests using synthetic duplicate and fallback-identifier records.
- Create `tests/paperecho/compare-results.test.mjs` — comparison summary tests with synthetic grades.
- Create `paperecho-config/paperecho.local.config.json` — secret-free Local mode runner configuration with LLM/email disabled for deterministic Phase 1.
- Create `paperecho-config/source_selection.json` — declares `non_biomedical_stem` and OpenAlex/RSS source policy for later Phase 2 while remaining harmless in Local evaluation.
- Create `paperecho-config/openalex_search.json` — thermoelectric 7-day OpenAlex discovery configuration prepared for Phase 2.
- Create `paperecho-config/rss_sources.json` — valid empty/safe RSS configuration for Phase 1; future journal feeds can be added without changing workflow code.
- Create `paperecho-config/pubmed_pmc_search.json` — valid disabled/non-biomedical placeholder so PaperEcho configuration remains complete.
- Create `paperecho-config/review-workflow-rules.json` — thermoelectric A/B/C/D definitions, positive groups, and strict exclusions migrated from the approved interests.
- Create `.github/workflows/paperecho-evaluation.yml` — end-to-end 7-day comparison workflow.
- Modify `README.md` — add a short “PaperEcho evaluation” section and explain that the existing paper-digest workflow remains the fallback baseline.

---

### Task 1: Paper-digest → PaperEcho Candidate Adapter

**Files:**
- Create: `scripts/paperecho/convert-paper-digest.mjs`
- Create: `tests/paperecho/convert-paper-digest.test.mjs`

**Interfaces:**
- Consumes: paper-digest JSON object with `feeds: [{name, papers:[...]}]`.
- Produces: JSON array accepted by PaperEcho `workflow/tools/local/local_import.mjs`, with records containing `title`, `abstract`, `doi`, `url`, `openalex_id`, `external_id`, `authors`, `journal`, `pubdate`, `source_channel`, and `source_platform`.
- CLI: `node scripts/paperecho/convert-paper-digest.mjs <latest.json> <candidates.json>`.

- [ ] **Step 1: Write the failing adapter tests**

Create `tests/paperecho/convert-paper-digest.test.mjs` with Node's built-in test runner. The test fixture must include:

```js
const digest = {
  feeds: [
    {
      name: "PRIORITY - Doping Optimization and Transport",
      papers: [
        {
          title: "High-zT GeTe by band engineering",
          summary: "GeTe thermoelectric performance improves through band convergence.",
          authors: ["A. Author", "B. Author"],
          doi: "10.1000/gete.1",
          paper_id: "openalex:W1",
          abstract_url: "https://doi.org/10.1000/gete.1",
          published_at: "2026-08-25T00:00:00+00:00",
          source: "openalex",
          canonical_id: "doi:10.1000/gete.1"
        }
      ]
    },
    {
      name: "Broad Thermoelectric Safety Net",
      papers: [
        {
          title: "High-zT GeTe by band engineering",
          summary: "Duplicate feed occurrence.",
          authors: ["A. Author"],
          doi: "10.1000/gete.1",
          paper_id: "openalex:W1",
          abstract_url: "https://doi.org/10.1000/gete.1",
          published_at: "2026-08-25T00:00:00+00:00",
          source: "openalex",
          canonical_id: "doi:10.1000/gete.1"
        },
        {
          title: "Thermoelectric preprint without DOI",
          summary: "Ag2Se flexible thermoelectric film.",
          authors: ["C. Author"],
          paper_id: "arxiv:2608.12345",
          abstract_url: "https://arxiv.org/abs/2608.12345",
          arxiv_id: "2608.12345",
          published_at: "2026-08-26T00:00:00+00:00",
          source: "arxiv",
          canonical_id: "arxiv:2608.12345"
        }
      ]
    }
  ]
};
```

Assertions must verify: output length is `2`; DOI duplicate collapses to one record; `summary` maps to `abstract`; `paper_id=openalex:W1` maps to `openalex_id=W1`; the arXiv record receives a stable `url` and `external_id`; `source_channel` records all feed names that contained the candidate.

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
node --test tests/paperecho/convert-paper-digest.test.mjs
```

Expected: FAIL because `scripts/paperecho/convert-paper-digest.mjs` does not exist.

- [ ] **Step 3: Implement the minimal converter**

Implement an exported function `convertDigest(digest)` and CLI entrypoint. Deduplication key priority must be `canonical_id`, then normalized DOI, then `paper_id`, then `abstract_url`, then normalized lowercase title. Preserve the richest non-empty abstract and union feed names into `source_channel` joined by ` | `. `openalex:` prefixes must be stripped when populating `openalex_id`.

- [ ] **Step 4: Run the adapter tests**

Run:

```bash
node --test tests/paperecho/convert-paper-digest.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/paperecho/convert-paper-digest.mjs tests/paperecho/convert-paper-digest.test.mjs
git commit -m "feat: add PaperEcho candidate adapter"
```

---

### Task 2: Thermoelectric PaperEcho Control Configuration

**Files:**
- Create: `paperecho-config/paperecho.local.config.json`
- Create: `paperecho-config/source_selection.json`
- Create: `paperecho-config/openalex_search.json`
- Create: `paperecho-config/rss_sources.json`
- Create: `paperecho-config/pubmed_pmc_search.json`
- Create: `paperecho-config/review-workflow-rules.json`

**Interfaces:**
- Consumes: pinned PaperEcho configuration schema v2.
- Produces: secret-free Local run config and thermoelectric screening rules copied into upstream PaperEcho `config/` at workflow runtime.

- [ ] **Step 1: Create the Local runner config**

`paperecho.local.config.json` must set `schemaVersion: 2`, `mode: "local"`, `profile: "standard"`, `common.llm.enabled: false`, email/notifications/radar/integrity disabled, and `local.enabled: true`. The workflow supplies the concrete input/output paths by CLI, so `local.input` and `local.outputRoot` remain `null` in the repository config.

- [ ] **Step 2: Create source-selection and Phase-2-ready discovery configs**

`source_selection.json` must set `research_domain` to `non_biomedical_stem`, `require_manual_confirmation` to `false`, with OpenAlex primary and RSS supplemental. `openalex_search.json` must be enabled with `days_back: 7`, article type, relevance sorting, and a query covering `thermoelectric OR Seebeck OR "power factor" OR "figure of merit"`. `rss_sources.json` must be syntactically valid and contain no invented feed URLs; start with an empty source list. `pubmed_pmc_search.json` must be valid and disabled/not selected for this domain.

- [ ] **Step 3: Create thermoelectric A/B/C/D rules**

Use the upstream `review-workflow-rules.json` schema. Configure:

- A: directly relevant to thermoelectric ML/composition prediction, doping optimization, weighted mobility/B factor/quality factor, carrier concentration optimization, band convergence/resonant level/bipolar transport, or priority material systems with a substantive performance/mechanism result.
- B: strong thermoelectric mechanism/performance work relevant to alloying, co-doping, interface/strain/band engineering, carrier/phonon transport, nanostructuring, or phase engineering.
- C: thermoelectric-domain background/device work with weaker direct relevance.
- D: battery/supercapacitor/ion-storage, photovoltaics/solar cells, generic optoelectronics, anomalous/spin Nernst and spin caloritronics unless the paper also contains a direct conventional thermoelectric result.

Positive keyword groups must explicitly include the approved material systems and ML/transport terms. `journal_quality_filter.enabled` must be `false` for Phase 1 so no external EasyScholar secret is required. `llm_review.enabled` and `feedback_learning.enabled` may remain structurally present but Local runner config disables real LLM use.

- [ ] **Step 4: Validate JSON syntax locally**

Run:

```bash
node -e "for (const f of process.argv.slice(1)) JSON.parse(require('fs').readFileSync(f,'utf8'))" paperecho-config/*.json
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add paperecho-config
git commit -m "feat: add thermoelectric PaperEcho configuration"
```

---

### Task 3: PaperEcho Result Comparison Adapter

**Files:**
- Create: `scripts/paperecho/compare-results.mjs`
- Create: `tests/paperecho/compare-results.test.mjs`

**Interfaces:**
- Consumes: paper-digest `latest.json` and PaperEcho Local `state/papers.json`.
- Produces: `comparison.json` and `comparison.md` with candidate count, PaperEcho stored count, duplicate reduction, grade counts A/B/C/D/unknown, and top PaperEcho titles grouped by grade.
- CLI: `node scripts/paperecho/compare-results.mjs <latest.json> <papers.json> <output-dir>`.

- [ ] **Step 1: Write failing comparison tests**

Use synthetic `latest.json` with three unique candidates and PaperEcho snapshot:

```js
{
  schema_version: 1,
  papers: [
    { title: "Paper A", final_grade: "A", doi: "10.1/a" },
    { title: "Paper B", rule_grade: "B", doi: "10.1/b" },
    { title: "Paper C", grade: "D", doi: "10.1/c" }
  ]
}
```

Assert metrics: candidate count `3`, stored count `3`, A/B/D each `1`, C `0`, unknown `0`, and Markdown contains `Paper A` under the A section.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test tests/paperecho/compare-results.test.mjs
```

Expected: FAIL because the comparison module does not exist.

- [ ] **Step 3: Implement comparison summary**

Grade resolution priority: first character of `final_grade`, then `semantic_grade`, then `rule_grade`, then `grade`; only `A|B|C|D` are accepted, otherwise `unknown`. Paper-digest unique candidate count must use the same identifier priority as Task 1.

- [ ] **Step 4: Run comparison tests**

```bash
node --test tests/paperecho/compare-results.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/paperecho/compare-results.mjs tests/paperecho/compare-results.test.mjs
git commit -m "feat: add PaperEcho comparison summary"
```

---

### Task 4: End-to-End GitHub Actions Evaluation Workflow

**Files:**
- Create: `.github/workflows/paperecho-evaluation.yml`

**Interfaces:**
- Consumes: existing `configs/base.toml`, `configs/research-directions.toml`, `configs/researchers.toml`; repository-side scripts and `paperecho-config/` files.
- Produces: GitHub artifact `paperecho-evaluation-<run_number>` containing paper-digest fresh output, `candidates.json`, PaperEcho Local output, and `comparison.md/json`.

- [ ] **Step 1: Add workflow triggers and pins**

Workflow name: `PaperEcho Thermoelectric Evaluation`. Trigger on `workflow_dispatch` and on pushes touching only `paperecho-config/**`, `scripts/paperecho/**`, `tests/paperecho/**`, or the workflow itself. Pin paper-digest to `8906f9a12309956913eab29dade75c01cb7d0771` and PaperEcho to `87a49927306e347553e74b5fbc7b48de8ca09055`.

- [ ] **Step 2: Add repository-side unit-test gate**

Set up Node.js 20 and run:

```bash
node --test tests/paperecho/*.test.mjs
```

The workflow must stop on any adapter test failure.

- [ ] **Step 3: Run the same 7-day paper-digest fresh collection**

Checkout stock paper-digest into `paper-digest/`, set up Python 3.12, install with `python -m pip install ./paper-digest`, concatenate the current three repository TOML config files into `paper-digest/config.toml`, and run:

```bash
cd paper-digest
python -m paper_digest --config config.toml
```

Do not restore or save paper-digest production cache in this evaluation workflow.

- [ ] **Step 4: Convert the candidate set**

Run:

```bash
node scripts/paperecho/convert-paper-digest.mjs paper-digest/output/latest.json evaluation/candidates.json
```

Then print the candidate count with a small Node command and fail if zero valid candidates are produced.

- [ ] **Step 5: Checkout and configure pinned stock PaperEcho**

Checkout PaperEcho into `PaperEcho/`, run `npm ci` in that directory, and copy the repository `paperecho-config` files into `PaperEcho/config/`. Copy `paperecho.local.config.json` specifically to `PaperEcho/config/paperecho.config.json`.

- [ ] **Step 6: Run official PaperEcho Local preflight**

From `PaperEcho/`, run:

```bash
node skills/paperecho-local/scripts/run.mjs --check --config config/paperecho.config.json --input ../evaluation/candidates.json --output-root ../evaluation/paperecho-output
```

Expected: preflight passes with no Zotero requirement and no secret requirement.

- [ ] **Step 7: Run official PaperEcho Local production launcher**

From `PaperEcho/`, run:

```bash
node skills/paperecho-local/scripts/run.mjs --run --config config/paperecho.config.json --input ../evaluation/candidates.json --output-root ../evaluation/paperecho-output
```

Do not invoke internal Stage1/Stage4 modules directly.

- [ ] **Step 8: Generate the comparison summary**

Run:

```bash
node scripts/paperecho/compare-results.mjs paper-digest/output/latest.json evaluation/paperecho-output/state/papers.json evaluation
```

Print `evaluation/comparison.md` into the workflow log.

- [ ] **Step 9: Upload complete evaluation artifacts**

Upload:

```text
paper-digest/output/
evaluation/candidates.json
evaluation/paperecho-output/
evaluation/comparison.json
evaluation/comparison.md
```

Retention: 90 days.

- [ ] **Step 10: Commit**

```bash
git add .github/workflows/paperecho-evaluation.yml
git commit -m "ci: add PaperEcho thermoelectric evaluation"
```

---

### Task 5: Documentation and Fresh End-to-End Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: clear user instructions for running PaperEcho evaluation and locating comparison artifacts while retaining the paper-digest baseline instructions.

- [ ] **Step 1: Add README evaluation instructions**

Add a section that says:

```text
Actions → PaperEcho Thermoelectric Evaluation → Run workflow → main → Run workflow
```

Explain that this is currently an evaluation path, uses no Zotero/API key, does not alter the existing `Thermoelectric Paper Digest Weekly` production history, and that the most important artifact files are `comparison.md` and `paperecho-output/exports/.../周报.xlsx`.

- [ ] **Step 2: Run all repository-side adapter tests**

```bash
node --test tests/paperecho/*.test.mjs
```

Expected: all PASS.

- [ ] **Step 3: Trigger/observe the workflow created by the commit**

Confirm GitHub Actions run `PaperEcho Thermoelectric Evaluation` reaches `completed / success`. Inspect the official PaperEcho preflight and run steps rather than relying only on the green overall status.

- [ ] **Step 4: Inspect comparison output quality**

Verify `comparison.md` reports nonzero candidates, nonzero PaperEcho stored papers, explicit A/B/C/D counts, and readable top-title lists. Download the artifact and inspect `paperecho-output/state/papers.json` plus the generated weekly workbook.

- [ ] **Step 5: Commit README update**

```bash
git add README.md
git commit -m "docs: explain PaperEcho evaluation workflow"
```

---

## Phase-1 Acceptance Gate

Phase 1 is accepted only if all of the following are true:

1. Existing `Thermoelectric Paper Digest Weekly` files remain unchanged.
2. Upstream PaperEcho is checked out at exactly `87a49927306e347553e74b5fbc7b48de8ca09055` and no source patch is applied.
3. PaperEcho's official Local `--check` passes.
4. PaperEcho's official Local `--run` completes successfully on the same 7-day paper-digest candidate set.
5. Artifact contains `comparison.md/json`, PaperEcho `state/papers.json`, and a generated weekly report.
6. The comparison allows manual judgment of whether A/B/C/D ordering improves over the current paper-digest feed ordering.

## Deferred to Phase 2

- `ZOTERO_API_KEY` and Zotero Web writeback.
- Real PaperEcho OpenAlex/RSS retrieval as the primary source-discovery path.
- Real journal RSS URLs.
- Scheduled PaperEcho production workflow.
- Disabling the existing paper-digest production workflow.
