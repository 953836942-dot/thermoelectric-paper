import { beforeEach, describe, expect, it } from "vitest";
import { getSession, saveSession } from "../src/storage/session";

describe("extension session storage", () => {
  const data: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(data)) delete data[key];
    (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
      storage: {
        local: {
          async get(key: string) {
            return { [key]: data[key] };
          },
          async set(value: Record<string, unknown>) {
            Object.assign(data, value);
          }
        }
      }
    };
  });

  it("stores profile id and recovery key locally and returns them unchanged", async () => {
    const session = { profileId: "p1", recoveryKey: "secret", apiBaseUrl: "https://api.example" };
    await saveSession(session);
    await expect(getSession()).resolves.toEqual(session);
  });

  it("returns null when no session has been stored", async () => {
    await expect(getSession()).resolves.toBeNull();
  });
});
