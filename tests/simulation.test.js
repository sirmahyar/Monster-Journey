import { describe, expect, it } from "vitest";
import { TOKEN_TTL_MS } from "../src/shared/protocol.js";
import { startRun, transition } from "../src/server/game/engine.js";
import { createHmacRng } from "../src/server/game/rng.js";
import { bytesToBase64Url } from "../src/server/security/encoding.js";
import { randomBytes } from "../src/server/security/crypto.js";
import { signState, verifyState } from "../src/server/security/tokens.js";
import { RNG_KEY, SIGNING_KEY, dodgeInputs } from "./helpers.js";

function assertSane(state) {
  for (const value of [state.revision, state.rngCounter, state.distance, state.player.hp, state.player.energy, state.player.y]) {
    expect(Number.isSafeInteger(value)).toBe(true);
  }
  expect(state.player.hp).toBeGreaterThanOrEqual(0);
  expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
  expect(state.player.energy).toBeGreaterThanOrEqual(0);
  expect(state.player.energy).toBeLessThanOrEqual(state.player.maxEnergy);
  if (state.phase === "run") {
    expect(state.player.hp).toBeGreaterThan(0);
    expect(state.leg.actors.length).toBeGreaterThanOrEqual(5);
  } else if (state.phase === "game_over") {
    expect(state.player.hp).toBe(0);
    expect(state.leg).toBeNull();
  } else {
    throw new Error(`Unexpected phase ${state.phase}`);
  }
}

describe("long journeys", () => {
  it("keeps hundreds of stretches inside a bounded, valid token", async () => {
    let transitions = 0;
    let runs = 0;
    while (transitions < 300 && runs < 80) {
      runs += 1;
      const gameId = bytesToBase64Url(randomBytes(16));
      const rng = createHmacRng(RNG_KEY, gameId, 0);
      let { state } = await startRun(gameId, rng, { issuedAt: 5_000, expiresAt: 5_000 + TOKEN_TTL_MS });
      let steps = 0;
      while (state.phase === "run" && steps < 40 && transitions < 300) {
        const inputs = dodgeInputs(state);
        const result = await transition(state, { type: "finish_leg", inputs }, rng);
        state = result.state;
        steps += 1;
        transitions += 1;
        assertSane(state);
        const token = await signState(state, SIGNING_KEY);
        expect(token.length).toBeLessThan(4096);
        const verified = await verifyState(token, SIGNING_KEY, 5_000);
        expect(verified.distance).toBe(state.distance);
        expect(verified.phase).toBe(state.phase);
      }
    }
    expect(transitions).toBeGreaterThanOrEqual(300);
  });
});