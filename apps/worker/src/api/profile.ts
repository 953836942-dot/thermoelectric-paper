import { computeNextRun } from "@literature-monitor/core";
import type { ResearchConfig, ResearcherRef, ScheduleConfig } from "@literature-monitor/core";
import { generateRecoveryKey, sha256Hex } from "../auth";
import { getProfileRow, rowToProfile } from "../db";
import type { Env } from "../env";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const MAX_LIST_ITEMS = 100;
const MAX_RESEARCHERS = 50;
const MAX_TEXT = 200;

function emptyConfig(): ResearchConfig {
  return {
    topics: [],
    priorityMaterials: [],
    mechanisms: [],
    excludedTopics: [],
    priorityVenues: [],
    researchers: [],
  };
}

function thermoelectricConfig(): ResearchConfig {
  return {
    topics: ["thermoelectric", "thermoelectric machine learning", "composition property prediction"],
    priorityMaterials: ["GeTe", "Bi2Te3", "PbTe", "SnSe", "Ag2Se", "Mg3Sb2", "half-Heusler", "skutterudite"],
    mechanisms: ["co-doping", "doping optimization", "weighted mobility", "B factor", "quality factor", "band convergence", "resonant level", "strain engineering", "interface engineering"],
    excludedTopics: ["battery", "supercapacitor", "photovoltaic", "solar cell", "photodetector", "spin Nernst", "anomalous Nernst"],
    priorityVenues: ["Advanced Materials", "Advanced Functional Materials", "Advanced Energy Materials", "Science Advances", "Energy & Environmental Science", "Joule", "ACS Energy Letters", "Nano Energy", "Small"],
    researchers: [],
    strongEvidenceTerms: ["zT", "Seebeck coefficient", "power factor", "carrier transport", "thermal conductivity", "performance"],
    peripheralTerms: ["flexible", "wearable", "sensor", "generator", "module"],
  };
}

function validateTimezone(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) throw new ApiError(400, "Invalid timezone");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
  } catch {
    throw new ApiError(400, "Invalid timezone");
  }
  return value;
}

function validateStringList(value: unknown, field: string, maxItems = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new ApiError(400, `Invalid ${field}`);
  return value.map(item => {
    if (typeof item !== "string") throw new ApiError(400, `Invalid ${field}`);
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > MAX_TEXT) throw new ApiError(400, `Invalid ${field}`);
    return trimmed;
  });
}

function validateResearchers(value: unknown): ResearcherRef[] {
  if (!Array.isArray(value) || value.length > MAX_RESEARCHERS) throw new ApiError(400, "Invalid researchers");
  return value.map(item => {
    if (!item || typeof item !== "object") throw new ApiError(400, "Invalid researchers");
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.name !== "string" || typeof candidate.openalexId !== "string") throw new ApiError(400, "Invalid researchers");
    const name = candidate.name.trim();
    const openalexId = candidate.openalexId.trim();
    if (!name || name.length > MAX_TEXT || !/^(?:https:\/\/openalex\.org\/)?A\d+$/i.test(openalexId)) {
      throw new ApiError(400, "Invalid researchers");
    }
    return { name, openalexId: openalexId.replace(/^https:\/\/openalex\.org\//i, "") };
  });
}

function validateConfig(current: ResearchConfig, update: unknown): ResearchConfig {
  if (!update || typeof update !== "object" || Array.isArray(update)) throw new ApiError(400, "Invalid config");
  const candidate = update as Record<string, unknown>;
  return {
    topics: candidate.topics === undefined ? current.topics : validateStringList(candidate.topics, "topics"),
    priorityMaterials: candidate.priorityMaterials === undefined ? current.priorityMaterials : validateStringList(candidate.priorityMaterials, "priorityMaterials"),
    mechanisms: candidate.mechanisms === undefined ? current.mechanisms : validateStringList(candidate.mechanisms, "mechanisms"),
    excludedTopics: candidate.excludedTopics === undefined ? current.excludedTopics : validateStringList(candidate.excludedTopics, "excludedTopics"),
    priorityVenues: candidate.priorityVenues === undefined ? current.priorityVenues : validateStringList(candidate.priorityVenues, "priorityVenues"),
    researchers: candidate.researchers === undefined ? current.researchers : validateResearchers(candidate.researchers),
    strongEvidenceTerms: candidate.strongEvidenceTerms === undefined
      ? current.strongEvidenceTerms
      : validateStringList(candidate.strongEvidenceTerms, "strongEvidenceTerms"),
    peripheralTerms: candidate.peripheralTerms === undefined
      ? current.peripheralTerms
      : validateStringList(candidate.peripheralTerms, "peripheralTerms"),
  };
}

function validateSchedule(value: unknown): ScheduleConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "Invalid schedule");
  const candidate = value as Record<string, unknown>;
  if (candidate.frequency !== "daily" && candidate.frequency !== "weekly") throw new ApiError(400, "Invalid schedule");
  if (typeof candidate.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.time)) throw new ApiError(400, "Invalid schedule");
  if (candidate.frequency === "weekly") {
    if (!Number.isInteger(candidate.weekday) || Number(candidate.weekday) < 0 || Number(candidate.weekday) > 6) throw new ApiError(400, "Invalid schedule");
    return { frequency: "weekly", weekday: Number(candidate.weekday), time: candidate.time };
  }
  return { frequency: "daily", time: candidate.time };
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export async function createProfile(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request);
  if (body.template !== undefined && body.template !== "thermoelectric") throw new ApiError(400, "Unknown template");

  const isThermoelectric = body.template === "thermoelectric";
  const config = isThermoelectric ? thermoelectricConfig() : emptyConfig();
  const timezone = isThermoelectric ? "Australia/Brisbane" : "UTC";
  const schedule: ScheduleConfig = { frequency: "weekly", weekday: 1, time: "08:00" };
  const now = new Date();
  const profileId = crypto.randomUUID();
  const recoveryKey = generateRecoveryKey();
  const tokenHash = await sha256Hex(recoveryKey);
  const nextRunAt = computeNextRun(now, timezone, schedule).toISOString();
  const timestamp = now.toISOString();

  await env.DB.prepare(
    `INSERT INTO profiles (profile_id, token_hash, config_json, timezone, schedule_json, enabled, next_run_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).bind(profileId, tokenHash, JSON.stringify(config), timezone, JSON.stringify(schedule), nextRunAt, timestamp, timestamp).run();

  const row = await getProfileRow(env, profileId);
  if (!row) throw new Error("Profile insert failed");
  return Response.json({ profile_id: profileId, recovery_key: recoveryKey, profile: rowToProfile(row) }, { status: 201 });
}

export async function getProfile(env: Env, profileId: string): Promise<Response> {
  const row = await getProfileRow(env, profileId);
  if (!row) throw new ApiError(404, "Profile not found");
  return Response.json(rowToProfile(row));
}

export async function updateProfile(request: Request, env: Env, profileId: string): Promise<Response> {
  const row = await getProfileRow(env, profileId);
  if (!row) throw new ApiError(404, "Profile not found");
  const current = rowToProfile(row);
  const body = await readJsonBody(request);
  const config = body.config === undefined ? current.config : validateConfig(current.config, body.config);
  const timezone = body.timezone === undefined ? current.timezone : validateTimezone(body.timezone);
  const schedule = body.schedule === undefined ? current.schedule : validateSchedule(body.schedule);
  const enabled = body.enabled === undefined ? current.enabled : body.enabled;
  if (typeof enabled !== "boolean") throw new ApiError(400, "Invalid enabled value");

  const now = new Date();
  const nextRunAt = enabled ? computeNextRun(now, timezone, schedule).toISOString() : null;
  await env.DB.prepare(
    `UPDATE profiles SET config_json = ?, timezone = ?, schedule_json = ?, enabled = ?, next_run_at = ?, updated_at = ? WHERE profile_id = ?`
  ).bind(JSON.stringify(config), timezone, JSON.stringify(schedule), enabled ? 1 : 0, nextRunAt, now.toISOString(), profileId).run();

  const updated = await getProfileRow(env, profileId);
  if (!updated) throw new Error("Profile update failed");
  return Response.json(rowToProfile(updated));
}
