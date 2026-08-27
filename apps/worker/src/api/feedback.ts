import type { Env } from "../env";

const ACTIONS = new Set(["must_read", "read_later", "not_relevant", "done", "clear"]);

export async function postFeedback(request: Request, env: Env, profileId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json() as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paperId = body.paper_id;
  const action = body.action;
  if (typeof paperId !== "string" || !paperId || typeof action !== "string" || !ACTIONS.has(action)) {
    return Response.json({ error: "Invalid feedback" }, { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT paper_id FROM profile_papers WHERE profile_id = ? AND paper_id = ? LIMIT 1"
  ).bind(profileId, paperId).first<{ paper_id: string }>();
  if (!existing) return Response.json({ error: "Paper not found" }, { status: 404 });

  const state = action === "clear" ? null : action;
  const hidden = action === "not_relevant" ? 1 : 0;
  await env.DB.prepare(
    "UPDATE profile_papers SET feedback_state = ?, hidden = ? WHERE profile_id = ? AND paper_id = ?"
  ).bind(state, hidden, profileId, paperId).run();
  return Response.json({ paperId, feedbackState: state, hidden: hidden === 1 });
}
