import type {
  CreateProfileResponse,
  FeedbackAction,
  FeedbackResponse,
  Grade,
  LatestReport,
  PapersPage,
  ProfileUpdate,
  ProfileView,
  ResearcherCandidate,
  RunSummary
} from "./types";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface PapersQuery {
  grade?: Grade;
  state?: "active" | "all" | "must_read" | "read_later" | "not_relevant" | "done";
  cursor?: string;
}

export interface LiteratureApiClient {
  createProfile(template: "thermoelectric" | null): Promise<CreateProfileResponse>;
  getProfile(): Promise<ProfileView>;
  updateProfile(update: ProfileUpdate): Promise<ProfileView>;
  searchNow(): Promise<RunSummary>;
  getLatestReport(): Promise<LatestReport>;
  getPapers(query?: PapersQuery): Promise<PapersPage>;
  sendFeedback(paperId: string, action: FeedbackAction): Promise<FeedbackResponse>;
  searchResearchers(query: string): Promise<{ results: ResearcherCandidate[] }>;
}

function cleanBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function createApiClient(
  baseUrl: string,
  recoveryKey: string | null,
  fetchImpl: typeof fetch = fetch
): LiteratureApiClient {
  const base = cleanBaseUrl(baseUrl);

  async function requestJson<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
    if (auth && recoveryKey) headers.set("Authorization", `Bearer ${recoveryKey}`);

    const response = await fetchImpl(`${base}${path}`, { ...init, headers });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      const message = body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with ${response.status}`;
      throw new ApiClientError(response.status, message, body);
    }
    return body as T;
  }

  return {
    createProfile(template) {
      return requestJson<CreateProfileResponse>(
        "/v1/profile",
        { method: "POST", body: JSON.stringify(template ? { template } : {}) },
        false
      );
    },
    getProfile() {
      return requestJson<ProfileView>("/v1/profile");
    },
    updateProfile(update) {
      return requestJson<ProfileView>("/v1/profile", { method: "PUT", body: JSON.stringify(update) });
    },
    searchNow() {
      return requestJson<RunSummary>("/v1/search-now", { method: "POST" });
    },
    getLatestReport() {
      return requestJson<LatestReport>("/v1/report/latest");
    },
    getPapers(query = {}) {
      const params = new URLSearchParams();
      if (query.grade) params.set("grade", query.grade);
      if (query.state) params.set("state", query.state);
      if (query.cursor) params.set("cursor", query.cursor);
      const suffix = params.size ? `?${params.toString()}` : "";
      return requestJson<PapersPage>(`/v1/papers${suffix}`);
    },
    sendFeedback(paperId, action) {
      return requestJson<FeedbackResponse>("/v1/feedback", {
        method: "POST",
        body: JSON.stringify({ paper_id: paperId, action })
      });
    },
    searchResearchers(query) {
      const params = new URLSearchParams({ q: query });
      return requestJson<{ results: ResearcherCandidate[] }>(`/v1/researchers/search?${params.toString()}`);
    }
  };
}
