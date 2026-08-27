import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

type CreatedProfile = {
  profile_id: string;
  recovery_key: string;
  profile: {
    config: { topics: string[]; researchers: Array<{ name: string; openalexId: string }> };
    timezone: string;
    schedule: { frequency: string; weekday?: number; time: string };
    enabled: boolean;
  };
};

async function createProfile(body?: object): Promise<CreatedProfile> {
  const response = await exports.default.fetch("https://example.com/v1/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<CreatedProfile>;
}

function auth(key: string): HeadersInit {
  return { authorization: `Bearer ${key}`, "content-type": "application/json" };
}

describe("profile API", () => {
  it("creates a neutral profile and never stores the plaintext recovery key", async () => {
    const created = await createProfile();
    expect(created.profile_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.recovery_key.length).toBeGreaterThanOrEqual(43);
    expect(created.profile.config.topics).toEqual([]);
    expect(JSON.stringify(created)).not.toContain("token_hash");

    const row = await env.DB.prepare("SELECT token_hash FROM profiles WHERE profile_id = ?")
      .bind(created.profile_id)
      .first<{ token_hash: string }>();
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.token_hash).not.toBe(created.recovery_key);
  });

  it("can opt into the thermoelectric template", async () => {
    const created = await createProfile({ template: "thermoelectric" });
    expect(created.profile.config.topics).toContain("thermoelectric");
  });

  it("rejects profile reads without a bearer key", async () => {
    const response = await exports.default.fetch("https://example.com/v1/profile");
    expect(response.status).toBe(401);
  });

  it("authenticates a created profile with its recovery key", async () => {
    const created = await createProfile();
    const response = await exports.default.fetch("https://example.com/v1/profile", {
      headers: auth(created.recovery_key)
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { profile_id: string };
    expect(body.profile_id).toBe(created.profile_id);
  });

  it("rejects invalid timezone updates", async () => {
    const created = await createProfile();
    const response = await exports.default.fetch("https://example.com/v1/profile", {
      method: "PUT",
      headers: auth(created.recovery_key),
      body: JSON.stringify({ timezone: "Mars/Olympus" })
    });
    expect(response.status).toBe(400);
  });

  it("rejects researchers without both name and OpenAlex ID", async () => {
    const created = await createProfile();
    const response = await exports.default.fetch("https://example.com/v1/profile", {
      method: "PUT",
      headers: auth(created.recovery_key),
      body: JSON.stringify({ config: { researchers: [{ name: "Jane Doe" }] } })
    });
    expect(response.status).toBe(400);
  });
});
