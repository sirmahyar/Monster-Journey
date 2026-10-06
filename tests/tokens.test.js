import { describe, expect, it } from "vitest";
import { TOKEN_TTL_MS } from "../src/shared/protocol.js";
import { handleRequest } from "../src/server/http/handler.js";
import { bytesToBase64Url, canonicalJson, utf8Bytes, utf8String, base64ToBytes } from "../src/server/security/encoding.js";
import { signRawPayload, signState, verifyState } from "../src/server/security/tokens.js";
import { NOW, SIGNING_KEY, jsonRequest, runState } from "./helpers.js";

const key = SIGNING_KEY;

async function signed(state = runState()) {
  return { state, token: await signState(state, key) };
}

describe("signed state tokens", () => {
  it("round-trips a valid token and accepts a signed non-canonical payload", async () => {
    const { state, token } = await signed();
    const verified = await verifyState(token, key, NOW);
    expect(verified).toEqual(state);

    const pretty = utf8Bytes(JSON.stringify(state));
    const alternate = await signRawPayload(pretty, key);
    expect(alternate).not.toBe(token);
    await expect(verifyState(alternate, key, NOW)).resolves.toMatchObject({ phase: "run", gameId: state.gameId });
  });

  it("rejects a modified payload even when the signature still decodes", async () => {
    const { token } = await signed();
    const [payload, signature] = token.split(".");
    const bytes = base64ToBytes(payload);
    bytes[8] ^= 0x01;
    const tampered = `${bytesToBase64Url(bytes)}.${signature}`;
    await expect(verifyState(tampered, key, NOW)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects a payload whose bytes were reformatted under the old signature", async () => {
    const state = runState();
    const token = await signRawPayload(utf8Bytes(canonicalJson(state)), key);
    const reformatted = utf8Bytes(JSON.stringify(state, null, 2));
    const moved = `${bytesToBase64Url(reformatted)}.${token.split(".")[1]}`;
    await expect(verifyState(moved, key, NOW)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    expect(utf8String(reformatted)).not.toBe(canonicalJson(state));
  });

  it("rejects a modified signature and malformed encodings", async () => {
    const { token } = await signed();
    const flipped = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    await expect(verifyState(flipped, key, NOW)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    for (const bad of ["", "nope", "abc.", ".abc", "a.b.c", "@@@.abcd", "aaaa.!!!!"]) {
      await expect(verifyState(bad, key, NOW)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    }
  });

  it("rejects an expired token and accepts it one millisecond earlier", async () => {
    const state = runState();
    const { token } = await signed(state);
    await expect(verifyState(token, key, state.expiresAt - 1)).resolves.toMatchObject({ gameId: state.gameId });
    await expect(verifyState(token, key, state.expiresAt)).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });

  it("rejects unsupported versions before treating them as a generic schema failure", async () => {
    for (const patch of [{ schemaVersion: 2 }, { rulesVersion: 9 }]) {
      const broken = { ...runState(), ...patch };
      const token = await signRawPayload(utf8Bytes(canonicalJson(broken)), key);
      await expect(verifyState(token, key, NOW)).rejects.toMatchObject({ code: "UNSUPPORTED_VERSION" });
    }
  });

  it("rejects an invalid state schema after a good signature", async () => {
    const broken = runState();
    broken.player = { ...broken.player, hp: -1 };
    const token = await signRawPayload(utf8Bytes(canonicalJson(broken)), key);
    await expect(verifyState(token, key, NOW)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("returns a configuration error when the signing secret is missing or short", async () => {
    const missing = await handleRequest(jsonRequest("/api/game/start", {}), {});
    expect(missing.status).toBe(500);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: "CONFIGURATION_ERROR" },
    });

    const shortKey = await handleRequest(jsonRequest("/api/game/start", {}), {
      signingKey: "aaaa",
      rngKey: "bbbb",
      now: () => NOW,
    });
    expect(shortKey.status).toBe(500);
    const body = await shortKey.json();
    expect(body.error.code).toBe("CONFIGURATION_ERROR");
    expect(JSON.stringify(body)).not.toContain("aaaa");
    expect(body.error.message).not.toMatch(/TOKEN_TTL_MS|fallback/i);
  });

  it("uses a seven-day lifetime", () => {
    expect(TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
