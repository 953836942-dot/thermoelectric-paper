import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/client";

describe("typed API client", () => {
  it("adds the recovery key bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ profile_id: "p1" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const api = createApiClient("https://api.example", "rk_test", fetchMock);
    await api.getProfile();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example/v1/profile");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer rk_test");
  });

  it("does not send bearer auth when creating a new anonymous profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ profile_id: "p1", recovery_key: "rk" }), {
      status: 201,
      headers: { "content-type": "application/json" }
    }));
    const api = createApiClient("https://api.example", null, fetchMock);
    await api.createProfile(null);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });
});
