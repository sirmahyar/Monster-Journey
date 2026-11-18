import { describe, expect, it } from "vitest";
import { CHAPTER_COUNT, H, HEAT, PLAYER, STEP, W, WAVES_PER_CHAPTER, playerPity } from "../src/game/config.js";
import { bossCircles, hitBoss, makeBoss } from "../src/game/bosses.js";
import { makeEnemy } from "../src/game/enemies.js";
import { makePickup, rollDrops } from "../src/game/loot.js";
import { createGame, drainEvents, gameSummary, stepGame } from "../src/game/sim.js";
import { CHAPTERS, waveInfo } from "../src/game/waves.js";
import { MAX_LEVEL, WEAPON_ORDER, focusedDps, volley } from "../src/game/weapons.js";

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(state, seconds, input = {}, each) {
  const steps = Math.round(seconds / STEP);
  const events = [];
  for (let i = 0; i < steps && !state.over; i += 1) {
    if (each) each(state);
    stepGame(state, typeof input === "function" ? input(state) : input);
    events.push(...drainEvents(state));
  }
  return events;
}

function finite(list) {
  return list.every((o) => Number.isFinite(o.x) && Number.isFinite(o.y));
}

function godMode(state) {
  state.player.invuln = 10;
}

function hunter(state) {
  const target = state.boss || state.enemies.find((e) => !e.hidden && e.y > 0);
  return { targetX: target ? target.x : W / 2, targetY: H - 140, fire: true };
}

describe("weapons", () => {
  it("adds projectiles and damage with each level", () => {
    for (const type of WEAPON_ORDER) {
      let last = 0;
      for (let level = 1; level <= MAX_LEVEL; level += 1) {
        const dps = focusedDps(type, level);
        expect(dps).toBeGreaterThan(last);
        last = dps;
      }
    }
    expect(volley("pulse", 1, 0, 0)).toHaveLength(1);
    expect(volley("pulse", 6, 0, 0)).toHaveLength(7);
    expect(volley("laser", 6, 0, 0).every((s) => s.pierce > 0)).toBe(true);
    expect(volley("ion", 6, 0, 0).every((s) => s.homing > 0)).toBe(true);
    expect(volley("pulse", 1, 100, 500)[0].vy).toBeLessThan(0);
    expect(volley("pulse", 6, 0, 0).every((shot) => shot.kind === "pulse" && shot.pierce === 0)).toBe(true);
    expect(volley("laser", 6, 0, 0).every((shot) => shot.kind === "lance")).toBe(true);
    expect(volley("ion", 6, 0, 0).every((shot) => shot.kind === "ion")).toBe(true);
  });
});

describe("waves", () => {
  it("ends every chapter with a boss", () => {
    expect(CHAPTERS).toHaveLength(CHAPTER_COUNT);
    for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter += 1) {
      expect(waveInfo(chapter, WAVES_PER_CHAPTER).boss).toBe(true);
      for (let wave = 1; wave < WAVES_PER_CHAPTER; wave += 1) expect(waveInfo(chapter, wave).boss).toBe(false);
    }
  });

  it("builds every wave and keeps it moving on screen", () => {
    for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter += 1) {
      for (let wave = 1; wave <= WAVES_PER_CHAPTER; wave += 1) {
        const state = createGame({ random: seeded(chapter * 31 + wave), chapter, wave });
        expect(state.enemies.length + state.timers.length + (state.boss ? 1 : 0)).toBeGreaterThan(0);
        run(state, 12, { fire: false }, godMode);
        expect(finite(state.enemies)).toBe(true);
        expect(finite(state.eggs)).toBe(true);
        expect(state.over).toBe(false);
        const visible = state.enemies.filter((e) => !e.hidden && e.x > 0 && e.x < W && e.y > 0 && e.y < H);
        expect(visible.length + (state.boss ? 1 : 0)).toBeGreaterThan(0);
      }
    }
  });
});

describe("simulation", () => {
  it("starts with chickens flying in above the ship", () => {
    const state = createGame({ random: seeded(1) });
    expect(state.stage).toBe("intro");
    expect(state.enemies).toHaveLength(32);
    expect(state.player.y).toBe(PLAYER.startY);
    const events = drainEvents(state);
    expect(events[0]).toMatchObject({ type: "wave", chapter: 1, wave: 1 });
    run(state, 4);
    const settled = state.enemies.filter((e) => e.mode === "home");
    expect(settled.length).toBeGreaterThan(20);
    expect(Math.max(...settled.map((e) => e.y))).toBeLessThan(state.player.y - 300);
  });

  it("lays eggs that fall toward the ship", () => {
    const state = createGame({ random: seeded(2) });
    const events = run(state, 10, {}, godMode);
    expect(events.some((e) => e.type === "egg")).toBe(true);
    expect(events.some((e) => e.type === "splat")).toBe(true);
  });

  it("leaves gifts where they are when a wave ends", () => {
    const state = createGame({ random: seeded(11) });
    state.stage = "clear";
    state.player.x = 80;
    const gift = makePickup("power", 640, 180, state.rng);
    gift.vx = 0;
    gift.vy = 0;
    state.pickups.push(gift);
    run(state, 1.2, { fire: false });
    const left = state.pickups.find((k) => k.kind === "power");
    expect(left).toBeTruthy();
    expect(Math.hypot(left.x - state.player.x, left.y - state.player.y)).toBeGreaterThan(250);
  });

  it("clears the first wave and moves on", () => {
    const state = createGame({ random: seeded(3) });
    const events = run(state, 90, hunter, godMode);
    const clear = events.find((e) => e.type === "clear");
    expect(clear).toBeTruthy();
    expect(events.some((e) => e.type === "wave" && e.wave === 2)).toBe(true);
    expect(state.score).toBeGreaterThan(32 * 100);
    expect(gameSummary(state).kills).toBeGreaterThanOrEqual(32);
  });

  it("loses a life to an egg, respawns, and ends the run at zero lives", () => {
    const state = createGame({ random: seeded(4) });
    state.player.invuln = 0;
    state.player.level = 3;
    state.eggs.push({ kind: "egg", x: state.player.x, y: state.player.y, vx: 0, vy: 0, r: 7, t: 0, gravity: 1 });
    let events = run(state, STEP);
    expect(events.find((e) => e.type === "death")).toMatchObject({ lost: true, level: 2 });
    expect(state.player.lives).toBe(PLAYER.lives - 1);
    expect(state.player.level).toBe(2);
    events = run(state, PLAYER.respawnDelay + 0.1);
    expect(events.some((e) => e.type === "respawn")).toBe(true);
    for (let i = 0; i < PLAYER.lives; i += 1) {
      run(state, PLAYER.invuln + 0.1, {}, (s) => {
        if (s.player.alive && s.player.invuln <= 0) {
          s.eggs.push({ kind: "pellet", x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 6, t: 0, gravity: 1 });
        }
      });
      run(state, PLAYER.respawnDelay + 0.1);
    }
    run(state, 3);
    expect(state.over).toBe(true);
    expect(state.player.lives).toBe(0);
  });

  it("overheats under constant fire and cools down", () => {
    const state = createGame({ random: seeded(5) });
    const events = run(state, 40, { fire: true }, godMode);
    expect(events.some((e) => e.type === "overheat")).toBe(true);
    run(state, 4, { fire: false }, godMode);
    expect(state.player.overheated).toBe(false);
    expect(state.player.heat).toBeLessThan(HEAT.unlockAt);
  });

  it("applies power, weapon crates, food and nova pickups", () => {
    const state = createGame({ random: seeded(6), chapter: 2 });
    const p = state.player;
    const drop = (kind, extra = {}) => state.pickups.push({ kind, x: p.x, y: p.y, vx: 0, vy: 0, r: 12, t: 1, spin: 0, angle: 0, ...extra });
    for (let i = 0; i < MAX_LEVEL + 2; i += 1) drop("power");
    run(state, STEP);
    expect(p.level).toBe(MAX_LEVEL);
    drop("crate", { weapon: "pulse" });
    run(state, STEP);
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.weapon).toBe("pulse");
    drop("crate", { weapon: "laser" });
    run(state, STEP);
    expect(p.weapon).toBe("laser");
    for (let i = 0; i < 24; i += 1) drop("cob");
    run(state, STEP);
    expect(p.bombs).toBe(PLAYER.bombs + 1);
    state.eggs.push({ kind: "egg", x: 100, y: 300, vx: 0, vy: 0, r: 7, t: 0, gravity: 1 });
    run(state, 3, {}, godMode);
    const before = state.enemies.length;
    const events = run(state, 0.6, { bomb: true }, godMode);
    expect(events.some((e) => e.type === "nova")).toBe(true);
    expect(state.enemies.length).toBeLessThan(before);
    expect(p.bombs).toBe(PLAYER.bombs);
  });

  it("raises survival drops when only one or two ships remain (not in final chapters)", () => {
    expect(playerPity({ lives: 1 }, 5).drop).toBeGreaterThan(1);
    expect(playerPity({ lives: 3 }, 5).drop).toBe(1);
    expect(playerPity({ lives: 5 }, 5).drop).toBeLessThan(1);
    expect(playerPity({ lives: 1 }, CHAPTER_COUNT - 1).drop).toBe(1);
    const enemy = { kind: "hen", r: 24, carrier: null, chapter: 5 };
    const helpKinds = new Set(["life", "shield", "power", "coolant"]);
    function helpfulCount(lives, chapter, seed) {
      let n = 0;
      for (let i = 0; i < 2400; i += 1) {
        const drops = rollDrops(enemy, seeded(seed + i), { weapon: "pulse", weapons: ["pulse", "laser"], level: 3, lives });
        if (drops.some((d) => helpKinds.has(d.kind))) n += 1;
      }
      return n;
    }
    expect(helpfulCount(1, 5, 900)).toBeGreaterThan(helpfulCount(3, 5, 900));
    expect(helpfulCount(5, 5, 1200)).toBeLessThan(helpfulCount(3, 5, 1200));
  });

  it("lets some chickens drop a meal worth several coins", () => {
    let n = 0;
    const values = [0.1, 0.012, 0.9];
    const rng = () => values[n++] ?? 0.9;
    const drops = rollDrops({ kind: "hen", r: 24, carrier: null }, rng, { weapon: "pulse", weapons: ["pulse"] });
    expect(drops).toEqual([{ kind: "burger" }]);
    const state = createGame({ random: seeded(3) });
    const before = state.player.food;
    const meal = makePickup("burger", state.player.x, state.player.y, state.rng);
    meal.t = 1;
    state.pickups.push(meal);
    run(state, STEP);
    expect(state.player.food).toBe(before + 6);
  });

  it("locks later weapons until their chapter and fires wing rockets in chapter 4", () => {
    const early = createGame({ random: seeded(8) });
    expect(early.player.weapons).toEqual(["pulse"]);
    expect(early.player.rockets).toBe(false);
    expect(early.enemies.some((e) => e.carrier === "crate" || e.carrier === "power")).toBe(false);
    early.pickups.push({ kind: "crate", x: early.player.x, y: early.player.y, vx: 0, vy: 0, r: 12, t: 1, spin: 0, angle: 0, weapon: "ion" });
    run(early, STEP);
    expect(early.player.weapon).toBe("pulse");
    const mid = createGame({ random: seeded(8), chapter: 1, wave: 4 });
    expect(mid.enemies.filter((e) => e.carrier === "power")).toHaveLength(1);
    const late = createGame({ random: seeded(9), chapter: 4, wave: 1 });
    expect(late.player.weapons).toEqual(["pulse", "laser", "ion"]);
    expect(late.player.rockets).toBe(true);
    const events = run(late, 1, { fire: true }, godMode);
    expect(events.some((e) => e.type === "rocket")).toBe(true);
    const foe = makeEnemy(late.nextId, "hen", 4, { x: 360, y: 400, slotX: 360, slotY: 400, mode: "home", hidden: false });
    late.nextId += 1;
    late.enemies.push(foe);
    late.shots.push({ kind: "rocket", x: 360, y: 400, vx: 0, vy: 0, dmg: 2.6, r: 12, pierce: 0, homing: 0, life: 2, level: 1 });
    const impact = run(late, STEP);
    expect(impact.some((e) => e.type === "rocket_hit")).toBe(true);
    expect(foe.dead).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const a = createGame({ random: seeded(7) });
    const b = createGame({ random: seeded(7) });
    run(a, 20, hunter, godMode);
    run(b, 20, hunter, godMode);
    expect(a.score).toBe(b.score);
    expect(a.enemies.length).toBe(b.enemies.length);
  });
});

describe("bosses", () => {
  it("ignores damage during the intro and loses health afterwards", () => {
    const boss = makeBoss("grandhen");
    const core = bossCircles(boss).at(-3);
    expect(hitBoss(boss, core.x, core.y, 4, 5)).toBe("immune");
    boss.intro = 0;
    expect(hitBoss(boss, boss.x, boss.y, 4, 5)).toBe("hit");
    expect(boss.hp).toBe(boss.maxHp - 5);
  });

  it("armours the carrier core until its turrets fall", () => {
    const boss = makeBoss("carrier");
    boss.intro = 0;
    expect(hitBoss(boss, boss.x, boss.y - 40, 4, 10)).toBe("armored");
    expect(boss.hp).toBe(boss.maxHp - 2);
    for (const part of boss.parts) {
      let result = null;
      while (result !== "part_down") result = hitBoss(boss, part.x, part.y, 4, 50);
    }
    expect(hitBoss(boss, boss.x, boss.y - 40, 4, 10)).toBe("hit");
  });

  it("runs each boss fight to the end", () => {
    for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter += 1) {
      const state = createGame({ random: seeded(40 + chapter), chapter, wave: WAVES_PER_CHAPTER });
      state.player.level = MAX_LEVEL;
      const events = run(state, 240, hunter, godMode);
      expect(finite(state.eggs)).toBe(true);
      expect(events.some((e) => e.type === "boss_attack")).toBe(true);
      expect(events.some((e) => e.type === "boss_dead")).toBe(true);
      const next = events.find((e) => e.type === (chapter < CHAPTER_COUNT ? "warp" : "victory_start"));
      expect(next).toBeTruthy();
    }
  });
});
