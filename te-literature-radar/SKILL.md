---
name: te-literature-radar
description: Discover, rank, and summarize high-quality thermoelectric literature from Crossref, OpenAlex, arXiv, and RSS. Use for weekly TE literature monitoring, retrospective searches, novelty assessment, and A/B/C literature digests.
metadata:
  short-description: Thermoelectric literature radar
---

# TE Literature Radar

Use this Skill to perform one literature-radar run. Scheduling is external: Codex Automation, cron, or another scheduler invokes the Skill at the desired cadence.

## Read first

Read `references/scoring-policy.md`, `references/analysis-contract.md`, and `references/source-policy.md`. Do not override deterministic score weights or grade thresholds.

## Standard auto workflow

1. Run:

```bash
python3 te-literature-radar/scripts/radar_cli.py fetch --config te-literature-radar.config.json --mode auto
```

2. Read only `analysis_candidates` from the returned fetch JSON. For every candidate, create an analysis JSON that exactly follows `references/analysis-contract.md`.
3. Judge novelty from the supplied title/abstract/metadata evidence only. Do not claim full-text review and do not invent numerical results.
4. Validate:

```bash
python3 te-literature-radar/scripts/radar_cli.py validate-analysis --fetch FETCH.json --analysis ANALYSIS.json
```

5. If validation fails, correct only the unsupported or missing analysis field and revalidate. Never solve validation by inventing evidence.
6. Finalize:

```bash
python3 te-literature-radar/scripts/finalize_radar.py --config te-literature-radar.config.json --fetch FETCH.json --analysis ANALYSIS.json
```

7. Report the final JSON path, Markdown digest path, delivered paper count, email-send status, and source errors.

## Manual search windows

Recent 30 days without changing weekly state:

```bash
python3 te-literature-radar/scripts/radar_cli.py fetch --config te-literature-radar.config.json --mode lookback --lookback-days 30
```

Explicit historical interval without changing weekly state:

```bash
python3 te-literature-radar/scripts/radar_cli.py fetch --config te-literature-radar.config.json --mode range --start-date 2026-01-01 --end-date 2026-06-30
```

Only use `--advance-auto-state` for a manual run when the user explicitly wants that historical/manual run to become the new recurring boundary.

## Output policy

A and B papers receive full summaries: purpose, innovation, approach, results, mechanism, significance, limitations, and radar note. C papers are compact browse items. All preprints must retain the `Preprint — not peer reviewed` warning.
