# PaperEcho migration design

Date: 2026-08-27

## Goal

Migrate the thermoelectric literature workflow from stock `X-PG13/paper-digest` to upstream `Chip-G0202/PaperEcho` while preserving the current paper-digest workflow as a rollback/comparison baseline.

## Constraints

- Do not modify PaperEcho upstream source code.
- Pin PaperEcho to upstream commit `87a49927306e347553e74b5fbc7b48de8ca09055` for reproducibility.
- Keep current paper-digest workflows/configuration intact during evaluation.
- Preserve the existing thermoelectric interests: doping optimization, weighted mobility / B factor / quality factor, carrier concentration, band convergence, composition-to-property ML, Bi2Te3, GeTe, PbTe, SnSe, Ag2Se, Mg3Sb2, half-Heusler, skutterudite, performance engineering, and researcher watchlists.
- Secrets must live only in GitHub Actions secrets, never in repository files or chat.

## Important upstream behavior

PaperEcho `local` production mode requires a readable JSON/JSONL input plus an output root. It is suitable for comparing PaperEcho screening/grading/reporting on the same candidate set, but it is not the final source-discovery configuration.

PaperEcho `web` mode is the intended headless full workflow for OpenAlex/RSS discovery plus Zotero Web writeback. Its preflight requires `ZOTERO_API_KEY`.

## Phase 1: side-by-side PaperEcho Local evaluation

Add a new GitHub Actions workflow without deleting the existing paper-digest workflow.

Flow:

1. Run the existing thermoelectric fresh candidate collection for a 7-day window.
2. Convert the collected candidate metadata to PaperEcho-compatible JSON/JSONL input using a repository-side adapter only; PaperEcho upstream remains untouched.
3. Checkout pinned upstream PaperEcho.
4. Install its stock dependencies.
5. Materialize thermoelectric PaperEcho domain configuration.
6. Run the official `paperecho-local` launcher in `--check` mode, then `--run` only if preflight passes.
7. Upload PaperEcho outputs as a GitHub artifact.
8. Produce a compact comparison summary: candidate count, A/B/C/D counts, duplicates removed, and the top papers selected by PaperEcho versus the current paper-digest output.

Success criteria:

- GitHub Actions completes successfully with stock PaperEcho source unchanged.
- PaperEcho produces its local state and weekly report artifact.
- We can inspect A/B/C/D grading and compare quality against the current workflow on the same 7-day input.

## Phase 2: full PaperEcho Web/RSS production

After Phase 1 quality is accepted:

1. User creates a Zotero Web API key and stores it as GitHub Actions secret `ZOTERO_API_KEY` (never paste it into chat or commit it).
2. Enable PaperEcho `web` mode.
3. Configure `source_selection.json` for `non_biomedical_stem`.
4. Enable OpenAlex for broad thermoelectric discovery.
5. Configure journal RSS/Atom feeds for selected high-priority venues where stable RSS is available.
6. Migrate thermoelectric screening standards into `review-workflow-rules.json` and `screening_standards.md`.
7. Configure researcher watch rules using author names/identifiers supported by the selected sources.
8. Run PaperEcho Web `--check`, then one fresh production run.
9. Keep paper-digest enabled for one comparison week; disable it only after PaperEcho is demonstrably better.

## Repository layout

- Existing paper-digest files remain untouched.
- New PaperEcho control files live under `paperecho-config/`.
- New evaluation workflow: `.github/workflows/paperecho-evaluation.yml`.
- Future production workflow: `.github/workflows/paperecho-weekly.yml`.

## Rollback

At any point, PaperEcho workflows can be disabled/deleted without affecting the existing `Thermoelectric Paper Digest Weekly` baseline.
