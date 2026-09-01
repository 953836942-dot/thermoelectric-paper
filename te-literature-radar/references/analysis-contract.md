# Codex Analysis Contract

Codex analyzes only the evidence supplied in the fetch JSON. V1 evidence is title, abstract, bibliographic metadata, source, concepts, and deterministic base score; it is not full-text review.

For every candidate return exactly one entry with:

- `id`
- `novelty.score` integer 0–20
- `novelty.types` chosen only from: `new material`, `new dopant/alloy design`, `new mechanism`, `new performance regime`, `new experimental method`, `new theory`, `new ML/AI method`, `new dataset/screening strategy`, `incremental variant`
- `novelty.reason`
- `novelty.evidence_basis`: exactly `title_abstract_metadata`
- `summary.purpose`
- `summary.innovation`
- `summary.approach`
- `summary.results` as a list
- `summary.mechanism`
- `summary.significance`
- `summary.limitations` as a list
- `radar_note`

Do not provide a total score or A/B/C grade; deterministic code computes those.

Do not invent numerical values. Any number used in analysis must exist in the supplied title/abstract/metadata evidence. When exact results are absent, say that available metadata does not provide the value rather than guessing.

If novelty is mainly a small variant of an established approach, include `incremental variant`. Never claim that the full paper was reviewed when only title/abstract/metadata were supplied.
