import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyPaper } from "../src/classify";
import { normalizePaper } from "../src/normalize";
import type { CanonicalPaper, ResearchConfig } from "../src/types";

function paper(title: string): CanonicalPaper {
  return normalizePaper({ title, abstract: "thermoelectric performance carrier transport", source: "fixture" });
}

function config(partial: Partial<ResearchConfig>): ResearchConfig {
  return {
    topics: [], priorityMaterials: [], mechanisms: [], excludedTopics: [], priorityVenues: [], researchers: [], ...partial,
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
      normalizePaper({ title: "Solid electrolyte interface control in sodium ion batteries", abstract: "sodium ion battery hard carbon solid electrolyte interface", source: "fixture" }),
      config({ topics: ["sodium ion battery"], priorityMaterials: ["hard carbon"], mechanisms: ["solid electrolyte interface"] })
    );
    expect(["A", "B"]).toContain(result.grade);
  });

  it("preserves the validated 16-paper thermoelectric ranking sample", () => {
    const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/thermoelectric-weekly-16.json", import.meta.url), "utf8")) as {
      config: ResearchConfig;
      papers: Array<Record<string, string>>;
    };
    for (const raw of fixture.papers) {
      const { expectedGrade, ...paperFields } = raw;
      const result = classifyPaper(normalizePaper({ ...paperFields, title: paperFields.title }), fixture.config);
      expect(result.grade, raw.title).toBe(expectedGrade);
    }
  });
});
