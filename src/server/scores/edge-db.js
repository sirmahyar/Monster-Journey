import { GameError } from "../errors.js";
import { readEdgeEnv } from "../adapters/edge-env.js";
import { openMysql, passwordFromEdgeValue } from "./mysql-wire.js";

const HOST = "23a4f1ebae3841a2b5a4442b49d85c8f.db.arvandbaas.ir";
const PORT = 3306;
const USER = "base-user";
const DATABASE = "default";

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS scores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_name VARCHAR(16) NOT NULL,
  score INT UNSIGNED NOT NULL,
  chapter TINYINT UNSIGNED NOT NULL,
  wave TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX scores_rank (score, id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/**
 * Scoreboard backed by the Arvan DBaaS database.
 * The password comes from the edge variable `dbpassword` and is never written into the bundle.
 * @param {object | undefined} envBinding
 */
export function createEdgeScoreStore(envBinding, openSocket = openScoreSocket) {
  return {
    top: (limit = 50) => withDatabase(envBinding, (db) => readTop(db, limit), openSocket),
    insert: (entry) => withDatabase(envBinding, (db) => insertScore(db, entry), openSocket),
    close: async () => {},
  };
}

async function withDatabase(envBinding, run, openSocket) {
  const config = connectionFromEdge(envBinding);
  if (!config.password) {
    throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard password is not configured.", 503);
  }
  const socket = await Promise.race([
    openSocket(config.host, config.port),
    new Promise((_, reject) => {
      setTimeout(() => reject(new GameError("SERVICE_UNAVAILABLE", "Scoreboard database did not respond.", 503)), 8000);
    }),
  ]);
  const db = await openMysql(socket, config);
  try {
    await db.query(CREATE_TABLE);
    return await run(db);
  } finally {
    await db.close();
  }
}

/** @param {object | undefined} envBinding */
export function connectionFromEdge(envBinding) {
  const raw = edgeValue(envBinding, "dbpassword");
  const parsed = objectValue(raw);
  return {
    host: text(parsed, ["host", "hostname", "MYSQL_HOST"]) || HOST,
    port: numberValue(parsed, ["port", "MYSQL_PORT"]) || PORT,
    user: text(parsed, ["user", "username", "MYSQL_USER"]) || USER,
    database: text(parsed, ["database", "db", "MYSQL_DATABASE"]) || DATABASE,
    password: passwordFromEdgeValue(raw),
    servername: text(parsed, ["host", "hostname", "MYSQL_HOST"]) || HOST,
  };
}

function edgeValue(envBinding, name) {
  if (envBinding && typeof envBinding === "object" && Object.hasOwn(envBinding, name)) return envBinding[name];
  return readEdgeEnv(name);
}

function objectValue(raw) {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function text(source, keys) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function numberValue(source, keys) {
  const value = Number(text(source, keys));
  return Number.isInteger(value) && value > 0 ? value : 0;
}

async function readTop(db, limit) {
  const size = Math.max(1, Math.min(50, Math.floor(Number(limit) || 50)));
  const result = await db.query(
    `SELECT id, player_name, score, chapter, wave, created_at FROM scores ORDER BY score DESC, id DESC LIMIT ${size}`,
  );
  return result.rows.map((row) => ({
    id: Number(row[0]),
    name: row[1],
    score: Number(row[2]),
    chapter: Number(row[3]),
    wave: Number(row[4]),
    createdAt: row[5],
  }));
}

async function insertScore(db, entry) {
  const result = await db.query(
    `INSERT INTO scores (player_name, score, chapter, wave) VALUES (${quote(entry.name)}, ${Math.floor(entry.score)}, ${Math.floor(entry.chapter)}, ${Math.floor(entry.wave)})`,
  );
  return {
    id: result.insertId,
    name: entry.name,
    score: entry.score,
    chapter: entry.chapter,
    wave: entry.wave,
    createdAt: new Date().toISOString(),
  };
}

function quote(value) {
  return `'${String(value).replace(/[\0\\']/g, (char) => ({ "\0": "\\0", "\\": "\\\\", "'": "\\'" }[char]))}'`;
}

async function openScoreSocket(host, port) {
  const opened = await tryConnect(host, port);
  if (!opened) throw new GameError("SERVICE_UNAVAILABLE", "Scoreboard is not connected on this edge.", 503);
  return opened;
}

async function tryConnect(host, port) {
  if (typeof connect === "function") return wrapWeb(await connect({ hostname: host, port }, { secureTransport: "off" }));
  if (typeof globalThis.connect === "function") {
    return wrapWeb(await globalThis.connect({ hostname: host, port }, { secureTransport: "off" }));
  }
  if (globalThis.Deno?.connect) return wrapDeno(await globalThis.Deno.connect({ hostname: host, port }));
  try {
    const mod = await import("cloudflare:sockets");
    if (typeof mod.connect === "function") return wrapWeb(await mod.connect({ hostname: host, port }, { secureTransport: "off" }));
  } catch {
    return null;
  }
  return null;
}

function wrapWeb(socket) {
  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  let pending = new Uint8Array(0);
  return {
    async read(n) {
      while (pending.length < n) {
        const { value, done } = await reader.read();
        if (done || !value) throw new Error("database connection closed");
        const next = new Uint8Array(pending.length + value.length);
        next.set(pending);
        next.set(value, pending.length);
        pending = next;
      }
      const out = pending.slice(0, n);
      pending = pending.slice(n);
      return out;
    },
    async write(bytes) {
      await writer.write(bytes);
    },
    async close() {
      try { await writer.close(); } catch { /* already closed */ }
      try { reader.releaseLock(); } catch { /* already released */ }
      try { socket.close(); } catch { /* already closed */ }
    },
  };
}

async function wrapDeno(conn) {
  let pending = new Uint8Array(0);
  return {
    async read(n) {
      while (pending.length < n) {
        const buf = new Uint8Array(16384);
        const got = await conn.read(buf);
        if (got === null) throw new Error("database connection closed");
        const next = new Uint8Array(pending.length + got);
        next.set(pending);
        next.set(buf.subarray(0, got), pending.length);
        pending = next;
      }
      const out = pending.slice(0, n);
      pending = pending.slice(n);
      return out;
    },
    async write(bytes) {
      await conn.write(bytes);
    },
    async close() {
      conn.close();
    },
  };
}
