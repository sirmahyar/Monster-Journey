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

export const HEAT = Object.freeze({
  max: 100,
  coolIdle: 70,
  coolFiring: 6,
  coolLocked: 36,
  unlockAt: 28,
});

export const FOOD_PER_BOMB = 120;
export const COMBO_WINDOW = 1.5;
export const MAX_COMBO_MULT = 10;
export const EGG_GRAVITY = 320;
export const EGG_MAX_FALL = 440;
export const FLOOR_Y = H - 16;
