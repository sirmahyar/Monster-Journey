/**
 * A small MySQL client over any socket that can read, write, and upgrade to TLS.
 * The edge bundle uses it so the scoreboard can reach Arvan DBaaS without Node.js.
 */

const TEXT = new TextEncoder();
const UTF8 = new TextDecoder();

const CLIENT_LONG_PASSWORD = 0x00000001;
const CLIENT_LONG_FLAG = 0x00000004;
const CLIENT_CONNECT_WITH_DB = 0x00000008;
const CLIENT_PROTOCOL_41 = 0x00000200;
const CLIENT_TRANSACTIONS = 0x00002000;
const CLIENT_SECURE_CONNECTION = 0x00008000;
const CLIENT_PLUGIN_AUTH = 0x00080000;
const CLIENT_PLUGIN_AUTH_LENENC = 0x00200000;
const CAPS =
  CLIENT_LONG_PASSWORD |
  CLIENT_LONG_FLAG |
  CLIENT_CONNECT_WITH_DB |
  CLIENT_PROTOCOL_41 |
  CLIENT_TRANSACTIONS |
  CLIENT_SECURE_CONNECTION |
  CLIENT_PLUGIN_AUTH |
  CLIENT_PLUGIN_AUTH_LENENC;
const UTF8MB4 = 45;

/**
 * Turns the JSON value stored in the edge variable `dbpassword` into a password string.
 * Arvan requires the variable itself to be JSON, so it may already be a string or an object.
 * @param {unknown} value
 * @returns {string}
 */
export function passwordFromEdgeValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        return passwordFromEdgeValue(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (value && typeof value === "object") {
    for (const key of ["password", "dbpassword", "pass", "value", "MYSQL_PASSWORD"]) {
      const entry = value[key];
      if (typeof entry === "string" && entry) return entry;
    }
  }
  return "";
}

/**
 * @param {{ read: (n: number) => Promise<Uint8Array>, write: (bytes: Uint8Array) => Promise<void>, close: () => Promise<void> }} socket
 * @param {{ user: string, password: string, database: string }} auth
 */
export async function openMysql(socket, auth) {
  const greeting = parseGreeting((await readPacket(socket)).body);
  await socket.write(packet(1, await handshakeResponse(greeting, auth)));
  let response = await finishAuth(socket, await readPacket(socket), greeting, auth.password);
  if (response.body[0] === 0xff) throw mysqlError(response.body);
  if (response.body[0] !== 0x00 && response.body[0] !== 0xfe) throw new Error("database login failed");
  return {
    /** @param {string} sql */
    query: (sql) => query(socket, sql),
    close: () => socket.close(),
  };
}

async function finishAuth(socket, response, greeting, password) {
  let packetInfo = response;
  let scramble = greeting.scramble;
  let plugin = greeting.plugin;
  for (let round = 0; round < 5; round += 1) {
    const body = packetInfo.body;
    if (body[0] === 0x00 || body[0] === 0xff) return packetInfo;
    if (body[0] === 0xfe) {
      const name = readNull(body, 1);
      plugin = name.text;
      scramble = body.subarray(name.next, name.next + 20);
      const token = await authToken(plugin, password, scramble);
      await socket.write(packet(packetInfo.seq + 1, token));
      packetInfo = await readPacket(socket);
      continue;
    }
    if (body[0] === 0x01) {
      if (body[1] === 0x03) {
        packetInfo = await readPacket(socket);
        continue;
      }
      if (body[1] === 0x04) {
        await socket.write(packet(packetInfo.seq + 1, new Uint8Array([2])));
        const keyPacket = await readPacket(socket);
        const pem = UTF8.decode(keyPacket.body.subarray(keyPacket.body[0] === 0x01 ? 1 : 0)).replace(/\0+$/g, "");
        const encrypted = await encryptPassword(password, scramble, pem);
        await socket.write(packet(keyPacket.seq + 1, encrypted));
        packetInfo = await readPacket(socket);
        continue;
      }
    }
    return packetInfo;
  }
  return packetInfo;
}

/** @param {Uint8Array} body */
function parseGreeting(body) {
  let at = 1;
  while (body[at] !== 0) at += 1;
  at += 1;
  at += 4;
  const part1 = body.subarray(at, at + 8);
  at += 8 + 1;
  const caps = body[at] | (body[at + 1] << 8) | (body[at + 5] << 16) | (body[at + 6] << 24);
  const authLen = body[at + 7] || 21;
  at += 2 + 1 + 2 + 2 + 1 + 10;
  const rest = Math.max(13, authLen - 8);
  const part2 = body.subarray(at, at + rest);
  at += rest;
  let plugin = "mysql_native_password";
  if (body[at] !== undefined) {
    const name = readNull(body, at);
    if (name.text) plugin = name.text;
  }
  const scramble = new Uint8Array(20);
  scramble.set(part1.subarray(0, 8));
  scramble.set(part2.subarray(0, 12), 8);
  return { scramble, plugin, caps };
}

async function handshakeResponse(greeting, auth) {
  const user = TEXT.encode(auth.user);
  const database = TEXT.encode(auth.database);
  const plugin = TEXT.encode(greeting.plugin || "caching_sha2_password");
  const token = await authToken(greeting.plugin, auth.password, greeting.scramble);
  const body = new Uint8Array(4 + 4 + 1 + 23 + user.length + 1 + 1 + token.length + database.length + 1 + plugin.length + 1);
  let at = 0;
  writeU32(body, at, CAPS);
  at += 4;
  writeU32(body, at, 0xffffff);
  at += 4;
  body[at] = UTF8MB4;
  at += 1 + 23;
  body.set(user, at);
  at += user.length + 1;
  body[at] = token.length;
  at += 1;
  body.set(token, at);
  at += token.length;
  body.set(database, at);
  at += database.length + 1;
  body.set(plugin, at);
  return body;
}

async function authToken(plugin, password, scramble) {
  if (!password) return new Uint8Array(0);
  if (plugin === "caching_sha2_password") return sha2Token(password, scramble);
  return nativeToken(password, scramble);
}

async function sha2Token(password, scramble) {
  const pass = TEXT.encode(password);
  const stage1 = await sha256(pass);
  const stage2 = await sha256(stage1);
  const mixed = new Uint8Array(stage2.length + scramble.length);
  mixed.set(stage2);
  mixed.set(scramble, stage2.length);
  const stage3 = await sha256(mixed);
  return xor(stage1, stage3);
}

async function nativeToken(password, scramble) {
  const pass = TEXT.encode(password);
  const stage1 = await sha1(pass);
  const stage2 = await sha1(stage1);
  const mixed = new Uint8Array(scramble.length + stage2.length);
  mixed.set(scramble);
  mixed.set(stage2, scramble.length);
  const stage3 = await sha1(mixed);
  return xor(stage1, stage3);
}

async function query(socket, sql) {
  // A new command always starts at sequence 0. The connection phase does not carry over.
  await socket.write(packet(0, concat([new Uint8Array([0x03]), TEXT.encode(sql)])));
  const first = await readPacket(socket);
  if (first.body[0] === 0xff) throw mysqlError(first.body);
  if (first.body[0] === 0x00) return { ok: true, insertId: okPacket(first.body).insertId, rows: [] };
  const columns = lenenc(first.body, 0).value;
  for (let i = 0; i < columns; i += 1) await readPacket(socket);
  const mid = await readPacket(socket);
  if (!isEof(mid.body)) throw new Error("unexpected database response");
  const rows = [];
  for (;;) {
    const row = await readPacket(socket);
    if (isEof(row.body)) break;
    if (row.body[0] === 0xff) throw mysqlError(row.body);
    rows.push(decodeRow(row.body));
  }
  return { ok: true, insertId: 0, rows };
}

/** @param {Uint8Array} body */
function okPacket(body) {
  let at = 1;
  const affected = lenenc(body, at);
  at = affected.next;
  const insert = lenenc(body, at);
  return { insertId: insert.value };
}

/** @param {Uint8Array} body */
function decodeRow(body) {
  const fields = [];
  let at = 0;
  while (at < body.length) {
    if (body[at] === 0xfb) {
      fields.push(null);
      at += 1;
      continue;
    }
    const size = lenenc(body, at);
    at = size.next;
    fields.push(UTF8.decode(body.subarray(at, at + size.value)));
    at += size.value;
  }
  return fields;
}

function isEof(body) {
  return body[0] === 0xfe && body.length < 9;
}

function mysqlError(body) {
  const message = UTF8.decode(body.subarray(body.length > 3 && body[3] === 0x23 ? 9 : 3));
  const error = new Error(message || "database request failed");
  error.code = "DB_ERROR";
  return error;
}

/** @param {Uint8Array} body @param {number} at */
function lenenc(body, at) {
  const first = body[at];
  if (first < 251) return { value: first, next: at + 1 };
  if (first === 252) return { value: body[at + 1] | (body[at + 2] << 8), next: at + 3 };
  if (first === 253) return { value: body[at + 1] | (body[at + 2] << 8) | (body[at + 3] << 16), next: at + 4 };
  let value = 0;
  for (let i = 0; i < 8; i += 1) value += body[at + 1 + i] * 2 ** (8 * i);
  return { value, next: at + 9 };
}

function readNull(body, at) {
  let end = at;
  while (end < body.length && body[end] !== 0) end += 1;
  return { text: UTF8.decode(body.subarray(at, end)), next: end + 1 };
}

async function readPacket(socket) {
  const header = await socket.read(4);
  let len = header[0] | (header[1] << 8) | (header[2] << 16);
  const seq = header[3];
  const parts = [];
  let last = len;
  while (true) {
    if (len) parts.push(await socket.read(len));
    if (last !== 0xffffff) break;
    const more = await socket.read(4);
    len = more[0] | (more[1] << 8) | (more[2] << 16);
    last = len;
  }
  return { seq, body: concat(parts) };
}

function packet(seq, body) {
  const chunks = [];
  let offset = 0;
  let id = seq & 0xff;
  do {
    const size = Math.min(0xffffff, body.length - offset);
    const header = new Uint8Array(4);
    header[0] = size & 0xff;
    header[1] = (size >> 8) & 0xff;
    header[2] = (size >> 16) & 0xff;
    header[3] = id;
    chunks.push(header, body.subarray(offset, offset + size));
    offset += size;
    id = (id + 1) & 0xff;
  } while (offset < body.length);
  return concat(chunks);
}

function writeU32(target, at, value) {
  target[at] = value & 0xff;
  target[at + 1] = (value >> 8) & 0xff;
  target[at + 2] = (value >> 16) & 0xff;
  target[at + 3] = (value >> 24) & 0xff;
}

function xor(left, right) {
  const out = new Uint8Array(left.length);
  for (let i = 0; i < left.length; i += 1) out[i] = left[i] ^ right[i];
  return out;
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

async function encryptPassword(password, scramble, pem) {
  const key = await crypto.subtle.importKey(
    "spki",
    pemToDer(pem),
    { name: "RSA-OAEP", hash: "SHA-1" },
    false,
    ["encrypt"],
  );
  const plain = TEXT.encode(`${password}\0`);
  const seeded = new Uint8Array(plain.length);
  for (let i = 0; i < plain.length; i += 1) seeded[i] = plain[i] ^ scramble[i % scramble.length];
  return new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, seeded));
}

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function sha256(bytes) {
  return crypto.subtle.digest("SHA-256", bytes).then((buf) => new Uint8Array(buf));
}

function sha1(bytes) {
  return crypto.subtle.digest("SHA-1", bytes).then((buf) => new Uint8Array(buf));
}
