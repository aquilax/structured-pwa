import { D1Storage } from "./storage";
import { Env, Payload } from "./types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-NodeID",
};

const jsonResponse = (data: any, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 2. Health check endpoint
    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({
        status: "ok",
        service: "appendix-cloudflare",
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Match /sync endpoint
    if (url.pathname !== "/sync") {
      return jsonResponse({ error: "not found" }, 404);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "method not allowed" }, 405);
    }

    // 4. Mandatory Bearer Token Authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized: missing bearer token" }, 401);
    }

    const token = authHeader.substring(7).trim();
    if (!env.API_TOKEN) {
      return jsonResponse({ error: "server configuration error: API_TOKEN required" }, 500);
    }

    if (token !== env.API_TOKEN) {
      return jsonResponse({ error: "unauthorized: invalid token" }, 401);
    }

    // 5. Process Replication Sync Payload
    try {
      const payload: Payload = await request.json();
      if (!payload || typeof payload !== "object") {
        return jsonResponse({ error: "bad request: payload must be a JSON object" }, 400);
      }

      const storage = new D1Storage(env.DB);
      const responsePayload = await storage.processPayload(payload);
      return jsonResponse(responsePayload, 200);
    } catch (err: any) {
      return jsonResponse({ error: "bad request: " + (err.message || "invalid JSON") }, 400);
    }
  },
};
