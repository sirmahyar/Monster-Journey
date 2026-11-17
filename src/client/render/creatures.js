import { blit, cached, ellipse, linear, radial, rgba, shade, silhouette, sprite } from "./paint.js";

export const FRAMES = 6;
const TAU = Math.PI * 2;

export const HEN_COLORS = [
  { body: "#fffaf2", shade: "#d6c2a6", wing: "#f1e3cc" },
  { body: "#f7d29c", shade: "#c48a4f", wing: "#e9b071" },
  { body: "#c98a58", shade: "#7a4526", wing: "#ab6a3e" },
  { body: "#e6eaf2", shade: "#97a1b6", wing: "#ccd3e0" },
];
const CHICK_COLORS = ["#ffe45c", "#ffd23f", "#fff07a", "#ffc93c"];
const BOMBER_COLORS = [
  { body: "#9a8f86", shade: "#5a524c", wing: "#80766e" },
  { body: "#b07a4a", shade: "#6b4222", wing: "#93623a" },
  { body: "#8e9aa8", shade: "#4f5a68", wing: "#768391" },
  { body: "#a86a5a", shade: "#5f3328", wing: "#8c5446" },
];
const ROOSTER_COLORS = [
  { body: "#b33a22", shade: "#5c1a0f", wing: "#842a17", tail: "#1f7a64" },
  { body: "#3f3650", shade: "#1b1622", wing: "#2d2639", tail: "#2fa37c" },
  { body: "#d16b1f", shade: "#7a3608", wing: "#a85214", tail: "#25507a" },
  { body: "#f1ece4", shade: "#a99d8c", wing: "#d8cfc0", tail: "#3c3c46" },
];
const GOLD = { body: "#ffd95a", shade: "#b5790f", wing: "#ffc53d" };
export const FEATHER_TINTS = {
  hen: HEN_COLORS.map((c) => c.body),
  chick: CHICK_COLORS,
  diver: HEN_COLORS.map((c) => c.body),
  bomber: BOMBER_COLORS.map((c) => c.body),
  rooster: ROOSTER_COLORS.map((c) => c.body),
  saucer: ["#cfd8e6", "#ffe45c", "#bfe9ff", "#ffd0f0"],
  golden: [GOLD.body, GOLD.wing, "#fff3b0", GOLD.body],
};

function legs(g, r, swing) {
  g.strokeStyle = "#f08a24";
  g.lineWidth = r * 0.09;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const side of [-1, 1]) {
    const x = side * r * 0.3;
    const foot = x + swing * side;
    g.beginPath();
    g.moveTo(x, r * 0.72);
    g.lineTo(foot, r * 1.1);
    for (const t of [-1, 0, 1]) {
      g.moveTo(foot, r * 1.1);
      g.lineTo(foot + t * r * 0.13, r * 1.24);
    }
    g.stroke();
  }
}

function wing(g, r, side, angle, color, dark, size = 1) {
  g.save();
  g.translate(side * r * 0.74, -r * 0.05);
  g.rotate(side * angle);
  g.scale(side * size, size);
  g.beginPath();
  g.moveTo(0, -r * 0.28);
  g.quadraticCurveTo(r * 0.75, -r * 0.6, r * 0.98, -r * 0.08);
  g.quadraticCurveTo(r * 0.88, r * 0.12, r * 0.7, r * 0.1);
  g.quadraticCurveTo(r * 0.62, r * 0.3, r * 0.44, r * 0.22);
  g.quadraticCurveTo(r * 0.3, r * 0.42, r * 0.08, r * 0.3);
  g.closePath();
  g.fillStyle = linear(g, 0, -r * 0.45, 0, r * 0.4, [
    [0, shade(color, 0.3)],
    [1, dark],
  ]);
  g.fill();
  g.strokeStyle = rgba("#000000", 0.2);
  g.lineWidth = r * 0.035;
  g.stroke();
  g.strokeStyle = rgba(dark, 0.8);
  g.lineWidth = r * 0.03;
  g.beginPath();
  g.moveTo(r * 0.22, -r * 0.02);
  g.lineTo(r * 0.72, -r * 0.08);
  g.moveTo(r * 0.2, r * 0.1);
  g.lineTo(r * 0.55, r * 0.1);
  g.stroke();
  g.restore();
}

function body(g, r, c, rx = 0.95, ry = 0.9) {
  ellipse(g, 0, 0, r * rx, r * ry);
  g.fillStyle = radial(
    g,
    0,
    0,
    r * 1.05,
    [
      [0, shade(c.body, 0.4)],
      [0.55, c.body],
      [1, c.shade],
    ],
    -r * 0.35,
    -r * 0.45,
  );
  g.fill();
  g.strokeStyle = rgba("#000000", 0.24);
  g.lineWidth = r * 0.045;
  g.stroke();
  g.strokeStyle = rgba(c.shade, 0.55);
  g.lineWidth = r * 0.035;
  for (let row = 0; row < 2; row += 1) {
    for (let i = -1; i <= 1 - row; i += 1) {
      g.beginPath();
      g.arc(i * r * 0.27 + row * r * 0.135, r * (0.36 + row * 0.2), r * 0.11, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
  }
}

function comb(g, r, lobes, scale, color = "#ff3b3b") {
  const top = -r * 0.84;
  g.fillStyle = radial(g, 0, top - r * 0.15, r * 0.4 * scale, [
    [0, shade(color, 0.35)],
    [1, shade(color, -0.25)],
  ]);
  g.strokeStyle = rgba("#5a0000", 0.35);
  g.lineWidth = r * 0.03;
  for (let i = 0; i < lobes; i += 1) {
    const t = lobes === 1 ? 0 : i / (lobes - 1) - 0.5;
    const h = (1 - Math.abs(t) * 0.7) * r * 0.2 * scale;
    ellipse(g, t * r * 0.38 * scale, top - h * 0.55, r * 0.1 * scale + 0.5, h);
    g.fill();
    g.stroke();
  }
}

function eyes(g, r, blink, { size = 0.22, angry = false, lens = false } = {}) {
  const ey = -r * 0.3;
  const er = r * size;
  for (const side of [-1, 1]) {
    const x = side * r * 0.3;
    if (blink && !lens) {
      g.strokeStyle = "#2a1a12";
      g.lineWidth = r * 0.06;
      g.lineCap = "round";
      g.beginPath();
      g.arc(x, ey, er * 0.7, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      continue;
    }
    ellipse(g, x, ey, er, er * 1.12);
    g.fillStyle = "#ffffff";
    g.fill();
    g.strokeStyle = rgba("#000000", 0.28);
    g.lineWidth = r * 0.025;
    g.stroke();
    ellipse(g, x - side * er * 0.1, ey + er * 0.3, er * 0.55, er * 0.62);
    g.fillStyle = "#1c120c";
    g.fill();
    ellipse(g, x - side * er * 0.1 - er * 0.18, ey + er * 0.1, er * 0.18, er * 0.18);
    g.fillStyle = "#ffffff";
    g.fill();
    if (angry) {
      g.strokeStyle = "#2a0d06";
      g.lineWidth = r * 0.085;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x + side * er * 1.05, ey - er * 1.25);
      g.lineTo(x - side * er * 0.75, ey - er * 0.7);
      g.stroke();
    }
  }
}

function beak(g, r, open = false, wattle = true) {
  const y = -r * 0.06;
  if (wattle) {
    ellipse(g, r * 0.02, y + r * 0.27, r * 0.07, r * 0.11);
    g.fillStyle = "#e8323a";
    g.fill();
  }
  g.fillStyle = linear(g, 0, y - r * 0.1, 0, y + r * 0.2, [
    [0, "#ffc247"],
    [1, "#ef8216"],
  ]);
  g.beginPath();
  g.moveTo(-r * 0.15, y);
  g.quadraticCurveTo(0, y - r * 0.13, r * 0.15, y);
  g.lineTo(0, y + (open ? r * 0.1 : r * 0.18));
  g.closePath();
  g.fill();
  g.strokeStyle = rgba("#7a3b00", 0.45);
  g.lineWidth = r * 0.025;
  g.stroke();
  if (open) {
    g.beginPath();
    g.moveTo(-r * 0.1, y + r * 0.14);
    g.lineTo(r * 0.1, y + r * 0.14);
    g.lineTo(0, y + r * 0.26);
    g.closePath();
    g.fill();
  }
}

function cheeks(g, r) {
  g.fillStyle = rgba("#ff7a9a", 0.32);
  for (const side of [-1, 1]) {
    ellipse(g, side * r * 0.55, -r * 0.04, r * 0.13, r * 0.08);
    g.fill();
  }
}

function tail(g, r, color, dark) {
  for (let i = 0; i < 3; i += 1) {
    g.save();
    g.translate(r * 0.45, -r * 0.6);
    g.rotate(-0.9 + i * 0.42);
    ellipse(g, r * 0.25, 0, r * 0.32, r * 0.12);
    g.fillStyle = i === 1 ? color : dark;
    g.fill();
    g.restore();
  }
}

function flapAngle(frame) {
  return -0.3 + Math.sin((frame / FRAMES) * TAU) * 0.6;
}

function hen(g, r, variant, frame, blink, extra = {}) {
  const c = extra.colors || HEN_COLORS[variant % HEN_COLORS.length];
  const flap = flapAngle(frame);
  tail(g, r, c.wing, c.shade);
  wing(g, r, -1, flap, c.wing, c.shade);
  wing(g, r, 1, flap, c.wing, c.shade);
  legs(g, r, Math.sin((frame / FRAMES) * TAU) * r * 0.05);
  body(g, r, c);
  if (extra.crown) crown(g, r);
  else if (!extra.helmet) comb(g, r, 3, 1);
  cheeks(g, r);
  eyes(g, r, blink, { lens: extra.goggles });
  beak(g, r, extra.open);
}

function crown(g, r) {
  const y = -r * 0.82;
  g.beginPath();
  g.moveTo(-r * 0.32, y);
  g.lineTo(-r * 0.36, y - r * 0.32);
  g.lineTo(-r * 0.16, y - r * 0.14);
  g.lineTo(0, y - r * 0.4);
  g.lineTo(r * 0.16, y - r * 0.14);
  g.lineTo(r * 0.36, y - r * 0.32);
  g.lineTo(r * 0.32, y);
  g.closePath();
  g.fillStyle = linear(g, 0, y - r * 0.4, 0, y, [
    [0, "#fff6c2"],
    [1, "#e09b0c"],
  ]);
  g.fill();
  g.strokeStyle = "#8a5a00";
  g.lineWidth = r * 0.03;
  g.stroke();
  for (const [x, color] of [
    [-r * 0.18, "#ff4f6d"],
    [0, "#42d7ff"],
    [r * 0.18, "#6cff8b"],
  ]) {
    ellipse(g, x, y - r * 0.07, r * 0.05, r * 0.05);
    g.fillStyle = color;
    g.fill();
  }
}

function goggles(g, r) {
  const ey = -r * 0.3;
  g.fillStyle = "#4a2c1a";
  g.fillRect(-r * 0.92, ey - r * 0.07, r * 1.84, r * 0.14);
  for (const side of [-1, 1]) {
    const x = side * r * 0.3;
    ellipse(g, x, ey, r * 0.27, r * 0.27);
    g.fillStyle = "#c9a227";
    g.fill();
    ellipse(g, x, ey, r * 0.21, r * 0.21);
    g.fillStyle = radial(g, x, ey, r * 0.21, [
      [0, rgba("#bff6ff", 0.5)],
      [1, rgba("#2a8fb8", 0.75)],
    ]);
    g.fill();
    ellipse(g, x + r * 0.02, ey + r * 0.06, r * 0.09, r * 0.1);
    g.fillStyle = "#13212b";
    g.fill();
    g.strokeStyle = rgba("#ffffff", 0.8);
    g.lineWidth = r * 0.04;
    g.beginPath();
    g.arc(x, ey, r * 0.15, 3.6, 4.4);
    g.stroke();
  }
}

function scarf(g, r, frame) {
  const wave = Math.sin((frame / FRAMES) * TAU);
  g.fillStyle = "#e5383b";
  g.strokeStyle = rgba("#5a0000", 0.45);
  g.lineWidth = r * 0.03;
  g.beginPath();
  g.moveTo(r * 0.45, r * 0.38);
  g.quadraticCurveTo(r * 0.95, r * 0.42 + wave * r * 0.12, r * 1.35, r * 0.22 + wave * r * 0.22);
  g.lineTo(r * 1.28, r * 0.48 + wave * r * 0.16);
  g.quadraticCurveTo(r * 0.85, r * 0.62, r * 0.42, r * 0.54);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(-r * 0.62, r * 0.3);
  g.quadraticCurveTo(0, r * 0.48, r * 0.62, r * 0.3);
  g.lineTo(r * 0.6, r * 0.46);
  g.quadraticCurveTo(0, r * 0.64, -r * 0.6, r * 0.46);
  g.closePath();
  g.fill();
  g.stroke();
  ellipse(g, r * 0.42, r * 0.46, r * 0.11, r * 0.1);
  g.fillStyle = "#b8232a";
  g.fill();
}

function helmet(g, r) {
  g.beginPath();
  g.arc(0, -r * 0.42, r * 0.62, Math.PI * 1.02, Math.PI * 1.98);
  g.closePath();
  g.fillStyle = linear(g, 0, -r * 1.05, 0, -r * 0.4, [
    [0, "#e6ecf2"],
    [1, "#6c7889"],
  ]);
  g.fill();
  g.strokeStyle = "#3b4350";
  g.lineWidth = r * 0.04;
  g.stroke();
  g.fillStyle = "#4b5563";
  g.fillRect(-r * 0.66, -r * 0.5, r * 1.32, r * 0.1);
  g.fillStyle = "#cfd6df";
  for (const x of [-0.4, 0, 0.4]) {
    ellipse(g, x * r, -r * 0.45, r * 0.035, r * 0.035);
    g.fill();
  }
}

function eggBelt(g, r) {
  g.save();
  g.rotate(-0.5);
  g.fillStyle = "#6b3f1f";
  g.fillRect(-r * 0.95, r * 0.12, r * 1.9, r * 0.16);
  for (const x of [-0.45, 0, 0.45]) {
    ellipse(g, x * r, r * 0.2, r * 0.09, r * 0.12);
    g.fillStyle = "#fff6e6";
    g.fill();
  }
  g.restore();
}

function hackles(g, r, color) {
  g.fillStyle = color;
  for (let i = 0; i < 9; i += 1) {
    const a = Math.PI * (0.95 + (i / 8) * 1.1);
    const x = Math.cos(a) * r * 0.78;
    const y = Math.sin(a) * r * 0.62 - r * 0.15;
    g.beginPath();
    g.moveTo(x - r * 0.12, y);
    g.lineTo(x * 1.28, y * 1.25 + r * 0.05);
    g.lineTo(x + r * 0.12, y);
    g.closePath();
    g.fill();
  }
}

function plume(g, r, color) {
  g.lineCap = "round";
  for (let i = 0; i < 4; i += 1) {
    g.strokeStyle = i % 2 ? shade(color, 0.25) : color;
    g.lineWidth = r * (0.16 - i * 0.02);
    g.beginPath();
    g.moveTo(r * 0.2, -r * 0.3);
    g.quadraticCurveTo(r * (0.9 + i * 0.12), -r * (1.4 - i * 0.12), r * (1.25 + i * 0.1), -r * (0.55 - i * 0.18));
    g.stroke();
  }
}

function rooster(g, r, variant, frame, blink) {
  const c = ROOSTER_COLORS[variant % ROOSTER_COLORS.length];
  const flap = flapAngle(frame);
  plume(g, r, c.tail);
  wing(g, r, -1, flap, c.wing, c.shade, 1.1);
  wing(g, r, 1, flap, c.wing, c.shade, 1.1);
  legs(g, r, Math.sin((frame / FRAMES) * TAU) * r * 0.05);
  body(g, r, c);
  hackles(g, r, "#f2b632");
  comb(g, r, 5, 1.45, "#ff2d2d");
  eyes(g, r, blink, { angry: true, size: 0.2 });
  beak(g, r, false);
}

function chick(g, r, variant, frame, blink) {
  const color = CHICK_COLORS[variant % CHICK_COLORS.length];
  const c = { body: color, shade: shade(color, -0.3), wing: shade(color, -0.08) };
  const flap = flapAngle(frame) * 1.3;
  wing(g, r, -1, flap, c.wing, c.shade, 0.7);
  wing(g, r, 1, flap, c.wing, c.shade, 0.7);
  legs(g, r * 0.85, Math.sin((frame / FRAMES) * TAU) * r * 0.06);
  ellipse(g, 0, 0, r * 0.95, r * 0.92);
  g.fillStyle = radial(g, 0, 0, r, [[0, shade(color, 0.5)], [0.6, color], [1, c.shade]], -r * 0.3, -r * 0.4);
  g.fill();
  g.strokeStyle = rgba("#7a5200", 0.35);
  g.lineWidth = r * 0.05;
  g.stroke();
  if (variant % 2 === 0) {
    g.beginPath();
    g.moveTo(-r * 0.55, -r * 0.7);
    for (let i = 0; i <= 6; i += 1) g.lineTo(-r * 0.55 + (i / 6) * r * 1.1, -r * (i % 2 ? 0.8 : 0.66));
    g.quadraticCurveTo(0, -r * 1.45, -r * 0.55, -r * 0.7);
    g.fillStyle = linear(g, 0, -r * 1.2, 0, -r * 0.5, [[0, "#ffffff"], [1, "#e8dcc8"]]);
    g.fill();
    g.strokeStyle = rgba("#8a7a60", 0.6);
    g.lineWidth = r * 0.04;
    g.stroke();
  } else {
    g.strokeStyle = shade(color, -0.25);
    g.lineWidth = r * 0.07;
    g.lineCap = "round";
    for (const a of [-0.5, 0, 0.5]) {
      g.beginPath();
      g.moveTo(0, -r * 0.85);
      g.quadraticCurveTo(a * r * 0.4, -r * 1.25, a * r * 0.6, -r * 1.15);
      g.stroke();
    }
  }
  cheeks(g, r);
  eyes(g, r, blink, { size: 0.27 });
  beak(g, r * 0.8, false, false);
}

function saucer(g, r, variant, frame) {
  g.save();
  g.translate(0, -r * 0.2);
  chick(g, r * 0.48, variant, frame, false);
  g.restore();
  g.beginPath();
  g.arc(0, -r * 0.05, r * 0.68, Math.PI, 0);
  g.closePath();
  g.fillStyle = radial(g, 0, -r * 0.3, r * 0.8, [[0, rgba("#e6fbff", 0.15)], [0.7, rgba("#7fd8ff", 0.25)], [1, rgba("#3aa0ff", 0.55)]], -r * 0.25, -r * 0.45);
  g.fill();
  g.strokeStyle = rgba("#dff6ff", 0.9);
  g.lineWidth = r * 0.05;
  g.stroke();
  g.strokeStyle = rgba("#ffffff", 0.75);
  g.beginPath();
  g.arc(0, -r * 0.05, r * 0.52, Math.PI * 1.15, Math.PI * 1.4);
  g.stroke();
  ellipse(g, 0, r * 0.28, r * 1.3, r * 0.4);
  g.fillStyle = linear(g, 0, r * -0.1, 0, r * 0.68, [[0, "#f1f5fb"], [0.5, "#8d9bb4"], [1, "#3c475c"]]);
  g.fill();
  g.strokeStyle = "#2a3242";
  g.lineWidth = r * 0.05;
  g.stroke();
  ellipse(g, 0, r * 0.22, r * 1.05, r * 0.16);
  g.strokeStyle = rgba("#ffffff", 0.35);
  g.stroke();
  for (let i = 0; i < 6; i += 1) {
    const x = (i / 5 - 0.5) * r * 2;
    const lit = (i + frame) % 3 === 0;
    ellipse(g, x, r * 0.36 + Math.abs(x) * -0.08, r * 0.08, r * 0.08);
    g.fillStyle = lit ? "#fff06a" : ["#ff5d8f", "#5dffb1", "#5dc2ff"][i % 3];
    g.fill();
  }
  ellipse(g, 0, r * 0.66, r * 0.34, r * 0.1);
  g.fillStyle = rgba("#7dffb2", 0.8);
  g.fill();
}

function golden(g, r, variant, frame, blink) {
  hen(g, r, variant, frame, blink, { colors: GOLD, crown: true });
  g.fillStyle = "#fffbe0";
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * TAU + (frame / FRAMES) * (TAU / 4);
    const x = Math.cos(a) * r * 1.25;
    const y = Math.sin(a) * r * 1.0;
    const s = r * (0.1 + 0.06 * Math.sin(frame + i));
    g.beginPath();
    g.moveTo(x, y - s * 2);
    g.lineTo(x + s * 0.5, y - s * 0.5);
    g.lineTo(x + s * 2, y);
    g.lineTo(x + s * 0.5, y + s * 0.5);
    g.lineTo(x, y + s * 2);
    g.lineTo(x - s * 0.5, y + s * 0.5);
    g.lineTo(x - s * 2, y);
    g.lineTo(x - s * 0.5, y - s * 0.5);
    g.closePath();
    g.fill();
  }
}

const PAINTERS = {
  hen: (g, r, v, f, b) => hen(g, r, v, f, b),
  chick,
  rooster,
  saucer,
  golden,
  diver: (g, r, v, f, b) => {
    hen(g, r, v, f, b, { goggles: true });
    scarf(g, r, f);
    goggles(g, r);
  },
  bomber: (g, r, v, f, b) => {
    hen(g, r * 1.0, v, f, b, { colors: BOMBER_COLORS[v % BOMBER_COLORS.length], helmet: true });
    helmet(g, r);
    eggBelt(g, r);
  },
};

/** Paints one cached animation frame of a creature. */
export function creatureSprite(kind, variant, frame, blink, r) {
  const key = `${kind}:${variant}:${frame}:${blink ? 1 : 0}:${r}`;
  return cached(key, () => {
    const tall = kind === "rooster" ? 4 : 3.4;
    return sprite(r * 4.2, r * tall, (g) => {
      if (kind === "rooster") g.translate(0, r * 0.25);
      PAINTERS[kind](g, r, variant, frame, blink);
    });
  });
}

export function creatureFlash(kind, variant, frame, blink, r) {
  const key = `${kind}:${variant}:${frame}:${blink ? 1 : 0}:${r}`;
  return silhouette(key, creatureSprite(kind, variant, frame, blink, r));
}

export const parts = { wing, body, comb, crown, eyes, beak, cheeks, legs, hackles, plume, chick };

/** Draws a creature at an arbitrary place, used by menus and boss summons. */
export function paintCreature(ctx, kind, x, y, r, time, variant = 0, rot = 0) {
  const frame = Math.floor(time * 12) % FRAMES;
  blit(ctx, creatureSprite(kind, variant, frame, false, r), x, y, rot);
}
