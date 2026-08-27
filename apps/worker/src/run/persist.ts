import type { CanonicalPaper, ClassificationResult } from "@literature-monitor/core";
import type { Env } from "../env";

export interface ClassifiedPaper {
  paper: CanonicalPaper;
  classification: ClassificationResult;
}

export async function persistClassifiedPapers(
  env: Env,
  profileId: string,
  runId: string,
  items: ClassifiedPaper[],
  timestamp: string
): Promise<void> {
  for (const { paper, classification } of items) {
    await env.DB.prepare(
      `INSERT INTO papers (
        paper_id, title, normalized_title, abstract, doi, openalex_id, arxiv_id,
        authors_json, venue, publication_date, url, sources_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(paper_id) DO UPDATE SET
        title = excluded.title,
        normalized_title = excluded.normalized_title,
        abstract = excluded.abstract,
        doi = COALESCE(excluded.doi, papers.doi),
        openalex_id = COALESCE(excluded.openalex_id, papers.openalex_id),
        arxiv_id = COALESCE(excluded.arxiv_id, papers.arxiv_id),
        authors_json = excluded.authors_json,
        venue = COALESCE(excluded.venue, papers.venue),
        publication_date = COALESCE(excluded.publication_date, papers.publication_date),
        url = COALESCE(excluded.url, papers.url),
        sources_json = excluded.sources_json,
        updated_at = excluded.updated_at`
    ).bind(
      paper.id,
      paper.title,
      paper.normalizedTitle,
      paper.abstract,
      paper.doi ?? null,
      paper.openalexId ?? null,
      paper.arxivId ?? null,
      JSON.stringify(paper.authors),
      paper.venue ?? null,
      paper.publicationDate ?? null,
      paper.url ?? null,
      JSON.stringify(paper.sources),
      timestamp,
      timestamp
    ).run();

    await env.DB.prepare(
      `INSERT INTO profile_papers (
        profile_id, paper_id, grade, score, reasons_json,
        first_seen_at, last_seen_at, originating_run_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, paper_id) DO UPDATE SET
        grade = excluded.grade,
        score = excluded.score,
        reasons_json = excluded.reasons_json,
        last_seen_at = excluded.last_seen_at,
        originating_run_id = excluded.originating_run_id`
    ).bind(
      profileId,
      paper.id,
      classification.grade,
      classification.score,
      JSON.stringify(classification.reasons),
      timestamp,
      timestamp,
      runId
    ).run();
  }
}
