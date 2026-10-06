import { describe, expect, it } from "vitest";
import { FIELD_HEIGHT, LEG_TICKS, PLAYER_RADIUS, PLAYER_X } from "../src/server/game/balance.js";
import { startRun, transition } from "../src/server/game/engine.js";
import { screenPosition } from "../src/server/game/motion.js";
import { dodgeInputs, freezeState, holdInputs, runState, scriptedRng } from "./helpers.js";

async function play(state, action, rolls = []) {
  return transition(state, action, scriptedRng(rolls));
}

function park(state, keep) {
  state.leg.actors.forEach((actor, index) => {
    if (index !== keep) actor.x = 4000;
  });
}

function rollsForLeg() {
  const rolls = [];
  for (let index = 0; index < 8; index += 1) {
    rolls.push(10, 120, 30, 1);
  }
  return rolls;
}

describe("endless flight", () => {
  it("starts in the air with five differently moving vectors", async () => {
    const opened = await startRun("game-id-test-0001", scriptedRng(rollsForLeg()), {
      issuedAt: 10,
      expiresAt: 10,
    });
    expect(opened.state.phase).toBe("run");
    expect(opened.state.revision).toBe(0);
    expect(opened.state.player.hp).toBe(100);
    expect(opened.state.leg.actors.map((actor) => actor.kind)).toEqual(["heart", "shard", "shard", "shard", "shard"]);
    const bat = opened.state.leg.actors[1];
    const start = screenPosition(bat, 0, opened.state.leg.speed);
    const later = screenPosition(bat, 10, opened.state.leg.speed);
    expect(later.x).not.toBe(start.x);
    expect(later.y).not.toBe(start.y);
  });

  it("clears a stretch when the creature stays out of the hazards", async () => {
    const state = runState();
    const before = structuredClone(state);
    const result = await play(freezeState(state), { type: "finish_leg", inputs: dodgeInputs(state) }, rollsForLeg());
    expect(state).toEqual(before);
    expect(result.state.phase).toBe("run");
    expect(result.state.distance).toBe(state.leg.speed * LEG_TICKS);
    expect(result.state.revision).toBe(1);
    expect(result.state.player.hp).toBe(100);
    expect(result.events.some((event) => event.type === "leg_cleared")).toBe(true);
    expect(result.state.leg.actors).toHaveLength(5);
  });

  it("applies one hit from a hazard that crosses the creature and does not mutate the input", async () => {
    const state = runState();
    state.player.y = 180;
    park(state, 1);
    state.leg.actors[1] = {
      ...state.leg.actors[1],
      x: PLAYER_X,
      y: 180,
      amp: 0,
      freq: 0,
      vy: 0,
      vx: 0,
    };
    const frozen = freezeState(structuredClone(state));
    const snapshot = structuredClone(frozen);
    const result = await play(frozen, { type: "finish_leg", inputs: holdInputs(180, LEG_TICKS) }, rollsForLeg());
    expect(frozen).toEqual(snapshot);
    expect(result.state.player.hp).toBe(100 - state.leg.actors[1].power);
    expect(result.events.filter((event) => event.type === "hazard_hit")).toHaveLength(1);
  });

  it("lets a dash pass through a hazard and spends one energy", async () => {
    const state = runState();
    state.player.y = 180;
    state.player.energy = 3;
    park(state, 1);
    state.leg.actors[1] = { ...state.leg.actors[1], x: PLAYER_X, y: 180, amp: 0, freq: 0, vy: 0, vx: 0 };
    const inputs = holdInputs(180, LEG_TICKS);
    inputs[0] = { y: 180, dash: 1 };
    const result = await play(state, { type: "finish_leg", inputs }, rollsForLeg());
    expect(result.events.some((event) => event.type === "dashed_through")).toBe(true);
    expect(result.events.some((event) => event.type === "hazard_hit")).toBe(false);
    expect(result.state.player.hp).toBe(100);
    expect(result.state.player.energy).toBeLessThanOrEqual(5);
    expect(result.state.player.energy).toBeGreaterThanOrEqual(3);
  });

  it("does not grant a dash when energy is empty", async () => {
    const state = runState();
    state.player.y = 180;
    state.player.energy = 0;
    park(state, 1);
    state.leg.actors[1] = { ...state.leg.actors[1], x: PLAYER_X, y: 180, amp: 0, freq: 0, vy: 0, vx: 0 };
    const inputs = holdInputs(180, LEG_TICKS, 1);
    const result = await play(state, { type: "finish_leg", inputs }, rollsForLeg());
    expect(result.events.some((event) => event.type === "hazard_hit")).toBe(true);
    expect(result.state.player.energy).toBeGreaterThanOrEqual(0);
  });

  it("heals once from a heart and never above max health", async () => {
    const state = runState();
    state.player.hp = 90;
    state.player.y = 40;
    park(state, 0);
    state.leg.actors[0] = { ...state.leg.actors[0], x: PLAYER_X, y: 40, amp: 0, freq: 0, vy: 0, vx: 0 };
    const result = await play(state, { type: "finish_leg", inputs: holdInputs(40, LEG_TICKS) }, rollsForLeg());
    expect(result.state.player.hp).toBe(100);
    expect(result.events.filter((event) => event.type === "healed")).toHaveLength(1);

    const full = runState();
    full.player.y = 40;
    park(full, 0);
    full.leg.actors[0] = { ...full.leg.actors[0], x: PLAYER_X, y: 40, amp: 0, freq: 0, vy: 0, vx: 0 };
    const capped = await play(full, { type: "finish_leg", inputs: holdInputs(40, LEG_TICKS) }, rollsForLeg());
    expect(capped.state.player.hp).toBe(100);
  });

  it("ends the run on the killing hit and does not keep flying afterward", async () => {
    const state = runState();
    state.player.y = 180;
    state.player.hp = 18;
    park(state, 1);
    state.leg.actors[1] = { ...state.leg.actors[1], x: PLAYER_X, y: 180, amp: 0, freq: 0, vy: 0, vx: 0, power: 18 };
    const result = await play(state, { type: "finish_leg", inputs: holdInputs(180, LEG_TICKS) }, []);
    expect(result.state.phase).toBe("game_over");
    expect(result.state.player.hp).toBe(0);
    expect(result.state.leg).toBeNull();
    expect(result.state.distance).toBe(state.leg.speed);
    expect(result.events.at(-1)).toMatchObject({ type: "player_defeated" });
    await expect(play(result.state, { type: "finish_leg", inputs: holdInputs(180, LEG_TICKS) }, [])).rejects.toMatchObject({
      code: "INVALID_ACTION",
    });
  });

  it("rejects a climb that is faster than the creature can fly, without changing state", async () => {
    const state = freezeState(runState());
    const inputs = holdInputs(state.player.y, LEG_TICKS);
    inputs[1] = { y: Math.min(FIELD_HEIGHT - PLAYER_RADIUS, state.player.y + 27), dash: 0 };
    const before = structuredClone(state);
    await expect(play(state, { type: "finish_leg", inputs }, [])).rejects.toMatchObject({ code: "INVALID_ACTION" });
    expect(state).toEqual(before);
  });

  it("rejects actions that are not a finished stretch", async () => {
    const state = runState();
    await expect(play(state, { type: "choose_route", route: "forest" }, [])).rejects.toMatchObject({ code: "INVALID_ACTION" });
    await expect(play(state, { type: "finish_leg", inputs: [] }, [])).rejects.toMatchObject({ code: "INVALID_ACTION" });
  });

  it("replays the same stretch to the same distance and events", async () => {
    const state = runState();
    const inputs = dodgeInputs(state);
    const first = await play(structuredClone(state), { type: "finish_leg", inputs }, rollsForLeg());
    const second = await play(structuredClone(state), { type: "finish_leg", inputs }, rollsForLeg());
    expect(second.state.distance).toBe(first.state.distance);
    expect(second.state.player).toEqual(first.state.player);
    expect(second.events).toEqual(first.events);
    expect(second.state.leg).toEqual(first.state.leg);
  });
});
