import type { RawPaper, SearchQuery } from "@literature-monitor/core";

export type SourceName = "openalex" | "arxiv" | "rss";
export type SourceStatus = "success" | "failed" | "skipped";

export interface SourceContext {
  fetchImpl: typeof fetch;
  lookbackSince?: string;
  contact?: string;
  timeoutMs?: number;
  rssFeeds?: string[];
}

export interface SearchAllOptions {
  sources?: SourceName[];
  rssFeeds?: string[];
  contact?: string;
  timeoutMs?: number;
}

export interface LiteratureSource {
  readonly name: SourceName;
  search(query: SearchQuery, ctx: SourceContext): Promise<RawPaper[]>;
}

export async function fetchChecked(url: string, ctx: SourceContext, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs ?? 8000);
  const headers = new Headers(init.headers);
  headers.set("Accept", headers.get("Accept") ?? "*/*");
  if (ctx.contact) headers.set("User-Agent", ctx.contact);
  try {
    const response = await ctx.fetchImpl(url, { ...init, headers, signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
