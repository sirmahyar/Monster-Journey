import { GameError } from "../errors.js";
import { readJsonBody } from "./body.js";
import { parseScoreBody } from "../scores/validate.js";

/**
 * Scoreboard HTTP API. Gameplay is not resolved here.
 * @param {Request} request
 * @param {{ store: import("../scores/store.js").ScoreStore, allowedOrigin?: string }} config
 */
export async function handleRequest(request, config) {
  const allowedOrigin = typeof config.allowedOrigin === "string" ? config.allowedOrigin : "";
  try {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname === "/api/scores") {
      return empty(request, allowedOrigin, 204, { allow: "GET, POST, OPTIONS" });
    }
    if (url.pathname !== "/api/scores") {
      return json(request, allowedOrigin, 404, {
        error: { code: "INVALID_REQUEST", message: "Not found" },
      });
    }
    if (request.method === "GET") {
      const scores = await config.store.top(50);
      return json(request, allowedOrigin, 200, { scores });
    }
    if (request.method !== "POST") {
      return json(request, allowedOrigin, 405, {
        error: { code: "INVALID_REQUEST", message: "Method not allowed" },
      }, { allow: "GET, POST" });
    }
    const body = await readJsonBody(request);
    const entry = parseScoreBody(body);
    const saved = await config.store.insert(entry);
    return json(request, allowedOrigin, 201, { score: saved });
  } catch (error) {
    if (error instanceof GameError) {
      return json(request, allowedOrigin, error.status, {
        error: { code: error.code, message: error.message },
      });
    }
    console.error("score-api-error");
    return json(request, allowedOrigin, 500, {
      error: { code: "INTERNAL_ERROR", message: "Unexpected error" },
    });
  }
}

function json(request, allowedOrigin, status, body, extra = {}) {
  const headers = baseHeaders(request, allowedOrigin);
  if (extra.allow) headers.set("allow", extra.allow);
  return new Response(JSON.stringify(body), { status, headers });
}

function empty(request, allowedOrigin, status, extra = {}) {
  const headers = baseHeaders(request, allowedOrigin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  if (extra.allow) headers.set("allow", extra.allow);
  return new Response(null, { status, headers });
}

function baseHeaders(request, allowedOrigin) {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  const origin = request.headers.get("origin");
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "origin");
  }
  return headers;
}
