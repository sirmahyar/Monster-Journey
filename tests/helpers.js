import { TOKEN_TTL_MS } from "../src/shared/protocol.js";
import { ACTOR_KINDS, FIELD_HEIGHT, LEG_TICKS, PLAYER_RADIUS, speedFor } from "../src/server/game/balance.js";
import { createInitialState } from "../src/server/game/engine.js";
import { overlaps, screenPosition } from "../src/server/game/motion.js";

export const SIGNING_KEY = new Uint8Array(32).fill(11);
export const RNG_KEY = new Uint8Array(32).fill(23);
export const NOW = 1_700_000_000_000;

/** @param {number[]} values */
export function scriptedRng(values) {
  const queue = [...values];
  let counter = 0;
  return {
    get counter() {
      return counter;
    },
    async integer(min, max, purpose) {
      if (queue.length === 0) throw new Error(`RNG exhausted for ${purpose}`);
      const value = queue.shift();
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Scripted value ${value} is outside ${min}..${max} for ${purpose}`);
      }
      counter += 1;
      return value;
    },
  };
}

/** @param {string} [gameId] */
export function runState(gameId = "game-id-test-0001") {
  const state = createInitialState(gameId, {
    issuedAt: NOW,
    expiresAt: NOW + TOKEN_TTL_MS,
  });
  state.leg = sampleLeg();
  return state;
}

export function sampleLeg() {
  const specs = ["heart", "shard", "bat", "boulder", "spark"];
  return {
    speed: speedFor(0),
    tickCount: LEG_TICKS,
    actors: specs.map((kind, index) => {
      const spec = ACTOR_KINDS[kind];
      return {
        id: `a${index}`,
        kind,
        role: spec.role,
        x: 220 + index * 90,
        y: 40 + index * 60,
        vx: spec.vx,
        vy: 0,
        amp: spec.amp,
        freq: spec.freq,
        phase: index,
        radius: spec.radius,
        power: spec.power,
      };
    }),
  };
}

/** @param {object} state */
export function freezeState(state) {
  Object.freeze(state.player);
  if (state.leg) {
    for (const actor of state.leg.actors) Object.freeze(actor);
    Object.freeze(state.leg.actors);
    Object.freeze(state.leg);
  }
  return Object.freeze(state);
}

/**
 * A legal path that tries to miss hazards. Tests may import the motion module.
 * @param {object} state
 */
export function dodgeInputs(state) {
  const inputs = [];
  let y = state.player.y;
  for (let tick = 0; tick < state.leg.tickCount; tick += 1) {
    let chosen = null;
    for (let step = -26; step <= 26; step += 1) {
      const candidate = Math.min(FIELD_HEIGHT - PLAYER_RADIUS, Math.max(PLAYER_RADIUS, y + step));
      const blocked = state.leg.actors.some((actor) => {
        if (actor.role !== "hazard") return false;
        return overlaps(candidate, screenPosition(actor, tick, state.leg.speed), actor.radius);
      });
      if (!blocked) {
        chosen = candidate;
        break;
      }
    }
    const next = chosen ?? y;
    inputs.push({ y: next, dash: chosen === null ? 1 : 0 });
    y = next;
  }
  return inputs;
}

/** Straight line, used when a test places a hazard on the creature. */
export function holdInputs(y, ticks, dash = 0) {
  return Array.from({ length: ticks }, () => ({ y, dash }));
}

/** @param {string} path @param {object} body */
export function jsonRequest(path, body) {
  return new Request(`http://127.0.0.1:8787${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:5173",
    },
    body: JSON.stringify(body),
  });
}

/** @param {object} [config] */
export function apiConfig(config = {}) {
  let clock = NOW;
  return {
    signingKey: SIGNING_KEY,
    rngKey: RNG_KEY,
    allowedOrigin: "http://127.0.0.1:5173",
    now: () => {
      clock += 1000;
      return clock;
    },
    ...config,
  };
}
