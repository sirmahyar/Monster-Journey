import { W, WAVES_PER_CHAPTER } from "./config.js";
import { arsenal } from "./weapons.js";
import { TAU, rand, randInt, weighted } from "./math.js";

export const CHAPTERS = Object.freeze([
  Object.freeze({
    name: "Henhouse Nebula",
    boss: "grandhen",
    bossName: "The Grand Hen",
    waves: ["grid", "flock", "snake", "ring", "dive", "saucers", "rocks"],
  }),
  Object.freeze({
    name: "Yolk Belt",
    boss: "reactor",
    bossName: "Yolk Reactor",
    waves: ["grid", "rocks", "flock", "bombers", "snake", "ring", "saucers"],
  }),
  Object.freeze({
    name: "Rooster Rift",
    boss: "ironrooster",
    bossName: "Iron Rooster",
    waves: ["grid", "dive", "snake", "ring", "rocks", "saucers", "gauntlet"],
  }),
  Object.freeze({
    name: "Coop Core",
    boss: "carrier",
    bossName: "Coop Carrier",
    waves: ["gauntlet", "flock", "ring", "dive", "snake", "rocks", "saucers"],
  }),
  Object.freeze({
    name: "Night Roost",
    boss: "barnowl",
    bossName: "The Barn Owl",
    waves: ["mines", "grid", "flock", "snake", "ring", "dive", "rocks"],
  }),
  Object.freeze({
    name: "Feather Orbit",
    boss: "plume",
    bossName: "The Plume",
    waves: ["snipers", "grid", "dive", "ring", "saucers", "bombers", "gauntlet"],
  }),
  Object.freeze({
    name: "Yolk Gale",
    boss: "cyclone",
    bossName: "Yolk Cyclone",
    waves: ["reflex", "mix", "dive", "snipers", "shells", "cyclone", "ambush"],
  }),
  Object.freeze({
    name: "Galaxy Crown",
    boss: "king",
    bossName: "The Coop King",
    waves: ["shells", "gauntlet", "mines", "snipers", "cyclone", "dive", "rocks"],
  }),
  Object.freeze({
    name: "Black Roost",
    boss: "matron",
    bossName: "The Night Matron",
    waves: ["feathers", "reflex", "comets", "mix", "snipers", "dive", "ambush"],
  }),
  Object.freeze({
    name: "Last Dawn",
    boss: "eternity",
    bossName: "The Eternal Hen",
    waves: ["comets", "feathers", "ambush", "dive", "shells", "gauntlet", "cyclone"],
  }),
]);

export const WAVE_NAMES = Object.freeze({
  grid: "Coop Formation",
  flock: "Chick Storm",
  snake: "Conga Line",
  ring: "Carousel",
  dive: "Dive Squadron",
  saucers: "Saucer Patrol",
  rocks: "Meteor Shower",
  bombers: "Yolk Bombers",
  gauntlet: "Feather Gauntlet",
  mines: "Mine Drift",
  snipers: "Sniper Perch",
  cyclone: "Yolk Cyclone",
  shells: "Shell Wall",
  reflex: "Sudden Dive",
  mix: "Mixed Flock",
  ambush: "Quick Ambush",
  feathers: "Feather Rain",
  comets: "Yolk Comets",
});

const PACING = Object.freeze({
  grid: { egg: 2.2, dive: 0.07 },
  flock: { egg: 1.5, dive: 0.12 },
  snake: { egg: 2.0, dive: 0 },
  ring: { egg: 2.1, dive: 0.05 },
  dive: { egg: 1.2, dive: 0.75 },
  saucers: { egg: 1.8, dive: 0.05 },
  rocks: { egg: 0.5, dive: 0 },
  bombers: { egg: 2.4, dive: 0.04 },
  gauntlet: { egg: 2.7, dive: 0.3 },
  mines: { egg: 2.0, dive: 0.08 },
  snipers: { egg: 1.6, dive: 0.12 },
  cyclone: { egg: 1.4, dive: 0.2 },
  shells: { egg: 1.15, dive: 0.55 },
  reflex: { egg: 0.85, dive: 1.2 },
  mix: { egg: 1.05, dive: 0.9 },
  ambush: { egg: 0.8, dive: 1.3 },
  feathers: { egg: 0.7, dive: 0.45 },
  comets: { egg: 0.7, dive: 0.35 },
  boss: { egg: 0, dive: 0.2 },
});

const GRID_ROWS = [
  ["hen", "hen", "hen", "chick"],
  ["bomber", "hen", "hen", "chick"],
  ["rooster", "hen", "diver", "hen", "chick"],
  ["rooster", "bomber", "diver", "hen", "hen"],
  ["miner", "warden", "miner", "chick", "hen"],
  ["sniper", "hen", "diver", "hen", "chick"],
  ["spinner", "bomber", "spinner", "hen", "chick"],
  ["shell", "rooster", "miner", "sniper", "hen"],
  ["diver", "sniper", "shell", "miner", "spinner"],
  ["rooster", "sniper", "diver", "shell", "bomber"],
];

export function waveInfo(chapter, wave) {
  const c = CHAPTERS[chapter - 1];
  if (wave >= WAVES_PER_CHAPTER) {
    return { chapter, wave, boss: true, template: "boss", name: c.bossName, bossKind: c.boss, chapterName: c.name };
  }
  const template = c.waves[wave - 1];
  return { chapter, wave, boss: false, template, name: WAVE_NAMES[template], chapterName: c.name };
}

export function wavePacing(info) {
  const base = PACING[info.template];
  const throughFour = info.chapter < 3 ? 1 + 0.2 * (info.chapter - 1) : 1.7 + 0.55 * (Math.min(info.chapter, 4) - 3);
  const climbed = info.chapter <= 4 ? throughFour : throughFour + 0.22 * (info.chapter - 4);
  const pressure = info.chapter >= 10 ? 3.3 : info.chapter === 9 ? 2.2 : info.chapter >= 7 ? 1.55 : climbed;
  const diveScale = info.chapter >= 10 ? 2.8 : info.chapter === 9 ? 2.15 : info.chapter >= 7 ? 1.7 : 1;
  return {
    eggRate: base.egg * pressure * (1 + 0.04 * (info.wave - 1)),
    diveRate: base.dive * climbed * diveScale,
    diveLoop: info.chapter >= 9 ? 1 : info.chapter >= 7 ? 0.95 : info.chapter >= 4 ? 0.75 : info.chapter >= 3 ? 0.58 : info.chapter === 2 ? 0.2 : 0,
  };
}

/** Power is ten percent less likely, and a shield twenty percent less likely, than an even share. */
function giftWeight(gift, count) {
  if (gift === "power") return 0.9 * (count - 1) / (count - 0.1);
  if (gift === "shield") {
    const power = 0.9 * (count - 1) / (count - 0.1);
    const total = power + (count - 1);
    return 0.8 * (total - 1) / (total - 0.8);
  }
  return 1;
}

function keptGift(gift, chapter, rng) {
  let keep = 1;
  if (gift === "nova") keep *= 0.36;
  if (chapter <= 3 && (gift === "power" || gift === "shield" || gift === "coolant")) keep *= 0.9;
  if (gift === "nova" || gift === "shield" || gift === "coolant" || gift === "crate") keep *= 0.85;
  if (gift && gift !== "life") keep *= 0.5;
  if (rng() >= keep) return "";
  return gift;
}

function pickGift(gifts, rng) {
  const weights = gifts.map((gift) => giftWeight(gift, gifts.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let i = 0; i < gifts.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return gifts[i];
  }
  return gifts[gifts.length - 1];
}

/** Twenty percent fewer than `full`, rounded at random so the average holds. */
function scaledCount(full, rng) {
  const want = full * 0.8;
  return Math.floor(want) + (rng() < want - Math.floor(want) ? 1 : 0);
}

function entryPath(style, side, slotX, slotY, rng) {
  const m = (x) => (side < 0 ? x : W - x);
  if (style === "drop") {
    const sx = slotX + rand(rng, -90, 90);
    return [sx, -70, sx, slotY + 220, slotX, slotY + 120, slotX, slotY];
  }
  if (style === "spiral") return [W / 2, -70, m(W + 160), 330, m(-160), 560, slotX, slotY];
  return [m(-70), 140, m(W * 0.55), 660, m(W * 0.92), 230, slotX, slotY];
}

function grid(api, rows, cols, style) {
  const gapX = cols > 8 ? 62 : 70;
  const left = W / 2 - ((cols - 1) * gapX) / 2;
  rows.forEach((kind, r) => {
    for (let c = 0; c < cols; c += 1) {
      const slotX = left + c * gapX;
      const slotY = 100 + r * 60;
      const side = (r + (style === "drop" ? c : 0)) % 2 === 0 ? -1 : 1;
      api.spawn(kind, {
        mode: "enter",
        home: "formation",
        slotX,
        slotY,
        path: entryPath(style, side, slotX, slotY, api.rng),
        pathDur: 1.7,
        delay: r * 0.32 + c * 0.075,
        phase: rand(api.rng, 0, TAU),
        variant: (r + c) % 4,
      });
    }
  });
}

function flock(api, chapter) {
  const perRibbon = 14 + chapter * 3;
  const flockExtra = [null, "bomber", "diver", "rooster", "warden", "sniper", "spinner", "shell", "warden", "sniper"];
  const extra = flockExtra[(chapter - 1) % flockExtra.length];
  for (let ribbon = 0; ribbon < 2; ribbon += 1) {
    const side = ribbon === 0 ? -1 : 1;
    for (let i = 0; i < perRibbon; i += 1) {
      const phi = i * 0.24 + ribbon * Math.PI;
      api.spawn(extra && i % 5 === 4 ? extra : "chick", {
        mode: "enter",
        home: "swirl",
        cx: W / 2,
        cy: 270,
        ax: 250,
        ay: 125,
        fx: 0.75,
        fy: 1.5,
        px: phi,
        py: phi * 2,
        path: [side < 0 ? -60 : W + 60, 30, W / 2 - side * 120, 90, W / 2, 200, W / 2, 270],
        pathDur: 1.6,
        delay: i * 0.12 + ribbon * 0.4,
        phase: i * 0.7,
        variant: i % 4,
      });
    }
  }
}

function snake(api, chapter) {
  const length = 10 + chapter * 2;
  const speed = 150 + chapter * 18;
  const head = chapter >= 2 ? "rooster" : "hen";
  const body = chapter >= 7
    ? ["hen", "spinner", "bomber"]
    : chapter >= 5
      ? ["hen", "miner", "bomber"]
      : chapter >= 3
        ? ["hen", "hen", "bomber"]
        : ["hen"];
  for (let s = 0; s < 2; s += 1) {
    for (let i = 0; i < length; i += 1) {
      api.spawn(i === 0 ? head : body[i % body.length], {
        mode: "home",
        home: "snake",
        lag: i * (48 / speed) + s * 2.2,
        speed,
        dir: s === 0 ? 1 : -1,
        top: 110 + s * 36,
        rows: 4,
        rowGap: 72,
        phase: s,
        hidden: true,
        variant: s * 2,
      });
    }
  }
}

const RING_KINDS = [
  ["hen"],
  ["hen", "bomber"],
  ["hen", "rooster"],
  ["bomber", "rooster", "hen"],
  ["miner", "hen", "chick"],
  ["sniper", "rooster", "hen"],
  ["spinner", "bomber", "hen"],
  ["shell", "miner", "rooster"],
  ["diver", "sniper", "shell", "spinner"],
  ["rooster", "sniper", "diver", "bomber", "shell"],
];

function ring(api, chapter) {
  const kinds = RING_KINDS[chapter - 1];
  const spinScale = 1 + 0.12 * (chapter - 1);
  const rings =
    chapter === 1
      ? [
          { cx: W * 0.3, cy: 250, radius: 110, n: 10, spin: 1 },
          { cx: W * 0.7, cy: 250, radius: 110, n: 10, spin: -1 },
        ]
      : [
          { cx: W / 2, cy: 280, radius: 220, n: 16, spin: 0.55 },
          { cx: W / 2, cy: 280, radius: 100, n: 8, spin: -1.25 },
          ...(chapter >= 4 ? [{ cx: W / 2, cy: 280, radius: 160, n: 12, spin: 0.9 }] : []),
        ];
  rings.forEach((def, k) => {
    for (let i = 0; i < def.n; i += 1) {
      const angle0 = (i / def.n) * TAU;
      const sx = def.cx + Math.cos(angle0) * def.radius * 2.2;
      api.spawn(kinds[(i + k) % kinds.length], {
        mode: "enter",
        home: "orbit",
        cx: def.cx,
        cy: def.cy,
        radius: def.radius,
        angle0,
        orbitSpin: def.spin * spinScale,
        pulse: 16,
        squash: 0.85,
        path: [sx, -80, sx, 120, def.cx, def.cy - def.radius - 60, def.cx, def.cy],
        pathDur: 1.9,
        delay: i * 0.08 + k * 0.5,
        phase: angle0,
        variant: k + 1,
      });
    }
  });
  const centers = chapter === 1 ? [W * 0.3, W * 0.7] : [W / 2];
  for (const cx of centers) {
    api.spawn(chapter >= 3 ? "rooster" : "hen", {
      mode: "enter",
      home: "formation",
      slotX: cx,
      slotY: chapter === 1 ? 250 : 280,
      path: entryPath("drop", -1, cx, 260, api.rng),
      pathDur: 2.2,
      delay: 1.2,
      variant: 3,
    });
  }
}

function saucers(api, chapter) {
  const n = 2 + chapter;
  for (let i = 0; i < n; i += 1) {
    api.spawn("saucer", {
      mode: "roam",
      x: rand(api.rng, 80, W - 80),
      y: -60 - i * 90,
      tx: rand(api.rng, 80, W - 80),
      ty: rand(api.rng, 100, 340),
      speed: 150 + 20 * chapter,
      variant: i % 4,
    });
  }
  grid(api, chapter >= 3 ? ["hen", "chick"] : ["chick"], 8, "drop");
}

function spawnDriftRock(api, chapter, opts = {}) {
  const slant = chapter >= 2 ? 120 : 50;
  const variant = opts.variant ?? randInt(api.rng, 0, 3);
  const tumble = variant === 3;
  const roll = api.rng();
  const kind = roll < 0.18 ? "poop" : roll < 0.32 ? "net" : "rock";
  const pattern = opts.pattern || ["straight", "zig", "wobble", "stall"][variant];
  api.spawn(kind, {
    size: kind === "rock" ? weighted(api.rng, [[3, 0.35], [2, 0.4], [1, 0.25]]) : 2,
    mode: "drift",
    pattern,
    x: opts.x ?? rand(api.rng, 40, W - 40),
    y: opts.y ?? -50,
    dx: opts.dx ?? rand(api.rng, tumble ? -slant * 1.6 : -slant, tumble ? slant * 1.6 : slant),
    dy: opts.dy ?? rand(api.rng, tumble ? 70 : 110, tumble ? 130 : 190) + chapter * 15 + (chapter >= 7 ? 50 : 0),
    spin: opts.spin ?? rand(api.rng, tumble ? -4.5 : -2, tumble ? 4.5 : 2),
    angle: opts.angle ?? rand(api.rng, 0, TAU),
    variant,
  });
}

function rocks(api, chapter) {
  const count = chapter >= 7 ? 22 : 16 + chapter * 5;
  const span = 20 + chapter * 2;
  const early = Math.min(4, count);
  for (let i = 0; i < early; i += 1) {
    spawnDriftRock(api, chapter, { y: -35 - i * 28 });
  }
  for (let i = 0; i < count; i += 1) {
    api.later((i / count) * span + rand(api.rng, 0, 0.6), () => {
      spawnDriftRock(api, chapter);
    });
  }
  api.later(span * 0.45, () => api.spawnGolden());
}

function mines(api, chapter) {
  if (chapter >= 7) {
    grid(api, ["miner", "diver", "hen"], 5, "drop");
    return;
  }
  grid(api, ["miner", "miner", "hen", "chick"], 7, "drop");
}

function snipers(api, chapter) {
  const n = 4 + Math.min(2, Math.max(0, chapter - 6));
  for (let i = 0; i < n; i += 1) {
    const slotX = 90 + (i / (n - 1)) * (W - 180);
    api.spawn("sniper", {
      mode: "enter",
      home: "formation",
      slotX,
      slotY: 120,
      path: entryPath("drop", i % 2 ? 1 : -1, slotX, 120, api.rng),
      pathDur: 1.6,
      delay: i * 0.15,
      variant: i % 4,
    });
  }
  grid(api, ["diver", "hen"], 6, "spiral");
}

function cyclone(api, chapter) {
  const late = chapter >= 7;
  const n = late ? 8 : 14;
  const mixed = ["spinner", "diver", "sniper", "bomber"];
  for (let i = 0; i < n; i += 1) {
    const angle0 = (i / n) * TAU;
    const radius = i % 2 ? 180 : 100;
    api.spawn(late ? mixed[i % mixed.length] : i % 3 === 0 ? "bomber" : "spinner", {
      mode: "enter",
      home: "orbit",
      cx: W / 2,
      cy: 260,
      radius,
      angle0,
      orbitSpin: (i % 2 ? 1.1 : -1.6) * (late ? 1.35 : 1 + 0.05 * Math.max(0, chapter - 7)),
      pulse: 20,
      squash: 0.8,
      path: [W / 2, -80, W / 2 + Math.cos(angle0) * 220, 90, W / 2, 200, W / 2, 260],
      pathDur: 1.8,
      delay: i * 0.06,
      phase: angle0,
      variant: i % 4,
    });
  }
}

function shells(api, chapter) {
  if (chapter >= 7) {
    grid(api, ["shell", "diver"], 4, "swoop");
    return;
  }
  grid(api, ["shell", "miner", "shell", "hen"], 6, "swoop");
}

function reflex(api) {
  grid(api, ["diver", "diver"], 6, "spiral");
  for (let i = 0; i < 3; i += 1) {
    const slotX = [140, 360, 580][i];
    api.spawn("sniper", {
      mode: "enter",
      home: "formation",
      slotX,
      slotY: 110,
      path: entryPath("drop", i % 2 ? 1 : -1, slotX, 110, api.rng),
      pathDur: 1.4,
      delay: 0.35 + i * 0.15,
      variant: i,
    });
  }
}

function mix(api) {
  grid(api, ["diver", "sniper", "spinner", "shell", "miner"], 4, "swoop");
}

function ambush(api) {
  grid(api, ["sniper", "shell", "diver", "miner"], 5, "spiral");
}

function rain(api, chapter, kind, r, speed) {
  const count = 12 + chapter * 2;
  const span = 14;
  for (let i = 0; i < count; i += 1) {
    api.later((i / count) * span + rand(api.rng, 0, 0.4), () => {
      api.drop({
        kind,
        x: rand(api.rng, 24, W - 24),
        y: -24,
        vx: rand(api.rng, -50, 50),
        vy: rand(api.rng, speed, speed + 90),
        r,
        gravity: 0.2,
      });
    });
  }
}

function feathers(api, chapter) {
  grid(api, chapter >= 10 ? ["hen", "diver", "sniper"] : ["hen", "diver"], chapter >= 10 ? 6 : 5, "swoop");
  rain(api, chapter, "quill", 8, 180);
}

function comets(api, chapter) {
  grid(api, chapter >= 10 ? ["bomber", "spinner", "diver"] : ["bomber", "spinner"], 4, "drop");
  rain(api, chapter, "yolk", 14, 150);
}

const BUILDERS = {
  grid: (api, ch) => grid(api, GRID_ROWS[ch - 1], 8, "swoop"),
  flock,
  snake,
  ring,
  dive: (api, ch) => grid(
    api,
    ch >= 7 ? ["diver", "diver", "sniper"] : ch >= 3 ? ["diver", "diver", "diver", "hen"] : ["diver", "diver", "hen"],
    ch >= 7 ? 5 : 7,
    "spiral",
  ),
  saucers,
  rocks,
  bombers: (api) => grid(api, ["bomber", "bomber", "hen", "chick"], 7, "swoop"),
  gauntlet: (api, ch) => {
    if (ch >= 7) {
      grid(api, ["rooster", "diver", "sniper", "shell"], 5, "drop");
      return;
    }
    grid(api, ["rooster", "bomber", "diver", "hen", "chick"], 9, "drop");
    if (ch >= 4) saucers(api, 0);
  },
  mines,
  snipers,
  cyclone,
  shells,
  reflex,
  mix,
  ambush,
  feathers,
  comets,
};

const SWAY = {
  ring: { ax: 30, ay: 10, fx: 0.4, fy: 0.9 },
  gauntlet: { ax: 45, ay: 14, fx: 0.55, fy: 1.1 },
  mines: { ax: 40, ay: 8, fx: 0.35, fy: 0.8 },
  snipers: { ax: 20, ay: 6, fx: 0.25, fy: 0.6 },
  cyclone: { ax: 50, ay: 16, fx: 0.7, fy: 1.3 },
  shells: { ax: 24, ay: 8, fx: 0.3, fy: 0.7 },
  reflex: { ax: 70, ay: 16, fx: 0.8, fy: 1.4 },
  mix: { ax: 36, ay: 10, fx: 0.45, fy: 1 },
  ambush: { ax: 28, ay: 8, fx: 0.35, fy: 0.8 },
  feathers: { ax: 34, ay: 12, fx: 0.5, fy: 1.1 },
  comets: { ax: 48, ay: 14, fx: 0.6, fy: 1.2 },
};

/**
 * Spawns the enemies of one regular wave through the simulation api.
 * Boss waves are handled by the simulation directly.
 */
export function buildWave(api, info) {
  const spawned = [];
  const tracked = { ...api, spawn: (kind, fields) => {
    const enemy = api.spawn(kind, fields);
    spawned.push(enemy);
    return enemy;
  } };
  api.setFormation(SWAY[info.template] || { ax: 60, ay: 12, fx: 0.5, fy: 1.2 });
  BUILDERS[info.template](tracked, info.chapter);
  const pool = spawned.filter((e) => e.kind !== "golden");
  const gifts = ["power", "shield", "coolant"];
  if (arsenal(info.chapter).length > 1) gifts.push("crate");
  if (info.chapter >= 2) gifts.push("mystery");
  if (info.chapter >= 3) gifts.push("feather");
  if (info.chapter >= 4) gifts.push("rocket");
  const powerChance = info.chapter <= 3 ? 0.405 : 0.45;
  const powers = (info.wave === 2 || info.wave === 4 || info.wave === 6) && api.rng() < powerChance ? 1 : 0;
  for (let i = 0; i < powers && pool.length > 0; i += 1) {
    const index = randInt(api.rng, 0, pool.length - 1);
    pool[index].carrier = "power";
    pool.splice(index, 1);
  }
  const marked = scaledCount((info.chapter >= 3 ? 3 : 2) * 0.475, api.rng);
  for (let i = 0; i < marked && pool.length > 0; i += 1) {
    const index = randInt(api.rng, 0, pool.length - 1);
    const gift = keptGift(pickGift(gifts, api.rng), info.chapter, api.rng);
    if (gift) pool[index].carrier = gift;
    pool.splice(index, 1);
  }
  for (const enemy of pool) {
    if (api.rng() >= 0.016625) continue;
    const gift = keptGift(pickGift(gifts, api.rng), info.chapter, api.rng);
    if (gift) enemy.carrier = gift;
  }
  return spawned;
}
