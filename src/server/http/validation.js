import { FIELD_HEIGHT, LEG_TICKS, LIMITS, PLAYER_RADIUS } from "../game/balance.js";
import { invalidRequest } from "../errors.js";

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
  if (action.type !== "finish_leg") throw invalidRequest("Unsupported action");
  assertExactKeys(action, ["type", "inputs"]);
  if (!Array.isArray(action.inputs) || action.inputs.length !== LEG_TICKS) {
    throw invalidRequest("Flight inputs do not match this stretch");
  }
  const inputs = action.inputs.map((input) => {
    assertPlainObject(input);
    assertExactKeys(input, ["y", "dash"]);
    if (!Number.isSafeInteger(input.y) || input.y < PLAYER_RADIUS || input.y > FIELD_HEIGHT - PLAYER_RADIUS) {
      throw invalidRequest("A lane position is invalid");
    }
    if (input.dash !== 0 && input.dash !== 1) throw invalidRequest("Dash is invalid");
    return { y: input.y, dash: input.dash };
  });
  return { type: "finish_leg", inputs };
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
