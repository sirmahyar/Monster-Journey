export const W = 720;
export const H = 960;
export const STEP = 1 / 60;

export const CHAPTER_COUNT = 10;
export const WAVES_PER_CHAPTER = 8;

export const PLAYER = Object.freeze({
  radius: 13,
  keySpeed: 470,
  pointerSpeed: 1250,
  minY: 140,
  maxY: H - 48,
  startY: H - 130,
  respawnDelay: 1.6,
  invuln: 2.6,
  lives: 3,
  bombs: 1,
  maxLives: 5,
  maxBombs: 5,
});

const LOOT_NEUTRAL = Object.freeze({
  drop: 1,
  gift: 1,
  carrierRare: 1,
  powerWave: 1,
  marked: 1,
  goldenLife: 0.3,
  crateBonus: 0,
});

/** Pendulum loot: more help at 1–2 ships, less at 4–5; unchanged in the last two chapters. */
export function playerPity(player, chapter) {
  if (chapter >= CHAPTER_COUNT - 1 || !player) return LOOT_NEUTRAL;
  if (player.lives <= 2) {
    return player.lives === 1
      ? { drop: 2.45, gift: 2.15, carrierRare: 2.6, powerWave: 1.7, marked: 1.8, goldenLife: 0.55, crateBonus: 0.038 }
      : { drop: 1.72, gift: 1.52, carrierRare: 1.9, powerWave: 1.38, marked: 1.42, goldenLife: 0.42, crateBonus: 0.024 };
  }
  if (player.lives >= 4) {
    return player.lives >= PLAYER.maxLives
      ? { drop: 0.5, gift: 0.56, carrierRare: 0.46, powerWave: 0.68, marked: 0.6, goldenLife: 0.09, crateBonus: -0.01 }
      : { drop: 0.68, gift: 0.73, carrierRare: 0.64, powerWave: 0.78, marked: 0.72, goldenLife: 0.15, crateBonus: -0.005 };
  }
  return LOOT_NEUTRAL;
}

export const HEAT = Object.freeze({
  max: 100,
  coolIdle: 70,
  coolFiring: 6,
  coolLocked: 36,
  unlockAt: 28,
  fireGain: 2.3958,
});

export const FOOD_PER_BOMB = 120;
export const COMBO_WINDOW = 1.5;
export const MAX_COMBO_MULT = 10;
export const EGG_GRAVITY = 320;
export const EGG_MAX_FALL = 440;
export const FLOOR_Y = H - 16;
