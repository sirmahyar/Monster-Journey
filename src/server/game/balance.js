/** Starting balance for the endless flight. Tuning values, not a finished design. */

export const FIELD_HEIGHT = 360;
export const PLAYER_X = 86;
export const PLAYER_RADIUS = 16;
export const MAX_DY = 26;
export const LEG_TICKS = 70;
export const TICK_MS = 40;
export const VIEW_WIDTH = 520;
export const ENERGY_REGEN_EVERY = 8;

export const INITIAL_PLAYER = Object.freeze({
  maxHp: 100,
  hp: 100,
  maxEnergy: 5,
  energy: 3,
  y: 180,
});

export const ACTOR_KINDS = Object.freeze({
  shard: Object.freeze({ role: "hazard", radius: 16, power: 12, vx: 0, amp: 46, freq: 1 }),
  bat: Object.freeze({ role: "hazard", radius: 18, power: 18, vx: -4, amp: 28, freq: 1 }),
  boulder: Object.freeze({ role: "hazard", radius: 28, power: 26, vx: 3, amp: 0, freq: 0 }),
  heart: Object.freeze({ role: "heal", radius: 12, power: 18, vx: 0, amp: 16, freq: 1 }),
  spark: Object.freeze({ role: "energy", radius: 12, power: 1, vx: -1, amp: 22, freq: 1 }),
});

export const LIMITS = Object.freeze({
  maxDistance: 5_000_000,
  maxHp: 1_000_000,
  maxEnergy: 200,
  maxRevision: 1_000_000,
  maxRngCounter: 5_000_000,
  maxTokenCharacters: 8192,
  maxActorPower: 80,
});

/** @param {number} distance */
export function speedFor(distance) {
  return Math.min(18, 8 + Math.floor(distance / 800));
}

/** @param {number} distance */
export function actorCountFor(distance) {
  return Math.min(8, 5 + Math.floor(distance / 1000));
}

/** @param {number} distance @param {string} role */
export function powerBonus(distance, role) {
  if (role !== "hazard") return 0;
  return Math.min(20, Math.floor(distance / 1500));
}
