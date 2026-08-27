const SETTINGS_KEY = "literatureMonitorUiSettings";

export interface UiSettings {
  defaultGrade?: "A" | "B" | "C" | "D";
  showHidden?: boolean;
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

export async function getUiSettings(): Promise<UiSettings> {
  const result = await storageArea().get(SETTINGS_KEY);
  const value = result[SETTINGS_KEY];
  return value && typeof value === "object" ? value as UiSettings : {};
}

export async function saveUiSettings(settings: UiSettings): Promise<void> {
  await storageArea().set({ [SETTINGS_KEY]: settings });
}
