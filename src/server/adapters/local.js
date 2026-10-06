/**
 * Local development server. Node.js is used only here and must not be bundled
 * into the edge artifact. The game API itself is handleRequest().
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { handleRequest } from "../http/handler.js";

loadEnvFile(".env");

const config = {
  signingKey: process.env.GAME_SIGNING_KEY,
  rngKey: process.env.GAME_RNG_KEY,
  allowedOrigin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
  now: () => Date.now(),
};

if (!config.signingKey || !config.rngKey) {
  console.error("GAME_SIGNING_KEY or GAME_RNG_KEY is missing. Run npm run keys and write the values to .env.");
}

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";

const server = createServer(async (nodeReq, nodeRes) => {
  try {
    const request = await toWebRequest(nodeReq, host, port);
    const response = await handleRequest(request, config);
    await writeResponse(nodeRes, response);
  } catch {
    nodeRes.writeHead(500, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    nodeRes.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } }));
  }
});

server.listen(port, host, () => {
  console.error(`Game API listening on http://${host}:${port}`);
});

/**
 * @param {import("node:http").IncomingMessage} nodeReq
 * @param {string} host
 * @param {number} port
 */
async function toWebRequest(nodeReq, host, port) {
  const chunks = [];
  for await (const chunk of nodeReq) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const url = `http://${host}:${port}${nodeReq.url || "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else headers.set(key, value);
  }
  const method = nodeReq.method || "GET";
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") init.body = body;
  return new Request(url, init);
}

/**
 * @param {import("node:http").ServerResponse} nodeRes
 * @param {Response} response
 */
async function writeResponse(nodeRes, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  nodeRes.writeHead(response.status, headers);
  const bytes = new Uint8Array(await response.arrayBuffer());
  nodeRes.end(bytes);
}

/** @param {string} path */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
