export const FONT = 'Vazirmatn, Tahoma, "Segoe UI", sans-serif';

const PERSIAN_LETTER = /[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC]/;

/** Persian words read right to left; bare numbers keep their usual sign placement. */
export function textDirection(str) {
  return PERSIAN_LETTER.test(str) ? "rtl" : "ltr";
}

const cache = new Map();
let spriteScale = 1;

/** Sprites are rasterised at the backing-store scale so they stay crisp. */
export function setSpriteScale(scale) {
  const next = Math.max(0.75, Math.min(2.5, Math.round(scale * 4) / 4));
  if (next !== spriteScale) {
    spriteScale = next;
    cache.clear();
  }
}

/**
 * Draws once into an offscreen canvas centred on the origin.
 * Soft, blurry art can pass a lower `scale` to save memory.
 * @param {number} w @param {number} h @param {(g: CanvasRenderingContext2D) => void} draw
 */
export function sprite(w, h, draw, scale = spriteScale) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const g = canvas.getContext("2d");
  g.scale(scale, scale);
  g.translate(w / 2, h / 2);
  draw(g);
  return { canvas, w, h };
}

export function cached(key, make) {
  let s = cache.get(key);
  if (!s) {
    s = make();
    cache.set(key, s);
  }
  return s;
}

/** A white silhouette of a sprite, used for hit flashes. */
export function silhouette(key, source) {
  return cached(`${key}:white`, () =>
    sprite(source.w, source.h, (g) => {
      g.drawImage(source.canvas, -source.w / 2, -source.h / 2, source.w, source.h);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "#fff";
      g.fillRect(-source.w / 2, -source.h / 2, source.w, source.h);
    }),
  );
}

export function blit(ctx, s, x, y, rot = 0, sx = 1, sy = 1, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
  ctx.restore();
}

function parse(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, alpha) {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mixes two hex colours, t = 0 gives a and t = 1 gives b. */
export function mix(a, b, t) {
  const ca = parse(a);
  const cb = parse(b);
  const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function shade(hex, amount) {
  return amount >= 0 ? mix(hex, "#ffffff", amount) : mix(hex, "#000000", -amount);
}

export function radial(g, x, y, r, stops, fx = x, fy = y) {
  const grad = g.createRadialGradient(fx, fy, 0, x, y, r);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  return grad;
}

export function linear(g, x0, y0, x1, y1, stops) {
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  return grad;
}

export function ellipse(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function glowDot(key, radius, color, core = "#ffffff") {
  return cached(`glow:${key}:${radius}`, () =>
    sprite(radius * 2, radius * 2, (g) => {
      g.fillStyle = radial(g, 0, 0, radius, [
        [0, core],
        [0.25, color],
        [1, rgba(color.length === 7 ? color : "#ffffff", 0)],
      ]);
      g.fillRect(-radius, -radius, radius * 2, radius * 2);
    }),
  );
}
