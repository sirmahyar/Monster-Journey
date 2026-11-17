import { GameError } from "../errors.js";
import { handleRequest as handleScores } from "./scores.js";
import { staticResponse } from "./static.js";

/**
 * The edge site: the built game for GET, and the scoreboard on /api/scores.
 * @param {Request} request
 * @param {{ assets?: Record<string, { type?: string, cache?: string, encoding?: string, body?: string }>, store?: { top: (limit?: number) => Promise<unknown[]>, insert: (entry: object) => Promise<object> }, allowedOrigin?: string }} config
 */
export async function handleSiteRequest(request, config = {}) {
  const allowedOrigin = typeof config.allowedOrigin === "string" ? config.allowedOrigin : "";
  const url = new URL(request.url);
  if (url.pathname === "/api/scores") {
    return handleScores(request, { store: config.store || disconnectedScores(), allowedOrigin });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(405, { error: { code: "INVALID_REQUEST", message: "Method not allowed" } }, { allow: "GET, HEAD" });
  }
  const page = staticResponse(url.pathname, request.method, config.assets);
  if (page) return page;
  // The game is one page. A missing file with an extension is a real 404; a route is the page.
  if (!url.pathname.split("/").pop().includes(".")) {
    const home = staticResponse("/", request.method, config.assets);
    if (home) return home;
  }
  return json(404, { error: { code: "INVALID_REQUEST", message: "Not found" } });
}

function disconnectedScores() {
  const fail = () => {
    throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard is not connected on this edge.", 503);
  };
  return { top: async () => fail(), insert: async () => fail() };
}

function json(status, body, extra = {}) {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (extra.allow) headers.set("allow", extra.allow);
  return new Response(JSON.stringify(body), { status, headers });
}
