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
  boss: { egg: 0, dive: 0.2 },
});

const GRID_ROWS = [
  ["hen", "hen", "hen", "chick"],
  ["bomber", "hen", "hen", "chick"],
  ["rooster", "hen", "diver", "hen", "chick"],
  ["rooster", "bomber", "diver", "hen", "hen"],
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
  const pressure = info.chapter < 3 ? 1 + 0.2 * (info.chapter - 1) : 1.7 + 0.55 * (info.chapter - 3);
  return {
    eggRate: base.egg * pressure * (1 + 0.04 * (info.wave - 1)),
    diveRate: base.dive * pressure,
    diveLoop: info.chapter >= 4 ? 0.75 : info.chapter >= 3 ? 0.58 : info.chapter === 2 ? 0.2 : 0,
  };
}

/** Power is ten percent less likely than the other gifts in this list. */
function pickGift(gifts, rng) {
  const weights = gifts.map((gift) => (gift === "power" ? 0.9 * (gifts.length - 1) / (gifts.length - 0.1) : 1));
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
  const extra = [null, "bomber", "diver", "rooster"][chapter - 1];
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
  const body = chapter >= 3 ? ["hen", "hen", "bomber"] : ["hen"];
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

function ring(api, chapter) {
  const kinds = [["hen"], ["hen", "bomber"], ["hen", "rooster"], ["bomber", "rooster", "hen"]][chapter - 1];
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
          ...(chapter === 4 ? [{ cx: W / 2, cy: 280, radius: 160, n: 12, spin: 0.9 }] : []),
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

function rocks(api, chapter) {
  const count = 16 + chapter * 5;
  const span = 20 + chapter * 2;
  for (let i = 0; i < count; i += 1) {
    api.later((i / count) * span + rand(api.rng, 0, 0.6), () => {
      const slant = chapter >= 2 ? 120 : 50;
      const variant = randInt(api.rng, 0, 3);
      const tumble = variant === 3;
      api.spawn("rock", {
        size: weighted(api.rng, [
          [3, 0.35],
          [2, 0.4],
          [1, 0.25],
        ]),
        mode: "drift",
        x: rand(api.rng, 40, W - 40),
        y: -50,
        dx: rand(api.rng, tumble ? -slant * 1.6 : -slant, tumble ? slant * 1.6 : slant),
        dy: rand(api.rng, tumble ? 70 : 110, tumble ? 130 : 190) + chapter * 15,
        spin: rand(api.rng, tumble ? -4.5 : -2, tumble ? 4.5 : 2),
        angle: rand(api.rng, 0, TAU),
        variant,
      });
    });
  }
  api.later(span * 0.45, () => api.spawnGolden());
}

const BUILDERS = {
  grid: (api, ch) => grid(api, GRID_ROWS[ch - 1], 8, "swoop"),
  flock,
  snake,
  ring,
  dive: (api, ch) => grid(api, ch >= 3 ? ["diver", "diver", "diver", "hen"] : ["diver", "diver", "hen"], 7, "spiral"),
  saucers,
  rocks,
  bombers: (api) => grid(api, ["bomber", "bomber", "hen", "chick"], 7, "swoop"),
  gauntlet: (api, ch) => {
    grid(api, ["rooster", "bomber", "diver", "hen", "chick"], 9, "drop");
    if (ch >= 4) saucers(api, 0);
  },
};

const SWAY = {
  ring: { ax: 30, ay: 10, fx: 0.4, fy: 0.9 },
  gauntlet: { ax: 45, ay: 14, fx: 0.55, fy: 1.1 },
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
  const gifts = ["power", "shield", "coolant", "nova"];
  if (arsenal(info.chapter).length > 1) gifts.push("crate");
  const powers = (info.wave === 2 || info.wave === 4 || info.wave === 6) && api.rng() < 0.9 ? 1 : 0;
  for (let i = 0; i < powers && pool.length > 0; i += 1) {
    const index = randInt(api.rng, 0, pool.length - 1);
    pool[index].carrier = "power";
    pool.splice(index, 1);
  }
  const marked = scaledCount(info.chapter >= 3 ? 3 : 2, api.rng);
  for (let i = 0; i < marked && pool.length > 0; i += 1) {
    const index = randInt(api.rng, 0, pool.length - 1);
    pool[index].carrier = pickGift(gifts, api.rng);
    pool.splice(index, 1);
  }
  for (const enemy of pool) {
    if (api.rng() >= 0.035) continue;
    enemy.carrier = pickGift(gifts, api.rng);
  }
  return spawned;
}
