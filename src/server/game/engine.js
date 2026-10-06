import { SCHEMA_VERSION, RULES_VERSION } from "../../shared/protocol.js";
import { invalidAction, numericLimit } from "../errors.js";
import {
  ACTOR_KINDS,
  ENERGY_REGEN_EVERY,
  FIELD_HEIGHT,
  INITIAL_PLAYER,
  LEG_TICKS,
  LIMITS,
  MAX_DY,
  PLAYER_RADIUS,
  actorCountFor,
  powerBonus,
  speedFor,
} from "./balance.js";
import { overlaps, screenPosition } from "./motion.js";

const KIND_NAMES = Object.keys(ACTOR_KINDS);

/**
 * @param {string} gameId
 * @param {{ issuedAt?: number, expiresAt?: number }} [timestamps]
 */
export function createInitialState(gameId, timestamps = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    gameId,
    revision: 0,
    rngCounter: 0,
    issuedAt: timestamps.issuedAt ?? 0,
    expiresAt: timestamps.expiresAt ?? 0,
    phase: "run",
    distance: 0,
    player: { ...INITIAL_PLAYER },
    leg: null,
  };
}

/**
 * Opens the first stretch. Revision stays 0 until the player finishes a leg.
 * @param {string} gameId
 * @param {{ integer: Function, counter: number }} rng
 * @param {{ issuedAt?: number, expiresAt?: number }} [timestamps]
 */
export async function startRun(gameId, rng, timestamps = {}) {
  const state = createInitialState(gameId, timestamps);
  state.leg = await generateLeg(state.distance, rng);
  state.rngCounter = rng.counter;
  return {
    state,
    events: [{ type: "run_started", distance: 0 }],
  };
}

/**
 * @param {object} state
 * @param {{ type: string, inputs?: { y: number, dash: number }[] }} action
 * @param {{ integer: Function, counter: number }} rng
 */
export async function transition(state, action, rng) {
  if (action?.type !== "finish_leg") throw invalidAction("This run only accepts a finished stretch");
  if (state.phase !== "run" || !state.leg) throw invalidAction("The run is over");
  assertInputs(state, action.inputs);

  const next = cloneState(state);
  const events = [];
  const spent = new Set();
  let ended = false;

  for (let tick = 0; tick < next.leg.tickCount; tick += 1) {
    const input = action.inputs[tick];
    const dashed = input.dash === 1 && next.player.energy > 0;
    if (dashed) next.player.energy -= 1;
    next.player.y = input.y;

    for (const actor of next.leg.actors) {
      if (spent.has(actor.id)) continue;
      const point = screenPosition(actor, tick, next.leg.speed);
      if (!overlaps(input.y, point, actor.radius)) continue;
      spent.add(actor.id);
      if (actor.role === "hazard") {
        if (dashed) {
          events.push({ type: "dashed_through", actorId: actor.id, tick });
          continue;
        }
        const before = next.player.hp;
        next.player.hp = Math.max(0, before - actor.power);
        events.push({
          type: "hazard_hit",
          actorId: actor.id,
          kind: actor.kind,
          tick,
          hpBefore: before,
          hpAfter: next.player.hp,
        });
        if (next.player.hp === 0) {
          ended = true;
          break;
        }
      } else if (actor.role === "heal") {
        const before = next.player.hp;
        next.player.hp = Math.min(next.player.maxHp, before + actor.power);
        events.push({ type: "healed", actorId: actor.id, tick, hpBefore: before, hpAfter: next.player.hp });
      } else if (actor.role === "energy") {
        const before = next.player.energy;
        next.player.energy = Math.min(next.player.maxEnergy, before + actor.power);
        events.push({
          type: "energy_changed",
          actorId: actor.id,
          tick,
          energyBefore: before,
          energyAfter: next.player.energy,
        });
      }
    }

    if (!dashed && (tick + 1) % ENERGY_REGEN_EVERY === 0 && next.player.energy < next.player.maxEnergy) {
      next.player.energy += 1;
    }

    if (!Number.isSafeInteger(next.distance + next.leg.speed) || next.distance + next.leg.speed > LIMITS.maxDistance) {
      throw numericLimit("Distance is outside the supported range");
    }
    next.distance += next.leg.speed;
    if (ended) break;
  }

  if (ended) {
    next.phase = "game_over";
    next.leg = null;
    events.push({ type: "player_defeated", distance: next.distance });
  } else {
    events.push({ type: "leg_cleared", distance: next.distance });
    next.leg = await generateLeg(next.distance, rng);
  }

  next.rngCounter = rng.counter;
  if (next.revision >= LIMITS.maxRevision) throw numericLimit("Revision is outside the supported range");
  next.revision += 1;
  if (next.rngCounter > LIMITS.maxRngCounter) throw numericLimit("Randomness counter is outside the supported range");
  return { state: next, events };
}

/**
 * @param {number} distance
 * @param {{ integer: Function }} rng
 */
export async function generateLeg(distance, rng) {
  const speed = speedFor(distance);
  const count = actorCountFor(distance);
  const bonus = powerBonus(distance, "hazard");
  const span = speed * LEG_TICKS;
  /** @type {object[]} */
  const actors = [];
  for (let index = 0; index < count; index += 1) {
    const roll = await rng.integer(0, 99, "actor_kind");
    const name = kindForRoll(roll, index);
    const spec = ACTOR_KINDS[name];
    const y = await rng.integer(spec.radius + 8, FIELD_HEIGHT - spec.radius - 8, "actor_y");
    const x = PLAYER_RADIUS + 160 + await rng.integer(0, Math.max(1, span - 80), "actor_x");
    const phase = await rng.integer(0, 15, "actor_phase");
    const vy = name === "bat" ? await rng.integer(-1, 1, "actor_vy") : 0;
    actors.push({
      id: `a${index}`,
      kind: name,
      role: spec.role,
      x,
      y,
      vx: spec.vx,
      vy,
      amp: spec.amp,
      freq: spec.freq,
      phase,
      radius: spec.radius,
      power: spec.power + (spec.role === "hazard" ? bonus : 0),
    });
  }
  return { speed, tickCount: LEG_TICKS, actors };
}

/** @param {number} roll @param {number} index */
function kindForRoll(roll, index) {
  if (index === 0) return roll < 55 ? "heart" : "spark";
  if (roll < 34) return "shard";
  if (roll < 67) return "bat";
  return "boulder";
}

/**
 * @param {object} state
 * @param {{ y: number, dash: number }[]} inputs
 */
function assertInputs(state, inputs) {
  if (!Array.isArray(inputs) || inputs.length !== state.leg.tickCount) {
    throw invalidAction("That stretch does not match the current run");
  }
  let previous = state.player.y;
  for (const input of inputs) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw invalidAction("A flight input is malformed");
    const keys = Object.keys(input);
    if (keys.length !== 2 || !Object.hasOwn(input, "y") || !Object.hasOwn(input, "dash")) {
      throw invalidAction("A flight input is malformed");
    }
    if (!Number.isSafeInteger(input.y) || input.y < PLAYER_RADIUS || input.y > FIELD_HEIGHT - PLAYER_RADIUS) {
      throw invalidAction("The creature left the lane");
    }
    if (input.dash !== 0 && input.dash !== 1) throw invalidAction("Dash is not a valid command");
    if (Math.abs(input.y - previous) > MAX_DY) throw invalidAction("The creature cannot climb that fast");
    previous = input.y;
  }
}

/** @param {object} state */
function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    leg: state.leg
      ? { ...state.leg, actors: state.leg.actors.map((actor) => ({ ...actor })) }
      : null,
  };
}

export { KIND_NAMES };
