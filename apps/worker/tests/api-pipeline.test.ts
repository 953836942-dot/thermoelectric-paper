import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

async function createProfile(template: "thermoelectric" | null = "thermoelectric") {
  const response = await worker.fetch(new Request("https://example.com/v1/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: template ? JSON.stringify({ template }) : undefined
  }), env);
  expect(response.status).toBe(201);
  return response.json() as Promise<{ profile_id: string; recovery_key: string }>;
}

function auth(key: string, json = false): HeadersInit {
  return {
    authorization: `Bearer ${key}`,
    ...(json ? { "content-type": "application/json" } : {})
  };
}

function stubSources() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.openalex.org/works")) {
      return Response.json({ results: [{
        id: "https://openalex.org/WAPI1",
        title: "Band convergence and doping optimization in high-performance GeTe thermoelectrics",
        doi: "https://doi.org/10.1000/api.1",
        publication_date: "2026-08-26",
        abstract_inverted_index: { thermoelectric: [0], performance: [1], doping: [2], optimization: [3] },
        authorships: [{ author: { id: "https://openalex.org/AAPI1", display_name: "API Author" } }],
        primary_location: { landing_page_url: "https://doi.org/10.1000/api.1", source: { display_name: "Advanced Materials" } }
      }] });
    }
    if (url.includes("export.arxiv.org")) {
      return new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
        <entry><id>http://arxiv.org/abs/2608.88888v1</id><published>2026-08-26T12:00:00Z</published>
        <updated>2026-08-26T12:00:00Z</updated><title>Weighted mobility optimization in thermoelectric PbTe</title>
        <summary>Thermoelectric doping optimization improves weighted mobility and performance.</summary>
        <author><name>Arxiv API Author</name></author><link href="https://arxiv.org/abs/2608.88888" rel="alternate" /></entry>
      </feed>`, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }));
}

describe("pipeline HTTP APIs", () => {
  it("runs Search now, serves the latest report and exposes graded papers", async () => {
    const profile = await createProfile();
    stubSources();
    try {
      const search = await worker.fetch(new Request("https://example.com/v1/search-now", {
        method: "POST",
        headers: auth(profile.recovery_key)
      }), env);
      expect(search.status).toBe(202);
      const run = await search.json() as { status: string; paperCount: number };
      expect(run.status).toBe("success");
      expect(run.paperCount).toBe(2);

      const report = await worker.fetch(new Request("https://example.com/v1/report/latest", {
        headers: auth(profile.recovery_key)
      }), env);
      expect(report.status).toBe(200);
      const reportBody = await report.json() as {
        gradeCounts: Record<string, number>;
        topPapers: Array<{ paperId: string; grade: string; title: string }>;
        lastSuccessfulUpdate: string;
        nextRunAt: string;
      };
      expect(Object.values(reportBody.gradeCounts).reduce((a, b) => a + b, 0)).toBe(2);
      expect(reportBody.topPapers.length).toBeGreaterThan(0);
      expect(reportBody.topPapers[0].grade).toBe("A");
      expect(reportBody.lastSuccessfulUpdate).toBeTruthy();
      expect(reportBody.nextRunAt).toBeTruthy();

      const papers = await worker.fetch(new Request("https://example.com/v1/papers?grade=A", {
        headers: auth(profile.recovery_key)
      }), env);
      expect(papers.status).toBe(200);
      const paperBody = await papers.json() as { items: Array<{ paperId: string; grade: string; reasons: string[]; authors: Array<{ name: string }> }> };
      expect(paperBody.items.length).toBeGreaterThan(0);
      expect(paperBody.items.every(item => item.grade === "A")).toBe(true);
      expect(paperBody.items[0].reasons.length).toBeGreaterThan(0);
      expect(paperBody.items[0].authors.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("persists feedback, hides not-relevant papers by default, and can query them from history", async () => {
    const profile = await createProfile();
    stubSources();
    try {
      const search = await worker.fetch(new Request("https://example.com/v1/search-now", { method: "POST", headers: auth(profile.recovery_key) }), env);
      expect(search.status).toBe(202);
      const before = await worker.fetch(new Request("https://example.com/v1/papers?grade=A", { headers: auth(profile.recovery_key) }), env);
      const beforeBody = await before.json() as { items: Array<{ paperId: string }> };
      const paperId = beforeBody.items[0].paperId;

      const mustRead = await worker.fetch(new Request("https://example.com/v1/feedback", {
        method: "POST",
        headers: auth(profile.recovery_key, true),
        body: JSON.stringify({ paper_id: paperId, action: "must_read" })
      }), env);
      expect(mustRead.status).toBe(200);

      const marked = await worker.fetch(new Request("https://example.com/v1/papers?grade=A", { headers: auth(profile.recovery_key) }), env);
      const markedBody = await marked.json() as { items: Array<{ paperId: string; feedbackState: string | null }> };
      expect(markedBody.items.find(item => item.paperId === paperId)?.feedbackState).toBe("must_read");

      const hide = await worker.fetch(new Request("https://example.com/v1/feedback", {
        method: "POST",
        headers: auth(profile.recovery_key, true),
        body: JSON.stringify({ paper_id: paperId, action: "not_relevant" })
      }), env);
      expect(hide.status).toBe(200);

      const active = await worker.fetch(new Request("https://example.com/v1/papers?grade=A", { headers: auth(profile.recovery_key) }), env);
      const activeBody = await active.json() as { items: Array<{ paperId: string }> };
      expect(activeBody.items.some(item => item.paperId === paperId)).toBe(false);

      const history = await worker.fetch(new Request("https://example.com/v1/papers?state=not_relevant", { headers: auth(profile.recovery_key) }), env);
      const historyBody = await history.json() as { items: Array<{ paperId: string; feedbackState: string | null }> };
      expect(historyBody.items.find(item => item.paperId === paperId)?.feedbackState).toBe("not_relevant");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rate-limits repeated manual searches for the same profile", async () => {
    const profile = await createProfile();
    stubSources();
    try {
      const first = await worker.fetch(new Request("https://example.com/v1/search-now", { method: "POST", headers: auth(profile.recovery_key) }), env);
      expect(first.status).toBe(202);
      const second = await worker.fetch(new Request("https://example.com/v1/search-now", { method: "POST", headers: auth(profile.recovery_key) }), env);
      expect(second.status).toBe(429);
      const body = await second.json() as { retry_after_seconds: number };
      expect(body.retry_after_seconds).toBeGreaterThan(0);
      expect(body.retry_after_seconds).toBeLessThanOrEqual(60);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not let another profile write feedback to a paper it has not seen", async () => {
    const owner = await createProfile();
    const stranger = await createProfile(null);
    stubSources();
    try {
      const run = await worker.fetch(new Request("https://example.com/v1/search-now", { method: "POST", headers: auth(owner.recovery_key) }), env);
      expect(run.status).toBe(202);
      const papers = await worker.fetch(new Request("https://example.com/v1/papers", { headers: auth(owner.recovery_key) }), env);
      const body = await papers.json() as { items: Array<{ paperId: string }> };
      const paperId = body.items[0].paperId;

      const response = await worker.fetch(new Request("https://example.com/v1/feedback", {
        method: "POST",
        headers: auth(stranger.recovery_key, true),
        body: JSON.stringify({ paper_id: paperId, action: "must_read" })
      }), env);
      expect(response.status).toBe(404);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
