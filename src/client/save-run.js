import { CHAPTER_COUNT, WAVES_PER_CHAPTER } from "../game/config.js";
import { hmacSha256, hmacVerify } from "../server/security/crypto.js";
import { base64ToBytes, bytesToBase64Url, canonicalJson, utf8Bytes } from "../server/security/encoding.js";

export const RUN_SAVE_KEY = "cluck-raid-run";
const RUN_SAVE_VERSION = 2;
const TOKEN_PREFIX = "cr2.";
/** Client-only integrity key; stops casual localStorage score edits. */
const INTEGRITY_KEY = utf8Bytes("yursh-morghi-local-run-v2");

/**
 * @typedef {{
 *   v: number,
 *   savedAt: number,
 *   chapter: number,
 *   wave: number,
 *   score: number,
 *   lives: number,
 *   bombs: number,
 *   food: number,
 *   level: number,
 *   weapon: string,
 *   weapons: string[],
 *   rockets: boolean,
 *   stats: object,
 *   pilot?: string,
 * }} RunSave
 */

/** @param {unknown} raw */
export function parseRunSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  const row = /** @type {RunSave} */ (raw);
  if (row.v !== RUN_SAVE_VERSION && row.v !== 1) return null;
  if (!Number.isInteger(row.chapter) || row.chapter < 1 || row.chapter > CHAPTER_COUNT) return null;
  if (!Number.isInteger(row.wave) || row.wave < 1 || row.wave > WAVES_PER_CHAPTER) return null;
  if (!Number.isFinite(row.score) || row.score < 0) return null;
  if (!Number.isInteger(row.lives) || row.lives < 0 || row.lives > 9) return null;
  if (!Number.isInteger(row.bombs) || row.bombs < 0 || row.bombs > 9) return null;
  if (!Number.isInteger(row.level) || row.level < 1 || row.level > 6) return null;
  if (typeof row.weapon !== "string" || !Array.isArray(row.weapons)) return null;
  if (!row.stats || typeof row.stats !== "object") return null;
  return { ...row, v: RUN_SAVE_VERSION };
}

function packBody(data) {
  return {
    v: RUN_SAVE_VERSION,
    savedAt: Date.now(),
    chapter: data.chapter,
    wave: data.wave,
    score: data.score,
    lives: data.lives,
    bombs: data.bombs,
    food: data.food,
    level: data.level,
    weapon: data.weapon,
    weapons: data.weapons,
    rockets: data.rockets,
    stats: data.stats,
    ...(data.pilot ? { pilot: data.pilot } : {}),
  };
}

/** @param {string} token */
async function decodeToken(token) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const rest = token.slice(TOKEN_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot <= 0) return null;
  let payload;
  let signature;
  try {
    payload = base64ToBytes(rest.slice(0, dot));
    signature = base64ToBytes(rest.slice(dot + 1));
  } catch {
    return null;
  }
  const ok = await hmacVerify(INTEGRITY_KEY, payload, signature);
  if (!ok) return null;
  try {
    return parseRunSave(JSON.parse(new TextDecoder().decode(payload)));
  } catch {
    return null;
  }
}

/** @param {string} raw */
function readLegacyJson(raw) {
  try {
    return parseRunSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function readRunSave() {
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (!raw) return null;
    if (raw.startsWith(TOKEN_PREFIX)) return decodeToken(raw);
    return readLegacyJson(raw);
  } catch {
    return null;
  }
}

/** @param {RunSave|null|undefined} data */
export async function writeRunSave(data) {
  if (!data) return;
  try {
    const body = packBody(data);
    const payload = utf8Bytes(canonicalJson(body));
    const signature = await hmacSha256(INTEGRITY_KEY, payload);
    const token = `${TOKEN_PREFIX}${bytesToBase64Url(payload)}.${bytesToBase64Url(signature)}`;
    localStorage.setItem(RUN_SAVE_KEY, token);
  } catch {
    /* private mode / quota */
  }
}

export function clearRunSave() {
  try {
    localStorage.removeItem(RUN_SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** @param {string} token */
export async function verifyRunSaveToken(token) {
  return decodeToken(token);
}