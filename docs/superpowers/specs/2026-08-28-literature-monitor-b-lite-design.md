# B-lite Literature Monitor Design

## Goal
Ship a small Chrome/Edge extension that visibly works without accounts or a deployed backend: each installation stores its own research settings, paper history, and feedback in `chrome.storage.local`; `Search now` queries OpenAlex directly and classifies results locally. A tiny Cloudflare scheduler can be connected later only for browser-closed scheduled runs.

## V1 visible experience
- Popup: latest update, A/B/C/D counts, top papers, Search now, Open full report.
- Dashboard: Weekly papers and Research settings only.
- Research settings: topics, priority materials, mechanisms, researchers as plain names, excluded topics, priority venues.
- Local persistence only for settings/history/feedback.
- If no report exists, seed a thermoelectric demo report so the extension is immediately inspectable.
- Search now uses OpenAlex directly, 7-day lookback, dedupe + existing literature-core classification.

## Cloud boundary
The existing Worker remains isolated and is not required for the preview build. Later B-lite cloud scheduling will store only a random installation token, minimal search/schedule config, and the latest scheduled result. No login, recovery workflow, server-side reading history, or shared user dashboard.

## Non-goals for this MVP
No SaaS account system, no recovery key UI, no Zotero, no LLM summaries, no multi-user server history, no researcher-ID resolver UI, no Firefox.

## Acceptance
1. ZIP loads unpacked in Chrome/Edge.
2. Opening popup shows a useful report immediately.
3. Editing research settings persists after reopening.
4. Search now can fetch recent OpenAlex papers and refresh local A/B/C/D results.
5. Build/tests/typecheck pass in GitHub Actions.
