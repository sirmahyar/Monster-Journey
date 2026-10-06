import { describe, expect, it, vi } from "vitest";
import { API_PATHS } from "../src/shared/protocol.js";
import { handleRequest } from "../src/server/http/handler.js";
import { readLimitedBody } from "../src/server/http/body.js";
import { verifyState } from "../src/server/security/tokens.js";
import { SIGNING_KEY, apiConfig, jsonRequest } from "./helpers.js";

async function post(path, body, config = apiConfig()) {
  const response = await handleRequest(jsonRequest(path, body), config);
  const payload = await response.json();
  return { response, payload };
}

function gameplay(state) {
  const copy = structuredClone(state);
  delete copy.issuedAt;
  delete copy.expiresAt;
  return copy;
}

describe("game HTTP API", () => {
  it("starts a flight, accepts a stretch, and resumes the same save", async () => {
    const started = await post(API_PATHS.start, {});
    expect(started.response.status).toBe(200);
    expect(started.response.headers.get("cache-control")).toBe("no-store");
    expect(started.payload.view).toMatchObject({ phase: "run", revision: 0, distance: 0 });
    expect(started.payload.view.actors.length).toBeGreaterThanOrEqual(5);
    expect(started.payload.view.actors[0].points.length).toBeGreaterThan(10);
    expect(started.payload.events).toEqual([{ type: "run_started", distance: 0 }]);

    const inputs = started.payload.view.actors[0].points.map(() => ({ y: started.payload.view.player.y, dash: 0 }));
    const flown = await post(API_PATHS.action, { token: started.payload.token, action: { type: "finish_leg", inputs } });
    expect(flown.response.status).toBe(200);
    expect(flown.payload.view.revision).toBe(1);
    expect(flown.payload.view.distance).toBeGreaterThan(0);
    expect(["run", "game_over"]).toContain(flown.payload.view.phase);

    const resumed = await post(API_PATHS.resume, { token: flown.payload.token });
    expect(resumed.payload.token).toBe(flown.payload.token);
    expect(resumed.payload.events).toEqual([]);
    expect(resumed.payload.view).toEqual(flown.payload.view);
  });

  it("replays the same action into the same gameplay result when the clock changes", async () => {
    const config = apiConfig();
    const started = await post(API_PATHS.start, {}, config);
    const inputs = started.payload.view.actors[0].points.map(() => ({ y: started.payload.view.player.y, dash: 0 }));
    const action = { type: "finish_leg", inputs };
    const first = await post(API_PATHS.action, { token: started.payload.token, action }, config);
    const second = await post(API_PATHS.action, { token: started.payload.token, action }, config);
    expect(first.payload.events).toEqual(second.payload.events);
    expect(first.payload.view).toEqual(second.payload.view);
    expect(first.payload.token).not.toBe(second.payload.token);

    const withinLifetime = 1_700_000_010_000;
    const firstState = await verifyState(first.payload.token, SIGNING_KEY, withinLifetime);
    const secondState = await verifyState(second.payload.token, SIGNING_KEY, withinLifetime);
    expect(gameplay(firstState)).toEqual(gameplay(secondState));
    expect(firstState.issuedAt).not.toBe(secondState.issuedAt);
  });

  it("rejects oversized bodies, including a dishonest Content-Length", async () => {
    const huge = { pad: "x".repeat(33_000) };
    const oversized = await handleRequest(jsonRequest(API_PATHS.start, huge), apiConfig());
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("cache-control")).toBe("no-store");
    await expect(oversized.json()).resolves.toMatchObject({ error: { code: "INVALID_REQUEST" } });

    await expect(readLimitedBody({
      headers: new Headers({ "content-length": "4" }),
      body: {
        getReader() {
          let sent = false;
          return {
            async read() {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: new Uint8Array(40_000) };
            },
            async cancel() {},
          };
        },
      },
    })).rejects.toMatchObject({ code: "INVALID_REQUEST", status: 413 });
  });

  it("rejects malformed input and client-supplied stat changes", async () => {
    const started = await post(API_PATHS.start, {});
    const token = started.payload.token;
    const cases = [
      jsonRequest(API_PATHS.start, { hp: 9999 }),
      jsonRequest(API_PATHS.action, { token, action: { type: "finish_leg", inputs: [], hp: 9999 } }),
      jsonRequest(API_PATHS.action, { token, action: { type: "choose_route", route: "forest", player: { hp: 1 } } }),
      jsonRequest(API_PATHS.resume, { token, view: { phase: "game_over" } }),
      jsonRequest(API_PATHS.action, { token, action: { type: "finish_leg", inputs: [{ y: 1, dash: 0 }] } }),
    ];
    for (const request of cases) {
      const response = await handleRequest(request, apiConfig());
      expect(response.headers.get("cache-control")).toBe("no-store");
      const payload = await response.json();
      expect(["INVALID_REQUEST", "INVALID_ACTION"]).toContain(payload.error.code);
      expect(JSON.stringify(payload)).not.toContain(token);
    }

    const resumed = await post(API_PATHS.resume, { token });
    expect(resumed.payload.view.revision).toBe(0);
    expect(resumed.payload.view.player.hp).toBe(100);
  });

  it("does not leak token material when an unexpected error is logged", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = "this-token-must-not-be-logged";
    const response = await handleRequest(jsonRequest(API_PATHS.resume, { token }), {
      ...apiConfig(),
      now: () => {
        throw new Error(`boom ${token}`);
      },
    });
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain(token);
    expect(text).not.toContain("Error:");
    expect(JSON.stringify(spy.mock.calls)).not.toContain(token);
    spy.mockRestore();
  });

  it("allows only the configured browser origin and never caches errors", async () => {
    const request = jsonRequest(API_PATHS.start, {});
    const response = await handleRequest(request, apiConfig());
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");

    const other = new Request("http://127.0.0.1:8787/api/game/start", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    const blocked = await handleRequest(other, apiConfig());
    expect(blocked.headers.get("access-control-allow-origin")).toBeNull();

    const preflight = await handleRequest(new Request("http://127.0.0.1:8787/api/game/start", {
      method: "OPTIONS",
      headers: { origin: "http://127.0.0.1:5173" },
    }), apiConfig());
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("cache-control")).toBe("no-store");

    const missing = await handleRequest(new Request("http://127.0.0.1:8787/api/game/start", { method: "GET" }), apiConfig());
    expect(missing.status).toBe(405);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });
});
