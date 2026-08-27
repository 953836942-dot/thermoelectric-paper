import type { LiteratureApiClient, PapersQuery } from "../api/client";
import type {
  CreateProfileResponse,
  FeedbackAction,
  FeedbackResponse,
  LatestReport,
  PaperView,
  ProfileUpdate,
  ProfileView,
  ResearchConfig,
  ResearcherCandidate,
  RunSummary
} from "../api/types";
import { searchRecentOpenAlex } from "./openalex";
import { loadLiteState, saveLiteState, type LiteState } from "./store";

function mergeConfig(current: ResearchConfig, patch: Partial<ResearchConfig> | undefined): ResearchConfig {
  return patch ? { ...current, ...patch } : current;
}

function profileView(state: LiteState): ProfileView {
  return {
    profile_id: "local-browser",
    config: state.config,
    timezone: state.timezone,
    schedule: state.schedule,
    enabled: state.enabled,
    last_run_at: state.report.lastSuccessfulUpdate,
    next_run_at: state.report.nextRunAt
  };
}

function gradeCounts(papers: PaperView[]) {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const paper of papers) counts[paper.grade] += 1;
  return counts;
}

function stateMatches(paper: PaperView, query: PapersQuery): boolean {
  if (query.grade && paper.grade !== query.grade) return false;
  const state = query.state ?? "active";
  if (state === "all") return true;
  if (state === "active") return paper.feedbackState !== "not_relevant";
  return paper.feedbackState === state;
}

function feedbackResult(paper: PaperView): FeedbackResponse {
  return {
    paperId: paper.paperId,
    feedbackState: paper.feedbackState,
    hidden: paper.feedbackState === "not_relevant"
  };
}

export function createLocalLiteratureClient(options: { fetchImpl?: typeof fetch } = {}): LiteratureApiClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async createProfile(): Promise<CreateProfileResponse> {
      const state = await loadLiteState();
      return { profile_id: "local-browser", recovery_key: "local-only", profile: profileView(state) };
    },

    async getProfile() {
      return profileView(await loadLiteState());
    },

    async updateProfile(update: ProfileUpdate) {
      const state = await loadLiteState();
      state.config = mergeConfig(state.config, update.config);
      if (update.timezone) state.timezone = update.timezone;
      if (update.schedule) state.schedule = update.schedule;
      if (typeof update.enabled === "boolean") state.enabled = update.enabled;
      await saveLiteState(state);
      return profileView(state);
    },

    async searchNow(): Promise<RunSummary> {
      const state = await loadLiteState();
      const startedAt = new Date().toISOString();
      const result = await searchRecentOpenAlex(state.config, fetchImpl);
      const previousFeedback = new Map(state.papers.map(item => [item.paperId, item.feedbackState]));
      const papers = result.papers.map(item => ({ ...item, feedbackState: previousFeedback.get(item.paperId) ?? null }));
      const counts = gradeCounts(papers);
      const endedAt = new Date().toISOString();
      const report: LatestReport = {
        runId: `local-${Date.now()}`,
        lastSuccessfulUpdate: endedAt,
        nextRunAt: null,
        gradeCounts: counts,
        sourceStatus: {
          openalex: result.failedQueries ? `${result.successfulQueries} queries ok, ${result.failedQueries} failed` : `${result.successfulQueries} queries ok`,
          mode: "local-first"
        },
        topPapers: papers.filter(item => item.grade === "A" && item.feedbackState !== "not_relevant").slice(0, 5)
      };
      state.papers = papers;
      state.report = report;
      await saveLiteState(state);
      return {
        runId: report.runId,
        profileId: "local-browser",
        status: result.failedQueries ? "partial" : "success",
        paperCount: papers.length,
        gradeCounts: counts,
        sourceStatus: report.sourceStatus,
        startedAt,
        endedAt
      };
    },

    async getLatestReport() {
      return (await loadLiteState()).report;
    },

    async getPapers(query: PapersQuery = {}) {
      const state = await loadLiteState();
      return { items: state.papers.filter(item => stateMatches(item, query)), nextCursor: null };
    },

    async sendFeedback(paperId: string, action: FeedbackAction) {
      const state = await loadLiteState();
      const paper = state.papers.find(item => item.paperId === paperId);
      if (!paper) throw new Error("Paper not found in this browser.");
      paper.feedbackState = action === "clear" ? null : action;
      state.report.topPapers = state.papers.filter(item => item.grade === "A" && item.feedbackState !== "not_relevant").slice(0, 5);
      await saveLiteState(state);
      return feedbackResult(paper);
    },

    async searchResearchers(): Promise<{ results: ResearcherCandidate[] }> {
      return { results: [] };
    }
  };
}
