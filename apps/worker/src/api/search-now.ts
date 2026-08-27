import type { Env } from "../env";
import { runProfile } from "../run/run-profile";

const COOLDOWN_MS = 60_000;

export async function searchNow(env: Env, profileId: string): Promise<Response> {
  const latest = await env.DB.prepare(
    `SELECT started_at FROM runs WHERE profile_id = ? AND reason = 'manual' ORDER BY started_at DESC LIMIT 1`
  ).bind(profileId).first<{ started_at: string }>();

  if (latest) {
    const elapsed = Date.now() - new Date(latest.started_at).getTime();
    if (elapsed >= 0 && elapsed < COOLDOWN_MS) {
      const retry = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
      return Response.json(
        { error: "Search now cooldown", retry_after_seconds: retry },
        { status: 429, headers: { "retry-after": String(retry) } }
      );
    }
  }

  const summary = await runProfile(profileId, "manual", env);
  return Response.json(summary, { status: 202 });
}
