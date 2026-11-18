import { H, W } from "../../game/config.js";
import { cached, linear, radial, rgba, shade, sprite } from "./paint.js";

const TAU = Math.PI * 2;

export const THEMES = [
  { top: "#1b0b3a", bottom: "#41104f", nebula: ["#ff4fb8", "#8a4dff", "#ff8a5c"], planet: "#ff9ec7", ring: true },
  { top: "#0b1236", bottom: "#46300c", nebula: ["#ffb23f", "#ff6a3d", "#ffd86b"], planet: "#ffcf6b", ring: false },
  { top: "#03201f", bottom: "#0c3d2e", nebula: ["#2fffc1", "#2fa3ff", "#7dff6b"], planet: "#6bffd0", ring: true },
  { top: "#17040b", bottom: "#420a14", nebula: ["#ff3b3b", "#ff7b2f", "#b02fff"], planet: "#ff5a3d", ring: false },
  { top: "#070818", bottom: "#1a1038", nebula: ["#6a5cff", "#9b7bff", "#3d4a8a"], planet: "#b9a6ff", ring: true },
  { top: "#041820", bottom: "#0c3a48", nebula: ["#7ee0ff", "#c8f6ff", "#3d8cff"], planet: "#d8fff2", ring: false },
  { top: "#2a1204", bottom: "#5a2a08", nebula: ["#ffb020", "#ff6a1a", "#ffe08a"], planet: "#ffd36a", ring: true },
  { top: "#140818", bottom: "#3a1028", nebula: ["#ffd24a", "#ff4f8b", "#8a4dff"], planet: "#ffe08a", ring: true },
  { top: "#05030c", bottom: "#1a0830", nebula: ["#6a3cff", "#ff4ad8", "#24104a"], planet: "#c9a6ff", ring: true },
  { top: "#1a0505", bottom: "#3a1408", nebula: ["#ffd36a", "#ff3b1f", "#fff6d0"], planet: "#fff1b0", ring: false },
];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function makeStars(count, seed) {
  const rnd = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: rnd() * W,
    y: rnd() * H,
    size: 0.6 + rnd() * 1.6,
    tw: rnd() * TAU,
    hue: rnd(),
  }));
}

const LAYERS = [
  { stars: makeStars(110, 11), speed: 14, alpha: 0.5, scale: 0.7 },
  { stars: makeStars(60, 23), speed: 34, alpha: 0.75, scale: 1 },
  { stars: makeStars(26, 37), speed: 80, alpha: 1, scale: 1.5 },
];

function nebulaSprite(index) {
  const theme = THEMES[index];
  return cached(`nebula:${index}`, () =>
    sprite(
      W,
      H * 2,
      (g) => {
        const rnd = seededRandom(100 + index * 17);
        g.translate(-W / 2, -H);
        g.globalCompositeOperation = "lighter";
        for (let i = 0; i < 22; i += 1) {
          const x = rnd() * W;
          const y = rnd() * H * 2;
          const rad = 120 + rnd() * 260;
          const color = theme.nebula[i % theme.nebula.length];
          const peak = 0.16 + rnd() * 0.1;
          for (const cy of [y - H * 2, y, y + H * 2]) {
            if (cy + rad < 0 || cy - rad > H * 2) continue;
            g.fillStyle = radial(g, x, cy, rad, [[0, rgba(color, peak)], [0.5, rgba(color, 0.06)], [1, rgba(color, 0)]]);
            g.fillRect(x - rad, cy - rad, rad * 2, rad * 2);
          }
        }
      },
      0.5,
    ),
  );
}

function planetSprite(index) {
  const theme = THEMES[index];
  return cached(`planet:${index}`, () =>
    sprite(520, 520, (g) => {
      const R = 150;
      if (theme.ring) {
        g.save();
        g.rotate(-0.35);
        g.strokeStyle = rgba(shade(theme.planet, 0.4), 0.35);
        g.lineWidth = 16;
        g.beginPath();
        g.ellipse(0, 0, R * 1.65, R * 0.42, 0, Math.PI, TAU);
        g.stroke();
        g.restore();
      }
      g.beginPath();
      g.arc(0, 0, R, 0, TAU);
      g.fillStyle = radial(g, 0, 0, R, [[0, shade(theme.planet, 0.25)], [0.7, shade(theme.planet, -0.35)], [1, shade(theme.planet, -0.75)]], -R * 0.4, -R * 0.4);
      g.fill();
      g.save();
      g.clip();
      g.globalAlpha = 0.18;
      for (let i = 0; i < 7; i += 1) {
        g.fillStyle = i % 2 ? shade(theme.planet, 0.4) : shade(theme.planet, -0.5);
        g.fillRect(-R, -R + i * 44 + 10, R * 2, 16 + (i % 3) * 6);
      }
      g.restore();
      g.fillStyle = radial(g, 0, 0, R * 1.25, [[0.75, rgba(theme.planet, 0)], [0.82, rgba(theme.planet, 0.25)], [1, rgba(theme.planet, 0)]]);
      g.beginPath();
      g.arc(0, 0, R * 1.25, 0, TAU);
      g.fill();
      if (theme.ring) {
        g.save();
        g.rotate(-0.35);
        g.strokeStyle = rgba(shade(theme.planet, 0.5), 0.55);
        g.lineWidth = 12;
        g.beginPath();
        g.ellipse(0, 0, R * 1.65, R * 0.42, 0, 0, Math.PI);
        g.stroke();
        g.restore();
      }
    }, 0.75),
  );
}

function vignette() {
  return cached("vignette", () =>
    sprite(
      W,
      H,
      (g) => {
        g.fillStyle = radial(g, 0, 0, H * 0.75, [[0.55, "rgba(0,0,0,0)"], [1, "rgba(5,0,15,0.6)"]]);
        g.fillRect(-W / 2, -H / 2, W, H);
      },
      0.5,
    ),
  );
}

function paintTheme(ctx, index, time, alpha) {
  const theme = THEMES[index];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, theme.top], [1, theme.bottom]]);
  ctx.fillRect(0, 0, W, H);
  const neb = nebulaSprite(index);
  const offset = (time * 9) % (H * 2);
  ctx.drawImage(neb.canvas, 0, offset - H * 2, W, H * 2);
  ctx.drawImage(neb.canvas, 0, offset, W, H * 2);
  const planet = planetSprite(index);
  const py = ((time * 4 + index * 300) % (H + 700)) - 350;
  const px = index % 2 ? W * 0.18 : W * 0.82;
  ctx.drawImage(planet.canvas, px - planet.w / 2, py - planet.h / 2, planet.w, planet.h);
  ctx.globalAlpha = 1;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ chapter: number, fromChapter: number, fade: number, warp: number, time: number }} view
 */
export function drawBackground(ctx, view) {
  const { time, warp } = view;
  paintTheme(ctx, view.fromChapter - 1, time, 1);
  if (view.fade > 0 && view.chapter !== view.fromChapter) paintTheme(ctx, view.chapter - 1, time, view.fade);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const stretch = 1 + warp * 30;
  for (const layer of LAYERS) {
    const speed = layer.speed * (1 + warp * 22);
    for (const s of layer.stars) {
      const y = (s.y + time * speed) % H;
      const twinkle = 0.65 + 0.35 * Math.sin(time * 3 + s.tw);
      const size = s.size * layer.scale;
      const color = s.hue < 0.15 ? "255,210,170" : s.hue < 0.3 ? "170,210,255" : "255,255,255";
      ctx.fillStyle = `rgba(${color},${layer.alpha * twinkle})`;
      if (warp > 0.05) ctx.fillRect(s.x - size / 2, y - size * stretch, size, size * stretch);
      else {
        ctx.beginPath();
        ctx.arc(s.x, y, size, 0, TAU);
        ctx.fill();
      }
    }
  }
  if (warp > 0) {
    ctx.fillStyle = radial(ctx, W / 2, H * 0.4, H * 0.6, [[0, `rgba(200,230,255,${0.25 * warp})`], [1, "rgba(120,160,255,0)"]]);
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  const v = vignette();
  ctx.drawImage(v.canvas, 0, 0, W, H);
}
