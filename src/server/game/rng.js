import { canonicalJson, utf8Bytes } from "../security/encoding.js";
import { hmacSha256 } from "../security/crypto.js";

const SAMPLE_SPACE = 2 ** 48;

/**
 * Deterministic HMAC-SHA-256 draws. Each consumed sample increments the counter,
 * including the rare rejection used to keep bounded integers unbiased.
 * @param {Uint8Array} keyBytes
 * @param {string} gameId
 * @param {number} startCounter
 */
export function createHmacRng(keyBytes, gameId, startCounter) {
  let counter = startCounter;
  return {
    get counter() {
      return counter;
    },
    /**
     * @param {number} min
     * @param {number} max
     * @param {string} purpose
     */
    async integer(min, max, purpose) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error("Invalid RNG range");
      }
      const span = max - min + 1;
      if (!Number.isSafeInteger(span) || span > SAMPLE_SPACE) {
        throw new Error("RNG span is too large");
      }
      while (true) {
        const current = counter;
        counter += 1;
        const message = canonicalJson([gameId, current, purpose]);
        const digest = await hmacSha256(keyBytes, utf8Bytes(message));
        const sample = unbiasedBelow(digest, span);
        if (sample !== null) return min + sample;
      }
    },
  };
}

/**
 * @param {Uint8Array} digest
 * @param {number} span
 * @returns {number | null}
 */
function unbiasedBelow(digest, span) {
  if (span <= 1) return 0;
  let value = 0;
  for (let i = 0; i < 6; i += 1) value = value * 256 + digest[i];
  const limit = SAMPLE_SPACE - (SAMPLE_SPACE % span);
  if (value >= limit) return null;
  return value % span;
}
