import type { RawPaper, SearchQuery } from "@literature-monitor/core";
import type { SourceContext } from "./types";
import { fetchChecked } from "./types";

interface OpenAlexAuthor {
  id?: string;
  display_name?: string;
}

interface OpenAlexWork {
  id?: string;
  title?: string;
  doi?: string;
  publication_date?: string;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: OpenAlexAuthor }>;
  primary_location?: {
    landing_page_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
}

function abstractFromInvertedIndex(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  let max = -1;
  for (const positions of Object.values(index)) {
    for (const position of positions) max = Math.max(max, position);
  }
  if (max < 0) return "";
  const words = Array<string>(max + 1).fill("");
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return words.filter(Boolean).join(" ");
}

export function buildOpenAlexWorksUrl(query: SearchQuery, ctx: SourceContext): string {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("per-page", "25");
  url.searchParams.set("sort", "publication_date:desc");
  if (ctx.contact?.includes("@")) url.searchParams.set("mailto", ctx.contact.replace(/^.*mailto:/, "").split(/[ )]/)[0]);

  const filters: string[] = [];
  if (ctx.lookbackSince) filters.push(`from_publication_date:${ctx.lookbackSince}`);
  if (query.kind === "researcher" && query.openalexAuthorId) {
    const id = query.openalexAuthorId.replace(/^https:\/\/openalex\.org\//i, "");
    filters.push(`authorships.author.id:${id}`);
  } else {
    url.searchParams.set("search", query.query);
  }
  if (filters.length) url.searchParams.set("filter", filters.join(","));
  return url.toString();
}

export async function searchOpenAlex(query: SearchQuery, ctx: SourceContext): Promise<RawPaper[]> {
  const response = await fetchChecked(buildOpenAlexWorksUrl(query, ctx), ctx, {
    headers: { Accept: "application/json" }
  });
  const payload = await response.json() as { results?: OpenAlexWork[] };
  return (payload.results ?? []).flatMap(work => {
    if (!work.title?.trim()) return [];
    return [{
      title: work.title,
      abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
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
    } satisfies RawPaper];
  });
}
