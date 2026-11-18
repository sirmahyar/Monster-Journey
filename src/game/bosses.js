import { W } from "./config.js";
import { TAU, clamp, easeInCubic, easeInOutSine, easeOutBack, easeOutCubic, lerp, overlap, rand } from "./math.js";

const SPECS = Object.freeze({
  grandhen: { name: "The Grand Hen", hp: 700, homeY: 180, circles: [[0, 0, 74], [-84, 6, 30], [84, 6, 30]] },
  reactor: { name: "Yolk Reactor", hp: 1000, homeY: 190, circles: [[0, 0, 82], [0, 74, 36]] },
  ironrooster: {
    name: "Iron Rooster",
    hp: 1400,
    homeY: 190,
    circles: [[0, 10, 70], [0, -66, 34], [-82, 24, 34], [82, 24, 34]],
  },
  carrier: {
    name: "Coop Carrier",
    hp: 1750,
    homeY: 175,
    circles: [[0, 0, 96], [-150, 8, 40], [150, 8, 40]],
    parts: [[-128, 54, 28, 220], [128, 54, 28, 220]],
  },
  barnowl: {
    name: "The Barn Owl",
    hp: 2100,
    homeY: 180,
    circles: [[0, 0, 70], [0, -50, 36], [-78, 18, 28], [78, 18, 28]],
  },
  plume: {
    name: "The Plume",
    hp: 2400,
    homeY: 185,
    circles: [[0, 8, 68], [0, -70, 32], [-90, 20, 26], [90, 20, 26]],
  },
  cyclone: {
    name: "Yolk Cyclone",
    hp: 2800,
    homeY: 190,
    circles: [[0, 0, 78], [0, 70, 30]],
  },
  king: {
    name: "The Coop King",
    hp: 3400,
    homeY: 170,
    circles: [[0, -10, 80], [-120, 16, 34], [120, 16, 34]],
    parts: [[-110, 60, 26, 260], [110, 60, 26, 260], [0, 78, 24, 220]],
  },
  matron: {
    name: "The Night Matron",
    hp: 3800,
    homeY: 170,
    circles: [[0, 0, 78], [-96, 10, 30], [96, 10, 30], [0, -62, 28]],
  },
  eternity: {
    name: "The Eternal Hen",
    hp: 3000,
    homeY: 160,
    circles: [[0, -8, 88], [-120, 18, 34], [120, 18, 34], [0, 70, 30]],
    parts: [[-130, 48, 26, 320], [130, 48, 26, 320]],
  },
});

const ATTACKS = Object.freeze({
  grandhen: [["relocate", "fan", "charge"], ["relocate", "needles", "charge", "summon"], ["relocate", "gust", "charge", "rain"]],
  reactor: [["relocate", "ring", "bombs"], ["relocate", "mines", "beams", "gust"], ["relocate", "spiral2", "bounce", "beams"]],
  ironrooster: [["relocate", "missiles", "dash"], ["relocate", "needles", "sweep", "stomp"], ["relocate", "fan", "bounce", "charge"]],
  carrier: [["relocate", "twin", "hatch"], ["relocate", "beams", "missiles", "mines"], ["relocate", "needles", "ring", "bounce"]],
  barnowl: [["relocate", "mines", "needles"], ["relocate", "gust", "swoop", "fan"], ["relocate", "beams", "bounce", "spirals"]],
  plume: [["relocate", "needles", "gust"], ["relocate", "missiles", "sweep", "bounce"], ["relocate", "beams", "swoop", "fan"]],
  cyclone: [["relocate", "gust", "swoop"], ["relocate", "needles", "mines", "fan"], ["relocate", "beams", "bounce", "charge"]],
  king: [["relocate", "twin", "needles"], ["relocate", "beams", "gust", "hatch"], ["relocate", "ring", "missiles", "fan"]],
  matron: [["relocate", "needles", "mines"], ["relocate", "beams", "missiles", "swoop"], ["relocate", "ring", "gust", "bounce"]],
  eternity: [["relocate", "beams", "needles", "fan"], ["relocate", "ring", "missiles", "mines"], ["relocate", "spiral2", "bounce", "charge", "swoop"]],
});

const REST = [1.5, 1.05, 0.72];
const INTRO = 2.6;
export const BOSS_DEATH = 2.4;

export function makeBoss(kind) {
  const spec = SPECS[kind];
  const boss = {
    kind,
    name: spec.name,
    x: W / 2,
    y: -230,
    hp: spec.hp,
    maxHp: spec.hp,
    homeY: spec.homeY,
    t: 0,
    intro: INTRO,
    phase: 0,
    attack: null,
    last: null,
    rest: 1.2,
    flash: 0,
    dying: 0,
    dead: false,
    lockMove: false,
    armored: false,
    mouth: 0,
    charge: 0,
    spin: 0,
    boomClock: 0,
    idle: 0,
    mark: null,
    shield: Math.round(spec.hp * 0.14),
    maxShield: Math.round(spec.hp * 0.14),
    shieldActive: 0,
    shieldRipple: 0,
    shieldReady: 1.2,
    parts: (spec.parts || []).map(([dx, dy, r, hp], id) => ({ id, dx, dy, r, hp, maxHp: hp, alive: true, x: 0, y: 0, flash: 0 })),
  };
  syncParts(boss);
  return boss;
}

function syncParts(b) {
  for (const p of b.parts) {
    p.x = b.x + p.dx;
    p.y = b.y + p.dy;
  }
}

function phaseOf(b) {
  const ratio = b.hp / b.maxHp;
  if (b.parts.length > 0) return b.parts.some((p) => p.alive) ? 0 : ratio > 0.35 ? 1 : 2;
  return ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
}

function hover(b, dt) {
  const tx = W / 2 + Math.sin(b.t * (0.45 + b.phase * 0.15)) * 190;
  const ty = b.homeY + Math.sin(b.t * 1.3) * 14;
  const k = Math.min(1, dt * 2.2);
  b.x = lerp(b.x, tx, k);
  b.y = lerp(b.y, ty, k);
}

function radial(api, x, y, count, speed, offset, kind = "pellet") {
  for (let i = 0; i < count; i += 1) {
    const angle = offset + (i / count) * TAU;
    api.egg({ kind, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 8 });
  }
}

function aimAt(api, x, y, speed, kind, extra = {}) {
  const angle = Math.atan2(api.player.y - y, api.player.x - x);
  api.egg({ kind, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 7, ...extra });
}

/** Runs one frame of the current attack and returns true when it has finished. */
function runAttack(b, a, dt, api) {
  a.t += dt;
  const rng = api.rng;
  switch (a.name) {
    case "fan": {
      const count = 5 + b.phase * 2;
      while (a.n < 3 && a.t >= 0.35 + a.n * 0.55) {
        const base = Math.atan2(api.player.y - b.y, api.player.x - b.x);
        for (let i = 0; i < count; i += 1) {
          const angle = base + (i - (count - 1) / 2) * 0.16 + (a.n % 2 ? 0.08 : 0);
          api.egg({ kind: "egg", x: b.x, y: b.y + 50, vx: Math.cos(angle) * 210, vy: Math.sin(angle) * 210, r: 13, gravity: 0.25 });
        }
        b.mouth = 1;
        a.n += 1;
        api.event("boss_shoot", {});
      }
      return a.t >= 2.2;
    }
    case "rain":
      a.acc += dt * (6 + b.phase * 3);
      while (a.acc >= 1) {
        a.acc -= 1;
        api.egg({ kind: "egg", x: rand(rng, 24, W - 24), y: -16, vx: rand(rng, -15, 15), vy: rand(rng, 40, 110), r: 12 });
      }
      b.mouth = 0.6;
      return a.t >= 2.8;
    case "summon":
      while (a.n < 2 && a.t >= 0.4 + a.n * 0.6) {
        for (let i = 0; i < 3 + b.phase; i += 1) api.summon("chick", b.x + rand(rng, -50, 50), b.y + 30, "swoop");
        a.n += 1;
        b.mouth = 1;
      }
      return a.t >= 1.8;
    case "relocate": {
      b.lockMove = true;
      if (a.n === 0) {
        a.n = 1;
        a.sx = b.x;
        a.sy = b.y;
        a.tx = rand(rng, 130, W - 130);
        a.ty = rand(rng, 120, 300);
        b.mark = { x: a.tx, y: a.ty };
      }
      if (a.t < 0.65) b.charge = a.t / 0.65;
      else if (a.t < 0.98) {
        const k = easeInCubic((a.t - 0.65) / 0.33);
        b.x = lerp(a.sx, a.tx, k);
        b.y = lerp(a.sy, a.ty, k);
        b.charge = 1;
      } else {
        b.charge = 0;
        b.mark = null;
        if (a.n === 1) {
          a.n = 2;
          radial(api, b.x, b.y + 20, 8 + b.phase * 2, 150, a.t, b.phase > 0 ? "spark" : "egg");
          api.event("boss_shoot", {});
        }
      }
      return a.t >= 1.35;
    }
    case "charge": {
      b.lockMove = true;
      if (a.n === 0) {
        a.n = 1;
        a.sx = b.x;
        a.sy = b.y;
        a.tx = clamp(api.player.x, 120, W - 120);
        b.aim = a.tx;
        b.mark = { x: a.tx, y: 600 };
      }
      if (a.t < 0.6) {
        b.x = a.sx + Math.sin(a.t * 60) * 4;
        b.charge = a.t / 0.6;
      } else if (a.t < 1.25) {
        const k = easeInCubic((a.t - 0.6) / 0.65);
        b.x = lerp(a.sx, a.tx, k);
        b.y = lerp(a.sy, 600, k);
      } else if (a.t < 1.5) {
        if (a.n === 1) {
          a.n = 2;
          radial(api, b.x, b.y + 40, 12 + b.phase * 2, 170, 0, "egg");
          api.event("boss_slam", { x: b.x, y: b.y });
        }
      } else {
        b.charge = 0;
        b.aim = null;
        b.mark = null;
        b.y = lerp(600, b.homeY, easeInOutSine(Math.min(1, (a.t - 1.5) / 1)));
      }
      return a.t >= 2.5;
    }
    case "spiral":
    case "spiral2": {
      const arms = a.name === "spiral2" || b.phase > 1 ? 3 : 2;
      b.spin += dt * (a.name === "spiral2" ? -2.6 : 3.4);
      a.acc += dt;
      while (a.acc >= 0.11) {
        a.acc -= 0.11;
        for (let i = 0; i < arms; i += 1) {
          const angle = b.spin + (i / arms) * TAU;
          api.egg({ kind: "pellet", x: b.x + Math.cos(angle) * 40, y: b.y + Math.sin(angle) * 40, vx: Math.cos(angle) * 165, vy: Math.sin(angle) * 165, r: 8 });
        }
      }
      return a.t >= 3.2;
    }
    case "ring": {
      const count = 16 + b.phase * 4;
      while (a.n < 3 && a.t >= 0.3 + a.n * 0.65) {
        radial(api, b.x, b.y + 20, count, 190, a.n * (Math.PI / count));
        a.n += 1;
        api.event("boss_shoot", { big: true });
      }
      return a.t >= 2.45;
    }
    case "bombs": {
      const count = 3 + b.phase;
      while (a.n < count && a.t >= 0.25 + a.n * 0.35) {
        api.egg({ kind: "bigyolk", x: b.x + rand(rng, -40, 40), y: b.y + 50, vx: rand(rng, -140, 140), vy: rand(rng, 60, 120), r: 17, splitY: rand(rng, 380, 640) });
        a.n += 1;
      }
      return a.t >= 0.65 + count * 0.35;
    }
    case "beams": {
      if (a.n === 0) {
        a.n = 1;
        const xs = [clamp(api.player.x, 30, W - 30)];
        const want = b.phase > 1 ? 4 : 3;
        for (let tries = 0; xs.length < want && tries < 60; tries += 1) {
          const x = rand(rng, 40, W - 40);
          if (xs.every((o) => Math.abs(o - x) > 130)) xs.push(x);
        }
        for (const x of xs) api.beam({ x, w: 34, warn: 0.95, life: 0.8 });
        api.event("beam_warn", {});
      }
      return a.t >= 2;
    }
    case "missiles": {
      const count = 4 + b.phase;
      while (a.n < count && a.t >= 0.2 + a.n * 0.2) {
        const side = a.n % 2 ? 1 : -1;
        api.egg({ kind: "missile", x: b.x + side * 60, y: b.y + 10, vx: side * 160, vy: -40, r: 9, homing: 1.7, speed: 235, life: 3.6 });
        a.n += 1;
        api.event("missile", {});
      }
      return a.t >= 0.7 + count * 0.2;
    }
    case "sweep": {
      if (a.n === 0) {
        a.n = 1;
        const gap = clamp(api.player.x, 150, W - 150);
        api.beam({ x: 10, w: 30, warn: 0.6, life: 1.7, fromX: 10, toX: gap - 120 });
        api.beam({ x: W - 10, w: 30, warn: 0.6, life: 1.7, fromX: W - 10, toX: gap + 120 });
        api.event("beam_warn", {});
      }
      if (a.t > 0.6 && a.t < 2.3) {
        a.acc += dt;
        while (a.acc >= 0.3) {
          a.acc -= 0.3;
          aimAt(api, b.x, b.y + 40, 300, "spark");
        }
      }
      return a.t >= 2.6;
    }
    case "stomp": {
      b.lockMove = true;
      if (a.n === 0) {
        a.n = 1;
        a.sy = b.y;
      }
      if (a.t < 0.45) {
        b.y = a.sy - easeOutCubic(a.t / 0.45) * 40;
        b.charge = a.t / 0.45;
      } else if (a.t < 0.7) {
        b.y = lerp(a.sy - 40, 330, easeInCubic((a.t - 0.45) / 0.25));
      } else {
        if (a.n === 1) {
          a.n = 2;
          b.charge = 0;
          radial(api, b.x, b.y + 60, 20 + b.phase * 4, 200, rand(rng, 0, 1));
          api.event("boss_slam", { x: b.x, y: b.y + 60 });
        }
        if (a.t > 0.9) b.y = lerp(330, b.homeY, easeInOutSine(Math.min(1, (a.t - 0.9) / 0.9)));
      }
      return a.t >= 1.9;
    }
    case "dash": {
      b.lockMove = true;
      const leg = Math.min(2, Math.floor(a.t / 0.8));
      if (a.leg !== leg) {
        a.leg = leg;
        a.sx = b.x;
        a.tx = b.x < W / 2 ? W - 100 : 100;
      }
      b.x = lerp(a.sx, a.tx, easeInOutSine(Math.min(1, (a.t - leg * 0.8) / 0.8)));
      b.y = lerp(b.y, b.homeY + 60, Math.min(1, dt * 3));
      a.acc += dt;
      while (a.acc >= 0.1) {
        a.acc -= 0.1;
        api.egg({ kind: "egg", x: b.x, y: b.y + 60, vx: 0, vy: 140, r: 13 });
      }
      return a.t >= 2.4;
    }
    case "twin": {
      a.acc += dt;
      while (a.acc >= 0.2) {
        a.acc -= 0.2;
        const alive = b.parts.filter((p) => p.alive);
        if (alive.length === 0) return true;
        const p = alive[a.n % alive.length];
        a.n += 1;
        aimAt(api, p.x, p.y + 10, 360, "spark");
      }
      return a.t >= 2.6;
    }
    case "hatch":
      while (a.n < 3 && a.t >= 0.4 + a.n * 0.5) {
        for (const side of [-1, 1]) api.summon(b.phase >= 2 ? "diver" : "hen", b.x + side * 40, b.y + 60, "swoop");
        a.n += 1;
      }
      b.mouth = a.t < 1.9 ? 1 : 0;
      return a.t >= 2;
    case "mines": {
      const count = 4 + b.phase;
      while (a.n < count && a.t >= 0.3 + a.n * 0.4) {
        api.egg({ kind: "mine", x: b.x + rand(rng, -80, 80), y: b.y + 40, vx: rand(rng, -40, 40), vy: 50, r: 12, arm: 0.7, life: 2.1 });
        a.n += 1;
        api.event("boss_shoot", {});
      }
      return a.t >= 0.5 + count * 0.4;
    }
    case "needles":
      while (a.n < 5 && a.t >= 0.25 + a.n * 0.28) {
        aimAt(api, b.x, b.y + 30, 480, "needle", { r: 5 });
        if (b.phase >= 1) {
          aimAt(api, b.x - 30, b.y + 20, 440, "needle", { r: 5 });
          aimAt(api, b.x + 30, b.y + 20, 440, "needle", { r: 5 });
        }
        a.n += 1;
        api.event("boss_shoot", {});
      }
      return a.t >= 2.1;
    case "gust":
      while (a.n < 4 && a.t >= 0.4 + a.n * 0.5) {
        const side = a.n % 2 ? 1 : -1;
        api.egg({ kind: "spiral", x: b.x + side * 36, y: b.y + 24, vx: side * 22, vy: 62, r: 11, spin: side * 3, orbit: 16 });
        a.n += 1;
        api.event("boss_shoot", {});
      }
      return a.t >= 2.5;
    case "swoop":
      while (a.n < 2 && a.t >= 0.3 + a.n * 0.75) {
        api.summon("diver", b.x + (a.n % 2 ? 70 : -70), b.y + 36, "loop");
        a.n += 1;
      }
      return a.t >= 1.9;
    case "spirals":
      a.acc += dt;
      while (a.acc >= 0.35) {
        a.acc -= 0.35;
        const side = a.n % 2 ? 1 : -1;
        a.n += 1;
        api.egg({ kind: "spiral", x: b.x + side * 40, y: b.y + 30, vx: side * 30, vy: 70, r: 12, spin: side * 4.5, orbit: 32 });
      }
      return a.t >= 2.6;
    case "bounce":
      while (a.n < 6 && a.t >= 0.2 + a.n * 0.22) {
        const side = a.n % 2 ? 1 : -1;
        api.egg({ kind: "bounce", x: b.x, y: b.y + 40, vx: side * (120 + b.phase * 30), vy: 40, r: 12, bounces: 1, gravity: 1 });
        a.n += 1;
      }
      return a.t >= 2;
    default:
      return true;
  }
}

function startAttack(b, api) {
  const list = ATTACKS[b.kind][b.phase];
  let name = list[Math.floor(api.rng() * list.length)];
  if (name === b.last && list.length > 1) name = list[(list.indexOf(name) + 1) % list.length];
  b.last = name;
  b.attack = { name, t: 0, n: 0, acc: 0 };
  api.event("boss_attack", { name });
}

/**
 * @param {any} b
 * @param {number} dt
 * @param {{ rng: () => number, player: { x: number, y: number }, egg: Function, beam: Function, summon: Function, event: Function }} api
 */
export function updateBoss(b, dt, api) {
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt);
  b.mouth = Math.max(0, b.mouth - dt * 2);
  for (const p of b.parts) p.flash = Math.max(0, p.flash - dt);
  if (b.dying > 0) {
    b.dying -= dt;
    b.boomClock -= dt;
    if (b.boomClock <= 0) {
      b.boomClock = 0.09;
      api.event("boss_boom", { x: b.x + rand(api.rng, -90, 90), y: b.y + rand(api.rng, -70, 70) });
    }
    b.x += Math.sin(b.t * 40) * 1.5;
    b.y += dt * 18;
    if (b.dying <= 0) b.dead = true;
    syncParts(b);
    return;
  }
  if (b.intro > 0) {
    b.intro = Math.max(0, b.intro - dt);
    b.y = lerp(-230, b.homeY, easeOutBack(1 - b.intro / INTRO));
    syncParts(b);
    return;
  }
  const phase = phaseOf(b);
  if (phase !== b.phase) {
    b.phase = phase;
    b.rest = Math.max(b.rest, 0.8);
    api.event("boss_phase", { phase, x: b.x, y: b.y });
  }
  b.armored = b.parts.some((p) => p.alive) || b.shield > 0;
  b.shieldRipple = Math.max(0, (b.shieldRipple || 0) - dt);
  if (b.shieldActive > 0) b.shieldActive = Math.max(0, b.shieldActive - dt);
  else {
    b.shieldReady = (b.shieldReady ?? 1.2) - dt;
    if (b.shieldReady <= 0) {
      if (rand(api.rng, 0, 1) < 0.58) b.shieldActive = rand(api.rng, 0.45, 1.05);
      b.shieldReady = rand(api.rng, 1.4, 3.1);
    }
  }
  b.idle += dt;
  if (b.idle > 3.2 && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.05 * dt);
  if (b.idle > 3.2 && b.shield < b.maxShield) b.shield = Math.min(b.maxShield, b.shield + b.maxShield * 0.08 * dt);
  if (!b.lockMove) hover(b, dt);
  if (b.attack) {
    if (runAttack(b, b.attack, dt, api)) {
      b.attack = null;
      b.lockMove = false;
      b.charge = 0;
      b.mark = null;
      b.aim = null;
      const calm = b.kind === "eternity" ? 0.28 : b.kind === "matron" ? 0.5 : 1;
      b.rest = REST[b.phase] * calm * rand(api.rng, 0.85, 1.2);
    }
  } else {
    b.rest -= dt;
    if (b.rest <= 0) startAttack(b, api);
  }
  syncParts(b);
}

export function bossCircles(b) {
  const out = [];
  for (const p of b.parts) if (p.alive) out.push({ x: p.x, y: p.y, r: p.r, part: p });
  for (const [dx, dy, r] of SPECS[b.kind].circles) out.push({ x: b.x + dx, y: b.y + dy, r, part: null });
  return out;
}

/** @returns {null|"immune"|"part"|"part_down"|"armored"|"hit"|"killed"} */
export function hitBoss(b, x, y, r, dmg) {
  if (b.dying > 0 || b.dead) return null;
  for (const c of bossCircles(b)) {
    if (!overlap(x, y, r, c.x, c.y, c.r)) continue;
    if (b.intro > 0) return "immune";
    b.idle = 0;
    if (c.part) {
      c.part.hp -= dmg;
      c.part.flash = 0.08;
      if (c.part.hp > 0) return "part";
      c.part.alive = false;
      return "part_down";
    }
    return damageCore(b, dmg);
  }
  return null;
}

function damageCore(b, dmg) {
  b.idle = 0;
  const armored = b.parts.some((p) => p.alive);
  if (!armored && b.shieldActive > 0) {
    b.shield = Math.max(0, b.shield - Math.min(b.shield, dmg * 0.35));
    b.shieldRipple = 0.35;
    b.flash = 0.1;
    return "shield_block";
  }
  const hit = armored ? dmg * 0.2 : dmg;
  b.hp -= hit;
  b.flash = 0.06;
  if (b.hp > 0) return armored ? "armored" : "hit";
  b.hp = 0;
  b.dying = BOSS_DEATH;
  b.attack = null;
  b.lockMove = false;
  return "killed";
}

/** Nova charge damage: parts take a heavy hit, the core a slice of its health. */
export function bombBoss(b) {
  if (b.intro > 0 || b.dying > 0 || b.dead) return null;
  b.idle = 0;
  b.shield = Math.max(0, b.shield - b.maxShield * 0.45);
  let result = null;
  for (const p of b.parts) {
    if (!p.alive) continue;
    p.hp -= 70;
    p.flash = 0.2;
    if (p.hp <= 0) {
      p.alive = false;
      result = "part_down";
    }
  }
  const core = damageCore(b, b.maxHp * 0.05);
  return core === "killed" ? core : result || core;
}
