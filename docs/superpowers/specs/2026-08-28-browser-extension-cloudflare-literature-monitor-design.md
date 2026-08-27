# Browser Extension + Cloudflare Literature Monitor — Design

Date: 2026-08-28

## 1. Goal

Turn the current thermoelectric literature-monitoring workflow into a lightweight tool that a few people can use independently without accounts.

Each person installs a Chrome/Edge extension, defines their own research directions, materials, researchers, excluded topics, priority venues, and schedule, and sees only their own reports. The browser may be completely closed: a Cloudflare Worker scheduled by Cron continues to run the literature search and stores the results in D1.

The existing GitHub Actions workflow remains available as a reference/fallback during the migration.

## 2. Product shape

The product has two pieces:

1. **Chrome/Edge extension (Manifest V3)** — user interface, local credentials, configuration, report browsing, feedback, manual `Search now`.
2. **Cloudflare backend** — Worker API + D1 database + Cron scheduler. It performs scheduled searches when the browser is closed, stores per-user configuration/results, and serves the latest report to the extension.

There is no username/password account system in v1.

## 3. Identity and privacy model

On first install the extension calls `POST /v1/profile`.

The backend returns:

- `profile_id`: random UUID.
- `recovery_key`: a high-entropy random secret, shown to the user once and stored in extension local storage.

The Worker stores only a SHA-256 hash of the recovery key. Requests use:

`Authorization: Bearer <recovery_key>`

The profile ID is not sufficient to access a profile.

Users can export a small recovery/config file containing the profile ID, recovery key, and optional local UI preferences. Importing that file on another computer reconnects the extension to the same profile.

If both the local extension data and exported recovery material are lost, v1 deliberately has no password-reset flow because there is no identity system to prove ownership.

The service stores research configuration and literature metadata, but no email address, password, or personal account details.

## 4. Extension UX

### 4.1 Popup — quick view

Clicking the extension icon opens a compact popup:

- last successful update time;
- next scheduled run;
- A/B/C/D counts;
- top 3 A-grade papers;
- `Search now` button;
- `Open full report` button.

### 4.2 Full extension dashboard

The extension provides an internal dashboard page with four sections.

**Home**

- latest report summary;
- A — Must read;
- B — Strong relevance;
- C — Broad relevance;
- D — Filtered;
- search/run status;
- paper cards with title, venue, date, authors, DOI/source link, grade and grade reasons.

**Research**

Editable chips/lists for:

- research directions;
- priority materials/systems;
- mechanism/optimization interests;
- exclude topics;
- priority venues/journals.

The thermoelectric template initially contains the current validated interests, including thermoelectric ML, composition-property prediction, doping optimization, weighted mobility/B factor/quality factor, band convergence, GeTe, Bi2Te3, PbTe, SnSe, Ag2Se, Mg3Sb2, half-Heuslers, and skutterudites.

**Researchers**

- add researcher by name;
- resolve the name through OpenAlex Authors;
- user chooses the correct author if ambiguous;
- store the OpenAlex Author ID after selection.

This is intentionally more reliable than the current `name + thermoelectric` text query.

**Settings**

- schedule: daily or weekly;
- weekday and local time for weekly schedules;
- IANA timezone;
- export/import configuration and recovery data;
- disable/enable scheduled updates;
- clear local UI cache.

### 4.3 Paper actions

Each paper supports:

- `Must read` / star;
- `Read later`;
- `Not relevant`;
- `Done`.

V1 stores this feedback and uses it for hiding/organizing papers. It does **not** automatically rewrite the ranking rules yet. Automatic preference learning is deferred until enough real feedback exists.

## 5. Backend architecture

### 5.1 Cloudflare Worker API

The Worker exposes a small versioned API:

- `POST /v1/profile` — create profile and recovery key.
- `GET /v1/profile` — fetch configuration/schedule.
- `PUT /v1/profile` — update configuration/schedule.
- `POST /v1/search-now` — enqueue/run an immediate scan for the authenticated profile.
- `GET /v1/report/latest` — latest report and run summary.
- `GET /v1/papers` — paginated papers, filterable by grade/state.
- `POST /v1/feedback` — save star/read-later/not-relevant/done state.
- `GET /v1/researchers/search?q=` — OpenAlex author resolution helper.

All profile-specific routes require the bearer recovery key.

### 5.2 D1 data model

Use a small relational model:

**profiles**

- `profile_id` PK;
- `token_hash`;
- `config_json`;
- `timezone`;
- `schedule_json`;
- `enabled`;
- `last_run_at`;
- `next_run_at`;
- timestamps.

**runs**

- `run_id` PK;
- `profile_id`;
- start/end/status;
- source counts;
- grade counts;
- error summary.

**papers**

Global canonical literature metadata keyed by a canonical ID derived in priority order from DOI, OpenAlex ID, arXiv ID, then normalized title hash.

**profile_papers**

- `profile_id` + `paper_id` PK;
- grade;
- score;
- reason JSON;
- first/last seen;
- feedback state;
- hidden flag;
- originating run ID.

This allows one canonical paper to be reused without mixing user-specific grades or feedback.

## 6. Search sources

V1 uses sources that work well from a Worker without paid credentials:

1. **OpenAlex** — broad journal coverage, venue metadata, author IDs, publication dates.
2. **arXiv** — recent preprints.
3. **Journal RSS/Atom feeds** — optional priority-venue feeds where a stable feed is available.

Crossref can be added as a fallback metadata resolver, but it is not the primary freshness source because the earlier GitHub prototype showed that re-indexing timestamps can make old papers look new.

The backend always stores the real publication/date field used for freshness decisions and source provenance for each paper.

## 7. Search generation

Each profile configuration is converted into a small set of queries rather than one enormous query.

Examples:

- each research direction;
- material + thermoelectric;
- mechanism + thermoelectric;
- resolved OpenAlex Author ID;
- priority-venue RSS feed.

Results are normalized and deduplicated before classification.

The initial lookback is 7 days for weekly schedules and 2 days for daily schedules, with overlap to avoid missing delayed indexing. Already-seen papers are retained in history but are not presented as newly discovered again.

## 8. Ranking and A/B/C/D classification

Do not run the upstream PaperEcho biomedical classifier in the Worker. Instead port the **validated deterministic thermoelectric logic** into a clean TypeScript ranking library and generalize it to profile configuration.

The classifier produces both a numeric relevance score and a grade.

Signals include:

- strong match to research direction;
- priority material/system match;
- researcher OpenAlex ID match;
- core mechanism/optimization match;
- priority venue match;
- explicit performance/transport evidence;
- negative/excluded topic match.

The report must show the reasons, for example:

`A — GeTe + strain engineering + priority material + strong thermoelectric-performance match`

Default grade semantics:

- **A — Must read:** strong core-topic match plus at least one strong priority signal such as priority material, selected researcher, high-priority mechanism, or priority venue.
- **B — Strong relevance:** clearly relevant to the user's research but not a top-priority combination.
- **C — Broad relevance:** in-domain but peripheral, device-oriented, flexible/sensing work, or weakly connected background.
- **D — Filtered:** explicit excluded topics or non-domain false positives.

The thermoelectric template will be regression-tested against the current known 16-paper weekly sample so that SnS co-doping, Ag2Se interface engineering, GeTe strain engineering and Mg3Sb2 alloying stay high priority, while photodetector/battery-like false positives remain filtered.

## 9. Scheduling when the browser is closed

A Cloudflare Cron trigger runs hourly.

At each trigger the Worker selects a small batch of profiles where:

`enabled = 1 AND next_run_at <= now`

For each due profile it:

1. creates a run record;
2. searches sources;
3. normalizes/deduplicates;
4. classifies papers;
5. writes `papers` and `profile_papers`;
6. updates the run summary;
7. computes the profile's next run time from its timezone and schedule.

This is designed for a few users. No queue system is required in v1. If usage grows enough that Cron execution becomes long, Cloudflare Queues can be introduced without changing the extension API.

`Search now` uses the same pipeline for one profile immediately and is rate-limited to prevent accidental repeated scans.

## 10. Multi-user isolation

Every profile-specific database query is scoped by authenticated `profile_id`.

Two-profile integration tests are mandatory: two profiles with different research directions must produce independent configurations, reports, feedback, and paper grades, and neither token may read the other profile.

There is no shared public dashboard in v1.

## 11. Repository layout

Keep the current repository during v1 rather than renaming/moving everything.

Proposed additions:

```text
apps/
  extension/
    manifest.json
    src/
      popup/
      dashboard/
      options/
      api/
  worker/
    src/
      index.ts
      api/
      scheduler/
      sources/
    migrations/
packages/
  literature-core/
    src/
      normalize.ts
      dedupe.ts
      classify.ts
      schedule.ts
      types.ts
    tests/
fixtures/
  thermoelectric-weekly-16.json
```

The current GitHub Actions PaperEcho-TE workflow remains in the repository as a comparison/fallback until the Cloudflare path has been used successfully for several real weekly cycles.

## 12. Deployment and distribution

### Backend

Cloudflare account resources:

- one Worker;
- one D1 database;
- one Cron trigger;
- Worker secrets only for deployment/service configuration if eventually needed.

The first version avoids paid APIs and avoids LLM credentials.

### Extension

First distribution is a ZIP for a few trusted users:

1. unzip;
2. Chrome/Edge Extensions;
3. enable Developer mode;
4. Load unpacked.

Once stable, the same Manifest V3 package can be published as an unlisted/private Chrome Web Store extension to simplify updates. Edge can run the Chromium extension as well.

## 13. Error handling

- Each source has a timeout and source-specific error capture.
- One failed source does not fail the entire run if another source succeeds.
- A completely failed run preserves the previous successful report and records the error in `runs`.
- The extension displays `last successful update`, not merely the last attempted update.
- Manual `Search now` returns a clear running/success/partial/failed state.
- D1 writes for a run use idempotent canonical paper IDs so retries do not duplicate papers.

## 14. Testing

### Core unit tests

- normalization;
- canonical IDs;
- DOI/OpenAlex/arXiv/title deduplication;
- classification and reason generation;
- schedule/timezone calculation;
- exclusion behavior.

### Worker integration tests

- create/update profile;
- bearer-token authentication;
- two-profile isolation;
- OpenAlex/arXiv source adapters using fixtures;
- scheduled due-profile selection;
- retry/idempotency;
- latest-report retrieval.

### Extension tests

- first-install profile creation;
- configuration save/load;
- researcher resolution selection;
- `Search now` status;
- A/B/C/D report rendering;
- recovery export/import.

### End-to-end acceptance

1. Install extension in two browser profiles.
2. Configure different research directions.
3. Close both browsers.
4. Trigger the backend schedule.
5. Reopen the browsers.
6. Verify each sees only its own new report.
7. Verify the thermoelectric profile still classifies the regression fixture as expected.

## 15. V1 scope limits

V1 deliberately does **not** include:

- username/password login;
- email delivery;
- Zotero synchronization;
- automatic LLM summaries;
- automatic preference-learning rule mutation;
- Firefox support;
- public sharing/community feeds;
- billing;
- admin dashboard.

These are deferred so the first version remains reliable for a few users.

## 16. Success criteria

The first version is successful when:

- Chrome and Edge can load the same extension;
- a new user can create a profile without logging in;
- each user can independently edit directions/materials/researchers/exclusions;
- selected researchers are resolved to OpenAlex Author IDs;
- `Search now` works;
- a weekly schedule runs successfully while the user's browser is closed;
- opening the extension later shows the latest A/B/C/D report;
- two users cannot see each other's configuration/results;
- thermoelectric default results preserve the known good ranking behavior from the current prototype;
- the existing GitHub Actions monitor remains available as a fallback until the Cloudflare version is proven stable.
