import type { RawPaper, SearchQuery } from "@literature-monitor/core";
import type { SourceContext } from "./types";
import { fetchChecked } from "./types";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function text(block: string, tag: string): string | undefined {
  const escaped = tag.replace(":", "\\:");
  const match = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i").exec(block);
  return match ? decodeXml(match[1]).replace(/\s+/g, " ").trim() : undefined;
}

function allText(block: string, tag: string): string[] {
  const results: string[] = [];
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const match of block.matchAll(pattern)) {
    const value = decodeXml(match[1]).replace(/\s+/g, " ").trim();
    if (value) results.push(value);
  }
  return results;
}

function alternateLink(block: string): string | undefined {
  const tags = block.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!/rel=["']alternate["']/i.test(tag)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (href) return decodeXml(href);
  }
  return undefined;
}

export function buildArxivUrl(query: SearchQuery): string {
  const url = new URL("https://export.arxiv.org/api/query");
  const field = query.kind === "researcher" ? "au" : "all";
  url.searchParams.set("search_query", `${field}:\"${query.query.replace(/\"/g, "")}\"`);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", "25");
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");
  return url.toString();
}

export async function searchArxiv(query: SearchQuery, ctx: SourceContext): Promise<RawPaper[]> {
  const response = await fetchChecked(buildArxivUrl(query), ctx, {
    headers: { Accept: "application/atom+xml, application/xml;q=0.9" }
  });
  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(match => match[1]);
  return entries.flatMap(entry => {
    const title = text(entry, "title");
    const id = text(entry, "id");
    if (!title || !id) return [];
    const published = text(entry, "published");
    if (ctx.lookbackSince && published && published.slice(0, 10) < ctx.lookbackSince) return [];
    const arxivId = id.split("/abs/").pop();
    return [{
      title,
      abstract: text(entry, "summary"),
      doi: text(entry, "arxiv:doi"),
      arxivId,
      authors: [...entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi)]
        .map(match => text(match[1], "name"))
        .filter((name): name is string => Boolean(name)),
      publicationDate: published?.slice(0, 10),
      url: alternateLink(entry) ?? id.replace("http://", "https://").replace(/v\d+$/, ""),
      source: "arxiv"
    } satisfies RawPaper];
  });
}
