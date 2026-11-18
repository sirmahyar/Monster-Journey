import { clamp } from "./math.js";

export const MAX_LEVEL = 6;

export const WEAPONS = Object.freeze({
  pulse: Object.freeze({ name: "Pulse Blaster", short: "PULSE", rate: 0.115, heat: 1.15, color: "#ff7a3d" }),
  laser: Object.freeze({ name: "Photon Lance", short: "LANCE", rate: 0.08, heat: 0.8, color: "#5cf2ff" }),
  ion: Object.freeze({ name: "Ion Seeker", short: "ION", rate: 0.19, heat: 1.9, color: "#c08cff" }),
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
  [-1.4, 1.4],
  [-2.6, 0, 2.6],
  [-3.6, -1.2, 1.2, 3.6],
  [-4.4, -2.2, 0, 2.2, 4.4],
  [-5.2, -3.2, -1.2, 0, 1.2, 3.2, 5.2],
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
export function volley(type, level, x, y, _phase = 0) {
  const lv = clamp(Math.round(level), 1, MAX_LEVEL);
  const out = [];
  if (type === "laser") {
    const dmg = 0.62 + 0.12 * lv;
    const pierce = 1 + Math.floor(lv / 2);
    out.push(shot("lance", x, y - 24, 0, 1350, dmg, 3 + lv * 0.8, { pierce, life: 0.9, level: lv }));
    if (lv >= 3) {
      for (const side of [-1, 1]) {
        out.push(shot("lance", x + side * 16, y - 16, side * 2.2, 1350, dmg * 0.7, 2.4 + lv * 0.35, { pierce, life: 0.9, level: Math.max(1, lv - 2) }));
      }
    }
    if (lv >= 5) {
      for (const side of [-1, 1]) {
        out.push(shot("lance", x + side * 30, y - 8, side * 4.2, 1320, dmg * 0.7, 2.2 + lv * 0.3, { pierce, life: 0.85, level: Math.max(1, lv - 3) }));
      }
    }
    return out;
  }
  if (type === "ion") {
    const count = ION_COUNT[lv - 1];
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      out.push(shot("ion", x + t * 28, y - 16, t * 16, 560, 1.7 + 0.15 * lv, 7 + lv * 0.5, {
        homing: 3.2 + 0.4 * lv,
        life: 2.4,
        level: lv,
      }));
    }
    return out;
  }
  const big = lv >= 4 ? 1 : 0;
  for (const angle of PULSE_FAN[lv - 1]) {
    const heavy = angle === 0 && lv >= 4;
    out.push(shot("pulse", x + angle * 1.2, y - 20, angle, heavy ? 860 : 980, heavy ? 1.45 : 1 + big * 0.15, heavy ? 7 : 5 + big, { life: 1.2, level: lv }));
  }
  return out;
}

/** Damage per second against one large target, used by tests and balancing. */
export function focusedDps(type, level) {
  const total = volley(type, level, 0, 0).reduce((sum, s) => sum + s.dmg, 0);
  return total / WEAPONS[type].rate;
}
