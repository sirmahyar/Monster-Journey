export const WORLD_W = 960;
export const WORLD_H = 540;
export const MAX_WEAPON = 6;

export const CHAPTERS = Object.freeze([
  Object.freeze({ name: "Barnyard Orbit", speed: 78, eggEvery: 2.5, dive: false, roosters: false, hp: 1 }),
  Object.freeze({ name: "Egg Storm", speed: 96, eggEvery: 1.35, dive: true, roosters: false, hp: 2 }),
  Object.freeze({ name: "Meteor Coop", speed: 118, eggEvery: 1.05, dive: true, roosters: true, hp: 3 }),
  Object.freeze({ name: "The Henship", speed: 132, eggEvery: 0.85, dive: true, roosters: true, hp: 4 }),
]);

const BOSS_NAMES = ["Giant Hen", "Egg Carrier", "Armored Rooster", "Henship"];

/** @param {number} level @param {number} x @param {number} y */
export function shotPattern(level, x, y) {
  const tier = Math.max(1, Math.min(MAX_WEAPON, level));
  const bolt = (oy, vy, damage = 1, missile = false) => ({
    x: x + 22,
    y: y + oy,
    vx: missile ? 420 : 560,
    vy,
    r: missile ? 8 : 5,
    damage,
    missile,
  });
  if (tier === 1) return [bolt(0, 0)];
  if (tier === 2) return [bolt(-8, 0), bolt(8, 0)];
  if (tier === 3) return [bolt(0, -90), bolt(0, 0), bolt(0, 90)];
  if (tier === 4) return [bolt(-14, 0), bolt(-5, 0), bolt(5, 0), bolt(14, 0)];
  if (tier === 5) return [bolt(0, -150), bolt(0, -75), bolt(0, 0), bolt(0, 75), bolt(0, 150)];
  return [bolt(0, -110), bolt(0, -40), bolt(0, 40), bolt(0, 110), bolt(-6, -36, 4, true), bolt(-6, 36, 4, true)];
}

/**
 * @param {{ x: number, y: number, r: number }} a
 * @param {{ x: number, y: number, r: number }} b
 */
export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = a.r + b.r;
  return dx * dx + dy * dy <= reach * reach;
}

/** @param {() => number} [random] */
export function createRun(random = Math.random) {
  const state = {
    random,
    phase: "play",
    chapter: 0,
    wave: 0,
    lives: 3,
    bombs: 2,
    weapon: 1,
    shield: 0,
    score: 0,
    combo: 0,
    comboTime: 0,
    hitThisWave: false,
    x: 120,
    y: WORLD_H / 2,
    fireCd: 0,
    invuln: 0,
    time: 0,
    clearDelay: 0,
    waiting: false,
    banner: CHAPTERS[0].name,
    bannerTime: 1.6,
    shots: [],
    enemies: [],
    eggs: [],
    gifts: [],
    spawns: [],
    nextId: 1,
    sounds: [],
  };
  queueWave(state);
  return state;
}

/**
 * @param {ReturnType<typeof createRun>} state
 * @param {{ ax?: number, ay?: number, targetX?: number | null, targetY?: number | null, fire?: boolean, bomb?: boolean }} input
 * @param {number} dt
 */
export function step(state, input, dt) {
  if (state.phase !== "play") return state;
  const frame = Math.min(0.05, Math.max(0, dt));
  state.time += frame;
  state.sounds.length = 0;
  if (state.bannerTime > 0) state.bannerTime -= frame;
  if (state.comboTime > 0) {
    state.comboTime -= frame;
    if (state.comboTime <= 0) state.combo = 0;
  }
  movePlayer(state, input, frame);
  if (input.bomb) useBomb(state);
  if (input.fire) fire(state, frame);
  else state.fireCd = Math.max(0, state.fireCd - frame);
  if (state.invuln > 0) state.invuln -= frame;
  moveActors(state, frame);
  collide(state);
  if (state.phase !== "play") return state;
  watchWave(state, frame);
  return state;
}

/** @param {ReturnType<typeof createRun>} state */
function queueWave(state) {
  const chapter = CHAPTERS[state.chapter];
  state.banner = state.wave === 4 ? `${chapter.name} · ${BOSS_NAMES[state.chapter]}` : `${chapter.name} · Wave ${state.wave + 1}`;
  state.bannerTime = 1.6;
  state.spawns = [];
  state.waiting = false;
  if (state.wave === 4) {
    state.enemies.push(makeBoss(state));
    return;
  }
  const count = 8 + state.chapter * 2 + state.wave * 2;
  for (let index = 0; index < count; index += 1) {
    const col = index % 4;
    const row = Math.floor(index / 4) % 5;
    let kind = "hen";
    if (chapter.roosters && index % 5 === 4) kind = "rooster";
    else if (index % 3 === 2) kind = "chick";
    state.spawns.push({
      delay: 0.45 + index * Math.max(0.18, 0.38 - state.chapter * 0.04),
      kind,
      x: WORLD_W + 30 + col * 48,
      y: 78 + row * 78,
    });
  }
}

/** @param {ReturnType<typeof createRun>} state */
function makeBoss(state) {
  const names = ["giant", "carrier", "charger", "henship"];
  const hp = 40 + state.chapter * 28;
  return enemy(state, {
    kind: "boss",
    boss: names[state.chapter],
    x: WORLD_W - 120,
    y: WORLD_H / 2,
    hp,
    maxHp: hp,
    r: state.chapter === 3 ? 78 : 58,
    score: 2500 + state.chapter * 500,
  });
}

/**
 * @param {ReturnType<typeof createRun>} state
 * @param {object} fields
 */
function enemy(state, fields) {
  const id = state.nextId;
  state.nextId += 1;
  return {
    id,
    kind: "hen",
    boss: "",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 1,
    maxHp: 1,
    r: 18,
    score: 100,
    age: 0,
    eggCd: 1.2,
    dived: false,
    ...fields,
  };
}

function movePlayer(state, input, frame) {
  const speed = 320;
  let vx = clamp(Number(input.ax) || 0, -1, 1) * speed;
  let vy = clamp(Number(input.ay) || 0, -1, 1) * speed;
  if (typeof input.targetX === "number" && typeof input.targetY === "number") {
    const dx = input.targetX - state.x;
    const dy = input.targetY - state.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      vx += (dx / dist) * speed;
      vy += (dy / dist) * speed;
    }
  }
  state.x = clamp(state.x + vx * frame, 36, WORLD_W - 36);
  state.y = clamp(state.y + vy * frame, 36, WORLD_H - 36);
}

function fire(state, frame) {
  state.fireCd -= frame;
  const interval = state.weapon >= MAX_WEAPON ? 0.2 : 0.14;
  if (state.fireCd > 0) return;
  state.fireCd = interval;
  const pattern = shotPattern(state.weapon, state.x, state.y);
  for (const shot of pattern) {
    state.shots.push({ ...shot, id: state.nextId });
    state.nextId += 1;
  }
  state.sounds.push("shoot");
}

function useBomb(state) {
  if (state.bombs <= 0) return;
  state.bombs -= 1;
  state.eggs.length = 0;
  for (const foe of state.enemies) foe.hp -= 8;
  state.sounds.push("bomb");
  reapEnemies(state);
}

function moveActors(state, frame) {
  const chapter = CHAPTERS[state.chapter];
  const due = [];
  const waiting = [];
  for (const spawn of state.spawns) {
    const nextDelay = spawn.delay - frame;
    if (nextDelay <= 0) due.push(spawn);
    else waiting.push({ ...spawn, delay: nextDelay });
  }
  state.spawns = waiting;
  for (const spawn of due) {
    const spec = kindSpec(spawn.kind, chapter);
    state.enemies.push(enemy(state, {
      kind: spawn.kind,
      x: spawn.x,
      y: spawn.y,
      hp: spec.hp,
      maxHp: spec.hp,
      r: spec.r,
      score: spec.score,
      vx: spec.vx,
    }));
  }

  for (const foe of state.enemies) {
    foe.age += frame;
    foe.eggCd -= frame;
    if (foe.kind === "boss") moveBoss(state, foe, frame, chapter);
    else {
      const drift = foe.vx == null ? -chapter.speed : foe.vx;
      foe.x += drift * frame;
      foe.y += Math.sin(state.time * 2.2 + foe.id) * 28 * frame;
      if (chapter.dive && !foe.dived && foe.age > 2.4 && foe.x < WORLD_W - 80) {
        foe.dived = true;
        foe.vy = (state.y - foe.y) * 0.8;
        foe.vx = -chapter.speed * 1.7;
      }
      if (foe.dived) foe.y += (foe.vy || 0) * frame;
      if (foe.eggCd <= 0 && foe.x < WORLD_W - 10 && foe.x > 80) {
        foe.eggCd = chapter.eggEvery;
        layEgg(state, foe.x, foe.y, foe.kind === "rooster" ? 2 : 1);
      }
    }
    foe.y = clamp(foe.y, foe.r, WORLD_H - foe.r);
  }
  state.enemies = state.enemies.filter((foe) => foe.x > -80);

  for (const shot of state.shots) {
    shot.x += shot.vx * frame;
    shot.y += shot.vy * frame;
  }
  state.shots = state.shots.filter((shot) => shot.x < WORLD_W + 40 && shot.y > -40 && shot.y < WORLD_H + 40);

  for (const egg of state.eggs) {
    egg.x += egg.vx * frame;
    egg.y += egg.vy * frame;
  }
  state.eggs = state.eggs.filter((egg) => egg.y < WORLD_H + 30 && egg.x > -40);

  for (const gift of state.gifts) {
    gift.x -= 40 * frame;
    gift.y += Math.sin(state.time * 3 + gift.id) * 16 * frame;
  }
  state.gifts = state.gifts.filter((gift) => gift.x > -30);
}

function moveBoss(state, foe, frame, chapter) {
  foe.x += Math.cos(foe.age * 0.7) * 12 * frame;
  if (foe.boss === "carrier") foe.y = WORLD_H / 2 + Math.sin(foe.age * 1.3) * 180;
  else if (foe.boss === "charger") {
    const cycle = foe.age % 3.2;
    foe.vx = cycle < 0.8 ? -280 : 90;
    foe.x += foe.vx * frame;
    if (foe.x < 520) foe.x = 520;
  } else foe.y = WORLD_H / 2 + Math.sin(foe.age) * (foe.boss === "henship" ? 80 : 140);
  if (foe.eggCd <= 0) {
    foe.eggCd = Math.max(0.35, chapter.eggEvery * 0.45);
    if (foe.boss === "henship") {
      layEgg(state, foe.x - 20, foe.y - 40, 1);
      layEgg(state, foe.x - 30, foe.y, 1);
      layEgg(state, foe.x - 20, foe.y + 40, 1);
    } else if (foe.boss === "carrier") {
      layEgg(state, foe.x, foe.y - 20, 1);
      layEgg(state, foe.x, foe.y + 20, 1);
    } else layEgg(state, foe.x - 10, foe.y, foe.boss === "giant" ? 2 : 1);
  }
}

function layEgg(state, x, y, count) {
  for (let index = 0; index < count; index += 1) {
    state.eggs.push({
      id: state.nextId,
      x,
      y: y + (index - (count - 1) / 2) * 14,
      vx: -30,
      vy: 150,
      r: 8,
    });
    state.nextId += 1;
  }
}

function kindSpec(kind, chapter) {
  if (kind === "chick") return { hp: 1, r: 12, score: 50, vx: -chapter.speed * 1.45 };
  if (kind === "rooster") return { hp: chapter.hp * 3, r: 24, score: 250, vx: -chapter.speed * 0.72 };
  return { hp: chapter.hp, r: 18, score: 100, vx: -chapter.speed };
}

function collide(state) {
  const player = { x: state.x, y: state.y, r: 16 };
  for (const shot of state.shots) {
    if (shot.spent) continue;
    for (const egg of state.eggs) {
      if (egg.spent) continue;
      if (circlesOverlap(shot, egg)) {
        shot.spent = true;
        egg.spent = true;
        addScore(state, 10);
      }
    }
    for (const foe of state.enemies) {
      if (shot.spent || foe.hp <= 0) continue;
      if (!circlesOverlap(shot, foe)) continue;
      shot.spent = true;
      foe.hp -= shot.damage;
      if (foe.hp <= 0) destroyEnemy(state, foe);
    }
  }
  state.shots = state.shots.filter((shot) => !shot.spent);
  state.eggs = state.eggs.filter((egg) => !egg.spent);
  reapEnemies(state);

  if (state.invuln > 0 || state.phase !== "play") return;
  const hazards = [
    ...state.enemies.map((foe) => ({ x: foe.x, y: foe.y, r: foe.r })),
    ...state.eggs,
  ];
  for (const hazard of hazards) {
    if (!circlesOverlap(player, hazard)) continue;
    hurt(state);
    break;
  }
  for (const gift of state.gifts) {
    if (gift.spent) continue;
    if (!circlesOverlap(player, gift)) continue;
    gift.spent = true;
    applyGift(state, gift.gift);
  }
  state.gifts = state.gifts.filter((gift) => !gift.spent);
}

function reapEnemies(state) {
  const alive = [];
  for (const foe of state.enemies) {
    if (foe.hp > 0) alive.push(foe);
    else if (!foe.rewarded) destroyEnemy(state, foe);
  }
  state.enemies = alive.filter((foe) => !foe.rewarded);
}

function destroyEnemy(state, foe) {
  if (foe.rewarded) return;
  foe.rewarded = true;
  addScore(state, foe.score);
  state.sounds.push(foe.kind === "boss" ? "boss" : "pop");
  if (state.random() < 0.22) {
    const kinds = ["weapon", "shield", "bomb", "life", "score"];
    const gift = kinds[Math.floor(state.random() * kinds.length)];
    state.gifts.push({ id: state.nextId, x: foe.x, y: foe.y, r: 14, gift, spent: false });
    state.nextId += 1;
  }
}

function addScore(state, amount) {
  state.combo += 1;
  state.comboTime = 2;
  const multiplier = Math.min(8, state.combo);
  state.score += amount * multiplier;
}

function applyGift(state, gift) {
  state.sounds.push("gift");
  if (gift === "weapon") state.weapon = Math.min(MAX_WEAPON, state.weapon + 1);
  else if (gift === "shield") state.shield = 1;
  else if (gift === "bomb") state.bombs = Math.min(6, state.bombs + 1);
  else if (gift === "life") state.lives = Math.min(7, state.lives + 1);
  else state.score += 500;
}

function hurt(state) {
  if (state.shield > 0) {
    state.shield = 0;
    state.invuln = 0.45;
    state.sounds.push("shield");
    return;
  }
  state.lives -= 1;
  state.weapon = Math.max(1, state.weapon - 1);
  state.combo = 0;
  state.hitThisWave = true;
  state.invuln = 1.5;
  state.sounds.push("hurt");
  if (state.lives <= 0) state.phase = "game_over";
}

function watchWave(state, frame) {
  if (state.spawns.length > 0 || state.enemies.length > 0 || state.eggs.length > 0) {
    state.waiting = false;
    return;
  }
  if (!state.waiting) {
    state.waiting = true;
    state.clearDelay = 1.1;
    if (!state.hitThisWave) state.score += 500 * (state.chapter + 1);
    state.sounds.push("clear");
    return;
  }
  state.clearDelay -= frame;
  if (state.clearDelay > 0) return;
  state.hitThisWave = false;
  if (state.wave >= 4) {
    if (state.chapter >= CHAPTERS.length - 1) {
      state.phase = "victory";
      state.banner = "Orbit clear";
      return;
    }
    state.chapter += 1;
    state.wave = 0;
  } else state.wave += 1;
  state.time = 0;
  queueWave(state);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
