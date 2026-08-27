import type { ResearchConfig, ScheduleConfig } from "@literature-monitor/core";
import type { Env } from "./env";

export interface ProfileRow {
  profile_id: string;
  token_hash: string;
  config_json: string;
  timezone: string;
  schedule_json: string;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileView {
  profile_id: string;
  config: ResearchConfig;
  timezone: string;
  schedule: ScheduleConfig;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

export async function getProfileRow(env: Env, profileId: string): Promise<ProfileRow | null> {
  return env.DB.prepare("SELECT * FROM profiles WHERE profile_id = ? LIMIT 1")
    .bind(profileId)
    .first<ProfileRow>();
}

export function rowToProfile(row: ProfileRow): ProfileView {
  return {
    profile_id: row.profile_id,
    config: JSON.parse(row.config_json) as ResearchConfig,
    timezone: row.timezone,
    schedule: JSON.parse(row.schedule_json) as ScheduleConfig,
    enabled: row.enabled === 1,
    last_run_at: row.last_run_at,
    next_run_at: row.next_run_at,
  };
}
