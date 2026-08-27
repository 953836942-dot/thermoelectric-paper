import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalLiteratureClient } from "../src/local/client";

const memory: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(memory)) delete memory[key];
  (globalThis as any).chrome = {
    storage: {
      local: {
        async get(key: string) { return { [key]: memory[key] }; },
        async set(value: Record<string, unknown>) { Object.assign(memory, value); }
      }
    }
  };
});

describe("B-lite local client", () => {
  it("seeds a visible thermoelectric preview and persists research settings locally", async () => {
    const api = createLocalLiteratureClient();
    const report = await api.getLatestReport();
    expect(report.topPapers.length).toBeGreaterThan(0);
    const profile = await api.getProfile();
    expect(profile.config.topics.join(" ")).toMatch(/thermoelectric/i);

    await api.updateProfile({ config: { topics: ["solid state batteries"] } });
    const saved = await api.getProfile();
    expect(saved.config.topics).toEqual(["solid state batteries"]);
  });

  it("turns recent OpenAlex results into a local graded report", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{
        id: "https://openalex.org/W1",
        title: "GeTe thermoelectric doping optimization and transport",
        publication_date: "2026-08-27",
        abstract_inverted_index: {
          thermoelectric: [0],
          performance: [1],
          doping: [2],
          GeTe: [3]
        },
        authorships: [{ author: { id: "https://openalex.org/A1", display_name: "A. Researcher" } }],
        primary_location: { landing_page_url: "https://example.org/paper", source: { display_name: "Advanced Functional Materials" } }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const api = createLocalLiteratureClient({ fetchImpl: fetchImpl as typeof fetch });
    const run = await api.searchNow();
    expect(run.paperCount).toBeGreaterThan(0);
    const report = await api.getLatestReport();
    expect(report.gradeCounts.A + report.gradeCounts.B + report.gradeCounts.C + report.gradeCounts.D).toBeGreaterThan(0);
    expect((await api.getPapers({ state: "all" })).items.some(item => item.title.includes("GeTe"))).toBe(true);
  });
});
