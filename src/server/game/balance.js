/** Starting balance. These are tuning values, not a claim of finished design. */

export const INITIAL_PLAYER = Object.freeze({
  maxHp: 100,
  hp: 100,
  attack: 14,
  defense: 4,
  maxEnergy: 5,
  energy: 3,
  potions: 2,
});

export const SPECIAL_ENERGY_COST = 3;
export const ATTACK_ENERGY_GAIN = 1;
export const DEFEND_ENERGY_GAIN = 2;
export const POTION_HEAL_PERCENT = 35;
export const SPRING_HEAL_PERCENT = 30;
export const SPRING_ENERGY_GAIN = 2;
export const SPRING_EVERY_N_STAGES = 3;
export const ENEMY_RECOVER_PERCENT = 10;
export const CAVE_HP_BONUS_NUMERATOR = 120;
export const CAVE_HP_BONUS_DENOMINATOR = 100;
export const CAVE_REWARD_NUMERATOR = 3;
export const CAVE_REWARD_DENOMINATOR = 2;
export const HP_SCALE_PERCENT_PER_STAGE = 12;
export const ATTACK_SCALE_PERCENT_PER_STAGE = 8;
export const DEFENSE_STAGE_INTERVAL = 4;
export const DAMAGE_VARIANCE = 2;
export const OFFER_COUNT = 3;

export const VITALITY_HP = 15;
export const POWER_ATTACK = 3;
export const ARMOR_DEFENSE = 2;
export const ENERGY_REWARD = 1;
export const SUPPLIES_POTIONS = 1;
export const SUPPLIES_HP = 10;

/**
 * Hard stops so a very long run cannot drift into unsafe Number arithmetic.
 * Crossing one rejects the action instead of wrapping or losing precision.
 */
export const LIMITS = Object.freeze({
  maxCompletedStages: 5000,
  maxHp: 1_000_000,
  maxAttack: 100_000,
  maxDefense: 100_000,
  maxEnergy: 200,
  maxPotions: 500,
  maxRevision: 1_000_000,
  maxRngCounter: 5_000_000,
  maxTokenCharacters: 8192,
});
