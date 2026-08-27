import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LatestReport, PaperView } from "../src/api/types";
import { Popup } from "../src/popup/Popup";

afterEach(() => cleanup());

function paper(index: number): PaperView {
  return {
    paperId: `p${index}`,
    title: `Priority paper ${index}`,
    abstract: "",
    authors: [{ name: "A. Researcher" }],
    venue: "Science Advances",
    publicationDate: "2026-08-27",
    url: `https://example.com/p${index}`,
    grade: "A",
    score: 80 - index,
    reasons: ["Priority material: GeTe"],
    feedbackState: null
  };
}

function report(): LatestReport {
  return {
    runId: "r1",
    lastSuccessfulUpdate: "2026-08-27T22:00:00.000Z",
    nextRunAt: "2026-08-31T22:00:00.000Z",
    gradeCounts: { A: 4, B: 8, C: 3, D: 2 },
    sourceStatus: { openalex: "success", arxiv: "success" },
    topPapers: [paper(1), paper(2), paper(3), paper(4)]
  };
}

function fakeApi(overrides: Record<string, unknown> = {}) {
  return {
    getLatestReport: vi.fn().mockResolvedValue(report()),
    searchNow: vi.fn().mockResolvedValue({ status: "success" }),
    ...overrides
  } as any;
}

describe("Popup", () => {
  it("shows update time, grade counts and top three A papers", async () => {
    render(<Popup api={fakeApi()} openDashboard={() => undefined} />);

    expect(await screen.findByText("A · 4")).toBeTruthy();
    expect(screen.getByText("B · 8")).toBeTruthy();
    expect(screen.getByText("C · 3")).toBeTruthy();
    expect(screen.getByText("D · 2")).toBeTruthy();
    expect(screen.getAllByTestId("top-paper")).toHaveLength(3);
    expect(screen.getByText(/Last updated/i)).toBeTruthy();
  });

  it("runs Search now, prevents duplicate clicks, and refreshes the report", async () => {
    let resolveSearch!: () => void;
    const searchPromise = new Promise<void>(resolve => { resolveSearch = resolve; });
    const api = fakeApi({
      searchNow: vi.fn().mockImplementation(() => searchPromise)
    });
    const user = userEvent.setup();
    render(<Popup api={api} openDashboard={() => undefined} />);

    const button = await screen.findByRole("button", { name: /search now/i });
    await user.click(button);
    expect(api.searchNow).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(screen.getByText(/Searching/i)).toBeTruthy();

    resolveSearch();
    await waitFor(() => expect(api.getLatestReport).toHaveBeenCalledTimes(2));
    expect(button).not.toBeDisabled();
  });
});
