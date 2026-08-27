import type { Grade } from "@literature-monitor/core";
import type { Env } from "../env";

export interface PaperApiRow {
  paper_id: string;
  title: string;
  abstract: string;
  authors_json: string;
  venue: string | null;
  publication_date: string | null;
  url: string | null;
  grade: Grade;
  score: number;
  reasons_json: string;
  feedback_state: string | null;
  last_seen_at: string;
}

export function serializePaperRow(row: PaperApiRow) {
  return {
    paperId: row.paper_id,
    title: row.title,
    abstract: row.abstract,
    authors: JSON.parse(row.authors_json) as Array<{ name: string; openalexId?: string }>,
    venue: row.venue,
    publicationDate: row.publication_date,
    url: row.url,
    grade: row.grade,
    score: row.score,
    reasons: JSON.parse(row.reasons_json) as string[],
    feedbackState: row.feedback_state
  };
}

function encodeCursor(row: PaperApiRow): string {
  const json = JSON.stringify({ lastSeenAt: row.last_seen_at, paperId: row.paper_id });
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCursor(value: string | null): { lastSeenAt: string; paperId: string } | null {
  if (!value) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const parsed = JSON.parse(atob(padded)) as { lastSeenAt?: unknown; paperId?: unknown };
    if (typeof parsed.lastSeenAt !== "string" || typeof parsed.paperId !== "string") return null;
    return { lastSeenAt: parsed.lastSeenAt, paperId: parsed.paperId };
  } catch {
    return null;
  }
}

export async function getPapers(request: Request, env: Env, profileId: string): Promise<Response> {
  const url = new URL(request.url);
  const grade = url.searchParams.get("grade");
  if (grade && !/^[ABCD]$/.test(grade)) return Response.json({ error: "Invalid grade" }, { status: 400 });

  const state = url.searchParams.get("state") ?? "active";
  const allowedStates = new Set(["active", "all", "must_read", "read_later", "not_relevant", "done"]);
  if (!allowedStates.has(state)) return Response.json({ error: "Invalid state" }, { status: 400 });

  const cursorText = url.searchParams.get("cursor");
  const cursor = decodeCursor(cursorText);
  if (cursorText && !cursor) return Response.json({ error: "Invalid cursor" }, { status: 400 });

  const where = ["pp.profile_id = ?"];
  const binds: unknown[] = [profileId];
  if (grade) {
    where.push("pp.grade = ?");
    binds.push(grade);
  }
  if (state === "active") where.push("pp.hidden = 0");
  else if (state !== "all") {
    where.push("pp.feedback_state = ?");
    binds.push(state);
  }
  if (cursor) {
    where.push("(pp.last_seen_at < ? OR (pp.last_seen_at = ? AND pp.paper_id > ?))");
    binds.push(cursor.lastSeenAt, cursor.lastSeenAt, cursor.paperId);
  }

  const sql = `SELECT
      p.paper_id, p.title, p.abstract, p.authors_json, p.venue, p.publication_date, p.url,
      pp.grade, pp.score, pp.reasons_json, pp.feedback_state, pp.last_seen_at
    FROM profile_papers pp
    JOIN papers p ON p.paper_id = pp.paper_id
    WHERE ${where.join(" AND ")}
    ORDER BY pp.last_seen_at DESC, pp.paper_id ASC
    LIMIT 51`;

  const result = await env.DB.prepare(sql).bind(...binds).all<PaperApiRow>();
  const rows = result.results;
  const page = rows.slice(0, 50);
  const nextCursor = rows.length > 50 && page.length ? encodeCursor(page[page.length - 1]) : null;
  return Response.json({ items: page.map(serializePaperRow), nextCursor });
}
