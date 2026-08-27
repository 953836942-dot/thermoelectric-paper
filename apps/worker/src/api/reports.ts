import type { Grade } from "@literature-monitor/core";
import type { Env } from "../env";
import type { PaperApiRow } from "./papers";
import { serializePaperRow } from "./papers";

interface LatestRunRow {
  run_id: string;
  ended_at: string;
  grade_counts_json: string | null;
  source_counts_json: string | null;
}

export async function getLatestReport(env: Env, profileId: string): Promise<Response> {
  const run = await env.DB.prepare(
    `SELECT run_id, ended_at, grade_counts_json, source_counts_json
     FROM runs
     WHERE profile_id = ? AND status IN ('success', 'partial') AND ended_at IS NOT NULL
     ORDER BY ended_at DESC, started_at DESC
     LIMIT 1`
  ).bind(profileId).first<LatestRunRow>();
  if (!run) return Response.json({ error: "No successful report yet" }, { status: 404 });

  const profile = await env.DB.prepare("SELECT next_run_at FROM profiles WHERE profile_id = ?")
    .bind(profileId).first<{ next_run_at: string | null }>();

  const top = await env.DB.prepare(
    `SELECT
      p.paper_id, p.title, p.abstract, p.authors_json, p.venue, p.publication_date, p.url,
      pp.grade, pp.score, pp.reasons_json, pp.feedback_state, pp.last_seen_at
     FROM profile_papers pp
     JOIN papers p ON p.paper_id = pp.paper_id
     WHERE pp.profile_id = ? AND pp.grade = 'A' AND pp.hidden = 0
     ORDER BY pp.score DESC, pp.last_seen_at DESC
     LIMIT 5`
  ).bind(profileId).all<PaperApiRow>();

  const fallbackCounts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
  return Response.json({
    runId: run.run_id,
    lastSuccessfulUpdate: run.ended_at,
    nextRunAt: profile?.next_run_at ?? null,
    gradeCounts: run.grade_counts_json ? JSON.parse(run.grade_counts_json) : fallbackCounts,
    sourceStatus: run.source_counts_json ? JSON.parse(run.source_counts_json) : {},
    topPapers: top.results.map(serializePaperRow)
  });
}
