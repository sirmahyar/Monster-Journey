import { FLOOR_Y } from "../../game/config.js";
import { FEATHER_TINTS } from "./creatures.js";
import { FONT, blit, cached, ellipse, glowDot, linear, rgba, sprite } from "./paint.js";

const TAU = Math.PI * 2;
const MAX_PARTICLES = 1100;

export function createFx() {
  return { parts: [], popups: [], decals: [], shake: 0, flash: 0, flashColor: "#ffffff", slow: 0, rng: Math.random };
}

function featherSprite(color) {
  return cached(`feather:${color}`, () =>
    sprite(12, 26, (g) => {
      g.beginPath();
      g.moveTo(0, -12);
      g.quadraticCurveTo(6, -2, 1, 11);
      g.lineTo(-1, 11);
      g.quadraticCurveTo(-6, -2, 0, -12);
      g.fillStyle = linear(g, 0, -12, 0, 12, [[0, "#ffffff"], [0.4, color], [1, color]]);
      g.fill();
      g.strokeStyle = rgba("#000000", 0.25);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(0, 12);
      g.stroke();
    }),
  );
}

function shellSprite() {
  return cached("shell", () =>
    sprite(10, 10, (g) => {
      g.beginPath();
      g.moveTo(-4, -3);
      g.lineTo(4, -4);
      g.lineTo(1, 4);
      g.closePath();
      g.fillStyle = "#fbf3e4";
      g.fill();
    }),
  );
}

function add(fx, p) {
  if (fx.parts.length >= MAX_PARTICLES) fx.parts.shift();
  p.t = 0;
  fx.parts.push(p);
}

function r(fx, a, b) {
  return a + (b - a) * fx.rng();
}

export function burst(fx, x, y, { count = 12, color = "#ffd27a", speed = 260, life = 0.5, size = 2.5, drag = 3 } = {}) {
  for (let i = 0; i < count; i += 1) {
    const a = r(fx, 0, TAU);
    const v = r(fx, speed * 0.3, speed);
    add(fx, { type: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: r(fx, life * 0.6, life), color, size, drag });
  }
}

function glow(fx, x, y, radius, color, life = 0.35) {
  add(fx, { type: "glow", x, y, vx: 0, vy: 0, radius, color, life });
}

function ring(fx, x, y, radius, color, life = 0.45, width = 4) {
  add(fx, { type: "ring", x, y, vx: 0, vy: 0, radius, color, life, width });
}

function smoke(fx, x, y, count, color = "#8a7f9e", size = 14) {
  for (let i = 0; i < count; i += 1) {
    const a = r(fx, 0, TAU);
    const v = r(fx, 20, 90);
    add(fx, { type: "smoke", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: r(fx, 0.5, 0.9), color, size: r(fx, size * 0.6, size) });
  }
}

export function puff(fx, x, y, color = "#5a4f66", size = 16) {
  smoke(fx, x, y, 1, color, size);
}

export function trail(fx, x, y, color = "#7fd8ff") {
  add(fx, { type: "spark", x: x + r(fx, -3, 3), y, vx: r(fx, -20, 20), vy: r(fx, 160, 260), life: r(fx, 0.15, 0.3), color, size: 2, drag: 2 });
}

function feathers(fx, x, y, count, color, speed = 180) {
  for (let i = 0; i < count; i += 1) {
    const a = r(fx, 0, TAU);
    const v = r(fx, 40, speed);
    add(fx, {
      type: "feather",
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 40,
      life: r(fx, 1.1, 1.9),
      color,
      rot: r(fx, 0, TAU),
      spin: r(fx, -6, 6),
      sway: r(fx, 0, TAU),
      scale: r(fx, 0.6, 1.1),
    });
  }
}

function shells(fx, x, y, count, speed = 160) {
  for (let i = 0; i < count; i += 1) {
    const a = r(fx, Math.PI, TAU);
    const v = r(fx, 50, speed);
    add(fx, { type: "shell", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: r(fx, 0.5, 0.9), rot: r(fx, 0, TAU), spin: r(fx, -10, 10) });
  }
}

function debris(fx, x, y, count, color, speed = 200) {
  for (let i = 0; i < count; i += 1) {
    const a = r(fx, 0, TAU);
    const v = r(fx, 40, speed);
    add(fx, { type: "debris", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: r(fx, 0.6, 1.2), color, size: r(fx, 2, 6), rot: r(fx, 0, TAU), spin: r(fx, -8, 8) });
  }
}

export function popup(fx, x, y, text, { color = "#ffffff", size = 18, life = 0.9 } = {}) {
  fx.popups.push({ x, y, text, color, size, life, t: 0 });
  if (fx.popups.length > 40) fx.popups.shift();
}

export function shake(fx, amount) {
  fx.shake = Math.min(1, fx.shake + amount);
}

export function flash(fx, alpha, color = "#ffffff") {
  fx.flash = Math.max(fx.flash, alpha);
  fx.flashColor = color;
}

function explode(fx, x, y, scale = 1, color = "#ffb347") {
  glow(fx, x, y, 46 * scale, color, 0.4);
  ring(fx, x, y, 60 * scale, color, 0.5, 4 * scale);
  burst(fx, x, y, { count: Math.round(22 * scale), color, speed: 340 * scale, life: 0.65 });
  burst(fx, x, y, { count: Math.round(10 * scale), color: "#ffffff", speed: 220 * scale, life: 0.4, size: 2 });
  smoke(fx, x, y, Math.round(6 * scale), "#6f5f86", 18 * scale);
}

const PICKUP_TEXT = { power: "POWER UP", shield: "SHIELD", nova: "+1 NOVA", coolant: "FROST CORE", life: "+1 SHIP" };
const WEAPON_TEXT = { pulse: "PULSE BLASTER", laser: "PHOTON LANCE", ion: "ION SEEKER" };

/** Turns one simulation event into particles, popups, shake and flashes. */
export function fxEvent(fx, ev) {
  switch (ev.type) {
    case "kill": {
      if (ev.kind === "rock") {
        debris(fx, ev.x, ev.y, 6 + ev.size * 5, "#9a8a7a", 120 + ev.size * 50);
        smoke(fx, ev.x, ev.y, 3 + ev.size * 2, "#7d6f66", 10 + ev.size * 5);
        ring(fx, ev.x, ev.y, ev.r * 1.6, "#ffcf9a", 0.35, 2);
      } else {
        const tints = FEATHER_TINTS[ev.kind] || FEATHER_TINTS.hen;
        const tint = tints[(ev.variant || 0) % tints.length];
        const scale = ev.r / 24;
        glow(fx, ev.x, ev.y, 34 * scale, "#fff1c2", 0.25);
        ring(fx, ev.x, ev.y, 40 * scale, "#ffffff", 0.3, 2.5);
        burst(fx, ev.x, ev.y, { count: Math.round(12 * scale), color: "#ffd27a", speed: 300 });
        feathers(fx, ev.x, ev.y, Math.round(7 + 6 * scale), tint, 200 * scale);
        smoke(fx, ev.x, ev.y, 3, "#f3e9ff", 10 * scale);
        if (ev.kind === "golden") {
          explode(fx, ev.x, ev.y, 1.4, "#ffd95a");
          flash(fx, 0.35, "#fff1a8");
          shake(fx, 0.35);
        }
        if (ev.kind === "saucer") debris(fx, ev.x, ev.y, 10, "#cfd8e6", 260);
      }
      popup(fx, ev.x, ev.y - 10, String(ev.points), { color: ev.points >= 1000 ? "#ffd95a" : "#ffffff", size: ev.points >= 1000 ? 24 : 15, life: 0.75 });
      shake(fx, ev.kind === "rock" ? 0.06 * ev.size : 0.04);
      break;
    }
    case "hit":
      burst(fx, ev.x, ev.y, { count: 3, color: "#fff1c2", speed: 180, life: 0.22, size: 2 });
      break;
    case "boss_hit":
      burst(fx, ev.x, ev.y, { count: ev.armored ? 2 : 4, color: ev.armored ? "#9fb3c8" : "#ffd27a", speed: 220, life: 0.25, size: 2 });
      break;
    case "boss_immune":
      burst(fx, ev.x, ev.y, { count: 2, color: "#8fa3b8", speed: 160, life: 0.2, size: 1.5 });
      break;
    case "shield_hit":
      ring(fx, ev.ex, ev.ey, 40, "#6fe3ff", 0.25, 2);
      break;
    case "shield_break":
      ring(fx, ev.ex, ev.ey, 56, "#9ff0ff", 0.4, 3);
      burst(fx, ev.ex, ev.ey, { count: 16, color: "#9ff0ff", speed: 260, life: 0.5 });
      break;
    case "splat":
      fx.decals.push({ x: ev.x, y: ev.y, t: 0, big: ev.big, yolk: ev.yolk, seed: fx.rng() });
      if (fx.decals.length > 26) fx.decals.shift();
      shells(fx, ev.x, ev.y - 4, ev.yolk ? 0 : 5);
      break;
    case "pickup": {
      const color = ev.kind === "kernel" || ev.kind === "cob" ? "#ffd23f" : "#ffffff";
      burst(fx, ev.x, ev.y, { count: ev.kind === "kernel" ? 4 : 12, color, speed: 160, life: 0.4, size: 2 });
      const text = ev.kind === "crate" ? WEAPON_TEXT[ev.weapon] : PICKUP_TEXT[ev.kind];
      if (text) popup(fx, ev.x, ev.y - 20, text, { color: "#9ff0ff", size: 20, life: 1.1 });
      break;
    }
    case "levelup":
    case "weapon":
      ring(fx, ev.x, ev.y, 70, "#ffe08a", 0.55, 4);
      glow(fx, ev.x, ev.y, 60, "#ffe08a", 0.4);
      break;
    case "death":
      explode(fx, ev.x, ev.y, 1.8, "#ff9a3d");
      debris(fx, ev.x, ev.y, 18, "#c7d0e0", 320);
      shake(fx, 0.85);
      flash(fx, 0.45, "#ff6b4a");
      break;
    case "respawn":
      ring(fx, ev.x, ev.y, 90, "#7fe8ff", 0.6, 3);
      glow(fx, ev.x, ev.y, 70, "#7fe8ff", 0.5);
      break;
    case "nova_launch":
      glow(fx, ev.x, ev.y, 40, "#ff7bf0", 0.3);
      break;
    case "nova":
      if (!ev.quiet) {
        flash(fx, 0.85, "#fff4ff");
        shake(fx, 1);
        ring(fx, ev.x, ev.y, 520, "#ff9bf3", 0.9, 10);
        ring(fx, ev.x, ev.y, 320, "#ffffff", 0.6, 6);
        glow(fx, ev.x, ev.y, 260, "#ff7bf0", 0.6);
      }
      for (const [x, y] of ev.eggs || []) {
        shells(fx, x, y, 3, 120);
        burst(fx, x, y, { count: 2, color: "#ffffff", speed: 120, life: 0.3, size: 1.5 });
      }
      break;
    case "part_down":
      explode(fx, ev.x, ev.y, 1.3, "#ffb347");
      shake(fx, 0.5);
      popup(fx, ev.x, ev.y - 20, String(ev.points), { color: "#ffd95a", size: 24 });
      break;
    case "boss_boom":
      explode(fx, ev.x, ev.y, 0.9 + fx.rng() * 0.6, fx.rng() < 0.5 ? "#ffb347" : "#ff6b4a");
      shake(fx, 0.25);
      break;
    case "boss_killed":
      fx.slow = 1.3;
      flash(fx, 0.7, "#ffffff");
      shake(fx, 0.9);
      popup(fx, ev.x, ev.y, String(ev.points), { color: "#ffd95a", size: 40, life: 2 });
      break;
    case "boss_dead":
      explode(fx, ev.x, ev.y, 3, "#ffd27a");
      feathers(fx, ev.x, ev.y, 46, "#fff1d6", 420);
      ring(fx, ev.x, ev.y, 700, "#ffffff", 1.1, 12);
      flash(fx, 0.9, "#fff7e0");
      shake(fx, 1);
      break;
    case "boss_phase":
      flash(fx, 0.35, "#ff3b3b");
      shake(fx, 0.5);
      ring(fx, ev.x, ev.y, 220, "#ff6b6b", 0.6, 6);
      break;
    case "boss_slam":
      shake(fx, 0.6);
      ring(fx, ev.x, ev.y, 260, "#ffd27a", 0.6, 7);
      smoke(fx, ev.x, ev.y, 10, "#8f7f9e", 22);
      break;
    case "beam_fire":
      shake(fx, 0.18);
      break;
    case "yolk_split":
      ring(fx, ev.x, ev.y, 46, "#ffc21a", 0.35, 3);
      burst(fx, ev.x, ev.y, { count: 8, color: "#ffc21a", speed: 200, life: 0.35 });
      break;
    case "pop":
      burst(fx, ev.x, ev.y, { count: 8, color: "#ffae3d", speed: 180, life: 0.3 });
      break;
    case "combo":
      popup(fx, ev.x, ev.y - 30, `x${ev.mult} COMBO`, { color: "#ff9bf3", size: 22 + ev.mult * 1.5, life: 1.1 });
      break;
    case "overheat":
      smoke(fx, ev.x, ev.y, 10, "#dfe7f2", 12);
      popup(fx, ev.x, ev.y - 50, "OVERHEAT", { color: "#ff6b4a", size: 22, life: 1.1 });
      break;
    case "coolant":
    case "shield_on":
      ring(fx, ev.x, ev.y, 80, "#9ff0ff", 0.5, 3);
      break;
    case "bomb_gain":
      popup(fx, ev.x, ev.y - 40, "+1 NOVA", { color: "#ff9bf3", size: 18 });
      break;
    case "shield_block":
      burst(fx, ev.x, ev.y, { count: 6, color: "#9ff0ff", speed: 200, life: 0.3, size: 2 });
      break;
    default:
      break;
  }
}

export function updateFx(fx, dt) {
  fx.shake = Math.max(0, fx.shake - dt * 1.7);
  fx.flash = Math.max(0, fx.flash - dt * 2.2);
  fx.slow = Math.max(0, fx.slow - dt);
  let w = 0;
  for (const p of fx.parts) {
    p.t += dt;
    if (p.t >= p.life) continue;
    if (p.type === "spark") {
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
    } else if (p.type === "feather") {
      p.vx *= 1 - Math.min(1, dt * 2.2);
      p.vy = p.vy * (1 - Math.min(1, dt * 2.2)) + 60 * dt;
      p.rot += p.spin * dt;
      p.spin *= 1 - Math.min(1, dt * 0.8);
      p.x += Math.sin(p.t * 5 + p.sway) * 30 * dt;
    } else if (p.type === "shell" || p.type === "debris") {
      p.vy += 420 * dt * (p.type === "shell" ? 1 : 0.3);
      p.rot += p.spin * dt;
    } else if (p.type === "smoke") {
      p.vx *= 1 - Math.min(1, dt * 2);
      p.vy *= 1 - Math.min(1, dt * 2);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    fx.parts[w] = p;
    w += 1;
  }
  fx.parts.length = w;
  for (const d of fx.decals) d.t += dt;
  fx.decals = fx.decals.filter((d) => d.t < 6);
  for (const p of fx.popups) p.t += dt;
  fx.popups = fx.popups.filter((p) => p.t < p.life);
}

export function shakeOffset(fx, time) {
  const s = fx.shake * fx.shake * 14;
  return { x: Math.sin(time * 71) * s, y: Math.cos(time * 53) * s };
}

export function drawDecals(ctx, fx) {
  for (const d of fx.decals) {
    const alpha = Math.min(1, (6 - d.t) / 1.5);
    const grow = Math.min(1, d.t * 10);
    const w = (d.big ? 22 : 15) * grow;
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = d.yolk ? "#ffb21a" : "#fbf3e4";
    ellipse(ctx, d.x, FLOOR_Y + 4, w * 1.4, w * 0.32);
    ctx.fill();
    ctx.fillStyle = "#ffc21a";
    ellipse(ctx, d.x + (d.seed - 0.5) * 6, FLOOR_Y + 2, w * 0.45, w * 0.24);
    ctx.fill();
    for (let i = 0; i < 3; i += 1) {
      const dx = (((d.seed * 7 + i * 0.37) % 1) - 0.5) * w * 3;
      ellipse(ctx, d.x + dx, FLOOR_Y + 4, w * 0.16, w * 0.1);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawParticles(ctx, fx) {
  for (const p of fx.parts) {
    const k = p.t / p.life;
    if (p.type === "feather") {
      blit(ctx, featherSprite(p.color), p.x, p.y, p.rot, p.scale, p.scale, Math.min(1, (1 - k) * 2));
    } else if (p.type === "shell") {
      blit(ctx, shellSprite(), p.x, p.y, p.rot, 1, 1, 1 - k);
    } else if (p.type === "debris") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    } else if (p.type === "smoke") {
      ctx.globalAlpha = (1 - k) * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + k * 1.2), 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of fx.parts) {
    const k = p.t / p.life;
    if (p.type === "spark") {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = p.size * (1 - k * 0.5);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else if (p.type === "glow") {
      blit(ctx, glowDot(`fx:${p.color}`, 64, p.color), p.x, p.y, 0, (p.radius / 64) * (0.6 + k * 0.6), (p.radius / 64) * (0.6 + k * 0.6), 1 - k);
    } else if (p.type === "ring") {
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (0.15 + 0.85 * Math.sqrt(k)), 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx, fx) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of fx.popups) {
    const k = p.t / p.life;
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.6);
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.font = `800 ${Math.round(p.size * pop)}px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(20,8,40,0.85)";
    const y = p.y - k * 46;
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, y);
  }
  ctx.globalAlpha = 1;
}
