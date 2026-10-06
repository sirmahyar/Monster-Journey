import {
  ARMOR_DEFENSE,
  CAVE_REWARD_DENOMINATOR,
  CAVE_REWARD_NUMERATOR,
  ENERGY_REWARD,
  POWER_ATTACK,
  SUPPLIES_HP,
  SUPPLIES_POTIONS,
  VITALITY_HP,
} from "./balance.js";
import { ceilDiv } from "./math.js";

export const REWARD_CATEGORIES = Object.freeze([
  "vitality",
  "power",
  "armor",
  "energy",
  "supplies",
]);

const BASE_EFFECTS = Object.freeze({
  vitality: Object.freeze({ maxHp: VITALITY_HP, hp: VITALITY_HP }),
  power: Object.freeze({ attack: POWER_ATTACK }),
  armor: Object.freeze({ defense: ARMOR_DEFENSE }),
  energy: Object.freeze({ maxEnergy: ENERGY_REWARD, energy: ENERGY_REWARD }),
  supplies: Object.freeze({ potions: SUPPLIES_POTIONS, hp: SUPPLIES_HP }),
});

/**
 * Cave rewards multiply every positive numeric effect by 3/2 and round upward.
 * @param {string} category
 * @param {boolean} cave
 */
export function effectsFor(category, cave) {
  const base = BASE_EFFECTS[category];
  if (!base) throw new Error("Unknown reward category");
  const effects = {};
  for (const [key, value] of Object.entries(base)) {
    effects[key] = cave ? ceilDiv(value * CAVE_REWARD_NUMERATOR, CAVE_REWARD_DENOMINATOR) : value;
  }
  return effects;
}
