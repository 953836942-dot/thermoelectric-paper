import { beforeEach, describe, expect, it } from "vitest";
import { createLocalLiteratureClient } from "../src/local/client";

const memory: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(memory)) delete memory[key];
  (globalThis as any).chrome = {
    storage: {
      local: {
        async get(key: string) { return { [key]: memory[key] }; },
        async set(value: Record<string, unknown>) { Object.assign(memory, value); }
      }
    }
  };
});

describe("B-lite local client", () => {
  it("seeds a visible thermoelectric preview and persists research settings locally", async () => {
    const api = createLocalLiteratureClient();
    const report = await api.getLatestReport();
    expect(report.topPapers.length).toBeGreaterThan(0);
    const profile = await api.getProfile();
    expect(profile.config.topics.join(" ")).toMatch(/thermoelectric/i);

    await api.updateProfile({ config: { topics: ["solid state batteries"] } });
    const saved = await api.getProfile();
    expect(saved.config.topics).toEqual(["solid state batteries"]);
  });
});
