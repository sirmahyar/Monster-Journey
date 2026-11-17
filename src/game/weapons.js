import { clamp } from "./math.js";

export const MAX_LEVEL = 6;

export const WEAPONS = Object.freeze({
  pulse: Object.freeze({ name: "Pulse Blaster", short: "PULSE", rate: 0.115, heat: 2.3, color: "#ff7a3d" }),
  laser: Object.freeze({ name: "Photon Lance", short: "LANCE", rate: 0.08, heat: 1.6, color: "#5cf2ff" }),
  ion: Object.freeze({ name: "Ion Seeker", short: "ION", rate: 0.19, heat: 3.8, color: "#c08cff" }),
});

export const WEAPON_ORDER = Object.freeze(["pulse", "laser", "ion"]);

/** Primary weapons available when a chapter begins. Later guns stay locked until then. */
export function arsenal(chapter) {
  const weapons = ["pulse"];
  if (chapter >= 2) weapons.push("laser");
  if (chapter >= 3) weapons.push("ion");
  return weapons;
}

/** The new toy granted on arrival in this chapter. Chapter 1 is the starting loadout. */
export function chapterGift(chapter) {
  if (chapter === 2) return "laser";
  if (chapter === 3) return "ion";
  if (chapter === 4) return "rocket";
  return "";
}

export function rocketsUnlocked(chapter) {
  return chapter >= 4;
}

const DEG = Math.PI / 180;

const PULSE_FAN = [
  [0],
  [-2.5, 2.5],
  [-6, 0, 6],
  [-9, -3, 3, 9],
  [-12, -6, 0, 6, 12],
  [-18, -12, -6, 0, 6, 12, 18],
];

const ION_COUNT = [1, 2, 2, 3, 4, 5];

function shot(kind, x, y, angleDeg, speed, dmg, r, extra) {
  const angle = -Math.PI / 2 + angleDeg * DEG;
  return {
    kind,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dmg,
    r,
    pierce: 0,
    homing: 0,
    life: 1.4,
    ...extra,
  };
}

/**
 * Builds the projectiles of one trigger pull.
 * @param {"pulse"|"laser"|"ion"} type
 * @param {number} level 1..MAX_LEVEL
 */
export function volley(type, level, x, y) {
  const lv = clamp(Math.round(level), 1, MAX_LEVEL);
  const out = [];
  if (type === "laser") {
    const dmg = 0.62 + 0.12 * lv;
    const pierce = 1 + Math.floor(lv / 2);
    out.push(shot("lance", x, y - 24, 0, 1350, dmg, 3 + lv * 0.8, { pierce, life: 0.9, level: lv }));
    if (lv >= 3) {
      for (const side of [-1, 1]) {
        out.push(shot("lance", x + side * 15, y - 14, side * 1.2, 1350, dmg * 0.7, 2.5 + lv * 0.4, { pierce, life: 0.9, level: lv }));
      }
    }
    if (lv >= 5) {
      for (const side of [-1, 1]) {
        out.push(shot("lance", x + side * 28, y - 6, side * 4, 1300, dmg * 0.7, 2.5 + lv * 0.4, { pierce, life: 0.9, level: lv }));
      }
    }
    return out;
  }
  if (type === "ion") {
    const count = ION_COUNT[lv - 1];
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      out.push(
        shot("ion", x + t * 34, y - 16, t * 34, 560, 1.7 + 0.15 * lv, 7 + lv * 0.5, {
          homing: 3.2 + 0.4 * lv,
          life: 2.4,
          level: lv,
        }),
      );
    }
    return out;
  }
  const big = lv >= 4 ? 1 : 0;
  for (const angle of PULSE_FAN[lv - 1]) {
    out.push(shot("pulse", x + angle * 1.6, y - 20, angle, 980, 1 + big * 0.15, 5 + big, { life: 1.2, level: lv }));
  }
  return out;
}

/** Damage per second against one large target, used by tests and balancing. */
export function focusedDps(type, level) {
  const total = volley(type, level, 0, 0).reduce((sum, s) => sum + s.dmg, 0);
  return total / WEAPONS[type].rate;
}
