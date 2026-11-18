import { WEAPONS } from "../../game/weapons.js";
import { blit, cached, ellipse, glowDot, linear, radial, rgba, shade, silhouette, sprite } from "./paint.js";

const TAU = Math.PI * 2;
const ACCENT = { pulse: "#ff7a3d", laser: "#3fe7ff", ion: "#b98cff" };

function shipSprite(weapon) {
  return cached(`ship:${weapon}`, () =>
    sprite(84, 84, (g) => {
      const accent = ACCENT[weapon];
      g.lineJoin = "round";
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(side * 5, -6);
        g.lineTo(side * 33, 14);
        g.lineTo(side * 31, 22);
        g.lineTo(side * 9, 20);
        g.closePath();
        g.fillStyle = linear(g, 0, -6, 0, 22, [[0, "#3b5bdb"], [1, "#1c2c7a"]]);
        g.fill();
        g.strokeStyle = "#0d1640";
        g.lineWidth = 1.6;
        g.stroke();
        g.beginPath();
        g.moveTo(side * 12, 6);
        g.lineTo(side * 28, 16);
        g.lineTo(side * 26, 19);
        g.lineTo(side * 11, 11);
        g.closePath();
        g.fillStyle = accent;
        g.fill();
        g.fillStyle = linear(g, 0, -2, 0, 18, [[0, "#e9eef7"], [1, "#7d8aa6"]]);
        g.fillRect(side * 30 - 2.5, 0, 5, 18);
        g.strokeStyle = "#0d1640";
        g.strokeRect(side * 30 - 2.5, 0, 5, 18);
      }
      g.beginPath();
      g.moveTo(0, -36);
      g.bezierCurveTo(9, -24, 11, 4, 9, 26);
      g.lineTo(-9, 26);
      g.bezierCurveTo(-11, 4, -9, -24, 0, -36);
      g.closePath();
      g.fillStyle = linear(g, -10, 0, 10, 0, [[0, "#9aa8c2"], [0.45, "#f7f9fd"], [1, "#8a97b3"]]);
      g.fill();
      g.strokeStyle = "#0d1640";
      g.lineWidth = 1.8;
      g.stroke();
      g.fillStyle = accent;
      g.fillRect(-2, 2, 4, 18);
      ellipse(g, 0, -13, 5.5, 11);
      g.fillStyle = radial(g, 0, -13, 12, [[0, "#d6fbff"], [0.5, "#38c6f4"], [1, "#0b4f8a"]], -2, -18);
      g.fill();
      g.strokeStyle = "#0d1640";
      g.lineWidth = 1.4;
      g.stroke();
      ellipse(g, -1.8, -17, 1.6, 4);
      g.fillStyle = rgba("#ffffff", 0.85);
      g.fill();
      for (const side of [-1, 1]) {
        g.fillStyle = "#2b3148";
        g.fillRect(side * 7 - 4, 22, 8, 7);
        ellipse(g, side * 7, 29, 4, 2);
        g.fillStyle = "#ffb347";
        g.fill();
      }
    }),
  );
}

function flame(ctx, x, y, length, width, time) {
  const flicker = 0.75 + 0.25 * Math.sin(time * 60 + x);
  const len = length * flicker;
  const grad = ctx.createLinearGradient(x, y, x, y + len);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.25, "rgba(120,220,255,0.9)");
  grad.addColorStop(0.7, "rgba(80,90,255,0.45)");
  grad.addColorStop(1, "rgba(80,40,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.quadraticCurveTo(x, y + len * 1.2, x + width, y);
  ctx.closePath();
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx */
export function drawShip(ctx, p, time) {
  if (!p.alive) return;
  const blink = p.invuln > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = "lighter";
  const boost = Math.max(0, -p.vy / 470);
  for (const side of [-1, 1]) flame(ctx, side * 7 + p.tilt * 2, 28, 14 + boost * 14, 4, time);
  ctx.globalCompositeOperation = "source-over";
  ctx.rotate(p.tilt * 0.12);
  ctx.scale(1 - Math.abs(p.tilt) * 0.22, 1);
  ctx.globalAlpha = blink ? 0.35 : 1;
  const s = shipSprite(p.weapon);
  ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
  if (p.heat > 60) {
    ctx.globalCompositeOperation = "lighter";
    const hot = (p.heat - 60) / 40;
    for (const side of [-1, 1]) blit(ctx, glowDot("heat", 14, "#ff3b1f"), side * 30, 2, 0, 1, 1, hot * (0.6 + 0.4 * Math.sin(time * 30)));
  }
  ctx.restore();
  if (p.shield > 0) drawShield(ctx, p, time);
}

function drawShield(ctx, p, time) {
  const fading = p.shield < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 12)) : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = fading;
  ctx.fillStyle = radial(ctx, 0, 0, 44, [[0, "rgba(80,200,255,0)"], [0.75, "rgba(80,200,255,0.12)"], [1, "rgba(150,230,255,0.45)"]]);
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(170,240,255,0.8)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const a = time * 2.2 + (i * TAU) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, 44, a, a + 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function shotSprite(kind, level) {
  return cached(`shot:${kind}:${level}`, () => {
    if (kind === "lance") {
      const w = 3 + level * 0.8;
      return sprite(w * 4 + 8, 44, (g) => {
        g.fillStyle = linear(g, 0, -20, 0, 20, [[0, "rgba(63,231,255,0)"], [0.3, "rgba(63,231,255,0.9)"], [1, "rgba(63,231,255,0.2)"]]);
        g.fillRect(-w, -20, w * 2, 40);
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.fillRect(-w * 0.35, -18, w * 0.7, 34);
      });
    }
    if (kind === "rocket") {
      return sprite(36, 56, (g) => {
        g.fillStyle = linear(g, 0, 16, 0, 26, [[0, "rgba(255,170,40,0.95)"], [1, "rgba(255,60,20,0)"]]);
        g.beginPath();
        g.moveTo(-3, 12);
        g.lineTo(0, 26);
        g.lineTo(3, 12);
        g.fill();
        g.fillStyle = "#f7fbff";
        g.beginPath();
        g.moveTo(0, -20);
        g.lineTo(6, -4);
        g.lineTo(6, 12);
        g.lineTo(-6, 12);
        g.lineTo(-6, -4);
        g.closePath();
        g.fill();
        g.fillStyle = "#ff4d3a";
        g.beginPath();
        g.moveTo(-7, 4);
        g.lineTo(0, 14);
        g.lineTo(7, 4);
        g.closePath();
        g.fill();
        g.fillStyle = "#26324a";
        g.fillRect(-2.2, -6, 4.4, 5);
      });
    }
    if (kind === "slug") {
      return sprite(36, 36, (g) => {
        g.fillStyle = radial(g, 0, 0, 16, [[0, "#fff6d0"], [0.35, "#ffb03a"], [1, "rgba(255,70,20,0)"]]);
        g.beginPath();
        g.arc(0, 0, 14, 0, TAU);
        g.fill();
      });
    }
    if (kind === "needle") {
      return sprite(10, 36, (g) => {
        g.fillStyle = "#fffaf0";
        g.fillRect(-1.2, -16, 2.4, 32);
        g.fillStyle = "#ffd36a";
        g.fillRect(-0.4, -16, 0.8, 22);
      });
    }
    if (kind === "prism") {
      return sprite(28, 28, (g) => {
        g.fillStyle = "rgba(180,255,255,0.95)";
        g.beginPath();
        g.moveTo(0, -12);
        g.lineTo(10, 0);
        g.lineTo(0, 12);
        g.lineTo(-10, 0);
        g.closePath();
        g.fill();
      });
    }
    if (kind === "comet") {
      return sprite(40, 48, (g) => {
        g.fillStyle = linear(g, 0, 16, 0, -8, [[0, "rgba(255,170,80,0)"], [1, "rgba(255,150,60,0.8)"]]);
        g.beginPath();
        g.moveTo(0, 18);
        g.lineTo(7, 2);
        g.lineTo(-7, 2);
        g.fill();
        g.fillStyle = radial(g, 0, -4, 14, [[0, "#ffffff"], [0.4, "#d7b0ff"], [1, "rgba(120,40,255,0)"]]);
        g.beginPath();
        g.arc(0, -4, 12, 0, TAU);
        g.fill();
      });
    }
    if (kind === "ion") {
      const r = 7 + level * 0.5;
      return sprite(r * 4, r * 4, (g) => {
        g.fillStyle = radial(g, 0, 0, r * 2, [[0, "#ffffff"], [0.12, "#f1e4ff"], [0.3, "#b57cff"], [0.55, "rgba(140,70,255,0.55)"], [1, "rgba(110,40,255,0)"]]);
        g.beginPath();
        g.arc(0, 0, r * 2, 0, TAU);
        g.fill();
      });
    }
    const big = level >= 4 ? 1.2 : 1;
    return sprite(20 * big, 48 * big, (g) => {
      g.scale(big, big);
      g.fillStyle = linear(g, 0, -21, 0, 23, [[0, "rgba(255,120,40,0)"], [0.22, "rgba(255,104,36,0.8)"], [1, "rgba(255,50,20,0)"]]);
      g.beginPath();
      g.moveTo(0, -21);
      g.quadraticCurveTo(7.5, -5, 0, 23);
      g.quadraticCurveTo(-7.5, -5, 0, -21);
      g.fill();
      g.fillStyle = linear(g, 0, -17, 0, 9, [[0, "#fffbe6"], [0.45, "#ffd23f"], [1, "rgba(255,140,40,0)"]]);
      g.beginPath();
      g.moveTo(0, -18);
      g.quadraticCurveTo(3.4, -8, 0, 9);
      g.quadraticCurveTo(-3.4, -8, 0, -18);
      g.fill();
    });
  });
}

export function drawShots(ctx, shots, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of shots) {
    const angle = Math.atan2(s.vy, s.vx) + Math.PI / 2;
    const spr = shotSprite(s.kind, s.level || 1);
    if (s.kind === "ion" || s.kind === "comet") {
      for (let i = 3; i >= 1; i -= 1) {
        blit(ctx, spr, s.x - s.vx * 0.012 * i, s.y - s.vy * 0.012 * i, 0, 1 - i * 0.18, 1 - i * 0.18, 0.35 / i);
      }
      blit(ctx, spr, s.x, s.y, time * 6, 1 + Math.sin(time * 20 + s.x) * 0.08);
    } else blit(ctx, spr, s.x, s.y, angle);
  }
  ctx.restore();
}

function eggShape(g, r) {
  g.beginPath();
  g.moveTo(0, -r * 1.25);
  g.bezierCurveTo(r * 0.95, -r * 1.2, r * 1.0, r * 0.95, 0, r * 1.05);
  g.bezierCurveTo(-r * 1.0, r * 0.95, -r * 0.95, -r * 1.2, 0, -r * 1.25);
  g.closePath();
}

function eggSprite(kind, r) {
  return cached(`egg:${kind}:${r}`, () => {
    if (kind === "pellet") {
      return sprite(r * 5, r * 5, (g) => {
        g.fillStyle = radial(g, 0, 0, r * 2.5, [[0, "rgba(255,80,150,0.75)"], [1, "rgba(255,61,127,0)"]]);
        g.fillRect(-r * 2.5, -r * 2.5, r * 5, r * 5);
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fillStyle = radial(g, 0, 0, r, [[0, "#ffffff"], [0.55, "#ffc2dc"], [1, "#ff3d7f"]], -r * 0.3, -r * 0.3);
        g.fill();
        g.strokeStyle = "rgba(90,0,40,0.8)";
        g.lineWidth = Math.max(1.2, r * 0.18);
        g.stroke();
      });
    }
    if (kind === "spark") {
      return sprite(r * 5, r * 5, (g) => {
        g.fillStyle = radial(g, 0, 0, r * 2.5, [[0, "rgba(140,255,200,0.9)"], [1, "rgba(40,255,160,0)"]]);
        g.fillRect(-r * 2.5, -r * 2.5, r * 5, r * 5);
        g.beginPath();
        g.moveTo(0, -r * 1.6);
        g.lineTo(r * 0.75, 0);
        g.lineTo(0, r * 1.6);
        g.lineTo(-r * 0.75, 0);
        g.closePath();
        g.fillStyle = "#eafff4";
        g.fill();
        g.strokeStyle = "rgba(0,90,50,0.85)";
        g.lineWidth = Math.max(1.2, r * 0.16);
        g.stroke();
      });
    }
    if (kind === "quill") {
      return sprite(r * 4, r * 8, (g) => {
        g.fillStyle = radial(g, 0, 0, r * 3.6, [[0, "rgba(255,140,70,0.45)"], [1, "rgba(255,90,40,0)"]]);
        g.fillRect(-r * 2, -r * 4, r * 4, r * 8);
        g.beginPath();
        g.moveTo(0, r * 3.2);
        g.quadraticCurveTo(r * 1.4, 0, 0, -r * 3.2);
        g.quadraticCurveTo(-r * 1.4, 0, 0, r * 3.2);
        g.fillStyle = linear(g, 0, -r * 3, 0, r * 3, [[0, "#fff1c2"], [0.5, "#ff9a4a"], [1, "#d9332b"]]);
        g.fill();
        g.strokeStyle = "#5a160c";
        g.lineWidth = Math.max(1.2, r * 0.2);
        g.stroke();
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -r * 3.2);
        g.lineTo(0, r * 3.2);
        g.stroke();
      });
    }
    if (kind === "missile") {
      return sprite(r * 3, r * 5, (g) => {
        g.fillStyle = "#7a8296";
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(side * r * 0.5, r * 0.6);
          g.lineTo(side * r * 1.3, r * 1.6);
          g.lineTo(side * r * 0.5, r * 1.3);
          g.fill();
        }
        ellipse(g, 0, 0, r * 0.75, r * 1.5);
        g.fillStyle = linear(g, -r, 0, r, 0, [[0, "#c9ced8"], [0.5, "#ffffff"], [1, "#9aa1b1"]]);
        g.fill();
        g.strokeStyle = "rgba(20,20,40,0.8)";
        g.lineWidth = 1.2;
        g.stroke();
        g.fillStyle = "#ff3b3b";
        ellipse(g, 0, -r * 0.8, r * 0.5, r * 0.6);
        g.fill();
      });
    }
    if (kind === "yolk" || kind === "bigyolk") {
      return sprite(r * 3.6, r * 3.6, (g) => {
        g.fillStyle = radial(g, 0, 0, r * 1.8, [[0, "rgba(255,210,80,0.55)"], [1, "rgba(255,200,60,0)"]]);
        g.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6);
        g.beginPath();
        for (let i = 0; i <= 10; i += 1) {
          const a = (i / 10) * TAU;
          const rr = r * (1.22 + 0.12 * Math.sin(i * 2.7));
          if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = "rgba(255,252,240,0.92)";
        g.fill();
        g.strokeStyle = "rgba(120,90,40,0.55)";
        g.lineWidth = 1.2;
        g.stroke();
        ellipse(g, r * 0.05, r * 0.05, r * 0.82, r * 0.8);
        g.fillStyle = radial(g, 0, 0, r * 0.85, [[0, "#fff4b0"], [0.45, "#ffc21a"], [1, "#e07a00"]], -r * 0.25, -r * 0.3);
        g.fill();
        g.strokeStyle = kind === "bigyolk" ? "#ff3b1f" : "#a34d00";
        g.lineWidth = kind === "bigyolk" ? 2.5 : 1.4;
        g.stroke();
        ellipse(g, -r * 0.28, -r * 0.3, r * 0.2, r * 0.13, -0.6);
        g.fillStyle = "rgba(255,255,255,0.85)";
        g.fill();
      });
    }
    return sprite(r * 3.6, r * 3.8, (g) => {
      g.fillStyle = radial(g, 0, 0, r * 1.8, [[0, "rgba(255,248,225,0.6)"], [0.6, "rgba(255,240,210,0.22)"], [1, "rgba(255,240,210,0)"]]);
      g.fillRect(-r * 1.8, -r * 1.9, r * 3.6, r * 3.8);
      eggShape(g, r);
      g.fillStyle = radial(g, 0, 0, r * 1.3, [[0, "#ffffff"], [0.6, "#fbf3e4"], [1, "#d8c6a6"]], -r * 0.35, -r * 0.5);
      g.fill();
      g.strokeStyle = "rgba(70,45,20,0.9)";
      g.lineWidth = Math.max(1.4, r * 0.14);
      g.stroke();
      if (r >= 10) {
        g.fillStyle = "rgba(170,120,70,0.45)";
        for (const [sx, sy, sr] of [[0.35, 0.2, 0.09], [-0.3, 0.45, 0.07], [0.15, -0.55, 0.06], [-0.5, -0.05, 0.05]]) {
          ellipse(g, sx * r, sy * r, sr * r, sr * r * 0.8);
          g.fill();
        }
      }
      ellipse(g, -r * 0.36, -r * 0.52, r * 0.18, r * 0.34, -0.4);
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.fill();
    });
  });
}

export function drawEggs(ctx, eggs, time) {
  for (const e of eggs) {
    const spr = eggSprite(e.kind, e.r);
    if (e.kind === "quill" || e.kind === "missile") blit(ctx, spr, e.x, e.y, Math.atan2(e.vy, e.vx) + Math.PI / 2);
    else if (e.kind === "yolk" || e.kind === "bigyolk") {
      const wob = Math.sin(e.t * 9) * 0.08;
      blit(ctx, spr, e.x, e.y, 0, 1 + wob, 1 - wob);
      if (e.kind === "bigyolk") {
        ctx.globalCompositeOperation = "lighter";
        blit(ctx, glowDot("warn", e.r * 2, "#ff3b1f"), e.x, e.y, 0, 1, 1, 0.3 + 0.3 * Math.sin(time * 14));
      }
    } else if (e.kind === "egg") blit(ctx, spr, e.x, e.y, Math.sin(e.t * 7 + e.x) * 0.35);
    else blit(ctx, spr, e.x, e.y, e.kind === "spark" ? time * 8 : 0);
    if (e.kind === "missile") {
      ctx.globalCompositeOperation = "lighter";
      blit(ctx, glowDot("trail", 8, "#ffae3d"), e.x - e.vx * 0.04, e.y - e.vy * 0.04, 0, 1, 1, 0.8);
    }
    ctx.globalCompositeOperation = "source-over";
  }
}

const PICKUP_COLOR = { kernel: "#ffd23f", cob: "#ffd23f", nugget: "#f0b429", burger: "#e07a2f", pizza: "#ff5a4a", power: "#ff5a3d", shield: "#4fd8ff", nova: "#ff4fd8", coolant: "#9be8ff", life: "#ff4f6d" };

function pickupSprite(kind, weapon) {
  return cached(`pickup:${kind}:${weapon || ""}`, () =>
    sprite(44, 44, (g) => {
      if (kind === "kernel") {
        g.beginPath();
        g.moveTo(0, -9);
        g.quadraticCurveTo(8, -6, 6, 4);
        g.quadraticCurveTo(0, 11, -6, 4);
        g.quadraticCurveTo(-8, -6, 0, -9);
        g.fillStyle = radial(g, 0, 0, 10, [[0, "#fff6b8"], [0.6, "#ffcf26"], [1, "#e09200"]], -2, -4);
        g.fill();
        g.strokeStyle = "#9a5d00";
        g.lineWidth = 1;
        g.stroke();
      } else if (kind === "cob") {
        g.rotate(-0.5);
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(0, 14);
          g.quadraticCurveTo(side * 14, 2, side * 4, -12);
          g.quadraticCurveTo(side * 4, 4, 0, 14);
          g.fillStyle = "#4caf50";
          g.fill();
        }
        ellipse(g, 0, -2, 6, 13);
        g.fillStyle = "#ffcf26";
        g.fill();
        g.fillStyle = "#ffe98a";
        for (let y = -12; y <= 8; y += 4) for (const x of [-3, 0, 3]) g.fillRect(x - 1, y, 2, 2);
      } else if (kind === "nugget") {
        g.beginPath();
        g.moveTo(-8, 4);
        g.quadraticCurveTo(-12, -2, -4, -8);
        g.quadraticCurveTo(2, -12, 9, -5);
        g.quadraticCurveTo(13, 2, 6, 8);
        g.quadraticCurveTo(0, 12, -8, 4);
        g.closePath();
        g.fillStyle = radial(g, 0, 0, 12, [[0, "#ffe7a3"], [0.55, "#f0a318"], [1, "#b86a10"]], -2, -3);
        g.fill();
        g.fillStyle = "#c47a12";
        for (const [x, y] of [[-3, -2], [3, 1], [0, 4], [-5, 3]]) g.fillRect(x, y, 2, 2);
      } else if (kind === "burger") {
        g.fillStyle = "#e7b15a";
        g.beginPath();
        g.ellipse(0, -6, 11, 5, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = "#6fbf4a";
        g.fillRect(-10, -7, 20, 3);
        g.fillStyle = "#f2d15a";
        g.fillRect(-10, -4, 20, 2);
        g.fillStyle = "#8a3d22";
        g.fillRect(-11, -2, 22, 5);
        g.fillStyle = "#f0c27a";
        g.beginPath();
        g.ellipse(0, 5, 11, 4, 0, 0, TAU);
        g.fill();
      } else if (kind === "pizza") {
        g.beginPath();
        g.moveTo(0, -13);
        g.lineTo(11, 9);
        g.quadraticCurveTo(0, 13, -11, 9);
        g.closePath();
        g.fillStyle = "#f3c56b";
        g.fill();
        g.beginPath();
        g.moveTo(0, -8);
        g.lineTo(8, 8);
        g.quadraticCurveTo(0, 11, -8, 8);
        g.closePath();
        g.fillStyle = "#e24b3b";
        g.fill();
        g.fillStyle = "#f6d7a8";
        for (const [x, y] of [[-2, -1], [3, 3], [-1, 5]]) {
          g.beginPath();
          g.arc(x, y, 2, 0, TAU);
          g.fill();
        }
      } else if (kind === "crate") {
        const c = ACCENT[weapon] || "#ff7a3d";
        g.fillStyle = linear(g, 0, -12, 0, 13, [[0, shade(c, 0.35)], [1, shade(c, -0.3)]]);
        g.fillRect(-13, -9, 26, 22);
        g.fillStyle = shade(c, 0.15);
        g.fillRect(-15, -13, 30, 7);
        g.fillStyle = "#fff4d6";
        g.fillRect(-2.5, -13, 5, 26);
        for (const side of [-1, 1]) {
          ellipse(g, side * 6, -16, 6, 4, side * 0.5);
          g.fill();
        }
        g.strokeStyle = rgba("#000000", 0.35);
        g.lineWidth = 1.2;
        g.strokeRect(-13, -9, 26, 22);
      } else {
        const c = PICKUP_COLOR[kind];
        g.fillStyle = radial(g, 0, 0, 14, [[0, "#ffffff"], [0.35, shade(c, 0.3)], [1, shade(c, -0.35)]], -3, -4);
        g.beginPath();
        if (kind === "life") {
          g.moveTo(0, 11);
          g.bezierCurveTo(-16, 0, -10, -14, 0, -6);
          g.bezierCurveTo(10, -14, 16, 0, 0, 11);
        } else if (kind === "shield") {
          for (let i = 0; i < 6; i += 1) g.lineTo(Math.cos((i / 6) * TAU) * 13, Math.sin((i / 6) * TAU) * 13);
        } else g.arc(0, 0, 12, 0, TAU);
        g.closePath();
        g.fill();
        g.strokeStyle = rgba("#ffffff", 0.75);
        g.lineWidth = 1.5;
        g.stroke();
        g.strokeStyle = "#ffffff";
        g.lineWidth = 2;
        g.lineCap = "round";
        g.beginPath();
        if (kind === "coolant") {
          for (let i = 0; i < 3; i += 1) {
            const a = (i / 3) * Math.PI;
            g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
            g.lineTo(-Math.cos(a) * 8, -Math.sin(a) * 8);
          }
        } else if (kind === "nova") {
          for (let i = 0; i < 8; i += 1) {
            const a = (i / 8) * TAU;
            const len = i % 2 ? 4 : 8;
            g.moveTo(0, 0);
            g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          }
        } else if (kind === "power") {
          g.moveTo(2, -7);
          g.lineTo(-3, 1);
          g.lineTo(2, 1);
          g.lineTo(-2, 8);
        }
        g.stroke();
      }
    }),
  );
}

export function drawPickups(ctx, pickups, time) {
  for (const k of pickups) {
    const color = k.kind === "crate" ? ACCENT[k.weapon] : PICKUP_COLOR[k.kind];
    const bob = Math.sin(k.t * 4 + k.spin) * 2;
    ctx.globalCompositeOperation = "lighter";
    const big = k.kind !== "kernel" && k.kind !== "cob";
    blit(ctx, glowDot(`pk:${color}`, big ? 26 : 16, color), k.x, k.y + bob, 0, 1, 1, big ? 0.55 + 0.25 * Math.sin(time * 6 + k.spin) : 0.35);
    ctx.globalCompositeOperation = "source-over";
    const spr = pickupSprite(k.kind, k.weapon);
    if (k.kind === "kernel") blit(ctx, spr, k.x, k.y + bob, 0, Math.cos(k.angle * 2), 1);
    else if (k.kind === "cob") blit(ctx, spr, k.x, k.y + bob, k.angle * 0.5);
    else blit(ctx, spr, k.x, k.y + bob, 0, 1 + Math.sin(time * 5) * 0.05);
    if (k.kind === "power") {
      ctx.strokeStyle = "rgba(255,190,120,0.8)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i += 1) {
        ctx.beginPath();
        ctx.ellipse(k.x, k.y + bob, 19, 7, time * 2.5 + i * 1.6, 0, TAU);
        ctx.stroke();
      }
    }
  }
}

const ROCK_TINTS = ["#b39c86", "#a391bf", "#8fb3ad", "#c48f6e"];

function rockSprite(size, variant, r) {
  return cached(`rock:${size}:${variant}:${r}`, () =>
    sprite(r * 2.6, r * 2.6, (g) => {
      let seed = variant * 977 + size * 131 + 7;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const n = 10 + Math.floor(rnd() * 4);
      const outline = new Path2D();
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * TAU;
        const rr = r * (0.84 + rnd() * 0.28);
        outline.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      outline.closePath();
      const tint = ROCK_TINTS[variant % 4];
      g.fillStyle = radial(g, 0, 0, r * 1.2, [[0, shade(tint, 0.45)], [0.55, tint], [1, shade(tint, -0.5)]], -r * 0.35, -r * 0.4);
      g.fill(outline);
      g.save();
      g.clip(outline);
      for (let i = 0; i < 3 + size; i += 1) {
        const a = rnd() * TAU;
        const d = rnd() * r * 0.55;
        const cr = r * (0.1 + rnd() * 0.14);
        ellipse(g, Math.cos(a) * d, Math.sin(a) * d, cr, cr * 0.8);
        g.fillStyle = rgba(shade(tint, -0.5), 0.55);
        g.fill();
        g.strokeStyle = rgba(shade(tint, 0.6), 0.6);
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(Math.cos(a) * d, Math.sin(a) * d, cr, 0.2, 1.6);
        g.stroke();
      }
      if (variant % 2 === 1) {
        g.strokeStyle = "rgba(255,150,60,0.85)";
        g.lineWidth = Math.max(1.4, r * 0.05);
        g.lineCap = "round";
        g.beginPath();
        let x = -r * 0.6;
        let y = -r * 0.1;
        g.moveTo(x, y);
        for (let i = 0; i < 4; i += 1) {
          x += r * (0.25 + rnd() * 0.15);
          y += r * (rnd() - 0.45) * 0.5;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = linear(g, -r, -r, r * 0.4, r * 0.4, [[0, "rgba(255,244,225,0.5)"], [0.45, "rgba(255,244,225,0)"]]);
      g.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
      g.restore();
      g.strokeStyle = "rgba(255,236,210,0.55)";
      g.lineWidth = Math.max(2.5, r * 0.12);
      g.save();
      g.translate(-1, -1);
      g.stroke(outline);
      g.restore();
      g.strokeStyle = "rgba(18,8,12,0.9)";
      g.lineWidth = Math.max(1.6, r * 0.07);
      g.stroke(outline);
    }),
  );
}

export function drawRock(ctx, e, time) {
  const spr = rockSprite(e.size, e.variant, e.r);
  const speed = Math.hypot(e.vx || 0, e.vy || 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (speed > 20) {
    const angle = Math.atan2(e.vy, e.vx) - Math.PI / 2;
    const tail = glowDot("meteor", e.r, "#ff8a3d", "#ffe2a8");
    for (let i = 1; i <= 3; i += 1) {
      const k = i * 0.045;
      blit(ctx, tail, e.x - e.vx * k, e.y - e.vy * k, angle, 1.25 - i * 0.22, 1.9 - i * 0.3, 0.32 / i);
    }
  }
  blit(ctx, glowDot("rockrim", e.r * 1.5, "#ffb070", "#ffd8b0"), e.x, e.y, 0, 1, 1, 0.22 + 0.06 * Math.sin((time || 0) * 5 + e.id));
  ctx.restore();
  blit(ctx, spr, e.x, e.y, e.angle);
  if (e.flash > 0) blit(ctx, silhouette(`rock:${e.size}:${e.variant}:${e.r}`, spr), e.x, e.y, e.angle, 1, 1, e.flash / 0.09);
}

export function weaponColor(weapon) {
  return ACCENT[weapon] || WEAPONS.pulse.color;
}

export { ACCENT, PICKUP_COLOR, pickupSprite, rockSprite, shipSprite };
