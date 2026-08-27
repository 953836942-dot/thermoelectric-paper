import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizeDoi(value = '') {
  return String(value)
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .toLowerCase();
}

export function candidateKey(paper = {}) {
  const canonical = String(paper.canonical_id || '').trim().toLowerCase();
  if (canonical) return `canonical:${canonical}`;
  const doi = normalizeDoi(paper.doi);
  if (doi) return `doi:${doi}`;
  const paperId = String(paper.paper_id || '').trim().toLowerCase();
  if (paperId) return `paper:${paperId}`;
  const url = String(paper.abstract_url || paper.url || '').trim().toLowerCase();
  if (url) return `url:${url}`;
  return `title:${String(paper.title || '').trim().toLowerCase()}`;
}

function paperUrl(paper = {}) {
  if (paper.abstract_url) return String(paper.abstract_url);
  if (paper.url) return String(paper.url);
  if (paper.arxiv_id) return `https://arxiv.org/abs/${paper.arxiv_id}`;
  const doi = normalizeDoi(paper.doi);
  if (doi) return `https://doi.org/${doi}`;
  return '';
}

function toRecord(paper, feedName) {
  const paperId = String(paper.paper_id || '').trim();
  const openalexId = paperId.toLowerCase().startsWith('openalex:') ? paperId.slice('openalex:'.length) : '';
  return {
    title: String(paper.title || '').trim(),
    abstract: String(paper.summary || paper.abstract || '').trim(),
    doi: normalizeDoi(paper.doi),
    url: paperUrl(paper),
    openalex_id: openalexId,
    external_id: paperId || String(paper.canonical_id || paper.arxiv_id || '').trim(),
    authors: Array.isArray(paper.authors) ? paper.authors : (paper.authors || ''),
    journal: String(paper.journal || paper.publicationTitle || '').trim(),
    publicationTitle: String(paper.publicationTitle || paper.journal || '').trim(),
    pubdate: String(paper.published_at || paper.publication_date || paper.pubdate || '').trim(),
    source_channel: String(feedName || '').trim(),
    source_platform: String(paper.source || 'paper-digest').trim()
  };
}

export function convertDigest(digest = {}) {
  const byKey = new Map();
  for (const feed of Array.isArray(digest.feeds) ? digest.feeds : []) {
    const feedName = String(feed?.name || '').trim();
    for (const paper of Array.isArray(feed?.papers) ? feed.papers : []) {
      if (!paper || !String(paper.title || '').trim()) continue;
      const key = candidateKey(paper);
      const next = toRecord(paper, feedName);
      const previous = byKey.get(key);
      if (!previous) {
        byKey.set(key, next);
        continue;
      }
      if (next.abstract.length > previous.abstract.length) previous.abstract = next.abstract;
      for (const field of ['doi', 'url', 'openalex_id', 'external_id', 'journal', 'publicationTitle', 'pubdate']) {
        if (!previous[field] && next[field]) previous[field] = next[field];
      }
      if ((!previous.authors || previous.authors.length === 0) && next.authors) previous.authors = next.authors;
      const channels = new Set(String(previous.source_channel || '').split(' | ').filter(Boolean));
      if (feedName) channels.add(feedName);
      previous.source_channel = [...channels].join(' | ');
    }
  }
  return [...byKey.values()];
}

function isCli() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCli()) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/paperecho/convert-paper-digest.mjs <latest.json> <candidates.json>');
    process.exit(2);
  }
  const digest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const converted = convertDigest(digest);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(converted, null, 2)}\n`, 'utf8');
  console.log(`Converted candidates: ${converted.length}`);
}
