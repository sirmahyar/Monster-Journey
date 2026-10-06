import { LIMITS } from "../game/balance.js";
import { invalidRequest } from "../errors.js";

const ROUTES = new Set(["forest", "cave", "spring"]);
const MOVES = new Set(["attack", "defend", "special", "potion"]);

/** @param {unknown} data */
export function parseStartBody(data) {
  assertPlainObject(data);
  if (Object.keys(data).length !== 0) throw invalidRequest("Start accepts an empty object");
}

/** @param {unknown} data */
export function parseResumeBody(data) {
  assertPlainObject(data);
  assertExactKeys(data, ["token"]);
  return { token: parseToken(data.token) };
}

/** @param {unknown} data */
export function parseActionBody(data) {
  assertPlainObject(data);
  assertExactKeys(data, ["token", "action"]);
  const token = parseToken(data.token);
  const action = parseAction(data.action);
  return { token, action };
}

/** @param {unknown} action */
function parseAction(action) {
  assertPlainObject(action);
  if (action.type === "choose_route") {
    assertExactKeys(action, ["type", "route"]);
    if (!ROUTES.has(action.route)) throw invalidRequest("Unknown route");
    return { type: "choose_route", route: action.route };
  }
  if (action.type === "combat_move") {
    assertExactKeys(action, ["type", "move"]);
    if (!MOVES.has(action.move)) throw invalidRequest("Unknown combat move");
    return { type: "combat_move", move: action.move };
  }
  if (action.type === "choose_reward") {
    assertExactKeys(action, ["type", "offerId"]);
    if (typeof action.offerId !== "string" || !/^[a-z0-9_-]{1,64}$/.test(action.offerId)) {
      throw invalidRequest("Reward id is invalid");
    }
    return { type: "choose_reward", offerId: action.offerId };
  }
  throw invalidRequest("Unsupported action");
}

/** @param {unknown} token */
function parseToken(token) {
  if (typeof token !== "string" || token.length === 0 || token.length > LIMITS.maxTokenCharacters) {
    throw invalidRequest("Token is missing");
  }
  return token;
}

/** @param {unknown} value */
function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidRequest("Request body must be a JSON object");
  }
}

/**
 * @param {object} value
 * @param {string[]} keys
 */
function assertExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw invalidRequest("Unexpected request fields");
  }
}
