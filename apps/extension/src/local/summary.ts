import type { PaperView, WeeklySummary } from "../api/types";

function cleanTerm(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function themeTerms(paper: PaperView): string[] {
  return paper.reasons.flatMap(reason => {
    const [label, raw = ""] = reason.split(/:\s*/, 2);
    if (!/^(Topic|Priority material|Mechanism|Evidence)$/i.test(label)) return [];
    return raw.split(",").map(cleanTerm).filter(term => term && term.toLowerCase() !== "thermoelectric");
  });
}

function topThemes(papers: PaperView[], limit = 5): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const paper of papers.filter(item => item.grade === "A" || item.grade === "B")) {
    for (const term of themeTerms(paper)) {
      const key = term.toLowerCase();
      const current = counts.get(key);
      counts.set(key, { label: current?.label ?? term, count: (current?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(item => item.label);
}

function sentenceSummary(paper: PaperView): string {
  const text = paper.abstract.trim().replace(/\s+/g, " ");
  if (text) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(item => item.trim()).filter(Boolean) ?? [text];
    const joined = sentences.slice(0, 2).join(" ");
    return joined.length > 420 ? `${joined.slice(0, 417).trimEnd()}…` : joined;
  }
  const reason = paper.reasons.slice(0, 2).join("; ");
  return reason ? `Ranked ${paper.grade} because ${reason}.` : `Ranked ${paper.grade} in this week's literature scan.`;
}

export function generateWeeklySummary(papers: PaperView[]): WeeklySummary {
  const visible = papers.filter(item => item.feedbackState !== "not_relevant");
  const priority = visible.filter(item => item.grade === "A" || item.grade === "B");
  const themes = topThemes(visible);
  const aCount = visible.filter(item => item.grade === "A").length;
  const bCount = visible.filter(item => item.grade === "B").length;

  const themeSentence = themes.length
    ? `The strongest themes are ${themes.slice(0, 4).join(", ")}.`
    : "No single research theme dominated this scan.";
  const leaders = priority.slice(0, 2).map(item => item.title);
  const leaderSentence = leaders.length
    ? `The highest-priority papers include ${leaders.map(title => `“${title}”`).join(" and ")}.`
    : "No A- or B-grade papers were identified this week.";

  const paperSummaries: Record<string, string> = {};
  for (const paper of priority) paperSummaries[paper.paperId] = sentenceSummary(paper);

  return {
    brief: `${visible.length} papers matched this week's scan, with ${aCount} must-read and ${bCount} strong matches. ${themeSentence} ${leaderSentence}`,
    keyThemes: themes,
    paperSummaries
  };
}
