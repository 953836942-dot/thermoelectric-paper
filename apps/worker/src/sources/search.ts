import { buildQueries, dedupePapers, normalizePaper } from "@literature-monitor/core";
import type { CanonicalPaper, RawPaper, ResearchConfig, SearchQuery } from "@literature-monitor/core";
import { searchArxiv } from "./arxiv";
import { searchOpenAlex } from "./openalex";
import { searchRss } from "./rss";
import type { SearchAllOptions, SourceContext, SourceName, SourceStatus } from "./types";

export interface SearchAllResult {
  papers: CanonicalPaper[];
  status: Partial<Record<SourceName, SourceStatus>>;
}

const DEFAULT_CONTACT = "literature-monitor/0.1 (research literature monitor)";

async function runSource(
  source: SourceName,
  queries: SearchQuery[],
  ctx: SourceContext
): Promise<RawPaper[]> {
  const search = source === "openalex" ? searchOpenAlex : source === "arxiv" ? searchArxiv : searchRss;
  const batches = await Promise.all(queries.map(query => search(query, ctx)));
  return batches.flat();
}

export async function searchAll(
  config: ResearchConfig,
  lookbackSince: string,
  fetchImpl: typeof fetch,
  options: SearchAllOptions = {}
): Promise<SearchAllResult> {
  const queries = buildQueries(config);
  const sources = options.sources ?? (["openalex", "arxiv", ...(options.rssFeeds?.length ? ["rss" as const] : [])] as SourceName[]);
  const status: Partial<Record<SourceName, SourceStatus>> = {};
  const raw: RawPaper[] = [];

  for (const source of sources) {
    try {
      const papers = await runSource(source, queries, {
        fetchImpl,
        lookbackSince,
        contact: options.contact ?? DEFAULT_CONTACT,
        timeoutMs: options.timeoutMs ?? 8000,
        rssFeeds: options.rssFeeds
      });
      raw.push(...papers);
      status[source] = "success";
    } catch {
      status[source] = "failed";
    }
  }

  return { papers: dedupePapers(raw.map(normalizePaper)), status };
}
