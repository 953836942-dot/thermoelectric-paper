# Literature Monitor Deployment and Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Cloudflare Worker/D1/Cron backend safely, connect and regression-test the Chrome/Edge extension against it, package an installable ZIP for a few users, and preserve the current GitHub Actions monitor as rollback/reference.

**Architecture:** Deployment uses Wrangler and a dedicated Cloudflare D1 database, with GitHub Actions limited to test/build/deploy automation. A production smoke test creates disposable profiles and verifies isolation and scheduled-run semantics. Extension release artifacts are deterministic ZIPs built from the same tested commit; configuration contains the production Worker origin but never secrets.

**Tech Stack:** GitHub Actions, Wrangler, Cloudflare Workers/D1/Cron, Node.js 22, npm workspaces, Chrome/Edge Manifest V3.

**Spec:** `docs/superpowers/specs/2026-08-28-browser-extension-cloudflare-literature-monitor-design.md`

## Global Constraints

- Do not delete or disable `.github/workflows/paperecho-weekly.yml`, `thermoelectric-weekly.yml`, or the stock smoke workflow during V1 rollout.
- Cloudflare credentials and account/database identifiers that are sensitive must live in GitHub Secrets/Cloudflare configuration, never committed plaintext.
- The production Worker stores only recovery-key hashes, never plaintext recovery keys.
- A deployment is not complete until two-profile isolation is proven against the deployed Worker.
- First distribution is an unpacked/ZIP Chrome+Edge package for a few trusted users; Chrome Web Store publishing is deferred.

---

### Task 1: Production-ready Wrangler config and migrations

**Files:**
- Modify: `apps/worker/wrangler.toml`
- Create: `apps/worker/wrangler.example.toml` if production IDs must remain out of source control
- Create: `apps/worker/scripts/migrate-check.mjs`
- Create: `apps/worker/tests/migrations.test.ts`
- Modify: `README.md`

**Interfaces:**
- Worker exposes the exact `/v1/*` API defined by the backend plan.
- Cron expression is hourly: `0 * * * *`.
- D1 binding name is stable (for example `DB`) across local/test/production.

- [ ] **Step 1: Write a migration-shape RED test**

Read migration SQL and assert the four required tables and critical indexes exist. The test must fail if `token_hash` is missing or if a plaintext `recovery_key` column appears.

- [ ] **Step 2: Add Wrangler config with explicit compatibility date and hourly Cron**

Keep the production D1 database ID injected/configured according to Cloudflare's supported deployment pattern; never hard-code secrets. Use an environment-specific Worker name such as `literature-monitor-api` only after checking availability in the user's account during execution.

- [ ] **Step 3: Add migration verification command**

Document/run:

```bash
npx wrangler d1 migrations list literature-monitor
npx wrangler d1 migrations apply literature-monitor --remote
```

The verification script should query `sqlite_master` or use Wrangler-supported local execution to confirm schema matches expectations.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- apps/worker/tests/migrations.test.ts
npm run typecheck
git add apps/worker README.md
git commit -m "chore: prepare Cloudflare deployment configuration"
```

---

### Task 2: CI quality gate and deploy workflow

**Files:**
- Create: `.github/workflows/literature-app-ci.yml`
- Create: `.github/workflows/literature-worker-deploy.yml`
- Modify: `README.md`

**Interfaces:**
- CI runs on pull requests/pushes affecting `apps/worker`, `apps/extension`, `packages/literature-core`, or relevant fixtures.
- Production deploy requires successful tests/typecheck/build and uses GitHub Secrets for Cloudflare authentication.

- [ ] **Step 1: Add CI workflow first**

CI steps:

```yaml
- uses: actions/checkout@v5
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npm test
- run: npm run typecheck
- run: npm --workspace apps/extension run build
```

- [ ] **Step 2: Verify CI fails on an intentional failing test in a temporary branch, then revert that test**

This proves the quality gate is active before deployment automation exists.

- [ ] **Step 3: Add deployment workflow**

Use only supported Cloudflare/Wrangler deployment commands. Required secrets should be documented by exact name, e.g. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, but secret values must never appear in logs or repository files.

The deploy workflow must apply remote D1 migrations before/with Worker deployment and stop on migration failure.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows README.md
git commit -m "ci: test and deploy literature monitor"
```

---

### Task 3: Deployed API smoke test and two-profile isolation

**Files:**
- Create: `scripts/e2e/deployed-api-smoke.mjs`
- Create: `scripts/e2e/fixtures/profile-te.json`
- Create: `scripts/e2e/fixtures/profile-other.json`
- Modify: `.github/workflows/literature-worker-deploy.yml`

**Interfaces:**
- Script accepts Worker base URL from `LITERATURE_API_BASE_URL`.
- It creates disposable profiles and prints only profile IDs/run summaries; never recovery keys.

- [ ] **Step 1: Write the smoke script against a local Worker first**

The script must:

1. create profile A and B;
2. update A to thermoelectric starter-like interests;
3. update B to a clearly different test domain;
4. trigger Search now for both;
5. poll boundedly for completion/latest report;
6. submit feedback for A;
7. verify B cannot observe A's feedback/config/results;
8. verify an invalid bearer token gets 401;
9. exit non-zero on any violation.

- [ ] **Step 2: Run it locally**

Run:

```bash
LITERATURE_API_BASE_URL=http://127.0.0.1:8787 node scripts/e2e/deployed-api-smoke.mjs
```

Expected: `E2E_OK=1` and no recovery key in stdout.

- [ ] **Step 3: Add post-deploy execution**

After production deploy, run the same script against the Worker URL. If external source availability makes Search now partial, the smoke test may accept `success` or `partial` but not `failed`, and isolation/auth assertions remain mandatory.

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e .github/workflows/literature-worker-deploy.yml
git commit -m "test: add deployed multi-profile smoke test"
```

---

### Task 4: Extension production config and deterministic ZIP packaging

**Files:**
- Create: `apps/extension/src/config/runtime.ts`
- Create: `apps/extension/scripts/package.mjs`
- Create: `apps/extension/tests/package.test.ts`
- Create: `.github/workflows/literature-extension-release.yml`
- Modify: `apps/extension/manifest.json`

**Interfaces:**
- Build accepts a non-secret `VITE_API_BASE_URL`.
- Packaging produces `dist/literature-monitor-extension.zip` containing `manifest.json` at ZIP root.

- [ ] **Step 1: Write packaging RED test**

The test builds a ZIP and asserts:

```ts
expect(entries).toContain("manifest.json");
expect(entries).toContain("popup.html"); // use the actual generated popup filename/path chosen in implementation
expect(entries.some((x) => x.endsWith(".js"))).toBe(true);
expect(entries.join("\n")).not.toMatch(/recovery_key|CLOUDFLARE_API_TOKEN/i);
```

Use exact built paths once the extension build layout is fixed; update the test and package script together in the same task rather than leaving placeholders.

- [ ] **Step 2: Implement runtime API origin injection**

No recovery key or user profile data may be included at build time. Only the Worker base URL is baked into the production build.

- [ ] **Step 3: Add release workflow**

On manual dispatch/tag, run full CI, build extension with production API URL, package ZIP, and upload it as a GitHub artifact. Do not publish to Chrome Web Store in V1.

- [ ] **Step 4: Load the generated ZIP unpacked in Chrome and Edge**

Verify manifest loads with no permission warnings beyond expected Worker-origin access and storage.

- [ ] **Step 5: Commit**

```bash
git add apps/extension .github/workflows/literature-extension-release.yml
git commit -m "build: package Chrome and Edge literature extension"
```

---

### Task 5: Browser-closed scheduling acceptance test

**Files:**
- Create: `scripts/e2e/cron-acceptance.mjs`
- Modify: `README.md`

**Interfaces:**
- Test profile can be scheduled a few minutes ahead in a controlled test/staging method without changing V1 production semantics.

- [ ] **Step 1: Create a disposable scheduled profile**

Use the API to configure an enabled profile whose `next_run_at` will be due before the next Cron test trigger. Record only its profile ID locally in the test process.

- [ ] **Step 2: Close all test browser instances**

The acceptance criterion explicitly requires no extension/browser process to be responsible for the run.

- [ ] **Step 3: Trigger/wait for Cloudflare scheduled handler**

Prefer a staging/manual scheduled-event trigger supported by Wrangler for repeatable CI; for production acceptance, also observe one real Cron execution. Then fetch `report/latest` using the recovery key retained only by the test process.

- [ ] **Step 4: Assert the run happened server-side**

Verify `last_successful_update` advanced and the run reason/source identifies scheduler/Cron rather than Search now.

- [ ] **Step 5: Document evidence and commit**

Record the exact repeatable test commands in README, not secret values.

```bash
git add scripts/e2e/cron-acceptance.mjs README.md
git commit -m "test: verify browser-closed scheduled updates"
```

---

### Task 6: User handoff for a few trusted users

**Files:**
- Create: `docs/extension-install.md`
- Create: `docs/extension-quickstart.md`
- Modify: `README.md`

**Interfaces:**
- Installation instructions assume only a ZIP and the Chrome/Edge extension page; users do not need GitHub Actions or Cloudflare credentials.

- [ ] **Step 1: Write install instructions with exact UI flow**

Chrome/Edge: download ZIP → extract → Extensions → Developer mode → Load unpacked → choose extracted folder.

- [ ] **Step 2: Write first-run instructions**

Explain generic vs thermoelectric starter, research topics/materials/researchers, Search now, weekly schedule, and the importance of exporting the recovery file.

- [ ] **Step 3: Explain privacy/recovery behavior clearly**

State that there is no login/password reset; losing both extension local data and the recovery export means the profile cannot be recovered in V1.

- [ ] **Step 4: Run final repository verification**

```bash
npm ci
npm test
npm run typecheck
npm --workspace apps/extension run build
node apps/extension/scripts/package.mjs
```

Expected: all PASS and extension ZIP produced.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/extension-install.md docs/extension-quickstart.md
git commit -m "docs: add literature extension user handoff"
```

---

## Final acceptance gate

The project is ready for the first few users only when all of the following have fresh evidence:

- Worker/D1 deployed with migrations applied.
- CI is green on the exact release commit.
- Deployed two-profile isolation smoke test passes.
- Chrome and Edge load the exact packaged build.
- Search now works from both browsers.
- A thermoelectric starter profile preserves the known regression behavior.
- A second unrelated research profile produces independently relevant results.
- Recovery export/import reconnects to the same profile.
- A scheduled run completes while browsers are closed.
- The extension ZIP contains no secret/token/recovery-key material.
- The existing GitHub Actions PaperEcho-TE workflow remains available as rollback/reference.