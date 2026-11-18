import { SCOREBOARD_KEY } from "../../shared/assets.js";
import { readEdgeEnv } from "../adapters/edge-env.js";
import { GameError } from "../errors.js";

const BOARD_LIMIT = 200;
const CONTENT_TYPE = "application/json";
/** Signed upload host from the object-storage sample. Public reads also work on ir-central1. */
const STORAGE_HOST = "s3.ir-thr-at1.arvanstorage.ir";

/**
 * Scoreboard stored as one JSON object in the same bucket as the music.
 * Credentials are the edge JSON variables ARVANSTORAGE_BUCKET_NAME,
 * ARVANSTORAGE_ACCESS_KEY, and ARVANSTORAGE_SECRET_KEY. The upload signs a
 * PUT the same way the object-storage sample does (AWS signature version 2).
 * Signed reads and writes use the Tehran endpoint from that sample.
 * @param {object | undefined} envBinding
 * @param {typeof fetch} [fetchImpl]
 */
export function createBucketScoreStore(envBinding, fetchImpl = globalThis.fetch) {
  return {
    async top(limit = 50) {
      const rows = await readBoard(storageCredentials(envBinding), fetchImpl);
      return rows.slice(0, limit);
    },
    async insert(entry) {
      const creds = storageCredentials(envBinding);
      const current = await readBoard(creds, fetchImpl);
      const row = {
        id: Date.now(),
        name: entry.name,
        score: entry.score,
        chapter: entry.chapter,
        wave: entry.wave,
        createdAt: new Date().toISOString(),
      };
      await writeBoard(creds, mergeScores(current, row), fetchImpl);
      return row;
    },
    async close() {},
  };
}

/**
 * @param {object[]} current
 * @param {object} row
 */
export function mergeScores(current, row) {
  const next = current.filter((item) => item.id !== row.id);
  next.push(row);
  next.sort((a, b) => b.score - a.score || b.id - a.id);
  return next.slice(0, BOARD_LIMIT);
}

/** @param {object | undefined} envBinding */
export function storageCredentials(envBinding) {
  const bucket = readStorageValue("ARVANSTORAGE_BUCKET_NAME", envBinding) || "game-assets22";
  const accessKey = readStorageValue("ARVANSTORAGE_ACCESS_KEY", envBinding);
  const secret = readStorageValue("ARVANSTORAGE_SECRET_KEY", envBinding);
  if (!accessKey || !secret) {
    throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard storage is not configured.", 503);
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,62}$/i.test(bucket)) {
    throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard bucket name is invalid.", 503);
  }
  return { bucket, accessKey, secret };
}

/**
 * AWS signature version 2, matching the object-storage upload sample:
 * METHOD + empty MD5 + content type + date + /bucket/key.
 * @param {{ method: string, contentType: string, date: string, bucket: string, key: string, accessKey: string, secret: string }} request
 */
export async function authorizeObject(request) {
  const resource = `/${request.bucket}/${request.key}`;
  const stringToSign = `${request.method}\n\n${request.contentType}\n${request.date}\n${resource}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(request.secret),
    { name: "HMAC", hash: { name: "SHA-1" } },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `AWS ${request.accessKey}:${btoa(binary)}`;
}

/** @param {string} name @param {object | undefined} envBinding */
function readStorageValue(name, envBinding) {
  if (envBinding && typeof envBinding === "object" && Object.hasOwn(envBinding, name)) {
    const parsed = jsonString(envBinding[name]);
    if (parsed) return parsed;
  }
  return jsonString(readEdgeEnv(name));
}

/** A JSON env var may already be parsed, or still be a JSON string such as `"game-assets22"`. */
function jsonString(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") return parsed;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of ["value", "bucket", "name", "accessKey", "secret", "key", "password"]) {
      if (typeof value[key] === "string" && value[key]) return value[key];
    }
  }
  return "";
}

/** @param {{ bucket: string, accessKey: string, secret: string }} creds */
function objectUrl(creds) {
  return `https://${creds.bucket}.${STORAGE_HOST}/${SCOREBOARD_KEY}`;
}

/** @param {{ bucket: string, accessKey: string, secret: string }} creds @param {typeof fetch} fetchImpl */
async function readBoard(creds, fetchImpl) {
  const date = new Date().toUTCString();
  const response = await fetchImpl(objectUrl(creds), {
    method: "GET",
    cache: "no-store",
    headers: {
      Host: `${creds.bucket}.${STORAGE_HOST}`,
      Date: date,
      Authorization: await authorizeObject({
        method: "GET",
        contentType: "",
        date,
        bucket: creds.bucket,
        key: SCOREBOARD_KEY,
        accessKey: creds.accessKey,
        secret: creds.secret,
      }),
    },
  });
  const text = await response.text();
  if (response.status === 404 || (response.status === 403 && text.includes("NoSuchKey"))) return [];
  if (!response.ok) throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard storage refused the request.", 503);
  if (!text.trim()) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard file could not be read.", 503);
  }
  const list = Array.isArray(data) ? data : data && typeof data === "object" ? data.scores : null;
  if (!Array.isArray(list)) throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard file could not be read.", 503);
  return list.filter(isScoreRow).map(publicScore).sort((a, b) => b.score - a.score || b.id - a.id);
}

/**
 * @param {{ bucket: string, accessKey: string, secret: string }} creds
 * @param {object[]} rows
 * @param {typeof fetch} fetchImpl
 */
async function writeBoard(creds, rows, fetchImpl) {
  const date = new Date().toUTCString();
  const body = new TextEncoder().encode(JSON.stringify({ scores: rows }));
  const response = await fetchImpl(objectUrl(creds), {
    method: "PUT",
    body,
    headers: {
      Host: `${creds.bucket}.${STORAGE_HOST}`,
      Date: date,
      "Content-Type": CONTENT_TYPE,
      "Content-Length": String(body.length),
      Authorization: await authorizeObject({
        method: "PUT",
        contentType: CONTENT_TYPE,
        date,
        bucket: creds.bucket,
        key: SCOREBOARD_KEY,
        accessKey: creds.accessKey,
        secret: creds.secret,
      }),
    },
  });
  if (!response.ok) {
    await response.text().catch(() => "");
    throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard storage refused the request.", 503);
  }
  await response.arrayBuffer().catch(() => {});
}

/** @param {unknown} row */
function isScoreRow(row) {
  return Boolean(row)
    && typeof row === "object"
    && typeof row.name === "string"
    && Number.isFinite(Number(row.score))
    && Number.isFinite(Number(row.chapter))
    && Number.isFinite(Number(row.wave));
}

/** @param {object} row */
function publicScore(row) {
  return {
    id: Number(row.id) || 0,
    name: row.name,
    score: Number(row.score),
    chapter: Number(row.chapter),
    wave: Number(row.wave),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
  };
}
