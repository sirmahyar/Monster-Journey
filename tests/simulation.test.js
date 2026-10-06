import { describe, expect, it } from "vitest";
import { TOKEN_TTL_MS } from "../src/shared/protocol.js";
import { createInitialState, transition } from "../src/server/game/engine.js";
import { createHmacRng } from "../src/server/game/rng.js";
import { bytesToBase64Url } from "../src/server/security/encoding.js";
import { randomBytes } from "../src/server/security/crypto.js";
import { signState, verifyState } from "../src/server/security/tokens.js";
import { RNG_KEY, SIGNING_KEY } from "./helpers.js";

function policy(state) {
  if (state.phase === "route") {
    const stage = state.completedStages + 1;
    if (stage % 3 === 0) return { type: "choose_route", route: "spring" };
    return { type: "choose_route", route: state.completedStages % 4 === 3 ? "cave" : "forest" };
  }
  if (state.phase === "reward") {
    return { type: "choose_reward", offerId: state.rewardOffers[0].id };
  }
  if (state.player.hp * 100 <= state.player.maxHp * 40 && state.player.potions > 0 && state.player.hp < state.player.maxHp) {
    return { type: "combat_move", move: "potion" };
  }
  if (state.player.energy >= 3 && state.encounter.hp > state.player.attack * 2) {
    return { type: "combat_move", move: "special" };
  }
  if (state.player.energy <= 1) return { type: "combat_move", move: "defend" };
  return { type: "combat_move", move: "attack" };
}

function assertSane(state) {
  const numbers = [
    state.revision,
    state.rngCounter,
    state.completedStages,
    state.player.hp,
    state.player.maxHp,
    state.player.attack,
    state.player.defense,
    state.player.energy,
    state.player.maxEnergy,
    state.player.potions,
  ];
  if (state.encounter) {
    numbers.push(state.encounter.hp, state.encounter.maxHp, state.encounter.attack, state.encounter.defense);
  }
  for (const value of numbers) {
    expect(Number.isSafeInteger(value)).toBe(true);
    expect(Number.isFinite(value)).toBe(true);
  }
  expect(state.player.hp).toBeGreaterThanOrEqual(0);
  expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
  expect(state.player.energy).toBeGreaterThanOrEqual(0);
  expect(state.player.energy).toBeLessThanOrEqual(state.player.maxEnergy);
  if (state.phase === "route") {
    expect(state.encounter).toBeNull();
    expect(state.rewardOffers).toEqual([]);
    expect(state.player.hp).toBeGreaterThan(0);
  } else if (state.phase === "combat") {
    expect(state.encounter.hp).toBeGreaterThan(0);
    expect(state.rewardOffers).toEqual([]);
  } else if (state.phase === "reward") {
    expect(state.encounter.hp).toBe(0);
    expect(state.rewardOffers).toHaveLength(3);
  } else if (state.phase === "game_over") {
    expect(state.player.hp).toBe(0);
    expect(state.rewardOffers).toEqual([]);
  } else {
    throw new Error(`Unexpected phase ${state.phase}`);
  }
}

describe("long journeys", () => {
  it("keeps hundreds of transitions inside a bounded, valid token", async () => {
    let transitions = 0;
    let runs = 0;
    while (transitions < 300 && runs < 200) {
      runs += 1;
      const gameId = bytesToBase64Url(randomBytes(16));
      let state = createInitialState(gameId, { issuedAt: 5_000, expiresAt: 5_000 + TOKEN_TTL_MS });
      const rng = createHmacRng(RNG_KEY, gameId, 0);
      let steps = 0;
      while (state.phase !== "game_over" && steps < 80 && transitions < 300) {
        const before = structuredClone(state);
        const action = policy(state);
        const result = await transition(state, action, rng);
        expect(state).toEqual(before);
        assertSane(result.state);
        const stamped = {
          ...result.state,
          issuedAt: 5_000,
          expiresAt: 5_000 + TOKEN_TTL_MS,
        };
        const token = await signState(stamped, SIGNING_KEY);
        expect(token.length).toBeLessThan(4096);
        expect(token.split(".")).toHaveLength(2);
        const verified = await verifyState(token, SIGNING_KEY, 5_000);
        expect(verified.revision).toBe(result.state.revision);
        expect(verified.phase).toBe(result.state.phase);
        state = result.state;
        steps += 1;
        transitions += 1;
      }
    }
    expect(transitions).toBeGreaterThanOrEqual(300);
  });
});
