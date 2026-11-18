import { W } from "./config.js";
import { ENEMY_TYPES } from "./enemies.js";
import { clamp, lerp, pick, rand } from "./math.js";
import { WEAPON_ORDER } from "./weapons.js";

export const PICKUPS = Object.freeze({
  kernel: Object.freeze({ r: 9, food: 1, score: 25 }),
  nugget: Object.freeze({ r: 13, food: 3, score: 75 }),
  burger: Object.freeze({ r: 16, food: 6, score: 150 }),
  pizza: Object.freeze({ r: 16, food: 8, score: 200 }),
  cob: Object.freeze({ r: 13, food: 5, score: 150 }),
  power: Object.freeze({ r: 14, food: 0, score: 500 }),
  crate: Object.freeze({ r: 17, food: 0, score: 300 }),
  shield: Object.freeze({ r: 14, food: 0, score: 300 }),
  nova: Object.freeze({ r: 14, food: 0, score: 300 }),
  coolant: Object.freeze({ r: 13, food: 0, score: 200 }),
  life: Object.freeze({ r: 15, food: 0, score: 1000 }),
});

export function makePickup(kind, x, y, rng, extra = {}) {
  return {
    kind,
    x,
    y,
    vx: rand(rng, -70, 70),
    vy: rand(rng, -170, -70),
    r: PICKUPS[kind].r,
    t: 0,
    spin: rand(rng, -3, 3),
    angle: 0,
    ...extra,
  };
}

/** A few chickens leave a meal worth several coins instead of one coin. */
function foodKind(e, rng) {
  const meal = rng();
  if (meal < 0.008) return "pizza";
  if (meal < 0.02) return "burger";
  if (meal < 0.035) return "nugget";
  return e.r >= 24 && rng() < 0.22 ? "cob" : "kernel";
}

function crateWeapon(rng, player) {
  const choices = (player.weapons || WEAPON_ORDER).filter((w) => w !== player.weapon);
  if (choices.length === 0) return null;
  return pick(rng, choices);
}

/** What a destroyed enemy leaves behind. */
export function rollDrops(e, rng, player) {
  const out = [];
  if (e.kind === "golden") {
    out.push({ kind: "power" });
    const weapon = crateWeapon(rng, player);
    if (weapon) out.push({ kind: "crate", weapon });
    out.push({ kind: "cob" }, { kind: "cob" });
    for (let i = 0; i < 6; i += 1) out.push({ kind: "kernel" });
    if (rng() < 0.3) out.push({ kind: "life" });
    return out;
  }
  if (e.carrier === "crate") {
    const weapon = crateWeapon(rng, player);
    if (weapon) out.push({ kind: "crate", weapon });
  }
  if (e.carrier === "power") out.push({ kind: "power" });
  if ((player.weapons || WEAPON_ORDER).length > 1 && rng() < 0.05) {
    const weapon = crateWeapon(rng, player);
    if (weapon) out.push({ kind: "crate", weapon });
  }
  if (rng() < ENEMY_TYPES[e.kind].food) out.push({ kind: foodKind(e, rng) });
  const roll = rng();
  if (roll < 0.016) out.push({ kind: "power" });
  else if (roll < 0.024) out.push({ kind: "coolant" });
  else if (roll < 0.029) out.push({ kind: "shield" });
  else if (roll < 0.033) out.push({ kind: "nova" });
  else if (roll < 0.0345) out.push({ kind: "life" });
  return out;
}

export function bossLoot(rng, player) {
  const out = [{ kind: "power" }, { kind: "life" }, { kind: "nova" }];
  const weapon = crateWeapon(rng, player);
  if (weapon) out.push({ kind: "crate", weapon });
  for (let i = 0; i < 4; i += 1) out.push({ kind: "cob" });
  for (let i = 0; i < 12; i += 1) out.push({ kind: "kernel" });
  return out;
}

/** Pickups pop up, drift down and get pulled in when the ship is close. */
export function updatePickup(k, dt, player) {
  k.t += dt;
  k.angle += k.spin * dt;
  const dx = player.x - k.x;
  const dy = player.y - k.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (k.t > 0.35 && player.alive && dist < 120) {
    const speed = 440;
    const blend = Math.min(1, dt * 7);
    k.vx = lerp(k.vx, (dx / dist) * speed, blend);
    k.vy = lerp(k.vy, (dy / dist) * speed, blend);
  } else {
    k.vy = Math.min(150, k.vy + 240 * dt);
    k.vx *= 1 - Math.min(1, dt * 1.5);
    k.x += Math.sin(k.t * 3 + k.spin) * 22 * dt;
  }
  k.x = clamp(k.x + k.vx * dt, 10, W - 10);
  k.y += k.vy * dt;
}
