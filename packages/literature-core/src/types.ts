export type Grade = "A" | "B" | "C" | "D";

export interface AuthorRef {
  name: string;
  openalexId?: string;
}

export interface ResearcherRef {
  name: string;
  openalexId: string;
}

export interface RawPaper {
  title: string;
  abstract?: string;
  doi?: string;
  openalexId?: string;
  arxivId?: string;
  authors?: Array<AuthorRef | string>;
  venue?: string;
  publicationDate?: string;
  url?: string;
  source?: string;
  sources?: string[];
}

export interface CanonicalPaper {
  id: string;
  title: string;
  normalizedTitle: string;
  abstract: string;
  doi?: string;
  openalexId?: string;
  arxivId?: string;
  authors: AuthorRef[];
  venue?: string;
  publicationDate?: string;
  url?: string;
  sources: string[];
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

export interface MatchedSignals {
  topics: string[];
  priorityMaterials: string[];
  mechanisms: string[];
  researchers: string[];
  priorityVenues: string[];
  strongEvidence: string[];
  peripheralTerms: string[];
  excludedTopics: string[];
}

export interface ClassificationResult {
  score: number;
  grade: Grade;
  reasons: string[];
  matched: MatchedSignals;
}
