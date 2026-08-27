import type { Env as WorkerEnv } from "../src/env";

declare module "cloudflare:workers" {
  interface ProvidedEnv extends WorkerEnv {
    TEST_MIGRATIONS: unknown[];
  }
}

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: unknown[];
    }
  }
}

declare module "*.xml?raw" {
  const content: string;
  export default content;
}

export {};
