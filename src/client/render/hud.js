import { COMBO_WINDOW, FOOD_PER_BOMB, H, HEAT, W, WAVES_PER_CHAPTER } from "../../game/config.js";
import { MAX_LEVEL } from "../../game/weapons.js";
import { hudText as T, formatNumber as fmt, names } from "../strings.js";
import { ACCENT, pickupSprite, shipSprite } from "./items.js";
import { FONT, blit, linear, rgba, textDirection } from "./paint.js";

export function createHud() {
  return { shown: 0, lastScore: 0, bump: 0, banner: null, toast: null };
}

function toast(hud, text, color = "#ffffff") {
  hud.toast = { text, color, t: 0, dur: 1.8 };
}

export function hudEvent(hud, ev) {
  switch (ev.type) {
    case "wave":
      hud.banner = ev.boss
        ? { kind: "boss", title: T.warning, sub: names.bosses[ev.bossKind] || "", t: 0, dur: 3.2 }
        : {
            kind: "wave",
            over: ev.wave === 1 ? `${T.chapter(ev.chapter)} · ${names.chapters[ev.chapter - 1]}` : T.chapter(ev.chapter),
            title: T.wave(ev.wave),
            sub: names.waves[ev.template] || "",
            t: 0,
            dur: 2.4,
          };
      break;
    case "clear":
      hud.banner = { kind: "clear", title: ev.boss ? T.bossDown : T.waveClear, bonus: ev.bonus, extra: ev.flawless ? T.flawless : "", t: 0, dur: 2.1 };
      break;
    case "warp":
      hud.banner = {
        kind: "warp",
        over: ev.gift ? T.gift(ev.gift) : "",
        title: T.warp,
        sub: `${T.chapter(ev.chapter)} · ${names.chapters[ev.chapter - 1]}`,
        extra: T.extraShip,
        t: 0,
        dur: 3.6,
      };
      break;
    case "victory_start":
      hud.banner = { kind: "victory", title: T.victory, sub: T.victorySub, t: 0, dur: 4 };
      break;
    case "death":
      if (ev.lives <= 0) hud.banner = { kind: "over", title: T.gameOver, sub: T.gameOverSub, t: 0, dur: 2.4 };
      else if (ev.lost) toast(hud, T.powerDown(ev.level), "#ff8a8a");
      break;
    case "golden":
      toast(hud, T.golden, "#ffd95a");
      break;
    case "golden_escape":
      toast(hud, T.goldenEscape, "#c9b8ff");
      break;
    case "boss_phase":
      toast(hud, ev.phase >= 2 ? T.furious : T.angry, "#ff6b6b");
      break;
    case "part_down":
      toast(hud, T.turret, "#9ff0ff");
      break;
    case "levelup":
      toast(hud, ev.level >= MAX_LEVEL ? T.maxPower : T.power(ev.level), "#ffe08a");
      break;
    case "life":
      toast(hud, T.life, "#ff8fa8");
      break;
    default:
      break;
  }
}

function text(ctx, str, x, y, size, color, align = "left", weight = 900) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
  ctx.direction = textDirection(str);
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = "rgba(16,6,34,0.85)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function bar(ctx, x, y, w, h, k, fill, back = "rgba(255,255,255,0.14)") {
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (k <= 0) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(h, w * Math.min(1, k)), h, h / 2);
  ctx.fill();
}

function bossBar(ctx, b, time) {
  const w = 420;
  const x = (W - w) / 2;
  const y = 38;
  text(ctx, names.bosses[b.kind], W / 2, y - 8, 16, b.armored ? "#9ff0ff" : "#ffd6d6", "center");
  const k = b.hp / b.maxHp;
  const fill = linear(ctx, x, 0, x + w, 0, [[0, "#ff3b5c"], [1, b.phase >= 2 ? "#ff1f1f" : "#ff9a3d"]]);
  bar(ctx, x, y, w, 14, k, fill, "rgba(40,10,30,0.75)");
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 14, 7);
  ctx.stroke();
  for (const notch of b.kind === "carrier" ? [0.35] : [0.66, 0.33]) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(x + w * notch - 1, y - 2, 2, 18);
  }
  b.parts.forEach((part, i) => {
    const px = W / 2 + (i === 0 ? -1 : 1) * 60 - 40;
    bar(ctx, px, y + 20, 80, 6, part.alive ? part.hp / part.maxHp : 0, "#5dffb1", "rgba(40,10,30,0.7)");
  });
  if (b.intro > 0) text(ctx, T.invulnerable, W / 2, y + 38, 13, rgba("#ffffff", 0.5 + 0.5 * Math.sin(time * 10)), "center");
}

function topRight(ctx, p, time) {
  const ship = shipSprite(p.weapon);
  const shown = Math.min(p.lives, 5);
  for (let i = 0; i < shown; i += 1) blit(ctx, ship, W - 28 - i * 30, 34, 0, 0.36, 0.36);
  if (p.lives > 5) text(ctx, T.times(p.lives), W - 28 - 5 * 30, 42, 16, "#ffffff", "right");
  const nova = pickupSprite("nova");
  const bombs = Math.min(p.bombs, 5);
  for (let i = 0; i < bombs; i += 1) blit(ctx, nova, W - 28 - i * 26, 70, 0, 0.75 + Math.sin(time * 4 + i) * 0.04, 0.75);
  if (p.bombs > 5) text(ctx, T.times(p.bombs), W - 28 - 5 * 26, 77, 15, "#ff9bf3", "right");
  if (p.bombs === 0) text(ctx, T.noBomb, W - 22, 77, 13, "rgba(255,255,255,0.5)", "right", 800);
  blit(ctx, pickupSprite("kernel"), W - 156, 100, 0, 0.8, 0.8);
  bar(ctx, W - 142, 96, 120, 8, p.food / FOOD_PER_BOMB, "#ffd23f");
}

function bottom(ctx, state, time) {
  const p = state.player;
  const color = ACCENT[p.weapon];
  text(ctx, p.rockets ? `${names.weapons[p.weapon]} + ${T.rocket}` : names.weapons[p.weapon], 22, H - 40, 16, color);
  for (let i = 0; i < MAX_LEVEL; i += 1) {
    ctx.fillStyle = i < p.level ? color : "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.roundRect(22 + i * 24, H - 30, 19, 9, 4);
    ctx.fill();
  }
  const hx = W - 222;
  const hy = H - 32;
  const heat = p.heat / HEAT.max;
  let label = T.heat;
  let labelColor = "rgba(255,255,255,0.7)";
  if (p.overheated) {
    label = T.overheat;
    labelColor = Math.floor(time * 8) % 2 ? "#ff4a2a" : "#ffffff";
  } else if (p.frost > 0) {
    label = T.frost(Math.ceil(p.frost));
    labelColor = "#9be8ff";
  }
  text(ctx, label, W - 22, H - 40, 14, labelColor, "right", 800);
  const fill = p.frost > 0 ? "#9be8ff" : linear(ctx, hx, 0, hx + 200, 0, [[0, "#5dffb1"], [0.6, "#ffd23f"], [1, "#ff3b1f"]]);
  bar(ctx, hx, hy, 200, 10, heat, fill);
  if (p.shield > 0) text(ctx, T.shield(Math.ceil(p.shield)), W / 2, H - 26, 14, "#9ff0ff", "center", 800);
}

function ease(k) {
  return 1 - (1 - k) ** 3;
}

function drawBanner(ctx, hud, time, dt) {
  const b = hud.banner;
  if (!b) return;
  b.t += dt;
  if (b.t >= b.dur) {
    hud.banner = null;
    return;
  }
  const k = b.t / b.dur;
  const enter = ease(Math.min(1, b.t / 0.35));
  const leave = k > 0.82 ? (k - 0.82) / 0.18 : 0;
  const slide = (1 - enter) * -W * 0.6 + leave * leave * W * 0.6;
  const alpha = Math.min(1, b.t / 0.15) * (1 - leave);
  const cy = H * 0.42;
  ctx.save();
  ctx.globalAlpha = alpha;
  const bandH = 130 * enter;
  if (b.kind === "boss") {
    ctx.fillStyle = "rgba(120,0,20,0.55)";
    ctx.fillRect(0, cy - bandH / 2, W, bandH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cy - bandH / 2, W, bandH);
    ctx.clip();
    ctx.fillStyle = "rgba(255,40,60,0.35)";
    const off = (time * 120) % 60;
    for (let x = -120 + off; x < W + 120; x += 60) {
      for (const y of [cy - bandH / 2, cy + bandH / 2 - 14]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 30, y);
        ctx.lineTo(x + 16, y + 14);
        ctx.lineTo(x - 14, y + 14);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    const blink = Math.floor(time * 6) % 2 === 0;
    text(ctx, b.title, W / 2, cy + 8, 64, blink ? "#ff3b4a" : "#ffffff", "center");
    text(ctx, b.sub, W / 2, cy + 44, 22, "#ffd6d6", "center");
  } else {
    ctx.fillStyle = linear(ctx, 0, 0, W, 0, [[0, "rgba(20,8,50,0)"], [0.5, "rgba(20,8,50,0.6)"], [1, "rgba(20,8,50,0)"]]);
    ctx.fillRect(0, cy - bandH / 2, W, bandH);
    ctx.translate(slide, 0);
    const main = { wave: "#ffffff", clear: "#ffd95a", warp: "#9ff0ff", victory: "#ffd95a", over: "#ff4a5a" }[b.kind];
    if (b.over) text(ctx, b.over, W / 2, cy - 40, 16, "#c9b8ff", "center", 800);
    text(ctx, b.title, W / 2, cy + 12, b.kind === "wave" ? 64 : 52, main, "center");
    if (b.bonus != null) text(ctx, `+${fmt(b.bonus * Math.min(1, b.t / 0.8))}`, W / 2, cy + 50, 26, "#ffffff", "center");
    else if (b.sub) text(ctx, b.sub, W / 2, cy + 48, 20, "#e9ddff", "center", 800);
    if (b.extra) text(ctx, b.extra, W / 2, cy + 80, 18, "#ff9bf3", "center", 800);
  }
  ctx.restore();
}

function drawToast(ctx, hud, dt) {
  const t = hud.toast;
  if (!t) return;
  t.t += dt;
  if (t.t >= t.dur) {
    hud.toast = null;
    return;
  }
  const k = t.t / t.dur;
  ctx.globalAlpha = Math.min(1, t.t / 0.15) * (k > 0.75 ? (1 - k) / 0.25 : 1);
  text(ctx, t.text, W / 2, 150 + ease(Math.min(1, t.t / 0.3)) * 14, 20, t.color, "center");
  ctx.globalAlpha = 1;
}

/** @param {CanvasRenderingContext2D} ctx */
export function drawHud(ctx, state, hud, time, dt) {
  hud.shown += (state.score - hud.shown) * Math.min(1, dt * 9);
  if (Math.abs(state.score - hud.shown) < 1) hud.shown = state.score;
  if (state.score > hud.lastScore) hud.bump = 1;
  hud.lastScore = state.score;
  hud.bump = Math.max(0, hud.bump - dt * 5);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  text(ctx, T.score, 24, 30, 14, "#c9b8ff", "left", 800);
  text(ctx, fmt(hud.shown), 22, 62, 30 + hud.bump * 3, "#ffffff");
  if (state.combo >= 3) {
    text(ctx, T.times(state.multiplier), 22, 94, 22, state.multiplier > 1 ? "#ff9bf3" : "#e9ddff");
    text(ctx, T.chain(state.combo), 66, 92, 13, "#ffd6fb", "left", 800);
    bar(ctx, 22, 101, 120, 5, state.comboTimer / COMBO_WINDOW, "#ff9bf3");
  }
  if (state.boss) bossBar(ctx, state.boss, time);
  else text(ctx, T.stage(state.chapter, state.wave, WAVES_PER_CHAPTER), W / 2, 30, 14, "rgba(233,221,255,0.78)", "center", 800);
  topRight(ctx, state.player, time);
  bottom(ctx, state, time);
  drawToast(ctx, hud, dt);
  drawBanner(ctx, hud, time, dt);
  ctx.restore();
}
