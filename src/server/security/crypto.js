import { configurationError } from "../errors.js";
import { base64ToBytes, hexToBytes } from "./encoding.js";

function subtle() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") {
    throw configurationError(
      "Web Crypto HMAC and secure random bytes are not available in this runtime",
    );
  }
  return cryptoApi.subtle;
}

/**
 * @param {string | undefined} text
 * @param {string} name
 * @returns {Uint8Array}
 */
export function decodeKeyMaterial(text, name) {
  if (typeof text !== "string" || text.trim() === "") {
    throw configurationError(`${name} is not configured`);
  }
  const trimmed = text.trim();
  let bytes;
  try {
    if (trimmed.startsWith("hex:")) bytes = hexToBytes(trimmed.slice(4));
    else bytes = base64ToBytes(trimmed);
  } catch {
    throw configurationError(`${name} is not valid base64url or hex`);
  }
  if (bytes.length < 32) {
    throw configurationError(`${name} must contain at least 32 bytes`);
  }
  return bytes;
}

/**
 * @param {Uint8Array | string | undefined} value
 * @param {string} name
 */
export function coerceKey(value, name) {
  if (value instanceof Uint8Array) {
    if (value.byteLength < 32) throw configurationError(`${name} must contain at least 32 bytes`);
    return new Uint8Array(value);
  }
  return decodeKeyMaterial(typeof value === "string" ? value : undefined, name);
}

/** @param {number} length */
export function randomBytes(length) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw configurationError("Secure random bytes are not available in this runtime");
  }
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

/**
 * @param {Uint8Array} keyBytes
 * @param {Uint8Array} data
 * @param {KeyUsage[]} usages
 */
async function importHmac(keyBytes, usages) {
  return subtle().importKey(
    "raw",
    copyBytes(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

/** @param {Uint8Array} bytes */
function copyBytes(bytes) {
  return new Uint8Array(bytes);
}

/**
 * @param {Uint8Array} keyBytes
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
export async function hmacSha256(keyBytes, data) {
  const key = await importHmac(keyBytes, ["sign"]);
  const signature = await subtle().sign("HMAC", key, copyBytes(data));
  return new Uint8Array(signature);
}

/**
 * Verifies with Web Crypto rather than comparing signature strings.
 * @param {Uint8Array} keyBytes
 * @param {Uint8Array} data
 * @param {Uint8Array} signature
 */
export async function hmacVerify(keyBytes, data, signature) {
  const key = await importHmac(keyBytes, ["verify"]);
  return subtle().verify("HMAC", key, copyBytes(signature), copyBytes(data));
}
