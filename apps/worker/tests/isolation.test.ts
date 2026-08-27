import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { runProfile } from "../src/run/run-profile";

async function createProfile(topic: string) {
  const createdResponse = await worker.fetch(new Request("https://example.com/v1/profile", { method: "POST" }), env);
  expect(createdResponse.status).toBe(201);
  const created = await createdResponse.json() as { profile_id: string; recovery_key: string };
  const updateResponse = await worker.fetch(new Request("https://example.com/v1/profile", {
    method: "PUT",
    headers: { authorization: `Bearer ${created.recovery_key}`, "content-type": "application/json" },
    body: JSON.stringify({ config: { topics: [topic] } })
  }), env);
  expect(updateResponse.status).toBe(200);
  return created;
}

function openAlexWork(title: string, id: string) {
  return {
    id: `https://openalex.org/${id}`,
    title,
    publication_date: "2026-08-25",
    abstract_inverted_index: { performance: [0] },
    authorships: [],
    primary_location: { landing_page_url: `https://example.com/${id}`, source: { display_name: "Example Journal" } }
  };
}

function dynamicSources() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "api.openalex.org") {
      const query = (url.searchParams.get("search") ?? "").toLowerCase();
      if (query.includes("thermoelectric")) return Response.json({ results: [openAlexWork("Thermoelectric transport in GeTe", "WTE1")] });
      if (query.includes("sodium ion battery")) return Response.json({ results: [openAlexWork("Sodium ion battery cathode optimization", "WBAT1")] });
      return Response.json({ results: [] });
    }
    if (url.hostname === "export.arxiv.org") return new Response("<?xml version=\"1.0\"?><feed xmlns=\"http://www.w3.org/2005/Atom\"></feed>", { status: 200 });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

async function titlesFor(profileId: string): Promise<string[]> {
  const result = await env.DB.prepare(
    `SELECT p.title FROM papers p JOIN profile_papers pp ON pp.paper_id = p.paper_id WHERE pp.profile_id = ? ORDER BY p.title`
  ).bind(profileId).all<{ title: string }>();
  return result.results.map(row => row.title);
}

describe("multi-profile isolation", () => {
  it("never leaks papers or grades across research profiles", async () => {
    const te = await createProfile("thermoelectric");
    const battery = await createProfile("sodium ion battery");
    dynamicSources();

    try {
      await runProfile(te.profile_id, "test", env);
      await runProfile(battery.profile_id, "test", env);

      expect(await titlesFor(te.profile_id)).toEqual(["Thermoelectric transport in GeTe"]);
      expect(await titlesFor(battery.profile_id)).toEqual(["Sodium ion battery cathode optimization"]);

      const crossTe = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM profile_papers pp JOIN papers p ON p.paper_id = pp.paper_id WHERE pp.profile_id = ? AND p.title LIKE '%battery%'`
      ).bind(te.profile_id).first<{ count: number }>();
      const crossBattery = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM profile_papers pp JOIN papers p ON p.paper_id = pp.paper_id WHERE pp.profile_id = ? AND p.title LIKE '%Thermoelectric%'`
      ).bind(battery.profile_id).first<{ count: number }>();
      expect(crossTe?.count).toBe(0);
      expect(crossBattery?.count).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
