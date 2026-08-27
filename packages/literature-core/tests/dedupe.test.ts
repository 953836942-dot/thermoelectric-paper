import { describe, expect, it } from "vitest";
import { dedupePapers } from "../src/dedupe";
import { normalizePaper } from "../src/normalize";

describe("dedupePapers", () => {
  it("merges DOI duplicates and retains all provenance", () => {
    const merged = dedupePapers([
      normalizePaper({ title: "Paper A", doi: "10.x/a", source: "openalex" }),
      normalizePaper({ title: "Paper A", doi: "https://doi.org/10.X/A", source: "rss" })
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sources.sort()).toEqual(["openalex", "rss"]);
  });

  it("merges title-identical records even when source identifiers differ", () => {
    const merged = dedupePapers([
      normalizePaper({ title: "A shared title", openalexId: "W1", source: "openalex" }),
      normalizePaper({ title: "A shared title!", arxivId: "2608.1", source: "arxiv" })
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sources.sort()).toEqual(["arxiv", "openalex"]);
  });
});
