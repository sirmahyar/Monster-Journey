import { readFileSync } from "node:fs";
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/server/adapters/arvan.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "dist/edge/game-api.js",
  legalComments: "none",
  banner: {
    js: [
      "/* Endless Monster Journey — ArvanCloud edge bundle.",
      " * Confirmed entry: addEventListener('fetch', event => event.respondWith(...)).",
      " * Web Crypto, resource limits, and the exact env binding are not fully verified.",
      " * This bundle does not fall back to an insecure signature.",
      " */",
    ].join("\n"),
  },
});

const bundled = readFileSync("dist/edge/game-api.js", "utf8");
const forbidden = ["node:http", "node:fs", "react", "Math.random", "from \"vite\"", "process.env"];
for (const needle of forbidden) {
  if (bundled.includes(needle)) {
    throw new Error(`Edge bundle contains forbidden marker: ${needle}`);
  }
}
if (!bundled.includes("addEventListener")) {
  throw new Error("Edge bundle is missing the confirmed fetch listener");
}
if (!bundled.includes("subtle")) {
  throw new Error("Edge bundle is missing Web Crypto HMAC usage");
}
console.log("Wrote dist/edge/game-api.js");
