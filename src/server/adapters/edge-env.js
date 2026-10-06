/**
 * ArvanCloud environment access.
 *
 * Confirmed (https://docs.arvancloud.ir/fa/edge-computing/env-variables/):
 * - Variables are configured per edge application and must be valid JSON.
 * - Encrypted variables are readable only at runtime.
 * - Example code reads them from a global `env` binding (`env.test.status`).
 * - `EC_URL` is reserved.
 *
 * The published example names a variable `test-variable` and then reads
 * `env.test.status`. This project therefore uses plain identifiers and reads
 * `env.GAME_SIGNING_KEY` and `env.GAME_RNG_KEY`. String secrets must be entered
 * as JSON strings, including the quotes, for example "base64url-key".
 *
 * Not confirmed: whether `env` is always a lexical global, always copied onto
 * globalThis, or sometimes passed another way. Both the lexical name and
 * globalThis are checked. There is no built-in fallback key.
 */

/** @param {string} name */
export function readEdgeEnv(name) {
  const lexical = readLexicalEnv(name);
  if (lexical !== undefined) return lexical;
  const globalEnv = globalThis.env;
  if (globalEnv && typeof globalEnv === "object" && Object.hasOwn(globalEnv, name)) {
    return globalEnv[name];
  }
  return undefined;
}

/**
 * `env` is intentionally a free variable so a runtime lexical binding can resolve it.
 * @param {string} name
 */
function readLexicalEnv(name) {
  if (typeof env !== "object" || env === null) return undefined;
  if (!Object.hasOwn(env, name)) return undefined;
  return env[name];
}

/** @param {unknown} value */
export function edgeConfigValue(value) {
  if (typeof value === "string") return value;
  return undefined;
}
