import { describe, expect, it } from "vitest";
import { generateWeeklySummary } from "../src/local/summary";
import type { PaperView } from "../src/api/types";

const papers: PaperView[] = [
  {
    paperId: "gete",
    title: "Multi-Scale Lattice Strain Engineering Enables High Thermoelectric Performance in GeTe Alloys",
    abstract: "Lattice strain reduces the deformation potential and improves carrier transport. The work reports enhanced thermoelectric performance in GeTe alloys.",
    authors: [{ name: "A. Author" }], venue: "Advanced Energy Materials", publicationDate: "2026-08-25", url: null,
    grade: "A", score: 123,
    reasons: ["Topic: thermoelectric", "Priority material: GeTe", "Mechanism: strain engineering, carrier concentration"],
    feedbackState: null
  },
  {
    paperId: "sns",
    title: "Na/Ag co-doping optimization in SnS thermoelectrics",
    abstract: "Co-doping tunes carrier concentration while suppressing lattice thermal conductivity.",
    authors: [{ name: "B. Author" }], venue: "Small", publicationDate: "2026-08-24", url: null,
    grade: "B", score: 42,
    reasons: ["Topic: thermoelectric", "Mechanism: co-doping", "Evidence: optimization"],
    feedbackState: null
  }
];

describe("weekly summary", () => {
  it("creates a readable brief, key themes, and paper summaries for priority papers", () => {
    const summary = generateWeeklySummary(papers);
    expect(summary.brief).toMatch(/2 papers/i);
    expect(summary.brief).toMatch(/GeTe|strain/i);
    expect(summary.keyThemes).toContain("GeTe");
    expect(summary.paperSummaries.gete).toMatch(/Lattice strain reduces/i);
    expect(summary.paperSummaries.sns).toMatch(/Co-doping tunes/i);
  });
});
