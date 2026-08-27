import { authenticate } from "./auth";
import { createProfile, getProfile, updateProfile } from "./api/profile";
import { searchResearchers } from "./api/researchers";
import type { Env } from "./env";

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function httpError(error: unknown): { status: number; message: string } | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; message?: unknown };
  if (typeof candidate.status !== "number" || candidate.status < 400 || candidate.status > 599) return null;
  return {
    status: candidate.status,
    message: typeof candidate.message === "string" ? candidate.message : "Request failed"
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/v1/profile") {
        if (request.method === "POST") return createProfile(request, env);
        const { profileId } = await authenticate(request, env);
        if (request.method === "GET") return getProfile(env, profileId);
        if (request.method === "PUT") return updateProfile(request, env, profileId);
        return errorResponse(405, "Method not allowed");
      }

      if (url.pathname === "/v1/researchers/search") {
        if (request.method !== "GET") return errorResponse(405, "Method not allowed");
        await authenticate(request, env);
        return searchResearchers(request, globalThis.fetch.bind(globalThis));
      }

      return errorResponse(404, "Not found");
    } catch (error) {
      const mapped = httpError(error);
      if (mapped) return errorResponse(mapped.status, mapped.message);
      console.error(error);
      return errorResponse(500, "Internal server error");
    }
  }
};
