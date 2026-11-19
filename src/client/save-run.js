import { CHAPTER_COUNT, WAVES_PER_CHAPTER } from "../game/config.js";

export const RUN_SAVE_KEY = "cluck-raid-run";
const RUN_SAVE_VERSION = 1;

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
  if (row.v !== RUN_SAVE_VERSION) return null;
  if (!Number.isInteger(row.chapter) || row.chapter < 1 || row.chapter > CHAPTER_COUNT) return null;
  if (!Number.isInteger(row.wave) || row.wave < 1 || row.wave > WAVES_PER_CHAPTER) return null;
  if (!Number.isFinite(row.score) || row.score < 0) return null;
  if (!Number.isInteger(row.lives) || row.lives < 0 || row.lives > 9) return null;
  if (!Number.isInteger(row.bombs) || row.bombs < 0 || row.bombs > 9) return null;
  if (!Number.isInteger(row.level) || row.level < 1 || row.level > 6) return null;
  if (typeof row.weapon !== "string" || !Array.isArray(row.weapons)) return null;
  if (!row.stats || typeof row.stats !== "object") return null;
  return row;
}

export function readRunSave() {
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (!raw) return null;
    return parseRunSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** @param {RunSave|null|undefined} data */
export function writeRunSave(data) {
  if (!data) return;
  try {
    localStorage.setItem(RUN_SAVE_KEY, JSON.stringify({ ...data, v: RUN_SAVE_VERSION, savedAt: Date.now() }));
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