import { classifyPaper, computeNextRun } from "@literature-monitor/core";
import type { Grade } from "@literature-monitor/core";
import { getProfileRow, rowToProfile } from "../db";
import type { Env } from "../env";
import { searchAll } from "../sources/search";
import { persistClassifiedPapers } from "./persist";

export type RunStatus = "success" | "partial" | "failed";

export interface RunSummary {
  runId: string;
  profileId: string;
  status: RunStatus;
  paperCount: number;
  gradeCounts: Record<Grade, number>;
  sourceStatus: Record<string, string>;
  startedAt: string;
  endedAt: string;
}

function blankGradeCounts(): Record<Grade, number> {
  return { A: 0, B: 0, C: 0, D: 0 };
}

function lookbackDate(now: Date): string {
  const date = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function aggregateStatus(values: string[]): RunStatus {
  if (!values.length || values.every(value => value === "failed")) return "failed";
  if (values.some(value => value === "failed")) return "partial";
  return "success";
}

export async function runProfile(profileId: string, reason: string, env: Env): Promise<RunSummary> {
  const profileRow = await getProfileRow(env, profileId);
  if (!profileRow) throw new Error("Profile not found");
  const profile = rowToProfile(profileRow);

  const started = new Date();
  const startedAt = started.toISOString();
  const runId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO runs (run_id, profile_id, reason, status, started_at)
     VALUES (?, ?, ?, 'running', ?)`
  ).bind(runId, profileId, reason, startedAt).run();

  try {
    const search = await searchAll(
      profile.config,
      lookbackDate(started),
      globalThis.fetch.bind(globalThis)
    );
    const status = aggregateStatus(Object.values(search.status));
    if (status === "failed") throw new Error("All literature sources failed");

    const classified = search.papers.map(paper => ({
      paper,
      classification: classifyPaper(paper, profile.config)
    }));
    const gradeCounts = blankGradeCounts();
    for (const item of classified) gradeCounts[item.classification.grade] += 1;

    const ended = new Date();
    const endedAt = ended.toISOString();
    await persistClassifiedPapers(env, profileId, runId, classified, endedAt);

    await env.DB.prepare(
      `UPDATE runs SET status = ?, ended_at = ?, source_counts_json = ?, grade_counts_json = ? WHERE run_id = ?`
    ).bind(status, endedAt, JSON.stringify(search.status), JSON.stringify(gradeCounts), runId).run();

    const nextRunAt = profile.enabled
      ? computeNextRun(ended, profile.timezone, profile.schedule).toISOString()
      : null;
    await env.DB.prepare(
      `UPDATE profiles SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE profile_id = ?`
    ).bind(endedAt, nextRunAt, endedAt, profileId).run();

    return {
      runId,
      profileId,
      status,
      paperCount: classified.length,
      gradeCounts,
      sourceStatus: search.status as Record<string, string>,
      startedAt,
      endedAt
    };
  } catch (error) {
    const endedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Unknown run failure";
    await env.DB.prepare(
      `UPDATE runs SET status = 'failed', ended_at = ?, error_summary = ? WHERE run_id = ?`
    ).bind(endedAt, message.slice(0, 1000), runId).run();
    throw error;
  }
}
