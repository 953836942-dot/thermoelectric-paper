import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaperView } from "../src/api/types";
import { PaperCard } from "../src/components/PaperCard";

afterEach(() => cleanup());

const paper: PaperView = {
  paperId: "p1",
  title: "GeTe doping optimization",
  abstract: "",
  authors: [{ name: "A. Researcher" }],
  venue: "Advanced Materials",
  publicationDate: "2026-08-27",
  url: "https://example.com/p1",
  grade: "A",
  score: 74,
  reasons: ["Priority material: GeTe"],
  feedbackState: null
};

describe("paper feedback", () => {
  it("updates the action immediately and keeps the successful state", async () => {
    let resolveFeedback!: () => void;
    const pending = new Promise(resolve => { resolveFeedback = () => resolve({ paperId: "p1", feedbackState: "must_read", hidden: false }); });
    const sendFeedback = vi.fn().mockReturnValue(pending);
    const user = userEvent.setup();
    render(<PaperCard paper={paper} sendFeedback={sendFeedback} />);

    const button = screen.getByRole("button", { name: /must read/i });
    await user.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(sendFeedback).toHaveBeenCalledWith("p1", "must_read");

    resolveFeedback();
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
  });

  it("rolls back optimistic feedback and shows an error when the API fails", async () => {
    let rejectFeedback!: () => void;
    const pending = new Promise((_, reject) => { rejectFeedback = () => reject(new Error("network down")); });
    const sendFeedback = vi.fn().mockReturnValue(pending);
    const user = userEvent.setup();
    render(<PaperCard paper={paper} sendFeedback={sendFeedback} />);

    const button = screen.getByRole("button", { name: /read later/i });
    await user.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    rejectFeedback();
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("false"));
    expect(screen.getByRole("alert").textContent).toMatch(/could not save/i);
  });
});
