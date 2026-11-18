import {
  CHAPTER_COUNT,
  COMBO_WINDOW,
  EGG_GRAVITY,
  EGG_MAX_FALL,
  FLOOR_Y,
  FOOD_PER_BOMB,
  H,
  HEAT,
  MAX_COMBO_MULT,
  PLAYER,
  STEP,
  W,
  WAVES_PER_CHAPTER,
} from "./config.js";
import { bombBoss, bossCircles, hitBoss, makeBoss, updateBoss } from "./bosses.js";
import { ENEMY_TYPES, fireFrom, makeEnemy, moveEnemy, startDive } from "./enemies.js";
import { PICKUPS, bossLoot, makePickup, rollDrops, updatePickup } from "./loot.js";
import { TAU, clamp, easeInOutSine, lerp, overlap, rand, steer } from "./math.js";
import { CHAPTERS, buildWave, waveInfo, wavePacing } from "./waves.js";
import { MAX_LEVEL, WEAPONS, arsenal, chapterGift, rocketsUnlocked, volley } from "./weapons.js";

const INTRO_TIME = 1.9;
const CLEAR_TIME = 2.2;
const WARP_TIME = 3.2;
const DEAD_TIME = 2.2;
const VICTORY_TIME = 4;
const FROST_TIME = 6;
const SHIELD_TIME = 8;
/** Hazards are drawn at full radius but only the inner part of them hurts. */
const HAZARD_HIT = 0.58;

function emit(state, type, data = {}) {
  state.events.push({ type, ...data });
}

function setStage(state, stage) {
  state.stage = stage;
  state.stageTime = 0;
}

export function createGame({ random = Math.random, chapter = 1, wave = 1, resume = null } = {}) {
  const state = {
    rng: random,
    time: 0,
    stage: "intro",
    stageTime: 0,
    chapter,
    wave,
    info: waveInfo(chapter, wave),
    player: {
      x: W / 2,
      y: PLAYER.startY,
      vx: 0,
      vy: 0,
      tilt: 0,
      alive: true,
      respawn: 0,
      invuln: PLAYER.invuln,
      shield: 0,
      frost: 0,
      haste: 0,
      magnet: 0,
      lives: PLAYER.lives,
      bombs: PLAYER.bombs,
      food: 0,
      weapon: "pulse",
      weapons: arsenal(chapter),
      rockets: rocketsUnlocked(chapter),
      rocketCd: 0,
      rocketSide: 1,
      level: 1,
      heat: 0,
      overheated: false,
      fireCd: 0,
      firing: false,
      volley: 0,
    },
    shots: [],
    eggs: [],
    enemies: [],
    pickups: [],
    beams: [],
    timers: [],
    boss: null,
    nova: null,
    formation: { t: 0, ox: 0, oy: 0, ax: 60, ay: 12, fx: 0.5, fy: 1.2 },
    pacing: { eggRate: 0, diveRate: 0, diveLoop: 0 },
    eggClock: 0,
    diveClock: 0,
    waveSize: 1,
    waveDeaths: 0,
    nextId: 1,
    score: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    stats: { kills: 0, fired: 0, hits: 0, bestCombo: 0, food: 0, bosses: 0, deaths: 0, time: 0 },
    bombHeld: false,
    over: false,
    victory: false,
    events: [],
    checkpoint: null,
  };
  if (resume && resume.chapter === chapter) {
    state.score = resume.score || 0;
    state.stats = { ...state.stats, ...resume.stats };
    const p = state.player;
    p.lives = resume.lives;
    p.bombs = resume.bombs;
    p.food = resume.food || 0;
    p.level = resume.level || 1;
    p.weapon = resume.weapon || p.weapon;
    p.weapons = resume.weapons || p.weapons;
    p.rockets = Boolean(resume.rockets);
  }
  startWave(state);
  return state;
}

function addEnemy(state, kind, fields) {
  const enemy = makeEnemy(state.nextId, kind, state.chapter, fields);
  state.nextId += 1;
  state.enemies.push(enemy);
  return enemy;
}

function shotPace(chapter) {
  return 0.68 + 0.07 * (chapter - 1);
}

function addEgg(state, spec) {
  const pace = shotPace(state.chapter);
  state.eggs.push({
    t: 0,
    gravity: 1,
    ...spec,
    vx: (spec.vx || 0) * pace,
    vy: (spec.vy || 0) * pace,
  });
}

function spawnGolden(state) {
  const dir = state.rng() < 0.5 ? 1 : -1;
  addEnemy(state, "golden", {
    mode: "flyby",
    dir,
    x: dir > 0 ? -60 : W + 60,
    y: 150,
    baseY: rand(state.rng, 110, 220),
    speed: 100,
    passes: 0,
  });
  emit(state, "golden", {});
}

function startWave(state) {
  const info = waveInfo(state.chapter, state.wave);
  state.info = info;
  setStage(state, "intro");
  state.pacing = wavePacing(info);
  state.eggClock = 0;
  state.diveClock = 0;
  state.waveDeaths = 0;
  state.timers = [];
  state.beams = [];
  state.formation.t = 0;
  emit(state, "wave", {
    chapter: info.chapter,
    wave: info.wave,
    name: info.name,
    chapterName: info.chapterName,
    boss: info.boss,
    template: info.template,
    bossKind: info.bossKind,
  });
  if (info.boss) {
    state.boss = makeBoss(info.bossKind);
    emit(state, "boss_intro", { name: state.boss.name, kind: info.bossKind });
  } else {
    buildWave(
      {
        rng: state.rng,
        spawn: (kind, fields) => addEnemy(state, kind, fields),
        later: (at, fn) => state.timers.push({ at, fn, optional: false }),
        setFormation: (sway) => Object.assign(state.formation, sway),
        spawnGolden: () => spawnGolden(state),
        drop: (spec) => addEgg(state, spec),
      },
      info,
    );
    if (info.template !== "rocks" && state.rng() < 0.15) {
      state.timers.push({ at: rand(state.rng, 6, 14), optional: true, fn: () => spawnGolden(state) });
    }
  }
  state.waveSize = Math.max(1, state.enemies.filter((e) => ENEMY_TYPES[e.kind].egg).length);
  if (state.wave === 1) {
    const p = state.player;
    state.checkpoint = {
      chapter: state.chapter,
      score: state.score,
      lives: p.lives,
      bombs: p.bombs,
      food: p.food,
      level: p.level,
      weapon: p.weapon,
      weapons: p.weapons.slice(),
      rockets: p.rockets,
      stats: { ...state.stats },
    };
  }
}

function advance(state) {
  state.enemies = [];
  state.timers = [];
  if (state.wave < WAVES_PER_CHAPTER) {
    state.wave += 1;
    startWave(state);
    return;
  }
  if (state.chapter < CHAPTER_COUNT) {
    setStage(state, "warp");
    const p = state.player;
    const next = state.chapter + 1;
    if (p.lives < PLAYER.maxLives) p.lives += 1;
    p.weapons = arsenal(next);
    p.rockets = rocketsUnlocked(next);
    if (!p.weapons.includes(p.weapon)) p.weapon = "pulse";
    emit(state, "warp", { chapter: next, name: CHAPTERS[state.chapter].name, gift: chapterGift(next) });
    return;
  }
  setStage(state, "victory");
  emit(state, "victory_start", {});
}

function updateStage(state) {
  const t = state.stageTime;
  if (state.stage === "intro" && t >= INTRO_TIME) setStage(state, "active");
  else if (state.stage === "clear" && t >= CLEAR_TIME) advance(state);
  else if (state.stage === "warp" && t >= WARP_TIME) {
    state.chapter += 1;
    state.wave = 1;
    startWave(state);
  } else if (state.stage === "dead" && t >= DEAD_TIME) {
    state.over = true;
    emit(state, "gameover", { score: state.score });
  } else if (state.stage === "victory" && t >= VICTORY_TIME) {
    state.over = true;
    state.victory = true;
    emit(state, "victory", { score: state.score });
  }
}

function cool(state, p, dt) {
  const rate = p.overheated ? HEAT.coolLocked : p.firing ? HEAT.coolFiring : HEAT.coolIdle;
  p.heat = Math.max(0, p.heat - rate * dt);
  if (p.overheated && p.heat <= HEAT.unlockAt) {
    p.overheated = false;
    emit(state, "cooled", {});
  }
}

function updatePlayer(state, input, dt) {
  const p = state.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.shield = Math.max(0, p.shield - dt);
  p.frost = Math.max(0, p.frost - dt);
  p.haste = Math.max(0, (p.haste || 0) - dt);
  p.magnet = Math.max(0, (p.magnet || 0) - dt);
  if (!p.alive) {
    p.firing = false;
    cool(state, p, dt);
    if (state.stage !== "dead") {
      p.respawn -= dt;
      if (p.respawn <= 0) respawn(state);
    }
    return;
  }
  const px = p.x;
  const py = p.y;
  if (input.targetX != null && input.targetY != null) {
    const dx = input.targetX - p.x;
    const dy = input.targetY - p.y;
    const dist = Math.hypot(dx, dy);
    const reach = PLAYER.pointerSpeed * dt;
    if (dist > reach) {
      p.x += (dx / dist) * reach;
      p.y += (dy / dist) * reach;
    } else {
      p.x = input.targetX;
      p.y = input.targetY;
    }
  } else {
    let mx = input.moveX || 0;
    let my = input.moveY || 0;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    p.x += mx * PLAYER.keySpeed * dt;
    p.y += my * PLAYER.keySpeed * dt;
  }
  p.x = clamp(p.x, 24, W - 24);
  p.y = clamp(p.y, PLAYER.minY, PLAYER.maxY);
  p.vx = (p.x - px) / dt;
  p.vy = (p.y - py) / dt;
  p.tilt += (clamp(p.vx / 600, -1, 1) - p.tilt) * Math.min(1, dt * 10);

  const weapon = WEAPONS[p.weapon];
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.rocketCd = Math.max(0, p.rocketCd - dt);
  p.firing = Boolean(input.fire) && !p.overheated && state.stage !== "warp" && state.stage !== "victory";
  if (p.firing && p.fireCd <= 0) {
    p.volley += 1;
    const shots = volley(p.weapon, p.level, p.x, p.y, p.volley);
    for (const s of shots) state.shots.push(s);
    state.stats.fired += shots.length;
    p.fireCd = weapon.rate * (p.haste > 0 ? 0.55 : 1);
    if (p.frost <= 0) p.heat += weapon.heat * 1.21;
    emit(state, "shot", { weapon: p.weapon, level: p.level, x: p.x, y: p.y });
    if (p.rockets && p.rocketCd <= 0) {
      p.rocketCd = 0.85;
      const side = p.rocketSide;
      p.rocketSide = -side;
      state.shots.push({
        kind: "rocket",
        x: p.x + side * 18,
        y: p.y - 8,
        vx: side * (p.volley % 2 === 0 ? 150 : 55),
        vy: -540,
        dmg: 2.6,
        r: 7,
        pierce: 0,
        homing: 2.6,
        life: 2.3,
        level: 1,
      });
      state.stats.fired += 1;
      emit(state, "rocket", { x: p.x + side * 18, y: p.y });
    }
    if (p.heat >= HEAT.max) {
      p.heat = HEAT.max;
      p.overheated = true;
      emit(state, "overheat", { x: p.x, y: p.y });
    }
  }
  cool(state, p, dt);
  if (input.bomb && !state.bombHeld && p.bombs > 0 && !state.nova) launchNova(state);
  state.bombHeld = Boolean(input.bomb);
}

function killPlayer(state) {
  const p = state.player;
  if (!p.alive) return;
  p.alive = false;
  p.lives -= 1;
  const lost = p.level > 1;
  p.level = Math.max(1, p.level - 1);
  p.heat = 0;
  p.overheated = false;
  p.shield = 0;
  p.frost = 0;
  state.waveDeaths += 1;
  state.stats.deaths += 1;
  state.combo = 0;
  state.comboTimer = 0;
  state.multiplier = 1;
  emit(state, "death", { x: p.x, y: p.y, lives: p.lives, level: p.level, lost });
  if (p.lives <= 0) setStage(state, "dead");
  else p.respawn = PLAYER.respawnDelay;
}

function respawn(state) {
  const p = state.player;
  p.alive = true;
  p.x = W / 2;
  p.y = PLAYER.startY;
  p.invuln = PLAYER.invuln;
  p.fireCd = 0.3;
  state.eggs = state.eggs.filter((g) => Math.hypot(g.x - p.x, g.y - p.y) > 180);
  emit(state, "respawn", { x: p.x, y: p.y });
}

function launchNova(state) {
  const p = state.player;
  p.bombs -= 1;
  state.nova = { x: p.x, y: p.y - 24, sx: p.x, sy: p.y - 24, t: 0 };
  emit(state, "nova_launch", { x: p.x, y: p.y });
}

function updateNova(state, dt) {
  const n = state.nova;
  if (!n) return;
  n.t += dt;
  const k = Math.min(1, n.t / 0.5);
  n.x = lerp(n.sx, W / 2, easeInOutSine(k));
  n.y = lerp(n.sy, H * 0.36, 1 - (1 - k) * (1 - k));
  if (k < 1) return;
  state.nova = null;
  emit(state, "nova", { x: n.x, y: n.y, eggs: state.eggs.map((g) => [g.x, g.y]) });
  state.eggs.length = 0;
  state.beams.length = 0;
  const dmg = 30 + 12 * state.chapter;
  for (const e of state.enemies) if (!e.dead && !e.hidden && e.y > -30 && e.y < H) damageEnemy(state, e, dmg, null);
  if (state.boss) bossResult(state, bombBoss(state.boss), state.boss.x, state.boss.y);
  state.player.invuln = Math.max(state.player.invuln, 0.8);
  state.enemies = state.enemies.filter((e) => !e.dead);
}

function damageEnemy(state, e, dmg, shot) {
  if (e.dead) return;
  const x = shot ? shot.x : e.x;
  const y = shot ? shot.y : e.y;
  let rest = dmg;
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, rest);
    e.shield -= absorbed;
    rest -= absorbed;
    emit(state, e.shield > 0 ? "shield_hit" : "shield_break", { x, y, ex: e.x, ey: e.y });
    if (rest <= 0) return;
  }
  e.hp -= rest;
  e.flash = 0.09;
  if (e.hp > 0) emit(state, "hit", { x, y, kind: e.kind });
  else killEnemy(state, e);
}

function killEnemy(state, e) {
  e.dead = true;
  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  const mult = Math.min(MAX_COMBO_MULT, 1 + Math.floor(state.combo / 8));
  if (mult > state.multiplier) emit(state, "combo", { mult, x: e.x, y: e.y });
  state.multiplier = mult;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, state.combo);
  state.stats.kills += 1;
  const points = e.score * mult;
  state.score += points;
  emit(state, "kill", { x: e.x, y: e.y, kind: e.kind, points, variant: e.variant, size: e.size || 0, r: e.r, vx: e.vx, vy: e.vy });
  if (e.kind === "rock" && e.size > 1) {
    for (const side of [-1, 1]) {
      addEnemy(state, "rock", {
        size: e.size - 1,
        mode: "drift",
        x: e.x + side * 8,
        y: e.y,
        dx: (e.dx || 0) * 0.6 + side * rand(state.rng, 60, 120),
        dy: Math.max(90, (e.dy || 150) * rand(state.rng, 0.8, 1.05)),
        spin: rand(state.rng, -3, 3),
        angle: rand(state.rng, 0, TAU),
        variant: e.variant,
        t: 1.1,
      });
    }
    emit(state, "rock_split", { x: e.x, y: e.y, size: e.size });
  }
  for (const drop of rollDrops(e, state.rng, state.player)) state.pickups.push(makePickup(drop.kind, e.x, e.y, state.rng, drop));
}

function bossResult(state, result, x, y) {
  const b = state.boss;
  if (!result || !b) return;
  if (result === "immune") emit(state, "boss_immune", { x, y });
  else if (result === "part_down") {
    state.score += 3000;
    emit(state, "part_down", { x, y, points: 3000 });
  } else if (result === "killed") {
    const points = 20000 * state.chapter;
    state.score += points;
    emit(state, "boss_killed", { x: b.x, y: b.y, kind: b.kind, points });
    for (const e of state.enemies) if (!e.dead) killEnemy(state, e);
    emit(state, "nova", { x: b.x, y: b.y, eggs: state.eggs.map((g) => [g.x, g.y]), quiet: true });
    state.eggs.length = 0;
    state.beams.length = 0;
  } else {
    state.score += 10;
    emit(state, "boss_hit", { x, y, armored: result === "armored", part: result === "part" });
  }
}

function countHit(state, s) {
  if (s.counted) return;
  s.counted = true;
  state.stats.hits += 1;
}

function homeShot(state, s, dt) {
  let target = s.target ? state.enemies.find((e) => e.id === s.target && !e.dead && !e.hidden) : null;
  if (!target) {
    let best = Infinity;
    for (const e of state.enemies) {
      if (e.dead || e.hidden || e.y < -20 || e.y > s.y + 40) continue;
      const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d < best) {
        best = d;
        target = e;
      }
    }
    s.target = target ? target.id : 0;
  }
  const b = state.boss;
  if (target) steer(s, target.x, target.y, s.homing, dt);
  else if (b && b.intro <= 0 && b.dying <= 0) steer(s, b.x, b.y, s.homing, dt);
}

function detonateRocket(state, s, ox, oy) {
  let direct = null;
  const splashed = [];
  const steps = 4;
  for (const e of state.enemies) {
    if (e.dead || e.hidden) continue;
    let near = false;
    let struck = false;
    for (let i = 1; i <= steps; i += 1) {
      const x = ox + (s.x - ox) * (i / steps);
      const y = oy + (s.y - oy) * (i / steps);
      const dist = Math.hypot(e.x - x, e.y - y);
      if (dist <= s.r + e.r + 8) struck = true;
      else if (dist <= 50 + e.r) near = true;
    }
    if (struck) direct = e;
    else if (near) splashed.push(e);
  }
  let bossHit = null;
  if (state.boss) {
    for (let i = 1; i <= steps; i += 1) {
      const x = ox + (s.x - ox) * (i / steps);
      const y = oy + (s.y - oy) * (i / steps);
      const result = hitBoss(state.boss, x, y, s.r + 6, 8);
      if (result) {
        bossHit = result;
        break;
      }
    }
  }
  if (!direct && splashed.length === 0 && !bossHit) return false;
  if (direct) damageEnemy(state, direct, 999, s);
  for (const e of splashed) if (!e.dead) damageEnemy(state, e, 18, s);
  if (bossHit) {
    if (bossHit !== "immune") countHit(state, s);
    bossResult(state, bossHit, s.x, s.y);
  } else countHit(state, s);
  emit(state, "rocket_hit", { x: s.x, y: s.y });
  return true;
}

function collideShot(state, s, ox = s.x, oy = s.y) {
  if (s.kind === "rocket") return detonateRocket(state, s, ox, oy);
  for (const e of state.enemies) {
    if (e.dead || e.hidden || (s.hit && s.hit.includes(e.id))) continue;
    if (!overlap(s.x, s.y, s.r, e.x, e.y, e.r)) continue;
    countHit(state, s);
    damageEnemy(state, e, s.dmg, s);
    if (s.pierce <= 0) return true;
    s.pierce -= 1;
    s.hit = s.hit || [];
    s.hit.push(e.id);
  }
  if (!state.boss) return false;
  const result = hitBoss(state.boss, s.x, s.y, s.r, s.dmg);
  if (!result) return false;
  if (result !== "immune") countHit(state, s);
  bossResult(state, result, s.x, s.y);
  return true;
}

function updateShots(state, dt) {
  let w = 0;
  for (const s of state.shots) {
    s.life -= dt;
    const ox = s.x;
    const oy = s.y;
    if (s.homing) homeShot(state, s, dt);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.life <= 0 || s.y < -40 || s.y > H + 40 || s.x < -40 || s.x > W + 40) continue;
    if (collideShot(state, s, ox, oy)) continue;
    state.shots[w] = s;
    w += 1;
  }
  state.shots.length = w;
  state.enemies = state.enemies.filter((e) => !e.dead);
}

function pickWeighted(rng, list, weightOf) {
  let total = 0;
  for (const item of list) total += weightOf(item);
  let roll = rng() * total;
  for (const item of list) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}

function eggPacer(state, dt) {
  if (!state.player.alive) return;
  const shooters = state.enemies.filter(
    (e) => !e.hidden && ENEMY_TYPES[e.kind].egg && e.mode !== "dive" && e.y > 0 && e.y < H * 0.62 && e.x > 0 && e.x < W,
  );
  if (shooters.length === 0) return;
  state.eggClock += dt * state.pacing.eggRate * (0.35 + 0.65 * Math.min(1, shooters.length / state.waveSize));
  while (state.eggClock >= 1) {
    state.eggClock -= 1;
    const e = pickWeighted(state.rng, shooters, (s) => ENEMY_TYPES[s.kind].eggWeight);
    for (const spec of fireFrom(e, state.player, state.rng, state.chapter)) addEgg(state, spec);
    e.lay = 0.35;
    emit(state, "egg", { x: e.x, y: e.y, kind: e.kind, egg: ENEMY_TYPES[e.kind].egg });
  }
}

function divePacer(state, dt) {
  if (!state.pacing.diveRate || !state.player.alive) return;
  state.diveClock += dt * state.pacing.diveRate;
  while (state.diveClock >= 1) {
    state.diveClock -= 1;
    const ready = state.enemies.filter((e) => !e.hidden && e.mode === "home" && e.home !== "snake" && ENEMY_TYPES[e.kind].dive > 0);
    if (ready.length === 0) return;
    const e = pickWeighted(state.rng, ready, (c) => ENEMY_TYPES[c.kind].dive);
    startDive(e, state.player, state.rng, state.rng() < state.pacing.diveLoop ? "loop" : "swoop");
    emit(state, "dive", { x: e.x, y: e.y, kind: e.kind });
  }
}

function updateEnemies(state, dt) {
  const world = { formation: state.formation, time: state.time, rng: state.rng };
  const p = state.player;
  for (const e of state.enemies) {
    if (e.dead) continue;
    moveEnemy(e, dt, world);
    if (e.lay) e.lay = Math.max(0, e.lay - dt);
    if (e.gone) {
      if (e.kind === "golden") emit(state, "golden_escape", {});
      continue;
    }
    if (e.hidden || !p.alive || !overlap(e.x, e.y, e.r * (e.kind === "rock" ? 0.68 : 0.78), p.x, p.y, PLAYER.radius)) continue;
    if (p.shield > 0) {
      damageEnemy(state, e, 999, null);
      emit(state, "shield_block", { x: p.x, y: p.y });
    } else if (p.invuln <= 0) {
      killPlayer(state);
      damageEnemy(state, e, 999, null);
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead && !e.gone);
  if (state.stage === "active") {
    eggPacer(state, dt);
    divePacer(state, dt);
  }
}

function updateBossState(state, dt) {
  const b = state.boss;
  if (!b) return;
  updateBoss(b, dt, {
    rng: state.rng,
    player: state.player,
    egg: (spec) => addEgg(state, spec),
    beam: (spec) => state.beams.push({ t: 0, top: b.y + 50, fired: false, ...spec }),
    summon: (kind, x, y, style) => {
      const e = addEnemy(state, kind, { x, y, slotX: x, slotY: y, once: true });
      startDive(e, state.player, state.rng, style);
      emit(state, "dive", { x, y, kind });
    },
    event: (type, data) => emit(state, type, data),
  });
  const p = state.player;
  if (p.alive && b.intro <= 0 && b.dying <= 0 && p.invuln <= 0 && p.shield <= 0) {
    if (bossCircles(b).some((c) => overlap(c.x, c.y, c.r * 0.85, p.x, p.y, PLAYER.radius))) killPlayer(state);
  }
  if (!b.dead) return;
  state.boss = null;
  state.stats.bosses += 1;
  emit(state, "boss_dead", { x: b.x, y: b.y, kind: b.kind });
  for (const drop of bossLoot(state.rng, state.player)) state.pickups.push(makePickup(drop.kind, b.x, b.y, state.rng, drop));
  clearWave(state);
}

function bendShot(g, target, dt) {
  const speed = Math.hypot(g.vx, g.vy) || 1;
  const cur = Math.atan2(g.vy, g.vx);
  const aim = Math.atan2(target.y - g.y, target.x - g.x);
  let diff = aim - cur;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  const next = cur + clamp(diff, -g.bend * dt, g.bend * dt);
  g.vx = Math.cos(next) * speed;
  g.vy = Math.sin(next) * speed;
}

function burstRing(spawned, g, count, speed, r) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + g.t;
    spawned.push({ kind: "pellet", x: g.x, y: g.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, t: 0, gravity: 1 });
  }
}

function stepSpiral(g, dt) {
  if (g.ox == null) {
    g.ox = g.x;
    g.oy = g.y;
    g.phase = 0;
  }
  g.ox += g.vx * dt;
  g.oy += g.vy * dt;
  g.phase += (g.spin || 4) * dt;
  const orbit = g.orbit || 28;
  g.x = g.ox + Math.cos(g.phase) * orbit;
  g.y = g.oy + Math.sin(g.phase) * orbit * 0.55;
}

function updateEggs(state, dt) {
  const p = state.player;
  const spawned = [];
  let w = 0;
  for (const g of state.eggs) {
    g.t += dt;
    if (g.weave) g.vx += Math.cos(g.t * 8) * 140 * dt;
    if (g.bend) bendShot(g, p, dt);
    if (g.kind === "egg" || g.kind === "cluster" || g.kind === "bounce" || g.kind === "goldenegg") {
      g.vy = Math.min(EGG_MAX_FALL, g.vy + EGG_GRAVITY * (g.gravity || 1) * dt);
    } else if (g.kind === "yolk") {
      g.vy = Math.min(260, g.vy + 60 * dt);
      g.vx += Math.sin(g.t * 6) * 40 * dt;
    } else if (g.kind === "bigyolk") {
      g.vy = Math.min(220, g.vy + 50 * dt);
    } else if (g.kind === "mine") {
      if (g.t < (g.arm || 0.85)) g.vy = Math.min(80, g.vy + 30 * dt);
      else {
        g.vx *= Math.max(0, 1 - dt * 4);
        g.vy *= Math.max(0, 1 - dt * 4);
      }
    } else if (g.kind === "spiral") {
      g.vy = Math.min(160, g.vy + 20 * dt);
    } else if (g.kind === "missile") {
      steer(g, p.x, p.y, g.homing, dt);
      const speed = Math.hypot(g.vx, g.vy);
      const next = Math.min(g.speed, speed + 220 * dt);
      if (speed > 0) {
        g.vx *= next / speed;
        g.vy *= next / speed;
      }
      g.life -= dt;
      if (g.life <= 0) {
        emit(state, "pop", { x: g.x, y: g.y });
        continue;
      }
    }
    if (g.kind === "bigyolk" && g.y >= g.splitY) {
      burstRing(spawned, g, g.splitCount || 8, 170, 8);
      emit(state, "yolk_split", { x: g.x, y: g.y });
      continue;
    }
    if (g.kind === "cluster" && g.y >= (g.splitY || 480)) {
      for (const vx of [-70, 0, 70]) spawned.push({ kind: "egg", x: g.x, y: g.y, vx, vy: 95, r: 8, t: 0, gravity: 1 });
      emit(state, "yolk_split", { x: g.x, y: g.y });
      continue;
    }
    if (g.kind === "mine" && (g.t >= (g.life || 2.2) || g.y >= FLOOR_Y)) {
      burstRing(spawned, g, 6, 150, 6);
      emit(state, "pop", { x: g.x, y: g.y });
      continue;
    }
    if (g.kind === "spiral") stepSpiral(g, dt);
    else {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    if (g.kind === "bounce" && g.bounces > 0 && (g.x < 18 || g.x > W - 18)) {
      g.vx *= -1;
      g.x = clamp(g.x, 18, W - 18);
      g.bounces -= 1;
    }
    const depth = g.oy == null ? g.y : g.oy;
    if ((g.kind === "egg" || g.kind === "yolk" || g.kind === "bounce" || g.kind === "cluster" || g.kind === "goldenegg") && g.y >= FLOOR_Y) {
      emit(state, "splat", { x: g.x, y: FLOOR_Y, big: g.r > 11, yolk: g.kind === "yolk" });
      continue;
    }
    if (depth > H + 40 || depth < -80 || g.x < -80 || g.x > W + 80) continue;
    if (p.alive && overlap(g.x, g.y, g.r * HAZARD_HIT, p.x, p.y, PLAYER.radius * 0.75)) {
      if (p.shield > 0) {
        emit(state, "shield_block", { x: g.x, y: g.y });
        continue;
      }
      if (p.invuln <= 0) {
        killPlayer(state);
        continue;
      }
    }
    state.eggs[w] = g;
    w += 1;
  }
  state.eggs.length = w;
  for (const g of spawned) state.eggs.push(g);
}

export function beamPhase(b) {
  if (b.t < b.warn) return "warn";
  return b.t < b.warn + b.life ? "active" : "fade";
}

function updateBeams(state, dt) {
  const p = state.player;
  state.beams = state.beams.filter((b) => {
    b.t += dt;
    if (b.fromX != null) b.x = lerp(b.fromX, b.toX, easeInOutSine(clamp((b.t - b.warn) / b.life, 0, 1)));
    const active = beamPhase(b) === "active";
    if (active && !b.fired) {
      b.fired = true;
      emit(state, "beam_fire", { x: b.x });
    }
    if (active && p.alive && p.invuln <= 0 && p.shield <= 0 && p.y > b.top && Math.abs(p.x - b.x) < b.w / 2 + PLAYER.radius * 0.6) {
      killPlayer(state);
    }
    return b.t < b.warn + b.life + 0.3;
  });
}

function collect(state, k) {
  const p = state.player;
  state.score += PICKUPS[k.kind].score;
  if (k.kind === "kernel" || k.kind === "cob" || k.kind === "nugget" || k.kind === "burger" || k.kind === "pizza") {
    p.food += PICKUPS[k.kind].food;
    state.stats.food += PICKUPS[k.kind].food;
    while (p.food >= FOOD_PER_BOMB) {
      p.food -= FOOD_PER_BOMB;
      if (p.bombs < PLAYER.maxBombs) p.bombs += 1;
      else state.score += 5000;
      emit(state, "bomb_gain", { x: p.x, y: p.y });
    }
  } else if (k.kind === "power") {
    if (p.level < MAX_LEVEL) {
      p.level += 1;
      emit(state, "levelup", { level: p.level, x: p.x, y: p.y });
    } else state.score += 2000;
  } else if (k.kind === "crate" && p.weapons.includes(k.weapon) && k.weapon !== p.weapon) {
    p.weapon = k.weapon;
    emit(state, "weapon", { weapon: k.weapon, x: p.x, y: p.y });
  } else if (k.kind === "shield") {
    p.shield = SHIELD_TIME;
    emit(state, "shield_on", { x: p.x, y: p.y });
  } else if (k.kind === "nova") {
    p.bombs = Math.min(PLAYER.maxBombs, p.bombs + 1);
    emit(state, "bomb_gain", { x: p.x, y: p.y });
  } else if (k.kind === "coolant") {
    p.heat = 0;
    p.overheated = false;
    p.frost = FROST_TIME;
    emit(state, "coolant", { x: p.x, y: p.y });
  } else if (k.kind === "life") {
    p.lives = Math.min(PLAYER.maxLives, p.lives + 1);
    emit(state, "life", { x: p.x, y: p.y });
  } else if (k.kind === "haste") {
    p.haste = 7;
    emit(state, "coolant", { x: p.x, y: p.y });
  } else if (k.kind === "magnet") {
    p.magnet = 8;
    emit(state, "shield_on", { x: p.x, y: p.y });
  }
  emit(state, "pickup", { kind: k.kind, weapon: k.weapon, x: k.x, y: k.y, points: PICKUPS[k.kind].score });
}

function updatePickups(state, dt) {
  const p = state.player;
  let w = 0;
  for (const k of state.pickups) {
    updatePickup(k, dt, p);
    if (p.alive && overlap(k.x, k.y, k.r + 10, p.x, p.y, PLAYER.radius)) {
      collect(state, k);
      continue;
    }
    if (k.y > H + 30) continue;
    state.pickups[w] = k;
    w += 1;
  }
  state.pickups.length = w;
}

function updateTimers(state, dt) {
  if ((state.stage !== "intro" && state.stage !== "active") || state.timers.length === 0) return;
  const due = [];
  state.timers = state.timers.filter((t) => {
    t.at -= dt;
    if (t.at > 0) return true;
    due.push(t);
    return false;
  });
  for (const t of due) t.fn();
}

function updateCombo(state, dt) {
  if (state.combo === 0) return;
  state.comboTimer -= dt;
  if (state.comboTimer > 0) return;
  if (state.multiplier > 1) emit(state, "combo_end", { combo: state.combo });
  state.combo = 0;
  state.multiplier = 1;
}

function clearWave(state) {
  setStage(state, "clear");
  const flawless = state.waveDeaths === 0;
  const bonus = (1000 + 250 * state.wave) * state.chapter * (flawless ? 2 : 1);
  state.score += bonus;
  state.timers = [];
  emit(state, "clear", {
    bonus,
    flawless,
    boss: state.info.boss,
    chapter: state.chapter,
    wave: state.wave,
    score: Math.floor(state.score),
  });
}

function checkClear(state) {
  if (state.stage !== "active" || state.boss) return;
  if (state.timers.some((t) => !t.optional)) return;
  if (state.enemies.some((e) => e.kind !== "golden")) return;
  clearWave(state);
}

/**
 * Advances the world by one fixed step.
 * @param {any} state
 * @param {{ moveX?: number, moveY?: number, targetX?: number|null, targetY?: number|null, fire?: boolean, bomb?: boolean }} input
 */
export function stepGame(state, input = {}, dt = STEP) {
  if (state.over) return state;
  state.time += dt;
  state.stageTime += dt;
  if (state.stage !== "dead" && state.stage !== "victory") state.stats.time += dt;
  updateStage(state);
  if (state.over) return state;
  const f = state.formation;
  f.t += dt;
  const ramp = Math.min(1, f.t / 3);
  f.ox = Math.sin(f.t * f.fx) * f.ax * ramp;
  f.oy = Math.sin(f.t * f.fy) * f.ay * ramp;
  updatePlayer(state, input, dt);
  updateTimers(state, dt);
  updateNova(state, dt);
  updateShots(state, dt);
  updateEnemies(state, dt);
  updateBossState(state, dt);
  updateEggs(state, dt);
  updateBeams(state, dt);
  updatePickups(state, dt);
  updateCombo(state, dt);
  checkClear(state);
  return state;
}

export function drainEvents(state) {
  const list = state.events;
  state.events = [];
  return list;
}

export function gameSummary(state) {
  const s = state.stats;
  return {
    score: Math.floor(state.score),
    chapter: state.chapter,
    wave: state.wave,
    kills: s.kills,
    accuracy: s.fired > 0 ? Math.min(1, s.hits / s.fired) : 0,
    bestCombo: s.bestCombo,
    time: s.time,
    food: s.food,
    bosses: s.bosses,
    deaths: s.deaths,
    victory: state.victory,
    checkpoint: state.checkpoint,
  };
}
