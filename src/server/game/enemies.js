import {
  ATTACK_SCALE_PERCENT_PER_STAGE,
  CAVE_HP_BONUS_DENOMINATOR,
  CAVE_HP_BONUS_NUMERATOR,
  DEFENSE_STAGE_INTERVAL,
  HP_SCALE_PERCENT_PER_STAGE,
  LIMITS,
} from "./balance.js";
import { ceilDiv } from "./math.js";
import { numericLimit } from "../errors.js";

export const ARCHETYPES = Object.freeze({
  forest_slime: Object.freeze({
    id: "forest_slime",
    hp: 45,
    attack: 9,
    defense: 2,
    intentions: Object.freeze([
      Object.freeze({ type: "attack", weight: 70 }),
      Object.freeze({ type: "heavy_attack", weight: 10 }),
      Object.freeze({ type: "recover", weight: 20 }),
    ]),
  }),
  cave_bat: Object.freeze({
    id: "cave_bat",
    hp: 34,
    attack: 13,
    defense: 1,
    intentions: Object.freeze([
      Object.freeze({ type: "attack", weight: 70 }),
      Object.freeze({ type: "heavy_attack", weight: 25 }),
      Object.freeze({ type: "recover", weight: 5 }),
    ]),
  }),
  stone_golem: Object.freeze({
    id: "stone_golem",
    hp: 55,
    attack: 11,
    defense: 5,
    intentions: Object.freeze([
      Object.freeze({ type: "attack", weight: 40 }),
      Object.freeze({ type: "heavy_attack", weight: 45 }),
      Object.freeze({ type: "recover", weight: 15 }),
    ]),
  }),
});

export const ROUTE_POOLS = Object.freeze({
  forest: Object.freeze(["forest_slime", "cave_bat"]),
  cave: Object.freeze(["cave_bat", "stone_golem"]),
});

export const INTENTIONS = Object.freeze(["attack", "heavy_attack", "recover"]);

/**
 * Stage scaling, then the cave health bonus.
 * Rounded upward with integer division.
 * @param {string} archetypeId
 * @param {number} stage
 * @param {"forest" | "cave"} route
 */
export function scaleEnemy(archetypeId, stage, route) {
  const base = ARCHETYPES[archetypeId];
  if (!base) throw numericLimit("Unknown enemy archetype");
  if (!Number.isSafeInteger(stage) || stage < 1 || stage > LIMITS.maxCompletedStages + 1) {
    throw numericLimit("Stage left the supported range");
  }
  const past = stage - 1;
  const hpFactor = 100 + HP_SCALE_PERCENT_PER_STAGE * past;
  const attackFactor = 100 + ATTACK_SCALE_PERCENT_PER_STAGE * past;
  const hpProduct = base.hp * hpFactor;
  const attackProduct = base.attack * attackFactor;
  if (!Number.isSafeInteger(hpProduct) || !Number.isSafeInteger(attackProduct)) {
    throw numericLimit("Enemy scaling left the supported integer range");
  }
  let maxHp = ceilDiv(hpProduct, 100);
  const attack = ceilDiv(attackProduct, 100);
  const defense = base.defense + Math.floor(past / DEFENSE_STAGE_INTERVAL);
  if (route === "cave") {
    const boosted = maxHp * CAVE_HP_BONUS_NUMERATOR;
    if (!Number.isSafeInteger(boosted)) {
      throw numericLimit("Enemy scaling left the supported integer range");
    }
    maxHp = ceilDiv(boosted, CAVE_HP_BONUS_DENOMINATOR);
  }
  if (
    maxHp > LIMITS.maxHp ||
    attack > LIMITS.maxAttack ||
    defense > LIMITS.maxDefense ||
    !Number.isSafeInteger(defense)
  ) {
    throw numericLimit("Enemy stats would leave the supported range");
  }
  return { maxHp, hp: maxHp, attack, defense };
}
