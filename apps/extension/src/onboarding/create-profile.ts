import { createApiClient, type LiteratureApiClient } from "../api/client";
import { getSession, saveSession, type ExtensionSession } from "../storage/session";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";

export async function ensureProfile(
  apiBaseUrl = DEFAULT_API_BASE_URL,
  template: "thermoelectric" | null = null,
  apiFactory: (baseUrl: string, recoveryKey: string | null) => LiteratureApiClient = createApiClient
): Promise<ExtensionSession> {
  const existing = await getSession();
  if (existing) return existing;

  const anonymousApi = apiFactory(apiBaseUrl, null);
  const created = await anonymousApi.createProfile(template);
  const session: ExtensionSession = {
    profileId: created.profile_id,
    recoveryKey: created.recovery_key,
    apiBaseUrl
  };
  await saveSession(session);
  return session;
}
