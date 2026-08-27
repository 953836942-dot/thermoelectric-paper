import type { ResearchConfig, SearchQuery } from "./types";

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildQueries(config: ResearchConfig): SearchQuery[] {
  const primaryTopic = clean(config.topics[0] ?? "");
  const queries: SearchQuery[] = [];

  for (const topic of config.topics.map(clean).filter(Boolean)) {
    queries.push({ kind: "topic", query: topic });
  }
  for (const material of config.priorityMaterials.map(clean).filter(Boolean)) {
    queries.push({ kind: "material", query: clean(`${material} ${primaryTopic}`) });
  }
  for (const mechanism of config.mechanisms.map(clean).filter(Boolean)) {
    queries.push({ kind: "mechanism", query: clean(`${mechanism} ${primaryTopic}`) });
  }
  for (const researcher of config.researchers) {
    queries.push({ kind: "researcher", query: clean(researcher.name), openalexAuthorId: researcher.openalexId });
  }
  for (const venue of config.priorityVenues.map(clean).filter(Boolean)) {
    queries.push({ kind: "venue", query: venue });
  }

  const seen = new Set<string>();
  return queries.filter(query => {
    const key = `${query.kind}|${query.query.toLowerCase()}|${query.openalexAuthorId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
