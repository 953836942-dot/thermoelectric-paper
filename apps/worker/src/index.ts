import { AuthError, authenticate } from "./auth";
import { ApiError, createProfile, getProfile, updateProfile } from "./api/profile";
import type { Env } from "./env";

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname !== "/v1/profile") return errorResponse(404, "Not found");

      if (request.method === "POST") return createProfile(request, env);

      const { profileId } = await authenticate(request, env);
      if (request.method === "GET") return getProfile(env, profileId);
      if (request.method === "PUT") return updateProfile(request, env, profileId);
      return errorResponse(405, "Method not allowed");
    } catch (error) {
      if (error instanceof AuthError) return errorResponse(error.status, error.message);
      if (error instanceof ApiError) return errorResponse(error.status, error.message);
      console.error(error);
      return errorResponse(500, "Internal server error");
    }
  }
};
