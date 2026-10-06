import { SCHEMA_VERSION, RULES_VERSION, TOKEN_TTL_MS } from "../../shared/protocol.js";
import { LIMITS } from "../game/balance.js";
import { INTENTIONS, ROUTE_POOLS, scaleEnemy } from "../game/enemies.js";
import { REWARD_CATEGORIES, effectsFor } from "../game/upgrades.js";
import { GameError, invalidToken, unsupportedVersion } from "../errors.js";

const STATE_KEYS = [
  "schemaVersion",
  "rulesVersion",
  "gameId",
  "revision",
  "rngCounter",
  "issuedAt",
  "expiresAt",
  "phase",
  "completedStages",
  "player",
  "encounter",
  "rewardOffers",
];

const PLAYER_KEYS = ["maxHp", "hp", "attack", "defense", "maxEnergy", "energy", "potions"];
const ENCOUNTER_KEYS = ["archetype", "route", "maxHp", "hp", "attack", "defense", "intention"];
const OFFER_KEYS = ["id", "category", "effects"];

/**
 * Structural and balance checks for a parsed token payload.
 * Expiry is checked separately so resume and action share one clock policy.
 * @param {unknown} state
 */
export function assertValidState(state) {
  if (!isPlainObject(state)) throw invalidToken();
  if (typeof state.schemaVersion !== "number" || typeof state.rulesVersion !== "number") {
    throw invalidToken();
  }
  if (state.schemaVersion !== SCHEMA_VERSION || state.rulesVersion !== RULES_VERSION) {
    throw unsupportedVersion();
  }
  assertExactKeys(state, STATE_KEYS);
  if (typeof state.gameId !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(state.gameId)) {
    throw invalidToken();
  }
  assertInt(state.revision, 0, LIMITS.maxRevision);
  assertInt(state.rngCounter, 0, LIMITS.maxRngCounter);
  assertInt(state.issuedAt, 0, Number.MAX_SAFE_INTEGER);
  assertInt(state.expiresAt, 0, Number.MAX_SAFE_INTEGER);
  if (state.expiresAt !== state.issuedAt + TOKEN_TTL_MS) throw invalidToken();
  if (!["route", "combat", "reward", "game_over"].includes(state.phase)) throw invalidToken();
  assertInt(state.completedStages, 0, LIMITS.maxCompletedStages);
  assertPlayer(state.player);

  if (state.phase === "route") {
    if (state.encounter !== null || !Array.isArray(state.rewardOffers) || state.rewardOffers.length !== 0) {
      throw invalidToken();
    }
    if (state.player.hp <= 0) throw invalidToken();
    return;
  }

  if (state.phase === "combat") {
    assertEncounter(state.encounter, state.completedStages, "positive");
    if (!Array.isArray(state.rewardOffers) || state.rewardOffers.length !== 0) throw invalidToken();
    if (state.player.hp <= 0) throw invalidToken();
    return;
  }

  if (state.phase === "reward") {
    assertEncounter(state.encounter, state.completedStages, "zero");
    assertOffers(state.rewardOffers, state.encounter.route);
    if (state.player.hp <= 0) throw invalidToken();
    return;
  }

  if (state.player.hp !== 0) throw invalidToken();
  assertEncounter(state.encounter, state.completedStages, "positive");
  if (!Array.isArray(state.rewardOffers) || state.rewardOffers.length !== 0) throw invalidToken();
}

/** @param {object} player */
function assertPlayer(player) {
  if (!isPlainObject(player)) throw invalidToken();
  assertExactKeys(player, PLAYER_KEYS);
  assertInt(player.maxHp, 1, LIMITS.maxHp);
  assertInt(player.hp, 0, player.maxHp);
  assertInt(player.attack, 1, LIMITS.maxAttack);
  assertInt(player.defense, 0, LIMITS.maxDefense);
  assertInt(player.maxEnergy, 1, LIMITS.maxEnergy);
  assertInt(player.energy, 0, player.maxEnergy);
  assertInt(player.potions, 0, LIMITS.maxPotions);
}

/**
 * @param {unknown} encounter
 * @param {number} completedStages
 * @param {"positive" | "zero"} hpRule
 */
function assertEncounter(encounter, completedStages, hpRule) {
  if (!isPlainObject(encounter)) throw invalidToken();
  assertExactKeys(encounter, ENCOUNTER_KEYS);
  if (encounter.route !== "forest" && encounter.route !== "cave") throw invalidToken();
  const pool = ROUTE_POOLS[encounter.route];
  if (!pool.includes(encounter.archetype)) throw invalidToken();
  if (!INTENTIONS.includes(encounter.intention)) throw invalidToken();
  let expected;
  try {
    expected = scaleEnemy(encounter.archetype, completedStages + 1, encounter.route);
  } catch (error) {
    if (error instanceof GameError) throw invalidToken();
    throw error;
  }
  if (
    encounter.maxHp !== expected.maxHp ||
    encounter.attack !== expected.attack ||
    encounter.defense !== expected.defense
  ) {
    throw invalidToken();
  }
  assertInt(encounter.hp, 0, encounter.maxHp);
  if (hpRule === "zero" && encounter.hp !== 0) throw invalidToken();
  if (hpRule === "positive" && encounter.hp <= 0) throw invalidToken();
}

/**
 * @param {unknown} offers
 * @param {"forest" | "cave"} route
 */
function assertOffers(offers, route) {
  if (!Array.isArray(offers) || offers.length !== 3) throw invalidToken();
  const seen = new Set();
  for (const offer of offers) {
    if (!isPlainObject(offer)) throw invalidToken();
    assertExactKeys(offer, OFFER_KEYS);
    if (!REWARD_CATEGORIES.includes(offer.category) || offer.id !== offer.category) throw invalidToken();
    if (seen.has(offer.category)) throw invalidToken();
    seen.add(offer.category);
    if (!isPlainObject(offer.effects)) throw invalidToken();
    const expected = effectsFor(offer.category, route === "cave");
    const actualKeys = Object.keys(offer.effects).sort();
    const expectedKeys = Object.keys(expected).sort();
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      throw invalidToken();
    }
    for (const key of expectedKeys) {
      if (offer.effects[key] !== expected[key]) throw invalidToken();
    }
  }
}

/**
 * @param {object} value
 * @param {string[]} keys
 */
function assertExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw invalidToken();
  }
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 */
function assertInt(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw invalidToken();
}

/** @param {unknown} value */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
