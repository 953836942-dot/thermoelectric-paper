# B-lite Literature Monitor MVP Plan

1. Add local research settings/report storage, thermoelectric demo data, and direct OpenAlex search using the existing literature-core query/normalize/dedupe/classify functions.
2. Simplify popup/dashboard to local-first operation with only Weekly papers and Research settings; remove recovery/profile setup from the visible flow.
3. Add tests for local persistence and live-search mapping; keep existing popup/dashboard tests working or replace them with B-lite equivalents.
4. Build the extension and upload a ZIP artifact from CI. Produce a local ZIP for immediate user testing.
5. Keep the existing Worker code untouched for now; wire the minimal browser-closed scheduler only after the visible MVP is accepted.
