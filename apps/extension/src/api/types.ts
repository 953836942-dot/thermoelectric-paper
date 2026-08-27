export type Grade = "A" | "B" | "C" | "D";
export type FeedbackAction = "must_read" | "read_later" | "not_relevant" | "done" | "clear";

export interface ResearcherRef {
  name: string;
  openalexId: string;
}

export interface ResearchConfig {
  topics: string[];
  priorityMaterials: string[];
  mechanisms: string[];
  excludedTopics: string[];
  priorityVenues: string[];
  researchers: ResearcherRef[];
  strongEvidenceTerms?: string[];
  peripheralTerms?: string[];
}

export interface ScheduleConfig {
  frequency: "daily" | "weekly";
  time: string;
  weekday?: number;
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

export interface CreateProfileResponse {
  profile_id: string;
  recovery_key: string;
  profile: ProfileView;
}

export interface PaperView {
  paperId: string;
  title: string;
  abstract: string;
  authors: Array<{ name: string; openalexId?: string }>;
  venue: string | null;
  publicationDate: string | null;
  url: string | null;
  grade: Grade;
  score: number;
  reasons: string[];
  feedbackState: Exclude<FeedbackAction, "clear"> | null;
}

export interface LatestReport {
  runId: string;
  lastSuccessfulUpdate: string;
  nextRunAt: string | null;
  gradeCounts: Record<Grade, number>;
  sourceStatus: Record<string, string>;
  topPapers: PaperView[];
}

export interface RunSummary {
  runId: string;
  profileId: string;
  status: "success" | "partial" | "failed";
  paperCount: number;
  gradeCounts: Record<Grade, number>;
  sourceStatus: Record<string, string>;
  startedAt: string;
  endedAt: string;
}

export interface PapersPage {
  items: PaperView[];
  nextCursor: string | null;
}

export interface ResearcherCandidate {
  id: string;
  displayName: string;
  institutions: string[];
  worksCount: number;
}

export interface FeedbackResponse {
  paperId: string;
  feedbackState: Exclude<FeedbackAction, "clear"> | null;
  hidden: boolean;
}

export interface ProfileUpdate {
  config?: Partial<ResearchConfig>;
  timezone?: string;
  schedule?: ScheduleConfig;
  enabled?: boolean;
}
