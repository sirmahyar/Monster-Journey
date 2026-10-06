/** @param {string} value */
export function utf8Bytes(value) {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(value);
  const bytes = [];
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
}

/** @param {Uint8Array} bytes */
export function utf8String(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

/**
 * Stable JSON used as the signed byte source and as the RNG message.
 * Objects get sorted keys. Arrays keep their order.
 * @param {unknown} value
 */
export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

/** @param {unknown} value */
function canonicalize(value) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number in canonical JSON");
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  throw new Error("Unsupported value in canonical JSON");
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** @param {Uint8Array} bytes */
export function bytesToBase64Url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63];
    out += B64[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : "";
    out += i + 2 < bytes.length ? B64[triple & 63] : "";
  }
  return out.replaceAll("+", "-").replaceAll("/", "_");
}

/** @param {string} value */
export function base64ToBytes(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("Invalid base64");
  const cleaned = value.trim().replaceAll("-", "+").replaceAll("_", "/").replace(/=+$/g, "");
  if (!/^[A-Za-z0-9+/]+$/.test(cleaned) || cleaned.length % 4 === 1) throw new Error("Invalid base64");
  const out = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const chunk = cleaned.slice(i, i + 4);
    const n = [
      B64.indexOf(chunk[0]),
      B64.indexOf(chunk[1] || "A"),
      chunk[2] ? B64.indexOf(chunk[2]) : 0,
      chunk[3] ? B64.indexOf(chunk[3]) : 0,
    ];
    if (n.some((part) => part < 0)) throw new Error("Invalid base64");
    const triple = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3];
    out.push((triple >> 16) & 255);
    if (chunk.length > 2) out.push((triple >> 8) & 255);
    if (chunk.length > 3) out.push(triple & 255);
  }
  return Uint8Array.from(out);
}

/** @param {string} hex */
export function hexToBytes(hex) {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
