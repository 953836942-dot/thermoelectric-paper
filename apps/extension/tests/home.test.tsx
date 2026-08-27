import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Grade, LatestReport, PaperView } from "../src/api/types";
import { HomePage } from "../src/dashboard/HomePage";

afterEach(() => cleanup());

function paper(grade: Grade, index: number): PaperView {
  return {
    paperId: `${grade}${index}`,
    title: `${grade}-grade thermoelectric paper ${index}`,
    abstract: "Carrier transport and doping optimization.",
    authors: [{ name: "A. Researcher" }, { name: "B. Scientist" }],
    venue: "Advanced Functional Materials",
    publicationDate: "2026-08-27",
    url: `https://example.com/${grade}${index}`,
    grade,
    score: grade === "A" ? 72 : grade === "B" ? 41 : grade === "C" ? 18 : -100,
    reasons: ["Priority material: GeTe", "Mechanism: doping optimization"],
    feedbackState: null
  };
}

const report: LatestReport = {
  runId: "r1",
  lastSuccessfulUpdate: "2026-08-27T22:00:00.000Z",
  nextRunAt: "2026-08-31T22:00:00.000Z",
  gradeCounts: { A: 1, B: 1, C: 1, D: 1 },
  sourceStatus: { openalex: "success", arxiv: "success", rss: "success" },
  topPapers: [paper("A", 1)]
};

function fakeApi() {
  const byGrade = {
    A: [paper("A", 1)],
    B: [paper("B", 1)],
    C: [paper("C", 1)],
    D: [paper("D", 1)]
  };
  return {
    getLatestReport: vi.fn().mockResolvedValue(report),
    getPapers: vi.fn().mockImplementation(({ grade }: { grade: Grade }) => Promise.resolve({ items: byGrade[grade], nextCursor: null })),
    sendFeedback: vi.fn().mockResolvedValue({ paperId: "A1", feedbackState: "must_read", hidden: false })
  } as any;
}

describe("dashboard home", () => {
  it("renders A/B/C sections with complete paper metadata and keeps D collapsed by default", async () => {
    render(<HomePage api={fakeApi()} />);

    expect(await screen.findByRole("heading", { name: /A · Must read/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /B · Strong match/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /C · Related/i })).toBeTruthy();
    expect(screen.getByText("A-grade thermoelectric paper 1")).toBeTruthy();
    expect(screen.getAllByText(/Advanced Functional Materials · 2026-08-27/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/A. Researcher, B. Scientist/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Score 72/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Priority material: GeTe/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("D-grade thermoelectric paper 1")).toBeNull();
    expect(screen.getByRole("button", { name: /show filtered.*1/i })).toBeTruthy();
  });
});
