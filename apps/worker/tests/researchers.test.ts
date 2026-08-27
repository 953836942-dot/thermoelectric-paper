import openalexFixture from "./fixtures/openalex.json";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

async function createProfile() {
  const response = await worker.fetch(new Request("https://example.com/v1/profile", { method: "POST" }), env);
  expect(response.status).toBe(201);
  return response.json() as Promise<{ recovery_key: string }>;
}

describe("researcher resolution API", () => {
  it("requires bearer authentication", async () => {
    const response = await worker.fetch(new Request("https://example.com/v1/researchers/search?q=Jane"), env);
    expect(response.status).toBe(401);
  });

  it("returns OpenAlex author candidates for an authenticated profile", async () => {
    const created = await createProfile();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("api.openalex.org/authors");
      return Response.json({ results: openalexFixture.authors });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const response = await worker.fetch(new Request("https://example.com/v1/researchers/search?q=Jane%20Researcher", {
        headers: { authorization: `Bearer ${created.recovery_key}` }
      }), env);
      expect(response.status).toBe(200);
      const body = await response.json() as { results: Array<{ id: string; displayName: string; institutions: string[]; worksCount: number }> };
      expect(body.results).toEqual([
        {
          id: "https://openalex.org/A1111111111",
          displayName: "Jane Researcher",
          institutions: ["University of Example"],
          worksCount: 87
        },
        {
          id: "https://openalex.org/A3333333333",
          displayName: "Jane Researcher",
          institutions: ["Institute of Materials"],
          worksCount: 24
        }
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
