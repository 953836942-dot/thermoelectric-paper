import { normalizeTitle } from "./normalize";
import type { CanonicalPaper, ClassificationResult, Grade, MatchedSignals, ResearchConfig } from "./types";

export const SCORE_WEIGHTS = {
  topic: 25,
  priorityMaterial: 22,
  mechanism: 18,
  researcher: 30,
  priorityVenue: 12,
  strongEvidence: 10,
  peripheral: -10,
  exclude: -100,
} as const;

export const GRADE_THRESHOLDS = { A: 50, B: 25, C: 10 } as const;

const DEFAULT_EVIDENCE_TERMS = ["performance", "transport", "properties", "mechanism", "optimization", "efficiency", "stability"];

function matchingTerms(haystack: string, terms: string[]): string[] {
  return [...new Set(terms.filter(Boolean).filter(term => haystack.includes(normalizeTitle(term))))];
}

function blankMatches(): MatchedSignals {
  return { topics: [], priorityMaterials: [], mechanisms: [], researchers: [], priorityVenues: [], strongEvidence: [], peripheralTerms: [], excludedTopics: [] };
}

export function classifyPaper(paper: CanonicalPaper, config: ResearchConfig): ClassificationResult {
  const text = normalizeTitle([paper.title, paper.abstract, paper.venue ?? ""].join(" "));
  const matched = blankMatches();
  matched.excludedTopics = matchingTerms(text, config.excludedTopics);
  if (matched.excludedTopics.length > 0) {
    return { score: SCORE_WEIGHTS.exclude, grade: "D", reasons: [`Excluded topic: ${matched.excludedTopics.join(", ")}`], matched };
  }

  matched.topics = matchingTerms(text, config.topics);
  matched.priorityMaterials = matchingTerms(text, config.priorityMaterials);
  matched.mechanisms = matchingTerms(text, config.mechanisms);
  matched.priorityVenues = matchingTerms(normalizeTitle(paper.venue ?? ""), config.priorityVenues);
  matched.strongEvidence = matchingTerms(text, config.strongEvidenceTerms ?? DEFAULT_EVIDENCE_TERMS);
  matched.peripheralTerms = matchingTerms(text, config.peripheralTerms ?? []);

  const paperAuthorIds = new Set(paper.authors.map(author => author.openalexId).filter((id): id is string => Boolean(id)));
  const paperAuthorNames = new Set(paper.authors.map(author => normalizeTitle(author.name)));
  matched.researchers = config.researchers
    .filter(researcher => paperAuthorIds.has(researcher.openalexId) || paperAuthorNames.has(normalizeTitle(researcher.name)))
    .map(researcher => researcher.name);

  const score =
    matched.topics.length * SCORE_WEIGHTS.topic +
    matched.priorityMaterials.length * SCORE_WEIGHTS.priorityMaterial +
    matched.mechanisms.length * SCORE_WEIGHTS.mechanism +
    matched.researchers.length * SCORE_WEIGHTS.researcher +
    matched.priorityVenues.length * SCORE_WEIGHTS.priorityVenue +
    (matched.strongEvidence.length > 0 ? SCORE_WEIGHTS.strongEvidence : 0) +
    (matched.peripheralTerms.length > 0 ? SCORE_WEIGHTS.peripheral : 0);

  let grade: Grade = "D";
  if (score >= GRADE_THRESHOLDS.A) grade = "A";
  else if (score >= GRADE_THRESHOLDS.B) grade = "B";
  else if (score >= GRADE_THRESHOLDS.C) grade = "C";

  const reasons: string[] = [];
  if (matched.topics.length) reasons.push(`Topic: ${matched.topics.join(", ")}`);
  if (matched.priorityMaterials.length) reasons.push(`Priority material: ${matched.priorityMaterials.join(", ")}`);
  if (matched.mechanisms.length) reasons.push(`Mechanism: ${matched.mechanisms.join(", ")}`);
  if (matched.researchers.length) reasons.push(`Selected researcher: ${matched.researchers.join(", ")}`);
  if (matched.priorityVenues.length) reasons.push(`Priority venue: ${matched.priorityVenues.join(", ")}`);
  if (matched.strongEvidence.length) reasons.push(`Evidence: ${matched.strongEvidence.join(", ")}`);
  if (matched.peripheralTerms.length) reasons.push(`Peripheral context: ${matched.peripheralTerms.join(", ")}`);
  if (!reasons.length) reasons.push("No configured research signal matched");

  return { score, grade, reasons, matched };
}
