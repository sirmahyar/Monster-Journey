import { CHAPTER_COUNT, WAVES_PER_CHAPTER } from "../../game/config.js";
import { invalidRequest } from "../errors.js";

export const MAX_SCORE = 9_999_999;
export const MAX_NAME = 16;

/** @param {unknown} data */
export function parseScoreBody(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw invalidRequest("Score body must be a JSON object");
  }
  const keys = Object.keys(data);
  for (const key of keys) {
    if (!["name", "score", "chapter", "wave"].includes(key)) {
      throw invalidRequest("Unexpected score fields");
    }
  }
  if (keys.length !== 4) throw invalidRequest("Score body is missing fields");
  const name = parseName(data.name);
  const score = parseBoundedInt(data.score, 0, MAX_SCORE, "Score");
  const chapter = parseBoundedInt(data.chapter, 1, CHAPTER_COUNT, "Chapter");
  const wave = parseBoundedInt(data.wave, 1, WAVES_PER_CHAPTER, "Wave");
  return { name, score, chapter, wave };
}

/** @param {unknown} value */
export function parseName(value) {
  if (typeof value !== "string") throw invalidRequest("Name is invalid");
  const name = value.trim();
  if (name.length < 1 || name.length > MAX_NAME) throw invalidRequest("Name must be 1 to 16 characters");
  if (!/^[A-Za-z0-9 ]+$/.test(name)) throw invalidRequest("Name may use letters, numbers, and spaces");
  return name;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {string} label
 */
function parseBoundedInt(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw invalidRequest(`${label} is outside the allowed range`);
  }
  return value;
}
