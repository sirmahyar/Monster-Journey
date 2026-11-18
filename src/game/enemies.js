import { H, W } from "./config.js";
import { bezier, clamp, lerp, rand } from "./math.js";

export const ENEMY_TYPES = Object.freeze({
  chick: Object.freeze({ r: 16, hp: 2, score: 100, egg: "egg", eggWeight: 0.45, food: 0.3, dive: 0.4 }),
  hen: Object.freeze({ r: 24, hp: 5, score: 200, egg: "egg", eggWeight: 1, food: 0.55, dive: 0.25 }),
  diver: Object.freeze({ r: 24, hp: 5, score: 300, egg: "egg", eggWeight: 0.55, food: 0.55, dive: 3 }),
  bomber: Object.freeze({ r: 26, hp: 8, score: 350, egg: "yolk", eggWeight: 0.75, food: 0.7, dive: 0.15 }),
  rooster: Object.freeze({ r: 30, hp: 14, score: 500, egg: "quill", eggWeight: 0.9, food: 0.85, dive: 0.6 }),
  saucer: Object.freeze({ r: 30, hp: 7, score: 650, egg: "spark", eggWeight: 1.3, food: 0.8, dive: 0, shield: 8 }),
  golden: Object.freeze({ r: 26, hp: 30, score: 2500, egg: null, eggWeight: 0, food: 1, dive: 0 }),
  rock: Object.freeze({ r: 38, hp: 16, score: 150, egg: null, eggWeight: 0, food: 0.12, dive: 0 }),
});

export const ROCK_SIZES = Object.freeze({
  1: Object.freeze({ r: 21, hp: 3, score: 50 }),
  2: Object.freeze({ r: 33, hp: 8, score: 100 }),
  3: Object.freeze({ r: 48, hp: 16, score: 150 }),
});

export function hpScale(chapter) {
  const steady = 1 + 0.4 * (chapter - 1);
  if (chapter < 3) return steady;
  return steady + 0.7 * (chapter - 2);
}

/**
 * @param {number} id
 * @param {keyof ENEMY_TYPES} kind
 * @param {number} chapter
 * @param {Record<string, any>} fields
 */
export function makeEnemy(id, kind, chapter, fields = {}) {
  const base = kind === "rock" ? ROCK_SIZES[fields.size || 3] : ENEMY_TYPES[kind];
  const hp = Math.round(base.hp * hpScale(chapter) * 10) / 10;
  const shield = ENEMY_TYPES[kind].shield ? Math.round(ENEMY_TYPES[kind].shield * hpScale(chapter)) : 0;
  const enemy = {
    id,
    kind,
    chapter,
    r: base.r,
    hp,
    maxHp: hp,
    score: base.score,
    shield,
    maxShield: shield,
    x: -200,
    y: -200,
    vx: 0,
    vy: 0,
    t: 0,
    clock: 0,
    phase: 0,
    variant: 0,
    flash: 0,
    angle: 0,
    spin: 0,
    mode: "home",
    home: "formation",
    slotX: W / 2,
    slotY: 160,
    delay: 0,
    hidden: false,
    gone: false,
    carrier: null,
    ...fields,
  };
  if (enemy.mode === "enter" && enemy.path) {
    enemy.x = enemy.path[0];
    enemy.y = enemy.path[1];
    enemy.pathT = 0;
  }
  return enemy;
}

function snakePoint(e) {
  const s = (e.clock - e.lag) * e.speed;
  if (s < 0) return { x: e.dir > 0 ? -90 : W + 90, y: e.top, hidden: true };
  const lane = W + 180;
  const row = Math.floor(s / lane) % e.rows;
  const f = s % lane;
  const right = (row % 2 === 0) === e.dir > 0;
  return {
    x: right ? -90 + f : W + 90 - f,
    y: e.top + row * e.rowGap + Math.sin(s * 0.025 + e.phase) * 16,
    hidden: false,
  };
}

/** Where an enemy wants to be in its settled behaviour. */
export function anchor(e, world) {
  const f = world.formation;
  switch (e.home) {
    case "orbit": {
      const angle = e.angle0 + e.orbitSpin * e.clock;
      const radius = e.radius + Math.sin(e.clock * 1.4 + e.phase) * (e.pulse || 0);
      return {
        x: e.cx + f.ox + Math.cos(angle) * radius,
        y: e.cy + f.oy + Math.sin(angle) * radius * (e.squash || 1),
      };
    }
    case "swirl":
      return {
        x: e.cx + Math.sin(e.clock * e.fx + e.px) * e.ax,
        y: e.cy + Math.sin(e.clock * e.fy + e.py) * e.ay,
      };
    case "snake":
      return snakePoint(e);
    default:
      return {
        x: e.slotX + f.ox + Math.sin(world.time * 1.7 + e.phase) * 3,
        y: e.slotY + f.oy + Math.sin(world.time * 2.6 + e.phase) * 4,
      };
  }
}

function blendWeight(t) {
  if (t < 0.35) return 0;
  const k = (t - 0.35) / 0.65;
  return k * k * (3 - 2 * k);
}

/**
 * Advances one enemy. `world` carries the formation sway, the time and the rng.
 * @param {any} e
 * @param {number} dt
 * @param {{ formation: { ox: number, oy: number }, time: number, rng: () => number }} world
 */
export function moveEnemy(e, dt, world) {
  e.flash = Math.max(0, e.flash - dt);
  if (e.mode === "enter" && e.delay > 0) {
    e.delay -= dt;
    e.hidden = true;
    return;
  }
  e.t += dt;
  e.clock += dt;
  const px = e.x;
  const py = e.y;
  switch (e.mode) {
    case "enter": {
      e.hidden = false;
      e.pathT = Math.min(1, e.pathT + dt / e.pathDur);
      const p = bezier(e.path, e.pathT);
      const a = anchor(e, world);
      const w = blendWeight(e.pathT);
      e.x = lerp(p.x, a.x, w);
      e.y = lerp(p.y, a.y, w);
      if (e.pathT >= 1) e.mode = "home";
      break;
    }
    case "home": {
      const a = anchor(e, world);
      e.hidden = Boolean(a.hidden);
      e.x = a.x;
      e.y = a.y;
      break;
    }
    case "dive": {
      e.pathT = Math.min(1, e.pathT + dt / e.pathDur);
      const k = e.pathT * (0.55 + 0.45 * e.pathT);
      const p = bezier(e.path, k);
      e.x = p.x;
      e.y = p.y;
      if (e.pathT >= 1) {
        if (e.once) {
          e.gone = true;
          break;
        }
        const a = anchor(e, world);
        e.x = clamp(a.x + rand(world.rng, -120, 120), 30, W - 30);
        e.y = -70;
        e.mode = "enter";
        e.path = [e.x, -70, e.x, 60, a.x, a.y - 90, a.x, a.y];
        e.pathT = 0;
        e.pathDur = 1.5;
      }
      break;
    }
    case "roam": {
      e.pause = Math.max(0, (e.pause || 0) - dt);
      const dx = e.tx - e.x;
      const dy = e.ty - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10 && e.pause <= 0) {
        e.tx = rand(world.rng, 70, W - 70);
        e.ty = rand(world.rng, 90, 380);
        e.pause = rand(world.rng, 0.3, 1.1);
      }
      const speed = e.pause > 0 ? 0 : Math.min(e.speed, dist * 2.4);
      const k = Math.min(1, dt * 3);
      e.mvx = lerp(e.mvx || 0, dist > 0 ? (dx / dist) * speed : 0, k);
      e.mvy = lerp(e.mvy || 0, dist > 0 ? (dy / dist) * speed : 0, k);
      e.x += e.mvx * dt;
      e.y += e.mvy * dt;
      break;
    }
    case "flyby":
      e.x += e.dir * e.speed * dt;
      e.y = e.baseY + Math.sin(e.clock * 2.4) * 36;
      if ((e.dir > 0 && e.x > W + 90) || (e.dir < 0 && e.x < -90)) e.gone = true;
      break;
    case "drift":
      e.x += e.dx * dt + (e.variant % 3 === 2 ? Math.cos(e.t * 1.6) * 70 * dt : 0);
      e.y += e.dy * dt;
      e.angle += e.spin * dt;
      if (e.t > 1 && (e.y > H + 80 || e.x < -110 || e.x > W + 110)) e.gone = true;
      break;
    default:
      break;
  }
  if (e.gone) return;
  e.vx = (e.x - px) / dt;
  e.vy = (e.y - py) / dt;
}

/** Sends a settled enemy on a curved attack run at the player. */
export function startDive(e, target, rng, style = "swoop") {
  const sx = e.x;
  const sy = e.y;
  const side = rng() < 0.5 ? -1 : 1;
  const tx = clamp(target.x + rand(rng, -50, 50), 40, W - 40);
  if (style === "loop") {
    e.path = [sx, sy, sx + side * 280, sy + 300, sx - side * 260, sy + 330, tx, H + 100];
    e.pathDur = rand(rng, 2.4, 2.9);
  } else {
    e.path = [sx, sy, sx + side * rand(rng, 60, 170), sy - 80, tx - side * 90, target.y - 150, tx + side * rand(rng, 40, 150), H + 100];
    e.pathDur = rand(rng, 1.8, 2.3);
  }
  e.mode = "dive";
  e.pathT = 0;
}

function aimed(x, y, target, speed, offsetDeg = 0) {
  const angle = Math.atan2(target.y - y, target.x - x) + (offsetDeg * Math.PI) / 180;
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

/** The projectiles one enemy releases when the egg pacer picks it. */
export function fireFrom(e, target, rng, chapter) {
  const x = e.x;
  const y = e.y + e.r * 0.55;
  switch (ENEMY_TYPES[e.kind].egg) {
    case "egg": {
      const rush = chapter >= 3 ? 32 * (chapter - 2) : 0;
      const egg = { kind: "egg", x, y, vx: rand(rng, -25, 25) + e.vx * 0.2, vy: rand(rng, 40, 90) + rush, r: e.kind === "chick" ? 10 : 13 };
      if (e.kind === "chick" && e.variant % 4 === 1) return [{ ...egg, weave: true, r: 9, vy: egg.vy + 35 }];
      if (e.kind !== "chick" && e.variant % 4 === 3) {
        return [
          { ...egg, x: x - 12, vx: egg.vx - 45 },
          { ...egg, x: x + 12, vx: egg.vx + 45 },
        ];
      }
      return [egg];
    }
    case "yolk":
      if (chapter >= 3 && rng() < 0.5) {
        return [{ kind: "bigyolk", x, y, vx: rand(rng, -20, 20), vy: 95, r: 17, splitY: rand(rng, 420, 640) }];
      }
      return [{ kind: "yolk", x, y, vx: rand(rng, -30, 30), vy: 120, r: 13 }];
    case "quill": {
      const speed = 290 + 25 * chapter + (chapter >= 3 ? 45 * (chapter - 2) : 0);
      const offsets = chapter >= 3 ? [-14, 0, 14] : [0];
      return offsets.map((off) => ({ kind: "quill", x, y, ...aimed(x, y, target, speed, off), r: 7 }));
    }
    case "spark": {
      const speed = 330 + 30 * chapter + (chapter >= 3 ? 40 * (chapter - 2) : 0);
      const shots = [{ kind: "spark", x, y, ...aimed(x, y, target, speed), r: 8 }];
      if (chapter >= 2) shots.push({ kind: "spark", x, y, ...aimed(x, y, target, speed * 0.82, 0), r: 8 });
      return shots;
    }
    default:
      return [];
  }
}
