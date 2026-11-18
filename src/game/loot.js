import { W, playerPity } from "./config.js";
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
  gem: Object.freeze({ r: 13, food: 0, score: 1800 }),
  haste: Object.freeze({ r: 13, food: 0, score: 250 }),
  magnet: Object.freeze({ r: 13, food: 0, score: 250 }),
  rocket: Object.freeze({ r: 14, food: 0, score: 400 }),
  feather: Object.freeze({ r: 15, food: 0, score: 220 }),
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
  if (meal < 0.012) return "pizza";
  if (meal < 0.028) return "burger";
  if (meal < 0.048) return "nugget";
  return e.r >= 24 && rng() < 0.22 ? "cob" : "kernel";
}

function crateWeapon(rng, player) {
  const choices = (player.weapons || WEAPON_ORDER).filter((w) => w !== player.weapon);
  if (choices.length === 0) return null;
  return pick(rng, choices);
}

function dropCuts(chapter, player) {
  const early = chapter <= 3 ? 0.9 : 1;
  const gift = 0.5;
  const scale = playerPity(player, chapter);
  const help = scale.drop;
  const widths = [
    0.012065 * early * gift * help,
    0.0076 * early * 0.85 * gift * help,
    0.0038 * early * 0.85 * gift * help,
    0,
    0.001425 * help,
    0.00151 * gift,
    0.0012 * gift,
    0.001 * gift,
    0.0016 * gift,
    0.00085 * gift,
  ];
  let cursor = 0;
  return widths.map((width) => {
    cursor += width;
    return cursor;
  });
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
    const goldenLife = playerPity(player, e.chapter || 1).goldenLife;
    if (rng() < goldenLife) out.push({ kind: "life" });
    return out;
  }
  if (e.carrier === "crate") {
    const weapon = crateWeapon(rng, player);
    if (weapon) out.push({ kind: "crate", weapon });
  }
  if (e.carrier === "power" || e.carrier === "shield" || e.carrier === "coolant" || e.carrier === "rocket" || e.carrier === "feather") {
    out.push({ kind: e.carrier });
  }
  const scale = playerPity(player, e.chapter || 1);
  const crateChance = Math.max(0.004, 0.01615 + scale.crateBonus);
  if ((player.weapons || WEAPON_ORDER).length > 1 && rng() < crateChance) {
    const weapon = crateWeapon(rng, player);
    if (weapon) out.push({ kind: "crate", weapon });
  }
  if (rng() < ENEMY_TYPES[e.kind].food) out.push({ kind: foodKind(e, rng) });
  const [power, coolant, shield, nova, life, gem, haste, magnet, rocket, feather] = dropCuts(e.chapter || 1, player);
  const roll = rng();
  if (roll < power) out.push({ kind: "power" });
  else if (roll < coolant) out.push({ kind: "coolant" });
  else if (roll < shield) out.push({ kind: "shield" });
  else if (roll < life) out.push({ kind: "life" });
  else if (roll < gem) out.push({ kind: "gem" });
  else if (roll < haste) out.push({ kind: "haste" });
  else if (roll < magnet) out.push({ kind: "magnet" });
  else if (roll < rocket && (e.chapter || 1) >= 4) out.push({ kind: "rocket" });
  else if (roll < feather) out.push({ kind: "feather" });
  return out;
}

export function bossLoot(rng, player) {
  const out = [{ kind: "power" }, { kind: "life" }];
  const bombs = rng() < 0.55 ? 1 : 2;
  for (let i = 0; i < bombs; i += 1) out.push({ kind: "nova" });
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
  if (player.alive && dist < (player.magnet > 0 ? 280 : 120)) {
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
