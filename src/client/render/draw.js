import { H, W } from "../../game/config.js";
import { drawBackground } from "./background.js";
import { drawBeams, drawBoss } from "./boss-art.js";
import { FRAMES, creatureFlash, creatureSprite } from "./creatures.js";
import { createFx, drawDecals, drawParticles, drawPopups, fxEvent, puff, shakeOffset, trail, updateFx } from "./fx.js";
import { createHud, drawHud, hudEvent } from "./hud.js";
import { drawEggs, drawHazard, drawPickups, drawRock, drawShip, drawShots } from "./items.js";
import { blit, glowDot, rgba, setSpriteScale } from "./paint.js";

const TAU = Math.PI * 2;

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  return {
    canvas,
    ctx: canvas.getContext("2d"),
    fx: createFx(),
    hud: createHud(),
    time: 0,
    pixel: 1,
    warp: 0,
    bg: { chapter: 1, from: 1, fade: 0 },
  };
}

export function resizeRenderer(r, cssWidth, dpr) {
  const pixel = (cssWidth / W) * Math.min(2, dpr || 1);
  r.canvas.width = Math.max(1, Math.round(W * pixel));
  r.canvas.height = Math.max(1, Math.round(H * pixel));
  r.pixel = pixel;
  setSpriteScale(pixel);
}

/** Clears effects so a new run starts from a clean slate. */
export function resetRenderer(r, chapter = 1) {
  r.fx = createFx();
  r.hud = createHud();
  r.bg = { chapter, from: chapter, fade: 0 };
  r.warp = 0;
}

export function handleEvents(r, events) {
  for (const ev of events) {
    fxEvent(r.fx, ev);
    hudEvent(r.hud, ev);
  }
}

/** Slow motion after a boss falls, read by the game loop. */
export function timeScale(r) {
  return r.fx.slow > 0 ? 0.3 + 0.7 * Math.max(0, 1 - r.fx.slow / 1.3) ** 2 : 1;
}

function drawEnemies(ctx, enemies, time) {
  for (const e of enemies) {
    if (e.hidden) continue;
    if (e.kind === "rock" || e.kind === "poop" || e.kind === "net") {
      drawCarrierMark(ctx, e, time, 0);
      if (e.kind === "rock") drawRock(ctx, e, time);
      else drawHazard(ctx, e, time);
      continue;
    }
    const bob = Math.sin(time * 4 + e.phase) * 2;
    drawCarrierMark(ctx, e, time, bob);
    const speed = e.mode === "dive" ? 22 : e.kind === "chick" ? 15 : 10;
    const frame = Math.floor(time * speed + e.phase * 3) % FRAMES;
    const blink = (time + e.id * 0.37) % 3.7 < 0.12;
    const s = creatureSprite(e.kind, e.variant, frame, blink, e.r);
    let rot = Math.max(-0.3, Math.min(0.3, e.vx / 900));
    if (e.mode === "dive") rot = Math.max(-0.9, Math.min(0.9, Math.atan2(e.vy, e.vx) - Math.PI / 2));
    const lay = e.lay > 0 ? Math.sin((e.lay / 0.35) * Math.PI) * 0.14 : 0;
    blit(ctx, s, e.x, e.y + bob, rot, 1 + lay, 1 - lay);
    if (e.flash > 0) blit(ctx, creatureFlash(e.kind, e.variant, frame, blink, e.r), e.x, e.y + bob, rot, 1 + lay, 1 - lay, Math.min(1, e.flash / 0.09));
    if (e.maxBombShield > 0 && e.bombShield > 0) {
      ctx.save();
      ctx.strokeStyle = rgba("#ff4fd8", 0.45 + 0.35 * (e.bombShield / e.maxBombShield));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y + bob, e.r * 1.5, time * 2, time * 2 + 4.2);
      ctx.stroke();
      ctx.restore();
    }
    if (e.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const k = e.shield / e.maxShield;
      ctx.strokeStyle = rgba("#7fe8ff", 0.35 + 0.45 * k);
      ctx.lineWidth = 2 + k * 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y + bob, e.r * 1.35, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba("#7fe8ff", 0.08 + 0.08 * k);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawCarrierMark(ctx, e, time, bob) {
  if (e.carrier !== "power") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulse = 0.55 + 0.35 * Math.sin(time * 6 + e.id);
  ctx.strokeStyle = `rgba(255, 148, 32, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(e.x, e.y + bob, e.r * 1.75, 0, TAU);
  ctx.stroke();
  blit(ctx, glowDot("carrier:#ff8a1f", Math.max(42, e.r * 2.4), "#ff8a1f"), e.x, e.y + bob, 0, 1, 1, 0.35 + 0.2 * pulse);
  ctx.restore();
}

function drawNova(ctx, n, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const k = Math.min(1, n.t / 0.5);
  blit(ctx, glowDot("nova", 40, "#ff7bf0"), n.x, n.y, 0, 0.8 + k * 0.8, 0.8 + k * 0.8);
  ctx.strokeStyle = rgba("#ffd6fb", 0.8);
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 14 + i * 9 + Math.sin(time * 20 + i) * 3, time * 8 + i, time * 8 + i + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function ambient(r, state, dt) {
  const p = state.player;
  if (p.alive) {
    for (const side of [-1, 1]) if (r.fx.rng() < dt * 40) trail(r.fx, p.x + side * 7, p.y + 34);
    if (p.overheated && r.fx.rng() < dt * 14) puff(r.fx, p.x + (r.fx.rng() - 0.5) * 50, p.y + 4, "#dfe7f2", 9);
  }
  const b = state.boss;
  if (b && b.phase >= 1 && b.dying <= 0 && r.fx.rng() < dt * (b.phase * 5)) {
    puff(r.fx, b.x + (r.fx.rng() - 0.5) * 120, b.y + (r.fx.rng() - 0.5) * 80, "#3d3448", 20);
  }
}

/**
 * Renders one frame of the world.
 * @param {ReturnType<typeof createRenderer>} r
 * @param {any} state
 * @param {number} dt real seconds since the previous frame
 */
export function drawGame(r, state, dt, { hud = true } = {}) {
  const { ctx, fx } = r;
  r.time += dt;
  updateFx(fx, dt);
  ambient(r, state, dt);
  if (state.chapter !== r.bg.chapter) {
    r.bg.from = r.bg.chapter;
    r.bg.chapter = state.chapter;
    r.bg.fade = 0;
  }
  if (r.bg.from !== r.bg.chapter) {
    r.bg.fade += dt / 1.6;
    if (r.bg.fade >= 1) {
      r.bg.from = r.bg.chapter;
      r.bg.fade = 0;
    }
  }
  const warpTarget = state.stage === "warp" ? Math.sin(Math.min(1, state.stageTime / 3.2) * Math.PI) : 0;
  r.warp += (warpTarget - r.warp) * Math.min(1, dt * 5);

  ctx.setTransform(r.pixel, 0, 0, r.pixel, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const shake = shakeOffset(fx, r.time);
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawBackground(ctx, { chapter: r.bg.chapter, fromChapter: r.bg.from, fade: r.bg.fade, warp: r.warp, time: r.time });
  drawDecals(ctx, fx);
  drawPickups(ctx, state.pickups, r.time);
  if (state.boss) drawBoss(ctx, state.boss, r.time, state.player);
  drawEnemies(ctx, state.enemies, r.time);
  drawBeams(ctx, state.beams, r.time);
  drawShots(ctx, state.shots, r.time);
  drawShip(ctx, state.player, r.time);
  if (state.nova) drawNova(ctx, state.nova, r.time);
  drawParticles(ctx, fx);
  drawEggs(ctx, state.eggs, r.time);
  drawPopups(ctx, fx);
  ctx.restore();
  if (fx.flash > 0) {
    ctx.globalAlpha = fx.flash * 0.6;
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (hud) drawHud(ctx, state, r.hud, r.time, dt);
}
