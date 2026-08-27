import type { SourceContext } from "../sources/types";
import { fetchChecked } from "../sources/types";

interface OpenAlexAuthorCandidate {
  id?: string;
  display_name?: string;
  works_count?: number;
  last_known_institutions?: Array<{ display_name?: string }>;
}

export async function searchResearchers(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 120) {
    return Response.json({ error: "Query must be between 2 and 120 characters" }, { status: 400 });
  }

  const upstream = new URL("https://api.openalex.org/authors");
  upstream.searchParams.set("search", query);
  upstream.searchParams.set("per-page", "8");

  const ctx: SourceContext = {
    fetchImpl,
    timeoutMs: 8000,
    contact: "literature-monitor/0.1 (researcher resolution)"
  };
  const response = await fetchChecked(upstream.toString(), ctx, { headers: { Accept: "application/json" } });
  const payload = await response.json() as { results?: OpenAlexAuthorCandidate[] };
  const results = (payload.results ?? []).flatMap(author => {
    if (!author.id || !author.display_name?.trim()) return [];
    return [{
      id: author.id,
      displayName: author.display_name,
      institutions: [...new Set((author.last_known_institutions ?? []).map(item => item.display_name?.trim()).filter((name): name is string => Boolean(name)))],
      worksCount: author.works_count ?? 0
    }];
  });
  return Response.json({ results });
}
