import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { runProfile } from "../src/run/run-profile";

async function createThermoelectricProfile() {
  const response = await worker.fetch(new Request("https://example.com/v1/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template: "thermoelectric" })
  }), env);
  expect(response.status).toBe(201);
  return response.json() as Promise<{ profile_id: string; recovery_key: string }>;
}

function arxivFeed() {
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
    <entry>
      <id>http://arxiv.org/abs/2608.99999v1</id>
      <published>2026-08-25T10:00:00Z</published>
      <updated>2026-08-25T10:00:00Z</updated>
      <title>Weighted mobility optimization in thermoelectric PbTe</title>
      <summary>Doping optimization improves weighted mobility and thermoelectric performance.</summary>
      <author><name>Pipeline Author</name></author>
      <link href="https://arxiv.org/abs/2608.99999" rel="alternate" />
    </entry>
  </feed>`;
}

function stubLiteratureSources() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.openalex.org/works")) {
      return Response.json({ results: [{
        id: "https://openalex.org/W9999999999",
        title: "Band convergence and doping optimization in high-performance GeTe thermoelectrics",
        doi: "https://doi.org/10.1000/pipeline.1",
        publication_date: "2026-08-24",
        abstract_inverted_index: { thermoelectric: [0], performance: [1], doping: [2], optimization: [3] },
        authorships: [],
        primary_location: { landing_page_url: "https://doi.org/10.1000/pipeline.1", source: { display_name: "Advanced Materials" } }
      }] });
    }
    if (url.includes("export.arxiv.org")) return new Response(arxivFeed(), { status: 200 });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("runProfile", () => {
  it("searches, classifies and persists one idempotent profile run", async () => {
    const created = await createThermoelectricProfile();
    stubLiteratureSources();

    try {
      const summary = await runProfile(created.profile_id, "test", env);
      expect(summary.status).toBe("success");
      expect(summary.paperCount).toBe(2);
      expect(summary.gradeCounts.A + summary.gradeCounts.B + summary.gradeCounts.C + summary.gradeCounts.D).toBe(2);

      const runRow = await env.DB.prepare("SELECT status, grade_counts_json, source_counts_json FROM runs WHERE profile_id = ?")
        .bind(created.profile_id)
        .first<{ status: string; grade_counts_json: string; source_counts_json: string }>();
      expect(runRow?.status).toBe("success");
      expect(JSON.parse(runRow!.grade_counts_json)).toEqual(summary.gradeCounts);
      expect(JSON.parse(runRow!.source_counts_json)).toMatchObject({ openalex: "success", arxiv: "success" });

      const paperCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM papers").first<{ count: number }>();
      const profilePaperCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM profile_papers WHERE profile_id = ?")
        .bind(created.profile_id).first<{ count: number }>();
      expect(paperCount?.count).toBe(2);
      expect(profilePaperCount?.count).toBe(2);

      const profileAfter = await env.DB.prepare("SELECT last_run_at, next_run_at FROM profiles WHERE profile_id = ?")
        .bind(created.profile_id).first<{ last_run_at: string | null; next_run_at: string | null }>();
      expect(profileAfter?.last_run_at).toBeTruthy();
      expect(profileAfter?.next_run_at).toBeTruthy();

      await env.DB.prepare("UPDATE profile_papers SET feedback_state = 'must_read' WHERE profile_id = ? LIMIT 1")
        .bind(created.profile_id).run();
      await runProfile(created.profile_id, "retry", env);

      const afterRetry = await env.DB.prepare("SELECT COUNT(*) AS count FROM profile_papers WHERE profile_id = ?")
        .bind(created.profile_id).first<{ count: number }>();
      const feedback = await env.DB.prepare("SELECT COUNT(*) AS count FROM profile_papers WHERE profile_id = ? AND feedback_state = 'must_read'")
        .bind(created.profile_id).first<{ count: number }>();
      expect(afterRetry?.count).toBe(2);
      expect(feedback?.count).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
