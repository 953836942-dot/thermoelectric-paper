import openalexFixture from "./fixtures/openalex.json";
import arxivFixture from "./fixtures/arxiv.xml?raw";
import rssFixture from "./fixtures/rss.xml?raw";
import { describe, expect, it, vi } from "vitest";
import { searchArxiv } from "../src/sources/arxiv";
import { searchOpenAlex } from "../src/sources/openalex";
import { searchRss } from "../src/sources/rss";
import { searchAll } from "../src/sources/search";

const topicQuery = { kind: "topic" as const, query: "thermoelectric" };

function context(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return {
    fetchImpl,
    lookbackSince: "2026-08-01",
    contact: "literature-monitor@example.invalid",
    timeoutMs: 5000,
    ...extra
  };
}

describe("literature source adapters", () => {
  it("maps OpenAlex works into RawPaper fields", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ results: openalexFixture.works })) as unknown as typeof fetch;
    const papers = await searchOpenAlex(topicQuery, context(fetchImpl));

    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      title: "High-performance thermoelectric transport in doped GeTe",
      doi: "https://doi.org/10.1000/te.2026.001",
      openalexId: "https://openalex.org/W1234567890",
      publicationDate: "2026-08-20",
      venue: "Advanced Materials",
      url: "https://doi.org/10.1000/te.2026.001",
      source: "openalex"
    });
    expect(papers[0].authors).toEqual([
      { name: "Jane Researcher", openalexId: "https://openalex.org/A1111111111" },
      { name: "Li Scientist", openalexId: "https://openalex.org/A2222222222" }
    ]);
    expect(papers[0].abstract).toBe("Doping improves weighted mobility");
  });

  it("maps arXiv Atom entries into RawPaper fields", async () => {
    const fetchImpl = vi.fn(async () => new Response(arxivFixture, { status: 200, headers: { "content-type": "application/atom+xml" } })) as unknown as typeof fetch;
    const papers = await searchArxiv(topicQuery, context(fetchImpl));

    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      title: "Composition-aware machine learning for thermoelectric materials",
      arxivId: "2608.12345v1",
      doi: "10.1000/arxiv.2026.001",
      publicationDate: "2026-08-21",
      url: "https://arxiv.org/abs/2608.12345",
      source: "arxiv"
    });
    expect(papers[0].authors).toEqual(["Alex Author", "Mei Author"]);
  });

  it("maps RSS 2.0 items and filters them by query text", async () => {
    const fetchImpl = vi.fn(async () => new Response(rssFixture, { status: 200, headers: { "content-type": "application/rss+xml" } })) as unknown as typeof fetch;
    const papers = await searchRss(topicQuery, context(fetchImpl, { rssFeeds: ["https://journal.example/feed.xml"] }));

    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      title: "Band convergence enables high thermoelectric quality factor",
      doi: "10.1000/rss.2026.001",
      publicationDate: "2026-08-22",
      venue: "Example Journal",
      url: "https://journal.example/paper-1",
      source: "rss"
    });
  });

  it("keeps successful sources when one source fails", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.openalex.org")) return new Response("upstream failure", { status: 500 });
      if (url.includes("export.arxiv.org")) return new Response(arxivFixture, { status: 200 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await searchAll(
      {
        topics: ["thermoelectric"],
        priorityMaterials: [],
        mechanisms: [],
        excludedTopics: [],
        priorityVenues: [],
        researchers: []
      },
      "2026-08-01",
      fetchImpl,
      { sources: ["openalex", "arxiv"] }
    );

    expect(result.status).toMatchObject({ openalex: "failed", arxiv: "success" });
    expect(result.papers.map(paper => paper.arxivId)).toContain("2608.12345v1");
  });
});
