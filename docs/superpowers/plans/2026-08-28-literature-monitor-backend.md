# Cloudflare Literature Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the account-free Cloudflare Worker + D1 backend and reusable TypeScript literature core that can search, deduplicate, rank, schedule, and persist per-profile literature reports while the browser is closed.

**Architecture:** Add an npm-workspace TypeScript core under `packages/literature-core` and a Cloudflare Worker under `apps/worker`. The core owns domain types, canonical IDs, deduplication, schedule calculation, query generation, and deterministic A/B/C/D ranking. The Worker owns authentication, D1 persistence, OpenAlex/arXiv/RSS adapters, API routes, manual runs, and hourly Cron execution.

**Tech Stack:** TypeScript 5.x, Node.js 22 for development/CI, npm workspaces, Vitest, Cloudflare Workers, Wrangler, D1, Web Crypto, native `fetch`.

**Spec:** `docs/superpowers/specs/2026-08-28-browser-extension-cloudflare-literature-monitor-design.md`

## Global Constraints

- V1 has no username/password login, email delivery, Zotero sync, paid API, LLM requirement, Firefox support, billing, or public dashboard.
- A new profile is protected by a high-entropy recovery key; D1 stores only its SHA-256 hash.
- Every profile-specific database query must be scoped to the authenticated `profile_id`.
- OpenAlex, arXiv, and optional RSS/Atom are the V1 discovery sources; Crossref is metadata fallback only.
- Hourly Cron must run due profiles even when every browser is closed.
- The current GitHub Actions PaperEcho-TE monitor remains untouched as fallback during this plan.
- The thermoelectric 16-paper behavior is a regression fixture, not a hidden hard-coded global research domain.

---

### Task 1: Workspace, domain types, canonical IDs, and generic classifier

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/literature-core/package.json`
- Create: `packages/literature-core/tsconfig.json`
- Create: `packages/literature-core/src/types.ts`
- Create: `packages/literature-core/src/normalize.ts`
- Create: `packages/literature-core/src/classify.ts`
- Create: `packages/literature-core/src/index.ts`
- Create: `packages/literature-core/tests/normalize.test.ts`
- Create: `packages/literature-core/tests/classify.test.ts`
- Create: `fixtures/thermoelectric-weekly-16.json`

**Interfaces:**
- Produces `canonicalPaperId(paper: RawPaper): string`.
- Produces `normalizePaper(raw: RawPaper): CanonicalPaper`.
- Produces `classifyPaper(paper: CanonicalPaper, config: ResearchConfig): ClassificationResult`.
- Produces shared `ResearchConfig`, `CanonicalPaper`, `ClassificationResult`, `Grade`, and `ResearcherRef` types for Worker and extension.

- [ ] **Step 1: Add the failing canonical-ID tests**

```ts
import { describe, expect, it } from "vitest";
import { canonicalPaperId } from "../src/normalize";

describe("canonicalPaperId", () => {
  it("prefers DOI over source IDs", () => {
    expect(canonicalPaperId({ title: "x", doi: "https://doi.org/10.1000/ABC", openalexId: "W1" }))
      .toBe("doi:10.1000/abc");
  });

  it("falls back through OpenAlex, arXiv and normalized title", () => {
    expect(canonicalPaperId({ title: "A Paper", openalexId: "W99" })).toBe("openalex:W99");
    expect(canonicalPaperId({ title: "A Paper", arxivId: "2608.12345" })).toBe("arxiv:2608.12345");
    expect(canonicalPaperId({ title: "  A   Paper!  " })).toMatch(/^title:/);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- packages/literature-core/tests/normalize.test.ts`

Expected: FAIL because workspace/package/modules do not exist.

- [ ] **Step 3: Implement the minimal workspace and normalization API**

Root `package.json` must expose:

```json
{
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

`types.ts` must define a `RawPaper` with optional DOI/OpenAlex/arXiv IDs and a `CanonicalPaper` with canonical ID, normalized title, source provenance, authors, venue, publication date, URL and abstract.

`canonicalPaperId` must use the exact priority: DOI → OpenAlex ID → arXiv ID → SHA-256-compatible deterministic normalized-title key. Do not use a random ID.

- [ ] **Step 4: Add classifier RED tests using thermoelectric and unrelated configurations**

```ts
it("ranks a configured priority material + mechanism as A", () => {
  const result = classifyPaper(
    paper("Multi-Scale Lattice Strain Engineering in GeTe Thermoelectrics"),
    config({ topics: ["thermoelectric"], priorityMaterials: ["GeTe"], mechanisms: ["strain engineering"] })
  );
  expect(result.grade).toBe("A");
  expect(result.reasons.join(" ")).toMatch(/GeTe/i);
});

it("is domain-generic rather than thermoelectric-hard-coded", () => {
  const result = classifyPaper(
    paper("Solid electrolyte interface control in sodium ion batteries"),
    config({ topics: ["sodium ion battery"], priorityMaterials: ["hard carbon"], mechanisms: ["solid electrolyte interface"] })
  );
  expect(["A", "B"]).toContain(result.grade);
});
```

- [ ] **Step 5: Implement deterministic scoring and reason generation**

Use an explicit score table in `classify.ts`, for example:

```ts
const weights = {
  topic: 25,
  priorityMaterial: 22,
  mechanism: 18,
  researcher: 30,
  priorityVenue: 12,
  strongEvidence: 10,
  exclude: -100
} as const;
```

Grade thresholds must be named constants, and an exclude match always produces D. The returned object must include `score`, `grade`, `reasons`, and matched signal arrays so the UI can explain the grade.

- [ ] **Step 6: Port the current 16-paper sample into a regression fixture and test key expectations**

The fixture must preserve title, venue/date/URL and enough text to classify. Regression assertions must include:

```ts
expect(gradeOf("Enhanced Thermoelectric Performance in Se Alloyed SnS")).toBe("A");
expect(gradeOf("Interface‐Engineered Boosting of Phase Stability and Thermoelectric Performance of Ag 2 Se")).toBe("A");
expect(gradeOf("Multi‐Scale Lattice Strain Engineering Enables Reduced Deformation Potential and High Thermoelectric Performance in GeTe Alloys")).toBe("A");
expect(gradeOf("Flexible Bi 2 Te 3 Photothermoelectric Position‐Sensitive Detector")).toBe("D");
```

- [ ] **Step 7: Run tests and typecheck, then commit**

Run:

```bash
npm install
npm test -- packages/literature-core/tests
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add package.json package-lock.json tsconfig.base.json packages/literature-core fixtures/thermoelectric-weekly-16.json
git commit -m "feat: add generic literature ranking core"
```

---

### Task 2: Schedule/query generation and source-independent deduplication

**Files:**
- Create: `packages/literature-core/src/dedupe.ts`
- Create: `packages/literature-core/src/query.ts`
- Create: `packages/literature-core/src/schedule.ts`
- Create: `packages/literature-core/tests/dedupe.test.ts`
- Create: `packages/literature-core/tests/query.test.ts`
- Create: `packages/literature-core/tests/schedule.test.ts`
- Modify: `packages/literature-core/src/index.ts`

**Interfaces:**
- Produces `dedupePapers(papers: CanonicalPaper[]): CanonicalPaper[]`.
- Produces `buildQueries(config: ResearchConfig): SearchQuery[]`.
- Produces `computeNextRun(now: Date, timezone: string, schedule: ScheduleConfig): Date`.

- [ ] **Step 1: Write dedupe tests for DOI/source/title collisions**

```ts
it("merges DOI duplicates and retains all provenance", () => {
  const merged = dedupePapers([
    paper({ id: "doi:10.x/a", sources: ["openalex"] }),
    paper({ id: "doi:10.x/a", sources: ["rss"] })
  ]);
  expect(merged).toHaveLength(1);
  expect(merged[0].sources.sort()).toEqual(["openalex", "rss"]);
});
```

- [ ] **Step 2: Write query-generation tests**

A config with two topics, two materials, one mechanism and one resolved researcher must yield bounded query objects rather than a single concatenated query. The researcher query must carry the OpenAlex Author ID.

- [ ] **Step 3: Write timezone schedule tests**

Test Brisbane weekly Monday 08:00 and at least one DST timezone (`Australia/Sydney`) across a DST transition. Use `Intl.DateTimeFormat`; do not assume fixed offsets except when a timezone actually is fixed.

- [ ] **Step 4: Implement minimal functions and rerun tests**

Run: `npm test -- packages/literature-core/tests`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/literature-core
git commit -m "feat: add query dedupe and scheduling core"
```

---

### Task 3: Worker scaffold, D1 schema, profile creation, and bearer authentication

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/wrangler.toml`
- Create: `apps/worker/migrations/0001_initial.sql`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/auth.ts`
- Create: `apps/worker/src/db.ts`
- Create: `apps/worker/src/api/profile.ts`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/tests/profile.test.ts`

**Interfaces:**
- `POST /v1/profile -> { profile_id, recovery_key, profile }`.
- `GET /v1/profile` and `PUT /v1/profile` require `Authorization: Bearer <recovery_key>`.
- `authenticate(request, env): Promise<{ profileId: string }>` is reused by all later routes.

- [ ] **Step 1: Write API RED tests for profile creation and unauthorized access**

```ts
it("creates a profile and never returns a stored token hash", async () => {
  const res = await app.request("/v1/profile", { method: "POST" }, env);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.profile_id).toMatch(/[0-9a-f-]{36}/);
  expect(body.recovery_key.length).toBeGreaterThanOrEqual(43);
  expect(JSON.stringify(body)).not.toContain("token_hash");
});

it("rejects profile reads without a bearer key", async () => {
  expect((await app.request("/v1/profile", {}, env)).status).toBe(401);
});
```

- [ ] **Step 2: Create the D1 migration**

`0001_initial.sql` must create `profiles`, `runs`, `papers`, and `profile_papers`, with foreign keys and indexes on `profiles(next_run_at, enabled)`, `runs(profile_id, started_at)`, and `profile_papers(profile_id, grade, last_seen_at)`.

The `profiles` table stores `token_hash`, never the plaintext recovery key.

- [ ] **Step 3: Implement profile creation and auth with Web Crypto**

Generate the recovery key from `crypto.getRandomValues`, encode URL-safe base64, hash with `crypto.subtle.digest("SHA-256", ...)`, and compare hashes in constant-time style byte comparison after D1 lookup.

The initial profile config must use a neutral empty template plus an optional `template: "thermoelectric"` request field; do not silently force all users into thermoelectrics.

- [ ] **Step 4: Add update-validation tests**

Reject invalid timezones, empty/oversized strings, more than configured list limits, invalid weekdays/times, and researcher objects without both name and OpenAlex ID.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- apps/worker/tests/profile.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add apps/worker package.json package-lock.json
git commit -m "feat: add authenticated Cloudflare profile API"
```

---

### Task 4: OpenAlex, arXiv, RSS adapters and researcher resolution

**Files:**
- Create: `apps/worker/src/sources/types.ts`
- Create: `apps/worker/src/sources/openalex.ts`
- Create: `apps/worker/src/sources/arxiv.ts`
- Create: `apps/worker/src/sources/rss.ts`
- Create: `apps/worker/src/sources/search.ts`
- Create: `apps/worker/src/api/researchers.ts`
- Create: `apps/worker/tests/sources.test.ts`
- Create: `apps/worker/tests/researchers.test.ts`
- Create: `apps/worker/tests/fixtures/openalex.json`
- Create: `apps/worker/tests/fixtures/arxiv.xml`
- Create: `apps/worker/tests/fixtures/rss.xml`

**Interfaces:**
- Each adapter implements `search(query: SearchQuery, ctx: SourceContext): Promise<RawPaper[]>`.
- `searchAll(config, lookback, fetchImpl)` returns normalized, deduplicated `CanonicalPaper[]` plus per-source status.
- `GET /v1/researchers/search?q=...` returns OpenAlex author candidates `{ id, displayName, institutions, worksCount }`.

- [ ] **Step 1: Write fixture-driven adapter tests before network code**

Inject `fetchImpl` into adapters. Tests must verify publication date, DOI/source IDs, authors, venue and URL mapping from static fixtures.

- [ ] **Step 2: Add partial-failure RED test**

When OpenAlex returns 500 but arXiv fixture succeeds, `searchAll` must return arXiv papers and source status `{ openalex: "failed", arxiv: "success" }` rather than throwing the whole run away.

- [ ] **Step 3: Implement adapters with explicit timeout and user-agent/contact string**

Use `AbortSignal.timeout` (or a small helper) and source-specific URL builders. RSS parsing must accept RSS 2.0 and Atom entries needed by configured journal feeds without executing HTML/script content.

- [ ] **Step 4: Implement OpenAlex Author search endpoint**

Require bearer authentication even though author metadata is public, so this endpoint cannot be abused as an unauthenticated proxy. Limit query length and result count.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- apps/worker/tests/sources.test.ts apps/worker/tests/researchers.test.ts
npm run typecheck
git add apps/worker
 git commit -m "feat: add literature sources and researcher resolution"
```

---

### Task 5: Run pipeline, reports, paper history, feedback, Search now, and Cron

**Files:**
- Create: `apps/worker/src/run/run-profile.ts`
- Create: `apps/worker/src/run/persist.ts`
- Create: `apps/worker/src/api/search-now.ts`
- Create: `apps/worker/src/api/reports.ts`
- Create: `apps/worker/src/api/papers.ts`
- Create: `apps/worker/src/api/feedback.ts`
- Create: `apps/worker/src/scheduler/cron.ts`
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/tests/run-profile.test.ts`
- Create: `apps/worker/tests/isolation.test.ts`
- Create: `apps/worker/tests/cron.test.ts`

**Interfaces:**
- `runProfile(profileId, reason, env): Promise<RunSummary>` is the single pipeline used by both Search now and Cron.
- `POST /v1/search-now` returns `202`/run state and is profile-rate-limited.
- `GET /v1/report/latest` returns last successful run, next run, grade counts and top papers.
- `GET /v1/papers?grade=A&state=...&cursor=...` is paginated.
- `POST /v1/feedback` accepts `must_read | read_later | not_relevant | done | clear`.

- [ ] **Step 1: Write a run-pipeline RED test**

Using source fixtures, create a profile, invoke `runProfile`, then assert one run row exists, canonical papers are upserted, per-profile grades/reasons are stored, and `last_run_at`/`next_run_at` are updated only after success/partial success.

- [ ] **Step 2: Write the mandatory two-profile isolation test**

```ts
it("never leaks configuration, grades, feedback or reports across profiles", async () => {
  const te = await createProfile({ topics: ["thermoelectric"] });
  const battery = await createProfile({ topics: ["sodium ion battery"] });
  await runProfile(te.id, "test", env);
  await runProfile(battery.id, "test", env);

  expect(await titlesFor(te.token)).not.toEqual(await titlesFor(battery.token));
  expect((await requestWith(te.token, `/v1/profile/${battery.id}`)).status).toBe(404);
});
```

Do not add any route that allows profile ID path access; the second assertion may instead verify that a token cannot retrieve another profile's known paper/feedback if routes remain implicit-profile only.

- [ ] **Step 3: Implement idempotent persistence**

Use canonical paper IDs and `INSERT ... ON CONFLICT DO UPDATE`. Preserve `first_seen_at`; update `last_seen_at`. A retry of the same run must not duplicate a paper or reset feedback.

- [ ] **Step 4: Implement feedback and latest-report APIs**

Feedback changes display state only in V1; it must not mutate ranking rules. `not_relevant` may hide a card by default but remains queryable from history.

- [ ] **Step 5: Implement Search now rate limiting**

Use D1 run history to reject a repeated manual request for the same profile inside a small cooldown (for example 60 seconds) with HTTP 429 and `retry_after_seconds`.

- [ ] **Step 6: Implement hourly due-profile Cron**

The scheduled handler queries only `enabled = 1 AND next_run_at <= now`, orders oldest due first, processes a bounded number suitable for a few users, and records failures without deleting the previous successful report.

- [ ] **Step 7: Run the full backend suite and commit**

```bash
npm test -- packages/literature-core apps/worker
npm run typecheck
```

Expected: all tests PASS, including two-profile isolation and the 16-paper thermoelectric regression.

Commit:

```bash
git add apps/worker packages/literature-core
git commit -m "feat: complete scheduled multi-profile literature backend"
```

---

## Backend acceptance gate

Before starting the extension plan, verify all of the following locally with Wrangler/D1 test bindings:

```bash
npm ci
npm test -- packages/literature-core apps/worker
npm run typecheck
npm --workspace apps/worker run dev
```

Then exercise with HTTP calls: create two profiles, save different research configs, resolve a researcher, run `search-now`, fetch `report/latest`, post feedback, and confirm one token cannot access the other's state.

The backend plan is complete only when it is usable through HTTP without any extension code.