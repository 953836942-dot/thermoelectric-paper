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

function stripMarkup(value: string): string {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function text(block: string, tag: string): string | undefined {
  const escaped = tag.replace(":", "\\:");
  const match = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i").exec(block);
  return match ? stripMarkup(match[1]) : undefined;
}

function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function queryMatches(paper: RawPaper, query: SearchQuery): boolean {
  if (query.kind === "researcher") {
    const names = (paper.authors ?? []).map(author => typeof author === "string" ? author : author.name).join(" ").toLowerCase();
    return names.includes(query.query.toLowerCase());
  }
  const haystack = `${paper.title} ${paper.abstract ?? ""} ${paper.venue ?? ""}`.toLowerCase();
  return haystack.includes(query.query.toLowerCase());
}

function parseRss(xml: string): RawPaper[] {
  const channel = /<channel\b[^>]*>([\s\S]*?)<\/channel>/i.exec(xml)?.[1] ?? xml;
  const venue = text(channel.replace(/<item\b[\s\S]*$/i, ""), "title");
  return [...channel.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(match => {
    const item = match[1];
    const title = text(item, "title");
    if (!title) return [];
    const identifier = text(item, "dc:identifier") ?? text(item, "doi");
    const doi = identifier?.replace(/^doi:\s*/i, "");
    const creator = text(item, "dc:creator") ?? text(item, "author");
    return [{
      title,
      abstract: text(item, "description"),
      doi,
      authors: creator ? [creator] : [],
      venue,
      publicationDate: isoDate(text(item, "pubDate") ?? text(item, "dc:date")),
      url: text(item, "link") ?? text(item, "guid"),
      source: "rss"
    } satisfies RawPaper];
  });
}

function atomLink(entry: string): string | undefined {
  const tags = entry.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (/rel=["']alternate["']/i.test(tag) || !/rel=/i.test(tag)) {
      const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
      if (href) return decodeXml(href);
    }
  }
  return undefined;
}

function parseAtom(xml: string): RawPaper[] {
  const feedPrefix = xml.split(/<entry\b/i)[0] ?? xml;
  const venue = text(feedPrefix, "title");
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].flatMap(match => {
    const entry = match[1];
    const title = text(entry, "title");
    if (!title) return [];
    const authors = [...entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi)]
      .map(author => text(author[1], "name"))
      .filter((name): name is string => Boolean(name));
    return [{
      title,
      abstract: text(entry, "summary") ?? text(entry, "content"),
      authors,
      venue,
      publicationDate: isoDate(text(entry, "published") ?? text(entry, "updated")),
      url: atomLink(entry) ?? text(entry, "id"),
      source: "rss"
    } satisfies RawPaper];
  });
}

export async function searchRss(query: SearchQuery, ctx: SourceContext): Promise<RawPaper[]> {
  const feeds = ctx.rssFeeds ?? [];
  const papers: RawPaper[] = [];
  for (const feed of feeds) {
    const response = await fetchChecked(feed, ctx, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9" } });
    const xml = await response.text();
    const parsed = /<rss\b/i.test(xml) ? parseRss(xml) : parseAtom(xml);
    for (const paper of parsed) {
      if (ctx.lookbackSince && paper.publicationDate && paper.publicationDate < ctx.lookbackSince) continue;
      if (queryMatches(paper, query)) papers.push(paper);
    }
  }
  return papers;
}
