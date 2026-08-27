import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

beforeEach(async () => {
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS as Parameters<typeof applyD1Migrations>[1]
  );
  await env.DB.batch([
    env.DB.prepare("DELETE FROM profile_papers"),
    env.DB.prepare("DELETE FROM papers"),
    env.DB.prepare("DELETE FROM runs"),
    env.DB.prepare("DELETE FROM profiles")
  ]);
});
