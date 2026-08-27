# Thermoelectric Paper Digest

This repository runs the **stock upstream `X-PG13/paper-digest`** for thermoelectric literature monitoring.

The paper-digest source code is not modified here. GitHub Actions checks out a pinned upstream commit and applies only repository-side configuration.

## Weekly production digest

Workflow: `.github/workflows/thermoelectric-weekly.yml`

Schedule: every Monday at about **08:07 Australia/Brisbane** (GitHub cron `22:07 UTC` on Sunday).

Production config: `configs/thermoelectric-weekly.toml`

Current coverage:

- Core thermoelectric materials
- Doping and transport physics
- Thermoelectric machine learning and materials discovery
- Flexible / wearable / printed thermoelectrics and devices
- Journal-oriented discovery through Crossref
- Journal/preprint discovery through OpenAlex

The stock LLM analysis and translation features are intentionally disabled. No delivery channel is configured yet.

## Outputs

Each successful run uploads a GitHub Actions artifact containing the stock paper-digest output tree, including:

- `output/latest.json`
- `output/latest.md`
- `output/site/index.html`
- dated JSON/Markdown archive files

State and archive output are also cached between weekly runs so the stock deduplication/history behavior can work across executions.

## Manual run

Open **Actions → Thermoelectric Paper Digest Weekly → Run workflow**.

The earlier `Paper Digest Thermoelectric Stock Smoke` workflow is kept as a minimal baseline test.

## Researcher watchlist

Stock paper-digest currently has no first-class `author` field in its feed config. A commented query-based researcher-watch template is therefore included at the bottom of `configs/thermoelectric-weekly.toml`.

When specific researcher names are added, use one feed per researcher and treat it as discovery by query rather than strict author-ID matching.

## Upstream pin

The production workflow pins the same upstream paper-digest revision that passed the initial thermoelectric smoke test:

`8906f9a12309956913eab29dade75c01cb7d0771`

Changing that pin should be treated as an explicit upstream upgrade and revalidated with the stock smoke test first.
