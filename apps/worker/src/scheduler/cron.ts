import type { Env } from "../env";
import { runProfile } from "../run/run-profile";

export interface DueRunSummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

export async function runDueProfiles(env: Env, now: Date = new Date(), limit = 10): Promise<DueRunSummary> {
  const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const due = await env.DB.prepare(
    `SELECT profile_id
     FROM profiles
     WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
     ORDER BY next_run_at ASC
     LIMIT ?`
  ).bind(now.toISOString(), boundedLimit).all<{ profile_id: string }>();

  let succeeded = 0;
  let failed = 0;
  for (const row of due.results) {
    try {
      await runProfile(row.profile_id, "cron", env);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error("Scheduled literature run failed", row.profile_id, error);
    }
  }

  return { attempted: due.results.length, succeeded, failed };
}
