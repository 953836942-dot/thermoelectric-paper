import type { Env } from "./env";

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response(JSON.stringify({ error: "not implemented" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }
};
