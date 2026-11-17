import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/server/http/scores.js";
import { createMemoryScores } from "../src/server/scores/store.js";
import { parseScoreBody } from "../src/server/scores/validate.js";

function post(body, store = createMemoryScores()) {
  return handleRequest(new Request("http://127.0.0.1:8787/api/scores", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
    body: JSON.stringify(body),
  }), { store, allowedOrigin: "http://127.0.0.1:5173" });
}

describe("scoreboard", () => {
  it("rejects a bad name, a forged extra field, and an oversized score", () => {
    expect(() => parseScoreBody({ name: "Pilot!", score: 10, chapter: 1, wave: 1 })).toThrow(/Name/);
    expect(() => parseScoreBody({ name: "Pilot", score: 10, chapter: 1, wave: 1, hp: 99 })).toThrow(/Unexpected/);
    expect(() => parseScoreBody({ name: "Pilot", score: 10_000_000, chapter: 1, wave: 1 })).toThrow(/Score/);
    expect(() => parseScoreBody({ name: "Pilot", score: 10, chapter: 5, wave: 1 })).toThrow(/Chapter/);
    expect(() => parseScoreBody({ name: "Pilot", score: 10, chapter: 4, wave: 9 })).toThrow(/Wave/);
    expect(parseScoreBody({ name: " Ace ", score: 20, chapter: 4, wave: 8 })).toEqual({
      name: "Ace",
      score: 20,
      chapter: 4,
      wave: 8,
    });
  });

  it("accepts Persian names and rejects markup and direction overrides", () => {
    const entry = (name) => ({ name, score: 10, chapter: 1, wave: 1 });
    expect(parseScoreBody(entry("  مهیار ۱۴۰۳ ")).name).toBe("مهیار ۱۴۰۳");
    expect(parseScoreBody(entry("\u200Cمحمد\u200Cرضا\u200C")).name).toBe("محمد\u200Cرضا");
    expect(parseScoreBody(entry("گیگ  پژواک")).name).toBe("گیگ پژواک");
    expect(() => parseScoreBody(entry("<b>علی</b>"))).toThrow(/Name/);
    expect(() => parseScoreBody(entry("علی\u202E"))).toThrow(/Name/);
    expect(() => parseScoreBody(entry("\u200C \u200C"))).toThrow(/Name/);
  });

  it("stores a score and lists it ahead of a lower one", async () => {
    const store = createMemoryScores();
    const saved = await post({ name: "Ace", score: 1500, chapter: 2, wave: 3 }, store);
    expect(saved.status).toBe(201);
    await post({ name: "Bo", score: 400, chapter: 1, wave: 1 }, store);
    const listed = await handleRequest(new Request("http://127.0.0.1:8787/api/scores"), { store, allowedOrigin: "" });
    const payload = await listed.json();
    expect(listed.headers.get("cache-control")).toBe("no-store");
    expect(payload.scores.map((row) => row.name)).toEqual(["Ace", "Bo"]);
  });

  it("does not echo a rejected body as a stored score", async () => {
    const response = await post({ name: "Ace", score: 10, chapter: 1, wave: 1, admin: true });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("INVALID_REQUEST");
    expect(JSON.stringify(payload)).not.toContain("admin");
  });
});
