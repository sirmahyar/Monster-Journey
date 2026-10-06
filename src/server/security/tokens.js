import { TOKEN_TTL_MS } from "../../shared/protocol.js";
import { LIMITS } from "../game/balance.js";
import { invalidToken, tokenExpired } from "../errors.js";
import { bytesToBase64Url, base64ToBytes, canonicalJson, utf8Bytes, utf8String } from "./encoding.js";
import { hmacSha256, hmacVerify } from "./crypto.js";
import { assertValidState } from "./state.js";

/**
 * Signs the exact canonical payload bytes.
 * @param {object} state
 * @param {Uint8Array} keyBytes
 */
export async function signState(state, keyBytes) {
  assertValidState(state);
  const payload = utf8Bytes(canonicalJson(state));
  const signature = await hmacSha256(keyBytes, payload);
  return `${bytesToBase64Url(payload)}.${bytesToBase64Url(signature)}`;
}

/**
 * Verifies the original payload bytes, then parses them.
 * The JSON is not reserialized before the signature check.
 * @param {string} token
 * @param {Uint8Array} keyBytes
 * @param {number} now
 */
export async function verifyState(token, keyBytes, now) {
  if (typeof token !== "string" || token.length === 0 || token.length > LIMITS.maxTokenCharacters) {
    throw invalidToken();
  }
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) throw invalidToken();
  let payload;
  let signature;
  try {
    payload = base64ToBytes(token.slice(0, dot));
    signature = base64ToBytes(token.slice(dot + 1));
  } catch {
    throw invalidToken();
  }
  let authentic = false;
  try {
    authentic = await hmacVerify(keyBytes, payload, signature);
  } catch {
    authentic = false;
  }
  if (authentic !== true) throw invalidToken();

  let parsed;
  try {
    parsed = JSON.parse(utf8String(payload));
  } catch {
    throw invalidToken();
  }
  assertValidState(parsed);
  if (!Number.isSafeInteger(now) || now >= parsed.expiresAt) throw tokenExpired();
  return parsed;
}

/** @param {number} now */
export function stampLifetime(state, now) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw invalidToken("Clock value is not usable");
  }
  state.issuedAt = now;
  state.expiresAt = now + TOKEN_TTL_MS;
  return state;
}

/**
 * Signs caller-supplied bytes. Tests use this for deliberately invalid payloads.
 * @param {Uint8Array} payload
 * @param {Uint8Array} keyBytes
 */
export async function signRawPayload(payload, keyBytes) {
  const signature = await hmacSha256(keyBytes, payload);
  return `${bytesToBase64Url(payload)}.${bytesToBase64Url(signature)}`;
}
