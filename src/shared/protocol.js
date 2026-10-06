/** Public protocol constants. No secrets and no combat formulas. */

export const SCHEMA_VERSION = 1;
export const RULES_VERSION = 1;

export const PHASES = Object.freeze(["route", "combat", "reward", "game_over"]);
export const ROUTES = Object.freeze(["forest", "cave", "spring"]);
export const MOVES = Object.freeze(["attack", "defend", "special", "potion"]);

export const API_PATHS = Object.freeze({
  start: "/api/game/start",
  action: "/api/game/action",
  resume: "/api/game/resume",
});

export const MAX_BODY_BYTES = 32 * 1024;

/** Renewed on each accepted gameplay action, including start. Not renewed by resume. */
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const ERROR_CODES = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
  INVALID_ACTION: "INVALID_ACTION",
  NUMERIC_LIMIT: "NUMERIC_LIMIT",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});
