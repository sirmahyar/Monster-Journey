export const W = 720;
export const H = 960;
export const STEP = 1 / 60;

export const CHAPTER_COUNT = 10;

/** Extra help when the run is on its last ship(s); off in the final two chapters. */
export function playerPity(player, chapter) {
  if (chapter >= CHAPTER_COUNT - 1 || !player || player.lives > 2) return null;
  return player.lives === 1
    ? { drop: 2.45, gift: 2.15, carrierRare: 2.6, powerWave: 1.7, marked: 1.8, goldenLife: 0.55, crateBonus: 0.038 }
    : { drop: 1.72, gift: 1.52, carrierRare: 1.9, powerWave: 1.38, marked: 1.42, goldenLife: 0.42, crateBonus: 0.024 };
}
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
