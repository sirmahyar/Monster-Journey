import { describe, expect, it } from "vitest";
import { connectionFromEdge } from "../src/server/scores/edge-db.js";
import { passwordFromEdgeValue } from "../src/server/scores/mysql-wire.js";
import { createMemoryScores } from "../src/server/scores/store.js";
import { handleSiteRequest } from "../src/server/http/site.js";

const assets = {
  "/index.html": { type: "text/html; charset=utf-8", cache: "no-cache", body: "<title>یورش مرغی</title>" },
  "/assets/app.js": { type: "text/javascript; charset=utf-8", cache: "public", body: "console.log(1)" },
};

describe("edge database password", () => {
  it("reads a JSON string, a raw string, or an object", () => {
    expect(passwordFromEdgeValue('"s3cret"')).toBe("s3cret");
    expect(passwordFromEdgeValue("s3cret")).toBe("s3cret");
    expect(passwordFromEdgeValue({ password: "s3cret" })).toBe("s3cret");
    expect(passwordFromEdgeValue({ dbpassword: "s3cret" })).toBe("s3cret");
    const config = connectionFromEdge({ dbpassword: { password: "s3cret", database: "scores" } });
    expect(config.password).toBe("s3cret");
    expect(config.database).toBe("scores");
    expect(config.user).toBe("base-user");
    expect(config.host.endsWith(".db.arvandbaas.ir")).toBe(true);
  });
});

describe("edge site", () => {
  it("serves the game page and its files", async () => {
    const home = await handleSiteRequest(new Request("https://monster.example/"), { assets });
    expect(home.status).toBe(200);
    expect(await home.text()).toContain("یورش مرغی");
    const script = await handleSiteRequest(new Request("https://monster.example/assets/app.js"), { assets });
    expect(script.headers.get("content-type")).toContain("javascript");
    expect(await script.text()).toContain("console.log");
  });

  it("streams a bucket object and rejects a path escape", async () => {
    const original = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url) => {
      seen.push(String(url));
      return new Response("audio", { status: 200, headers: { "content-type": "audio/mpeg", "content-length": "5" } });
    };
    try {
      const ok = await handleSiteRequest(new Request("https://game.example/cdn/05.%20C%20I3%20Ingame3.mp3"), { assets });
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-type")).toContain("audio/mpeg");
      expect(await ok.text()).toBe("audio");
      expect(seen[0]).toBe("https://game-assets22.s3.ir-central1.arvanstorage.ir/05.%20C%20I3%20Ingame3.mp3");
      const bad = await handleSiteRequest(new Request("https://game.example/cdn/..%2Fsecret"), { assets });
      expect(bad.status).toBe(404);
      expect(seen).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("returns the page for a route and 404 for a missing file", async () => {
    const route = await handleSiteRequest(new Request("https://monster.example/play"), { assets });
    expect(await route.text()).toContain("یورش مرغی");
    const missing = await handleSiteRequest(new Request("https://monster.example/assets/missing.mp3"), { assets });
    expect(missing.status).toBe(404);
  });

  it("stores a score when a store is connected and refuses when it is not", async () => {
    const store = createMemoryScores();
    const saved = await handleSiteRequest(new Request("https://monster.example/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "مهیار", score: 1200, chapter: 1, wave: 2 }),
    }), { assets, store });
    expect(saved.status).toBe(201);
    const board = await handleSiteRequest(new Request("https://monster.example/api/scores"), { assets, store });
    const payload = await board.json();
    expect(payload.scores[0].name).toBe("مهیار");
    const offline = await handleSiteRequest(new Request("https://monster.example/api/scores"), { assets });
    expect(offline.status).toBe(503);
  });
});
