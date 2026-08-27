import { describe, expect, it } from "vitest";
import { classifyPaper } from "../src/classify";
import type { CanonicalPaper, ResearchConfig } from "../src/types";

function paper(title: string): CanonicalPaper {
  return {
    id: `title:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title,
    normalizedTitle: title.toLowerCase(),
    abstract: "thermoelectric performance carrier transport",
    authors: [],
    sources: ["fixture"],
  };
}

function config(partial: Partial<ResearchConfig>): ResearchConfig {
  return {
    topics: [],
    priorityMaterials: [],
    mechanisms: [],
    excludedTopics: [],
    priorityVenues: [],
    researchers: [],
    ...partial,
  };
}

describe("classifyPaper", () => {
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
      { ...paper("Solid electrolyte interface control in sodium ion batteries"), abstract: "sodium ion battery hard carbon solid electrolyte interface" },
      config({ topics: ["sodium ion battery"], priorityMaterials: ["hard carbon"], mechanisms: ["solid electrolyte interface"] })
    );
    expect(["A", "B"]).toContain(result.grade);
  });
});
