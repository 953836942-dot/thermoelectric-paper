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
