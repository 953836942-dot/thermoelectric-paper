export interface ExtensionSession {
  profileId: string;
  recoveryKey: string;
  apiBaseUrl: string;
}

const SESSION_KEY = "literatureMonitorSession";

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

function isSession(value: unknown): value is ExtensionSession {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.profileId === "string" && item.profileId.length > 0
    && typeof item.recoveryKey === "string" && item.recoveryKey.length > 0
    && typeof item.apiBaseUrl === "string" && item.apiBaseUrl.length > 0;
}

export async function getSession(): Promise<ExtensionSession | null> {
  const result = await storageArea().get(SESSION_KEY);
  const value = result[SESSION_KEY];
  return isSession(value) ? value : null;
}

export async function saveSession(session: ExtensionSession): Promise<void> {
  if (!isSession(session)) throw new Error("Invalid extension session");
  await storageArea().set({ [SESSION_KEY]: session });
}
