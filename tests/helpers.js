import { TOKEN_TTL_MS } from "../src/shared/protocol.js";
import { createInitialState } from "../src/server/game/engine.js";

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
export function routeState(gameId = "game-id-test-0001") {
  return createInitialState(gameId, {
    issuedAt: NOW,
    expiresAt: NOW + TOKEN_TTL_MS,
  });
}

/** @param {object} state */
export function freezeState(state) {
  Object.freeze(state.player);
  if (state.encounter) Object.freeze(state.encounter);
  for (const offer of state.rewardOffers) {
    Object.freeze(offer.effects);
    Object.freeze(offer);
  }
  Object.freeze(state.rewardOffers);
  return Object.freeze(state);
}

/**
 * @param {object} [overrides]
 */
export function combatState(overrides = {}) {
  const state = routeState();
  state.phase = "combat";
  state.player = { ...state.player, ...overrides.player };
  state.completedStages = overrides.completedStages ?? 0;
  state.encounter = {
    archetype: "forest_slime",
    route: "forest",
    maxHp: 45,
    hp: 45,
    attack: 9,
    defense: 2,
    intention: "attack",
    ...overrides.encounter,
  };
  return state;
}

/** @param {string} path @param {object} body @param {object} [config] */
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
