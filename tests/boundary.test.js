import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readEdgeEnv } from "../src/server/adapters/edge-env.js";

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(js|jsx|css)$/.test(entry)) files.push(path);
  }
  return files;
}

describe("module boundaries", () => {
  it("keeps the authoritative rules out of the client and Math.random out of the server", () => {
    const client = walk("src/client").map((path) => readFileSync(path, "utf8"));
    const server = walk("src/server").map((path) => readFileSync(path, "utf8"));
    const shared = walk("src/shared").map((path) => readFileSync(path, "utf8"));
    for (const source of client) {
      expect(source).not.toMatch(/from\s+["'][^"']*server\//);
      expect(source).not.toContain("GAME_SIGNING_KEY");
      expect(source).not.toContain("defenderDefense");
      expect(source).not.toContain("Math.random");
    }
    for (const source of server) {
      expect(source).not.toContain("Math.random");
      expect(source).not.toMatch(/from\s+["'][^"']*client\//);
    }
    for (const source of shared) {
      expect(source).not.toMatch(/server\/|GAME_SIGNING_KEY|GAME_RNG_KEY/);
    }
  });

  it("reads a global edge env binding without inventing a secret", () => {
    const previous = globalThis.env;
    globalThis.env = { GAME_SIGNING_KEY: "from-the-edge" };
    expect(readEdgeEnv("GAME_SIGNING_KEY")).toBe("from-the-edge");
    expect(readEdgeEnv("GAME_RNG_KEY")).toBeUndefined();
    if (previous === undefined) delete globalThis.env;
    else globalThis.env = previous;
  });
});