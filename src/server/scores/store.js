import mysql from "mysql2/promise";
import { configurationError } from "../errors.js";

const SYSTEM_DATABASES = new Set(["information_schema", "mysql", "performance_schema", "sys"]);

/**
 * In-memory board used by tests and when a caller injects a store.
 * @returns {ScoreStore}
 */
export function createMemoryScores() {
  /** @type {ScoreRow[]} */
  const rows = [];
  let nextId = 1;
  return {
    async top(limit = 50) {
      return rows
        .slice()
        .sort((a, b) => b.score - a.score || b.id - a.id)
        .slice(0, limit)
        .map(publicRow);
    },
    async insert(entry) {
      const row = {
        id: nextId,
        name: entry.name,
        score: entry.score,
        chapter: entry.chapter,
        wave: entry.wave,
        createdAt: new Date().toISOString(),
      };
      nextId += 1;
      rows.push(row);
      return publicRow(row);
    },
    async close() {},
  };
}

/**
 * Opens Arvan MySQL, picks the application database, and creates `scores`.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<ScoreStore>}
 */
export async function createMysqlScores(env = process.env) {
  const host = env.MYSQL_HOST;
  const user = env.MYSQL_USER;
  const password = env.MYSQL_PASSWORD;
  const port = Number(env.MYSQL_PORT || 3306);
  if (!host || !user || typeof password !== "string" || password.length === 0) {
    throw configurationError("MySQL configuration is missing");
  }
  if (!Number.isInteger(port) || port <= 0) throw configurationError("MySQL port is invalid");

  const admin = await mysql.createConnection({
    host,
    port,
    user,
    password,
    connectTimeout: 8000,
  });
  try {
    const database = await resolveDatabase(admin, env.MYSQL_DATABASE);
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    const pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 4,
      connectTimeout: 8000,
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS scores (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_name VARCHAR(16) NOT NULL,
      score INT UNSIGNED NOT NULL,
      chapter TINYINT UNSIGNED NOT NULL,
      wave TINYINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX scores_rank (score, id)
    )`);
    return {
      async top(limit = 50) {
        const [rows] = await pool.query(
          `SELECT id, player_name AS name, score, chapter, wave, created_at AS createdAt
           FROM scores ORDER BY score DESC, id DESC LIMIT ?`,
          [limit],
        );
        return rows.map(publicRow);
      },
      async insert(entry) {
        const [result] = await pool.query(
          `INSERT INTO scores (player_name, score, chapter, wave) VALUES (?, ?, ?, ?)`,
          [entry.name, entry.score, entry.chapter, entry.wave],
        );
        return {
          id: Number(result.insertId),
          name: entry.name,
          score: entry.score,
          chapter: entry.chapter,
          wave: entry.wave,
          createdAt: new Date().toISOString(),
        };
      },
      async close() {
        await pool.end();
      },
    };
  } finally {
    await admin.end();
  }
}

/**
 * @param {import("mysql2/promise").Connection} admin
 * @param {string | undefined} requested
 */
async function resolveDatabase(admin, requested) {
  if (requested) return assertIdent(requested);
  const [rows] = await admin.query("SHOW DATABASES");
  const names = rows
    .map((row) => String(row.Database))
    .filter((name) => !SYSTEM_DATABASES.has(name));
  if (names.length === 0) throw configurationError("No application database is available");
  return assertIdent(names[0]);
}

/** @param {string} name */
function assertIdent(name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw configurationError("Database name is invalid");
  return name;
}

/** @param {ScoreRow} row */
function publicRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    score: Number(row.score),
    chapter: Number(row.chapter),
    wave: Number(row.wave),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

/**
 * @typedef {object} ScoreRow
 * @property {number} id
 * @property {string} name
 * @property {number} score
 * @property {number} chapter
 * @property {number} wave
 * @property {string | Date} createdAt
 */

/**
 * @typedef {object} ScoreStore
 * @property {(limit?: number) => Promise<object[]>} top
 * @property {(entry: { name: string, score: number, chapter: number, wave: number }) => Promise<object>} insert
 * @property {() => Promise<void>} close
 */
