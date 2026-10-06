import { API_PATHS } from "../../shared/protocol.js";
import { GameError } from "../errors.js";
import { createHmacRng } from "../game/rng.js";
import { createInitialState, transition } from "../game/engine.js";
import { toPublicView } from "../game/public-view.js";
import { bytesToBase64Url } from "../security/encoding.js";
import { coerceKey, randomBytes } from "../security/crypto.js";
import { signState, stampLifetime, verifyState } from "../security/tokens.js";
import { readJsonBody } from "./body.js";
import { parseActionBody, parseResumeBody, parseStartBody } from "./validation.js";

/**
 * Platform-independent game API.
 * @param {Request} request
 * @param {{ signingKey?: string | Uint8Array, rngKey?: string | Uint8Array, allowedOrigin?: string, now?: () => number }} config
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, config = {}) {
  const allowedOrigin = typeof config.allowedOrigin === "string" ? config.allowedOrigin : "";
  try {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return corsPreflight(request, allowedOrigin);
    }
    if (request.method !== "POST") {
      return jsonResponse(request, allowedOrigin, 405, {
        error: { code: "INVALID_REQUEST", message: "Method not allowed" },
      }, { allow: "POST" });
    }

    const secrets = {
      signingKey: coerceKey(config.signingKey, "GAME_SIGNING_KEY"),
      rngKey: coerceKey(config.rngKey, "GAME_RNG_KEY"),
      now: typeof config.now === "function" ? config.now : () => Date.now(),
    };

    if (url.pathname === API_PATHS.start) return await startGame(request, allowedOrigin, secrets);
    if (url.pathname === API_PATHS.action) return await act(request, allowedOrigin, secrets);
    if (url.pathname === API_PATHS.resume) return await resume(request, allowedOrigin, secrets);
    return jsonResponse(request, allowedOrigin, 404, {
      error: { code: "INVALID_REQUEST", message: "Not found" },
    });
  } catch (error) {
    return errorResponse(request, allowedOrigin, error);
  }
}

/**
 * @param {Request} request
 * @param {string} allowedOrigin
 * @param {{ signingKey: Uint8Array, rngKey: Uint8Array, now: () => number }} secrets
 */
async function startGame(request, allowedOrigin, secrets) {
  const body = await readJsonBody(request);
  parseStartBody(body);
  const gameId = bytesToBase64Url(randomBytes(16));
  const state = createInitialState(gameId);
  stampLifetime(state, secrets.now());
  const token = await signState(state, secrets.signingKey);
  return jsonResponse(request, allowedOrigin, 200, {
    token,
    view: toPublicView(state),
    events: [{ type: "game_started" }],
  });
}

/**
 * @param {Request} request
 * @param {string} allowedOrigin
 * @param {{ signingKey: Uint8Array, rngKey: Uint8Array, now: () => number }} secrets
 */
async function act(request, allowedOrigin, secrets) {
  const body = await readJsonBody(request);
  const parsed = parseActionBody(body);
  const state = await verifyState(parsed.token, secrets.signingKey, secrets.now());
  const rng = createHmacRng(secrets.rngKey, state.gameId, state.rngCounter);
  const result = await transition(state, parsed.action, rng);
  stampLifetime(result.state, secrets.now());
  const token = await signState(result.state, secrets.signingKey);
  return jsonResponse(request, allowedOrigin, 200, {
    token,
    view: toPublicView(result.state),
    events: result.events,
  });
}

/**
 * @param {Request} request
 * @param {string} allowedOrigin
 * @param {{ signingKey: Uint8Array, rngKey: Uint8Array, now: () => number }} secrets
 */
async function resume(request, allowedOrigin, secrets) {
  const body = await readJsonBody(request);
  const parsed = parseResumeBody(body);
  const state = await verifyState(parsed.token, secrets.signingKey, secrets.now());
  return jsonResponse(request, allowedOrigin, 200, {
    token: parsed.token,
    view: toPublicView(state),
    events: [],
  });
}

/**
 * @param {Request} request
 * @param {string} allowedOrigin
 */
function corsPreflight(request, allowedOrigin) {
  const headers = baseHeaders(request, allowedOrigin);
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(null, { status: 204, headers });
}

/**
 * @param {Request} request
 * @param {string} allowedOrigin
 * @param {unknown} error
 */
function errorResponse(request, allowedOrigin, error) {
    if (error instanceof GameError) {
      return jsonResponse(request, allowedOrigin, error.status, {
        error: { code: error.code, message: error.message },
      });
    }
  console.error("game-api-error");
  return jsonResponse(request, allowedOrigin, 500, {
    error: { code: "INTERNAL_ERROR", message: "Unexpected error" },
  });
}

/**
 * @param {Request} request
 * @param {string} allowedOrigin
 * @param {number} status
 * @param {object} body
 * @param {{ allow?: string }} [extra]
 */
function jsonResponse(request, allowedOrigin, status, body, extra = {}) {
  const headers = baseHeaders(request, allowedOrigin);
  if (extra.allow) headers.set("allow", extra.allow);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * @param {Request} request
 * @param {string} allowedOrigin
 */
function baseHeaders(request, allowedOrigin) {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  const origin = request.headers.get("origin");
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "origin");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
  }
  return headers;
}
