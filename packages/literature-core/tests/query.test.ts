import { describe, expect, it } from "vitest";
import { buildQueries } from "../src/query";
import type { ResearchConfig } from "../src/types";

const config: ResearchConfig = {
  topics: ["thermoelectric", "materials informatics"],
  priorityMaterials: ["GeTe", "SnSe"],
  mechanisms: ["band convergence"],
  excludedTopics: [],
  priorityVenues: [],
  researchers: [{ name: "Jane Doe", openalexId: "A123" }]
};

describe("buildQueries", () => {
  it("builds bounded query objects instead of one giant query", () => {
    const queries = buildQueries(config);
    expect(queries).toHaveLength(6);
    expect(queries.filter(q => q.kind === "topic").map(q => q.query)).toEqual(config.topics);
    expect(queries.find(q => q.kind === "material" && q.query.includes("GeTe"))).toBeTruthy();
    expect(queries.find(q => q.kind === "mechanism" && q.query.includes("band convergence"))).toBeTruthy();
    expect(queries.find(q => q.kind === "researcher")).toMatchObject({ openalexAuthorId: "A123" });
  });
});
