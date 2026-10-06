import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import * as esbuild from "esbuild";
import { bytesToBase64Url } from "../src/server/security/encoding.js";

const TEXT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp",
};

const clientDir = "dist/client";
const assets = loadClientAssets(clientDir);

await esbuild.build({
  entryPoints: ["src/server/adapters/arvan.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  charset: "utf8",
  outfile: "dist/edge/game-api.js",
  legalComments: "none",
  plugins: [siteAssetPlugin(assets)],
  banner: {
    js: [
      "/* Endless Monster Journey — ArvanCloud edge bundle.",
      " * GET / serves the built browser page. POST /api/game/* runs the rules.",
      " * Confirmed entry: addEventListener('fetch', event => event.respondWith(...)).",
      " * This bundle does not fall back to an insecure signature.",
      " */",
    ].join("\n"),
  },
});

const bundled = readFileSync("dist/edge/game-api.js", "utf8");
const forbidden = ["node:http", "node:fs", "from \"vite\"", "process.env"];
for (const needle of forbidden) {
  if (bundled.includes(needle)) {
    throw new Error(`Edge bundle contains forbidden marker: ${needle}`);
  }
}
if (!bundled.includes("سفر بی‌پایان هیولا")) {
  throw new Error("Edge bundle is missing the built game page");
}
if (!bundled.includes("addEventListener")) {
  throw new Error("Edge bundle is missing the confirmed fetch listener");
}
if (!bundled.includes("subtle")) {
  throw new Error("Edge bundle is missing Web Crypto HMAC usage");
}
console.log("Wrote dist/edge/game-api.js");

/** @param {string} root */
function loadClientAssets(root) {
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error("dist/client is missing. Run vite build before the edge bundle.");
  }
  /** @type {Record<string, { type: string, cache: string, encoding?: string, body: string }>} */
  const files = {};
  walkClient(root, root, files);
  if (!files["/index.html"]) throw new Error("dist/client/index.html is missing");
  return files;
}

/**
 * @param {string} dir
 * @param {string} root
 * @param {Record<string, { type: string, cache: string, encoding?: string, body: string }>} files
 */
function walkClient(dir, root, files) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkClient(full, root, files);
      continue;
    }
    const webPath = `/${relative(root, full).split("\\").join("/")}`;
    const ext = extname(name).toLowerCase();
    const type = TEXT_TYPES[ext] || "application/octet-stream";
    const cache = webPath === "/index.html" ? "no-cache" : "public, max-age=31536000, immutable";
    const bytes = readFileSync(full);
    if (ext === ".html" || ext === ".js" || ext === ".css" || ext === ".svg" || ext === ".json" || ext === ".txt" || ext === ".map") {
      files[webPath] = { type, cache, body: bytes.toString("utf8") };
    } else {
      files[webPath] = { type, cache, encoding: "base64url", body: bytesToBase64Url(bytes) };
    }
  }
}

/** @param {Record<string, { type: string, cache: string, encoding?: string, body: string }>} files */
function siteAssetPlugin(files) {
  return {
    name: "site-assets",
    setup(build) {
      build.onResolve({ filter: /site-assets\.js$/ }, () => ({
        path: "site-assets.js",
        namespace: "site-assets",
      }));
      build.onLoad({ filter: /.*/, namespace: "site-assets" }, () => ({
        contents: `export const SITE_ASSETS = ${JSON.stringify(files)};`,
        loader: "js",
      }));
    },
  };
}
