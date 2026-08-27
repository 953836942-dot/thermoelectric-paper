import type { Env as WorkerEnv } from "../src/env";

declare module "cloudflare:workers" {
  interface ProvidedEnv extends WorkerEnv {
    TEST_MIGRATIONS: unknown[];
  }
}
