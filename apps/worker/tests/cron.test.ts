import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { runProfile } from "../src/run/run-profile";
import { runDueProfiles } from "../src/scheduler/cron";

async function createProfile(template = true) {
  const response = await worker.fetch(new Request("https://example.com/v1/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: template ? JSON.stringify({ template: "thermoelectric" }) : undefined
  }), env);
  expect(response.status).toBe(201);
  return response.json() as Promise<{ profile_id: string; recovery_key: string }>;
}

function successSources() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.openalex.org/works")) return Response.json({ results: [{
      id: "https://openalex.org/WCRON1",
      title: "Thermoelectric doping optimization in GeTe",
      publication_date: "2026-08-26",
      abstract_inverted_index: { thermoelectric: [0], performance: [1] },
      authorships: [],
      primary_location: { landing_page_url: "https://example.com/cron", source: { display_name: "Advanced Materials" } }
    }] });
    if (url.includes("export.arxiv.org")) return new Response("<?xml version=\"1.0\"?><feed xmlns=\"http://www.w3.org/2005/Atom\"></feed>", { status: 200 });
    return new Response("not found", { status: 404 });
  }));
}

describe("hourly due-profile cron", () => {
  it("runs only enabled profiles that are due and advances their next run", async () => {
    const due = await createProfile();
    const future = await createProfile();
    const disabled = await createProfile();
    await env.DB.prepare("UPDATE profiles SET next_run_at = ? WHERE profile_id = ?").bind("2026-08-27T00:00:00.000Z", due.profile_id).run();
    await env.DB.prepare("UPDATE profiles SET next_run_at = ? WHERE profile_id = ?").bind("2099-01-01T00:00:00.000Z", future.profile_id).run();
    await env.DB.prepare("UPDATE profiles SET enabled = 0, next_run_at = ? WHERE profile_id = ?").bind("2026-08-27T00:00:00.000Z", disabled.profile_id).run();
    successSources();

    try {
      const summary = await runDueProfiles(env, new Date("2026-08-28T00:00:00.000Z"), 10);
      expect(summary).toMatchObject({ attempted: 1, succeeded: 1, failed: 0 });

      const dueRuns = await env.DB.prepare("SELECT COUNT(*) AS count FROM runs WHERE profile_id = ? AND reason = 'cron'")
        .bind(due.profile_id).first<{ count: number }>();
      const futureRuns = await env.DB.prepare("SELECT COUNT(*) AS count FROM runs WHERE profile_id = ? AND reason = 'cron'")
        .bind(future.profile_id).first<{ count: number }>();
      const disabledRuns = await env.DB.prepare("SELECT COUNT(*) AS count FROM runs WHERE profile_id = ? AND reason = 'cron'")
        .bind(disabled.profile_id).first<{ count: number }>();
      expect(dueRuns?.count).toBe(1);
      expect(futureRuns?.count).toBe(0);
      expect(disabledRuns?.count).toBe(0);

      const updated = await env.DB.prepare("SELECT next_run_at FROM profiles WHERE profile_id = ?")
        .bind(due.profile_id).first<{ next_run_at: string }>();
      expect(new Date(updated!.next_run_at).getTime()).toBeGreaterThan(new Date("2026-08-27T00:00:00.000Z").getTime());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("records a failed cron run without destroying the previous successful report", async () => {
    const profile = await createProfile();
    successSources();
    try {
      const first = await runProfile(profile.profile_id, "manual-seed", env);
      expect(first.status).toBe("success");
      await env.DB.prepare("UPDATE profiles SET next_run_at = ? WHERE profile_id = ?")
        .bind("2026-08-27T00:00:00.000Z", profile.profile_id).run();
    } finally {
      vi.unstubAllGlobals();
    }

    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream failure", { status: 500 })));
    try {
      const summary = await runDueProfiles(env, new Date("2026-08-28T00:00:00.000Z"), 10);
      expect(summary).toMatchObject({ attempted: 1, succeeded: 0, failed: 1 });

      const failed = await env.DB.prepare("SELECT COUNT(*) AS count FROM runs WHERE profile_id = ? AND reason = 'cron' AND status = 'failed'")
        .bind(profile.profile_id).first<{ count: number }>();
      expect(failed?.count).toBe(1);

      const report = await worker.fetch(new Request("https://example.com/v1/report/latest", {
        headers: { authorization: `Bearer ${profile.recovery_key}` }
      }), env);
      expect(report.status).toBe(200);
      const body = await report.json() as { runId: string };
      const successful = await env.DB.prepare("SELECT run_id FROM runs WHERE profile_id = ? AND status = 'success' ORDER BY ended_at DESC LIMIT 1")
        .bind(profile.profile_id).first<{ run_id: string }>();
      expect(body.runId).toBe(successful?.run_id);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
