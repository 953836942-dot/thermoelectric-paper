# Chrome/Edge Literature Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome/Edge Manifest V3 extension that creates/reconnects an anonymous profile, lets each user edit their own research settings, displays A/B/C/D reports, resolves researchers, runs manual searches, records feedback, and exports/imports recovery data.

**Architecture:** The extension is a Vite + Preact TypeScript app with a small popup and a full dashboard/options page. The recovery key and API base URL live only in `chrome.storage.local`; research configuration and literature history live in the Cloudflare backend. A typed API client and local session module isolate browser-extension APIs from UI components.

**Tech Stack:** Manifest V3, TypeScript 5.x, Vite, Preact, Vitest, Testing Library, Chrome/Edge extension APIs.

**Spec:** `docs/superpowers/specs/2026-08-28-browser-extension-cloudflare-literature-monitor-design.md`

## Global Constraints

- First release targets Chrome and Edge only.
- No username/password login and no browser-dependent background scheduler; the backend owns scheduled runs.
- The recovery key must never be rendered again after onboarding unless the user explicitly exports recovery data.
- No remotely hosted JavaScript; all extension code is bundled locally for Manifest V3 compliance.
- Host permissions should be limited to the configured Worker API origin plus source URLs opened by user interaction.
- The UI must work with generic research profiles; the thermoelectric preset is an optional starter template.

---

### Task 1: Extension scaffold, storage/session layer, and typed API client

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/vite.config.ts`
- Create: `apps/extension/manifest.json`
- Create: `apps/extension/src/api/types.ts`
- Create: `apps/extension/src/api/client.ts`
- Create: `apps/extension/src/storage/session.ts`
- Create: `apps/extension/src/storage/settings.ts`
- Create: `apps/extension/src/onboarding/create-profile.ts`
- Create: `apps/extension/tests/session.test.ts`
- Create: `apps/extension/tests/client.test.ts`

**Interfaces:**
- `getSession(): Promise<ExtensionSession | null>`.
- `saveSession(session: ExtensionSession): Promise<void>`.
- `ensureProfile(api): Promise<ExtensionSession>` creates one backend profile only when no valid local session exists.
- `createApiClient(baseUrl, recoveryKey)` exposes `getProfile`, `updateProfile`, `searchNow`, `getLatestReport`, `getPapers`, `sendFeedback`, and `searchResearchers`.

- [ ] **Step 1: Write storage RED tests using a mocked chrome.storage.local**

```ts
it("stores profile id and recovery key locally and returns them unchanged", async () => {
  await saveSession({ profileId: "p1", recoveryKey: "secret", apiBaseUrl: "https://api.example" });
  await expect(getSession()).resolves.toEqual({ profileId: "p1", recoveryKey: "secret", apiBaseUrl: "https://api.example" });
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `npm test -- apps/extension/tests/session.test.ts`

Expected: FAIL because the extension workspace/modules do not exist.

- [ ] **Step 3: Add Vite/Preact scaffold and Manifest V3**

The manifest must declare an action popup, an options/dashboard page, `storage` permission, and only the Worker origin in `host_permissions`. Do not request tabs/history/all-sites permissions in V1.

- [ ] **Step 4: Write API-client auth tests**

```ts
it("adds the recovery key bearer header", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  const api = createApiClient("https://api.example", "rk_test", fetchMock);
  await api.getProfile();
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.example/v1/profile",
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer rk_test" }) })
  );
});
```

- [ ] **Step 5: Implement the typed client and onboarding helper**

`ensureProfile` calls `POST /v1/profile` only when no local session exists. Support a `template: "thermoelectric" | null` onboarding choice but keep generic as default.

- [ ] **Step 6: Run tests/typecheck/build and commit**

```bash
npm test -- apps/extension/tests/session.test.ts apps/extension/tests/client.test.ts
npm run typecheck
npm --workspace apps/extension run build
git add apps/extension package.json package-lock.json
git commit -m "feat: scaffold literature browser extension"
```

---

### Task 2: Popup quick view and Search now

**Files:**
- Create: `apps/extension/src/popup/index.html`
- Create: `apps/extension/src/popup/main.tsx`
- Create: `apps/extension/src/popup/Popup.tsx`
- Create: `apps/extension/src/components/GradeBadge.tsx`
- Create: `apps/extension/src/components/RunStatus.tsx`
- Create: `apps/extension/src/styles/tokens.css`
- Create: `apps/extension/tests/popup.test.tsx`

**Interfaces:**
- Popup consumes `GET /v1/report/latest` and `POST /v1/search-now`.
- `Open full report` uses `chrome.runtime.openOptionsPage()` or the extension dashboard URL.

- [ ] **Step 1: Write popup rendering RED test**

```tsx
it("shows update time, grade counts and top three A papers", async () => {
  render(<Popup api={fakeApi(report({ A: 4, B: 8, C: 3, D: 2 }))} />);
  expect(await screen.findByText("A · 4")).toBeInTheDocument();
  expect(screen.getAllByTestId("top-paper")).toHaveLength(3);
});
```

- [ ] **Step 2: Add Search-now state test**

The button must show running/queued, disable repeated clicks, display 429 cooldown clearly, and refresh the report when the run finishes or the API returns an updated summary.

- [ ] **Step 3: Implement a compact popup**

Keep the popup focused: last successful update, next scheduled update, four counts, three A papers, Search now, Open full report. Do not place configuration editing into the popup.

- [ ] **Step 4: Run and commit**

```bash
npm test -- apps/extension/tests/popup.test.tsx
npm --workspace apps/extension run build
git add apps/extension
git commit -m "feat: add extension literature quick view"
```

---

### Task 3: Full dashboard Home and paper actions

**Files:**
- Create: `apps/extension/src/dashboard/index.html`
- Create: `apps/extension/src/dashboard/main.tsx`
- Create: `apps/extension/src/dashboard/Dashboard.tsx`
- Create: `apps/extension/src/dashboard/HomePage.tsx`
- Create: `apps/extension/src/components/PaperCard.tsx`
- Create: `apps/extension/src/components/GradeSection.tsx`
- Create: `apps/extension/tests/home.test.tsx`
- Create: `apps/extension/tests/feedback.test.tsx`

**Interfaces:**
- Home reads `/v1/report/latest` then paginates `/v1/papers` by grade.
- Paper actions call `/v1/feedback` with `must_read | read_later | not_relevant | done | clear`.

- [ ] **Step 1: Write report rendering tests**

A paper card must display title, venue/date, authors, DOI/source link, grade, score/reason text, and current feedback state. A/B/C/D sections must be visually separated but use the same card component.

- [ ] **Step 2: Write feedback optimistic-update/rollback test**

When feedback succeeds, update the card immediately. When the API fails, restore the prior state and show a concise error.

- [ ] **Step 3: Implement Home and card components**

Default ordering: A first, then B, then C; D is collapsed by default. `Not relevant` cards disappear from the default active list but remain accessible through a filter/history control.

- [ ] **Step 4: Verify accessibility basics**

Buttons need accessible names, external links use normal anchors, keyboard focus remains visible, grade is never conveyed by color alone.

- [ ] **Step 5: Run and commit**

```bash
npm test -- apps/extension/tests/home.test.tsx apps/extension/tests/feedback.test.tsx
npm --workspace apps/extension run build
git add apps/extension
git commit -m "feat: add graded literature dashboard"
```

---

### Task 4: Research configuration editor and thermoelectric starter template

**Files:**
- Create: `apps/extension/src/dashboard/ResearchPage.tsx`
- Create: `apps/extension/src/components/EditableChipList.tsx`
- Create: `apps/extension/src/templates/thermoelectric.ts`
- Create: `apps/extension/tests/research.test.tsx`
- Create: `apps/extension/tests/template.test.ts`

**Interfaces:**
- Research page edits the shared backend `ResearchConfig` fields: `topics`, `priorityMaterials`, `mechanisms`, `excludeTopics`, `priorityVenues`.
- Save uses `PUT /v1/profile` and reloads the canonical server representation.

- [ ] **Step 1: Write chip-list validation tests**

Reject blank chips and normalize accidental surrounding whitespace while preserving meaningful scientific punctuation/case in display values.

- [ ] **Step 2: Write thermoelectric-template regression test**

The starter template must include the validated interests: thermoelectric ML/materials informatics, composition-property prediction, doping optimization, weighted mobility/B factor/quality factor, band convergence/resonant levels, GeTe, Bi2Te3, PbTe, SnSe, Ag2Se, Mg3Sb2, half-Heusler, skutterudite, and known false-positive excludes such as battery/photodetector/spin-Nernst when the user chooses this template.

- [ ] **Step 3: Implement Research page with explicit Save**

Do not save every keystroke. Show unsaved state and disable Save while validation fails. Add `Load thermoelectric starter` as an explicit action that previews/replaces fields only after confirmation.

- [ ] **Step 4: Run and commit**

```bash
npm test -- apps/extension/tests/research.test.tsx apps/extension/tests/template.test.ts
npm --workspace apps/extension run build
git add apps/extension
git commit -m "feat: add customizable research directions"
```

---

### Task 5: Researcher resolver with OpenAlex Author IDs

**Files:**
- Create: `apps/extension/src/dashboard/ResearchersPage.tsx`
- Create: `apps/extension/src/components/ResearcherSearch.tsx`
- Create: `apps/extension/tests/researchers.test.tsx`

**Interfaces:**
- Search uses `GET /v1/researchers/search?q=`.
- Selected researchers are saved as `{ id: "https://openalex.org/A...", name, institutions?: string[] }` in the profile config.

- [ ] **Step 1: Write ambiguity-selection RED test**

```tsx
it("does not save an ambiguous name until the user chooses an OpenAlex author", async () => {
  render(<ResearchersPage api={apiWithTwoResultsNamed("J. Smith")} />);
  await user.type(screen.getByRole("textbox"), "J Smith");
  await user.click(screen.getByText("Search"));
  expect(screen.getAllByRole("button", { name: /select/i })).toHaveLength(2);
  expect(saveProfile).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement result cards**

Show display name, institutions, OpenAlex works count and OpenAlex ID suffix to help disambiguation. Saving a researcher stores the ID; later scans do not depend on name matching.

- [ ] **Step 3: Run and commit**

```bash
npm test -- apps/extension/tests/researchers.test.tsx
npm --workspace apps/extension run build
git add apps/extension
git commit -m "feat: add researcher watchlist resolution"
```

---

### Task 6: Settings, schedule, recovery export/import, and onboarding polish

**Files:**
- Create: `apps/extension/src/dashboard/SettingsPage.tsx`
- Create: `apps/extension/src/onboarding/OnboardingPage.tsx`
- Create: `apps/extension/src/recovery/export.ts`
- Create: `apps/extension/src/recovery/import.ts`
- Create: `apps/extension/tests/settings.test.tsx`
- Create: `apps/extension/tests/recovery.test.ts`
- Modify: `apps/extension/src/dashboard/Dashboard.tsx`

**Interfaces:**
- Schedule supports disabled, daily, and weekly with weekday/local time/IANA timezone.
- Recovery export shape is versioned: `{ version: 1, profileId, recoveryKey, apiBaseUrl, exportedAt }` plus non-secret UI preferences when useful.
- Import validates the file and verifies the key by calling `GET /v1/profile` before replacing the local session.

- [ ] **Step 1: Write schedule-form tests**

Weekly requires weekday + `HH:MM` + timezone; daily requires time + timezone; disabled requires neither run time nor weekday.

- [ ] **Step 2: Write recovery round-trip tests**

```ts
const blob = exportRecovery(session);
const parsed = await parseRecovery(blob);
expect(parsed.profileId).toBe(session.profileId);
expect(parsed.recoveryKey).toBe(session.recoveryKey);
```

Invalid JSON, wrong version, missing key, and a backend 401 during verification must not overwrite the current session.

- [ ] **Step 3: Implement onboarding**

First install: explain that there is no login, create a profile, offer generic blank or thermoelectric starter, display the recovery key once with a prominent `Export recovery file` action, then continue to dashboard.

- [ ] **Step 4: Implement Settings**

Include schedule, export/import recovery, API connection status, and clear-local-cache. Do not add a destructive backend profile-delete feature unless the backend plan explicitly implements one.

- [ ] **Step 5: Run the whole extension suite/build and commit**

```bash
npm test -- apps/extension
npm run typecheck
npm --workspace apps/extension run build
```

Expected: PASS and `apps/extension/dist/manifest.json` plus popup/dashboard assets exist.

Commit:

```bash
git add apps/extension
git commit -m "feat: complete extension settings and recovery"
```

---

## Extension acceptance gate

Before deployment work begins:

1. Point the extension at a local Wrangler backend.
2. Load `apps/extension/dist` unpacked in both Chrome and Edge.
3. Create two separate browser profiles and extension profiles.
4. Give them different research configs.
5. Verify Search now and report rendering.
6. Verify OpenAlex researcher disambiguation.
7. Export one recovery file, remove extension local data, re-import, and confirm the same backend profile returns.
8. Verify no extension page or console log prints the recovery key after onboarding/export operations.

The extension plan is complete only when the same build works as an unpacked extension in Chrome and Edge.