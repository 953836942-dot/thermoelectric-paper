import type { AuthorRef, CanonicalPaper } from "./types";

function idRank(id: string): number {
  if (id.startsWith("doi:")) return 4;
  if (id.startsWith("openalex:")) return 3;
  if (id.startsWith("arxiv:")) return 2;
  return 1;
}

function mergeAuthors(a: AuthorRef[], b: AuthorRef[]): AuthorRef[] {
  const map = new Map<string, AuthorRef>();
  for (const author of [...a, ...b]) {
    const key = author.openalexId || author.name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, author);
  }
  return [...map.values()];
}

function mergePaper(a: CanonicalPaper, b: CanonicalPaper): CanonicalPaper {
  const preferred = idRank(b.id) > idRank(a.id) ? b : a;
  const other = preferred === a ? b : a;
  return {
    ...preferred,
    abstract: preferred.abstract.length >= other.abstract.length ? preferred.abstract : other.abstract,
    doi: preferred.doi ?? other.doi,
    openalexId: preferred.openalexId ?? other.openalexId,
    arxivId: preferred.arxivId ?? other.arxivId,
    authors: mergeAuthors(preferred.authors, other.authors),
    venue: preferred.venue ?? other.venue,
    publicationDate: preferred.publicationDate ?? other.publicationDate,
    url: preferred.url ?? other.url,
    sources: [...new Set([...preferred.sources, ...other.sources])],
  };
}

export function dedupePapers(papers: CanonicalPaper[]): CanonicalPaper[] {
  const merged: CanonicalPaper[] = [];
  for (const paper of papers) {
    const index = merged.findIndex(existing =>
      existing.id === paper.id ||
      (Boolean(existing.doi && paper.doi) && existing.doi === paper.doi) ||
      existing.normalizedTitle === paper.normalizedTitle
    );
    if (index === -1) merged.push(paper);
    else merged[index] = mergePaper(merged[index], paper);
  }
  return merged;
}
