import { MAX_BODY_BYTES } from "../../shared/protocol.js";
import { GameError, invalidRequest } from "../errors.js";

/**
 * Reads the body while counting bytes. A missing or dishonest Content-Length
 * cannot bypass the limit.
 * @param {Request} request
 * @param {number} [maxBytes]
 * @returns {Promise<Uint8Array>}
 */
export async function readLimitedBody(request, maxBytes = MAX_BODY_BYTES) {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) throw invalidRequest("Content-Length is invalid");
    const advertised = Number(declared);
    if (!Number.isSafeInteger(advertised) || advertised > maxBytes) {
      throw bodyTooLarge();
    }
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw bodyTooLarge();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error?.code === "INVALID_REQUEST") throw error;
    throw invalidRequest("Request body could not be read");
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function bodyTooLarge() {
  return new GameError("INVALID_REQUEST", "Request body exceeds 32 KiB", 413);
}

/**
 * @param {Request} request
 */
export async function readJsonBody(request) {
  const bytes = await readLimitedBody(request);
  if (bytes.byteLength === 0) throw invalidRequest("Request body is required");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalidRequest("Request body must be UTF-8 JSON");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw invalidRequest("Request body must be JSON");
  }
}
