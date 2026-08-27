import { buildQueries, classifyPaper, dedupePapers, normalizePaper, type RawPaper, type ResearchConfig, type SearchQuery } from "@literature-monitor/core";
import type { PaperView } from "../api/types";

interface OpenAlexAuthor { id?: string; display_name?: string; }
interface OpenAlexWork {
  id?: string;
  title?: string;
  doi?: string;
  publication_date?: string;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: OpenAlexAuthor }>;
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
}

function abstractFromIndex(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words.push([position, word]);
  }
  return words.sort((a, b) => a[0] - b[0]).map(item => item[1]).join(" ");
}

function sinceIso(days = 7): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildUrl(query: SearchQuery): string {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("per-page", "15");
  url.searchParams.set("sort", "publication_date:desc");
  const filters = [`from_publication_date:${sinceIso(7)}`];
  if (query.kind === "researcher" && query.openalexAuthorId) {
    const id = query.openalexAuthorId.replace(/^https:\/\/openalex\.org\//i, "");
    filters.push(`authorships.author.id:${id}`);
  } else {
    url.searchParams.set("search", query.query);
  }
  url.searchParams.set("filter", filters.join(","));
  return url.toString();
}

function rawPaper(work: OpenAlexWork): RawPaper | null {
  if (!work.title?.trim()) return null;
  return {
    title: work.title,
    abstract: abstractFromIndex(work.abstract_inverted_index),
    doi: work.doi || undefined,
    openalexId: work.id || undefined,
    authors: (work.authorships ?? []).flatMap(authorship => {
      const author = authorship.author;
      if (!author?.display_name?.trim()) return [];
      return [{ name: author.display_name, openalexId: author.id || undefined }];
    }),
    venue: work.primary_location?.source?.display_name || undefined,
    publicationDate: work.publication_date || undefined,
    url: work.primary_location?.landing_page_url || work.doi || work.id || undefined,
    source: "openalex"
  };
}

export interface LocalSearchResult {
  papers: PaperView[];
  successfulQueries: number;
  failedQueries: number;
}

export async function searchRecentOpenAlex(
  config: ResearchConfig,
  fetchImpl: typeof fetch = fetch
): Promise<LocalSearchResult> {
  const queries = buildQueries(config).filter(item => item.query.trim()).slice(0, 8);
  if (!queries.length) throw new Error("Add at least one research topic before searching.");

  const settled = await Promise.allSettled(queries.map(async query => {
    const response = await fetchImpl(buildUrl(query), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`OpenAlex request failed (${response.status})`);
    const payload = await response.json() as { results?: OpenAlexWork[] };
    return (payload.results ?? []).map(rawPaper).filter((item): item is RawPaper => Boolean(item));
  }));

  const raw = settled.flatMap(item => item.status === "fulfilled" ? item.value : []);
  const successfulQueries = settled.filter(item => item.status === "fulfilled").length;
  const failedQueries = settled.length - successfulQueries;
  if (!successfulQueries) throw new Error("OpenAlex is temporarily unavailable. Please try again later.");

  const canonical = dedupePapers(raw.map(normalizePaper));
  const papers = canonical.map(item => {
    const ranked = classifyPaper(item, config);
    return {
      paperId: item.id,
      title: item.title,
      abstract: item.abstract,
      authors: item.authors,
      venue: item.venue ?? null,
      publicationDate: item.publicationDate ?? null,
      url: item.url ?? null,
      grade: ranked.grade,
      score: ranked.score,
      reasons: ranked.reasons,
      feedbackState: null
    } satisfies PaperView;
  }).sort((a, b) => {
    const rank = { A: 0, B: 1, C: 2, D: 3 } as const;
    return rank[a.grade] - rank[b.grade] || b.score - a.score || String(b.publicationDate ?? "").localeCompare(String(a.publicationDate ?? ""));
  });

  return { papers, successfulQueries, failedQueries };
}
