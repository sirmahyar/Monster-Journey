import { SCHEMA_VERSION, RULES_VERSION, TOKEN_TTL_MS } from "../../shared/protocol.js";
import {
  ACTOR_KINDS,
  FIELD_HEIGHT,
  LEG_TICKS,
  LIMITS,
  PLAYER_RADIUS,
  actorCountFor,
  powerBonus,
  speedFor,
} from "../game/balance.js";
import { invalidToken, unsupportedVersion } from "../errors.js";

const STATE_KEYS = [
  "schemaVersion",
  "rulesVersion",
  "gameId",
  "revision",
  "rngCounter",
  "issuedAt",
  "expiresAt",
  "phase",
  "distance",
  "player",
  "leg",
];

const PLAYER_KEYS = ["maxHp", "hp", "maxEnergy", "energy", "y"];
const LEG_KEYS = ["speed", "tickCount", "actors"];
const ACTOR_KEYS = ["id", "kind", "role", "x", "y", "vx", "vy", "amp", "freq", "phase", "radius", "power"];

/**
 * Structural checks for a parsed token payload.
 * Expiry is checked by the caller so resume and action share one clock policy.
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
  if (state.phase !== "run" && state.phase !== "game_over") throw invalidToken();
  assertInt(state.distance, 0, LIMITS.maxDistance);
  assertPlayer(state.player);

  if (state.phase === "run") {
    if (state.player.hp <= 0) throw invalidToken();
    assertLeg(state.leg, state.distance);
    return;
  }

  if (state.player.hp !== 0 || state.leg !== null) throw invalidToken();
}

/** @param {object} player */
function assertPlayer(player) {
  if (!isPlainObject(player)) throw invalidToken();
  assertExactKeys(player, PLAYER_KEYS);
  assertInt(player.maxHp, 1, LIMITS.maxHp);
  assertInt(player.hp, 0, player.maxHp);
  assertInt(player.maxEnergy, 1, LIMITS.maxEnergy);
  assertInt(player.energy, 0, player.maxEnergy);
  assertInt(player.y, PLAYER_RADIUS, FIELD_HEIGHT - PLAYER_RADIUS);
}

/**
 * @param {unknown} leg
 * @param {number} distance
 */
function assertLeg(leg, distance) {
  if (!isPlainObject(leg)) throw invalidToken();
  assertExactKeys(leg, LEG_KEYS);
  if (leg.speed !== speedFor(distance)) throw invalidToken();
  if (leg.tickCount !== LEG_TICKS) throw invalidToken();
  if (!Array.isArray(leg.actors) || leg.actors.length !== actorCountFor(distance)) throw invalidToken();
  const seen = new Set();
  leg.actors.forEach((actor, index) => {
    if (!isPlainObject(actor)) throw invalidToken();
    assertExactKeys(actor, ACTOR_KEYS);
    if (actor.id !== `a${index}` || seen.has(actor.id)) throw invalidToken();
    seen.add(actor.id);
    const spec = ACTOR_KINDS[actor.kind];
    if (!spec || actor.role !== spec.role || actor.radius !== spec.radius) throw invalidToken();
    if (actor.vx !== spec.vx || actor.amp !== spec.amp || actor.freq !== spec.freq) throw invalidToken();
    const bonus = powerBonus(distance, actor.role);
    if (actor.power !== spec.power + bonus) throw invalidToken();
    assertInt(actor.x, 0, 8_000);
    assertInt(actor.y, spec.radius, FIELD_HEIGHT - spec.radius);
    assertInt(actor.vy, -1, 1);
    if (actor.kind !== "bat" && actor.vy !== 0) throw invalidToken();
    assertInt(actor.phase, 0, 15);
  });
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
