import { describe, expect, it } from "vitest";
import { computeNextRun } from "../src/schedule";

describe("computeNextRun", () => {
  it("schedules Brisbane Monday 08:00 using the IANA timezone", () => {
    const now = new Date("2026-08-30T20:00:00Z"); // Monday 06:00 in Brisbane
    const next = computeNextRun(now, "Australia/Brisbane", { frequency: "weekly", weekday: 1, time: "08:00" });
    expect(next.toISOString()).toBe("2026-08-30T22:00:00.000Z");
  });

  it("respects Sydney DST after the October transition", () => {
    const now = new Date("2026-10-04T19:00:00Z"); // Monday 06:00 in Sydney after DST starts
    const next = computeNextRun(now, "Australia/Sydney", { frequency: "weekly", weekday: 1, time: "08:00" });
    expect(next.toISOString()).toBe("2026-10-04T21:00:00.000Z");
  });
});
