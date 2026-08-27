import type { LatestReport, PaperView, ResearchConfig, ScheduleConfig } from "../api/types";
import { THERMOELECTRIC_CONFIG, createDemoPapers, createDemoReport } from "./defaults";

const STATE_KEY = "literatureMonitorLiteState";

export interface LiteState {
  config: ResearchConfig;
  timezone: string;
  schedule: ScheduleConfig;
  enabled: boolean;
  report: LatestReport;
  papers: PaperView[];
}

interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(value: Record<string, unknown>): Promise<void>;
}

function storageArea(): StorageAreaLike {
  const candidate = (globalThis as typeof globalThis & {
    chrome?: { storage?: { local?: StorageAreaLike } };
  }).chrome?.storage?.local;
  if (!candidate) throw new Error("chrome.storage.local is unavailable");
  return candidate;
}

function cloneConfig(config: ResearchConfig): ResearchConfig {
  return {
    ...config,
    topics: [...config.topics],
    priorityMaterials: [...config.priorityMaterials],
    mechanisms: [...config.mechanisms],
    excludedTopics: [...config.excludedTopics],
    priorityVenues: [...config.priorityVenues],
    researchers: config.researchers.map(item => ({ ...item })),
    strongEvidenceTerms: config.strongEvidenceTerms ? [...config.strongEvidenceTerms] : undefined,
    peripheralTerms: config.peripheralTerms ? [...config.peripheralTerms] : undefined
  };
}

export function createDefaultLiteState(): LiteState {
  const papers = createDemoPapers();
  return {
    config: cloneConfig(THERMOELECTRIC_CONFIG),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    schedule: { frequency: "weekly", weekday: 1, time: "08:00" },
    enabled: true,
    papers,
    report: createDemoReport(papers)
  };
}

function isLiteState(value: unknown): value is LiteState {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LiteState>;
  return Boolean(item.config && item.report && Array.isArray(item.papers));
}

export async function loadLiteState(): Promise<LiteState> {
  const result = await storageArea().get(STATE_KEY);
  const stored = result[STATE_KEY];
  if (isLiteState(stored)) return stored;
  const initial = createDefaultLiteState();
  await saveLiteState(initial);
  return initial;
}

export async function saveLiteState(state: LiteState): Promise<void> {
  await storageArea().set({ [STATE_KEY]: state });
}
