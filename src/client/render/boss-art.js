import { H } from "../../game/config.js";
import { creatureSprite, parts } from "./creatures.js";
import { blit, ellipse, glowDot, linear, radial, rgba } from "./paint.js";

const TAU = Math.PI * 2;

function eyeGlow(ctx, r, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const side of [-1, 1]) blit(ctx, glowDot(`eye:${color}`, 22, color), side * r * 0.3, -r * 0.28, 0, 1, 1, alpha);
  ctx.restore();
}

function grandHen(ctx, b, time) {
  const r = 74;
  const flap = -0.25 + Math.sin(time * (3 + b.phase)) * 0.45;
  const wave = Math.sin(time * 2.4);
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.35);
  ctx.quadraticCurveTo(-r * 1.3, r * 0.4, -r * 1.05 + wave * 6, r * 1.2);
  ctx.quadraticCurveTo(0, r * 1.4 + wave * 5, r * 1.05 - wave * 6, r * 1.2);
  ctx.quadraticCurveTo(r * 1.3, r * 0.4, r * 0.7, -r * 0.35);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, -r * 0.4, 0, r * 1.3, [[0, "#a35cff"], [1, "#4b1a8a"]]);
  ctx.fill();
  ctx.strokeStyle = "#ffd24a";
  ctx.lineWidth = 5;
  ctx.stroke();
  parts.wing(ctx, r, -1, flap, "#fff1dc", "#cdb08a", 1.15);
  parts.wing(ctx, r, 1, flap, "#fff1dc", "#cdb08a", 1.15);
  parts.legs(ctx, r, Math.sin(time * 3) * r * 0.04);
  parts.body(ctx, r, { body: "#fff8ec", shade: "#d8bd96" });
  ctx.fillStyle = "#fffaf0";
  ctx.strokeStyle = "rgba(150,120,90,0.6)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i += 1) {
    const a = Math.PI * (0.2 + (i / 8) * 0.6);
    ellipse(ctx, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.3 + r * 0.14, 5, 5);
    ctx.fill();
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(0, -r * 0.08);
  ctx.scale(1.25, 1.25);
  parts.crown(ctx, r * 0.8);
  ctx.restore();
  parts.cheeks(ctx, r);
  parts.eyes(ctx, r, time % 4 < 0.12, { angry: b.phase >= 1, size: 0.2 });
  parts.beak(ctx, r, b.mouth > 0.3);
  if (b.phase >= 2 || b.charge > 0) eyeGlow(ctx, r, "#ff3b3b", 0.5 + 0.4 * Math.sin(time * 18));
}

function eggPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.bezierCurveTo(r * 0.98, -r * 1.1, r * 1.02, r * 0.85, 0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.02, r * 0.85, -r * 0.98, -r * 1.1, 0, -r * 1.15);
  ctx.closePath();
}

function reactor(ctx, b, time) {
  const r = 82;
  const ratio = b.hp / b.maxHp;
  const heat = b.phase >= 2 ? "#ff4a2a" : b.phase === 1 ? "#ff8a1f" : "#ffc21a";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const thrust = 26 + Math.sin(time * 40) * 6;
  ctx.fillStyle = linear(ctx, 0, 100, 0, 100 + thrust * 2, [[0, "rgba(255,240,200,0.9)"], [1, "rgba(255,120,40,0)"]]);
  ctx.beginPath();
  ctx.moveTo(-20, 100);
  ctx.quadraticCurveTo(0, 100 + thrust * 2.6, 20, 100);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = linear(ctx, 0, 50, 0, 106, [[0, "#b7c0d0"], [1, "#3c4558"]]);
  ctx.beginPath();
  ctx.moveTo(-36, 52);
  ctx.lineTo(36, 52);
  ctx.lineTo(24, 104);
  ctx.lineTo(-24, 104);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#1f2533";
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const a = b.spin + (i / 8) * TAU;
    const ex = Math.cos(a) * r * 1.18;
    const ey = Math.sin(a) * r * 1.0;
    ellipse(ctx, ex, ey, 9, 9);
    ctx.fillStyle = "#4b5568";
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    blit(ctx, glowDot(`emit:${heat}`, 16, heat), ex, ey, 0, 1, 1, 0.5 + b.mouth * 0.5);
    ctx.restore();
  }
  eggPath(ctx, r);
  ctx.fillStyle = radial(ctx, 0, 0, r * 1.3, [[0, "#ffffff"], [0.6, "#f6ecd8"], [1, "#b89f78"]], -r * 0.35, -r * 0.55);
  ctx.fill();
  ctx.strokeStyle = "#5a4630";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  eggPath(ctx, r);
  ctx.clip();
  for (const by of [-r * 0.62, r * 0.55]) {
    ctx.fillStyle = linear(ctx, 0, by - 9, 0, by + 9, [[0, "#d9dfe8"], [1, "#6b7689"]]);
    ctx.fillRect(-r * 1.2, by - 9, r * 2.4, 18);
    ctx.fillStyle = "#2c3340";
    for (let x = -r; x <= r; x += 22) {
      ellipse(ctx, x, by, 2.5, 2.5);
      ctx.fill();
    }
  }
  if (ratio < 0.66) {
    ctx.strokeStyle = "#3a2a18";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 1.1);
    ctx.lineTo(-r * 0.05, -r * 0.8);
    ctx.lineTo(-r * 0.3, -r * 0.62);
    ctx.lineTo(-r * 0.1, -r * 0.4);
    ctx.stroke();
  }
  if (ratio < 0.33) {
    ctx.beginPath();
    ctx.moveTo(r * 0.9, r * 0.1);
    ctx.lineTo(r * 0.55, r * 0.2);
    ctx.lineTo(r * 0.62, r * 0.42);
    ctx.lineTo(r * 0.36, r * 0.5);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba("#ff7a2a", 0.5 + 0.4 * Math.sin(time * 16));
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
  ellipse(ctx, 0, -r * 0.02, r * 0.5, r * 0.46);
  ctx.fillStyle = "#1c1430";
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulse = 1 + Math.sin(time * (6 + b.phase * 4)) * 0.12 + b.mouth * 0.2;
  blit(ctx, glowDot(`core:${heat}`, 44, heat, "#fff6d0"), 0, 0, 0, pulse, pulse);
  ctx.restore();
  ctx.save();
  ctx.translate(0, r * 0.12);
  parts.chick(ctx, 17, 1, Math.floor(time * 10) % 6, time % 3 < 0.1);
  ctx.restore();
  ellipse(ctx, 0, -r * 0.02, r * 0.5, r * 0.46);
  ctx.strokeStyle = "#c9d2e0";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -r * 0.02, r * 0.38, 3.6, 4.5);
  ctx.stroke();
}

function ironRooster(ctx, b, time) {
  const r = 70;
  const eye = b.phase >= 1 ? "#ff3b3b" : "#3fe7ff";
  for (let i = 0; i < 5; i += 1) {
    ctx.save();
    ctx.translate(0, -10);
    ctx.rotate(-1.1 + i * 0.55 + Math.sin(time * 2 + i) * 0.04);
    ctx.fillStyle = linear(ctx, 0, -r * 1.5, 0, 0, [[0, i % 2 ? "#2fa37c" : "#1f6b8a"], [1, "#2c3340"]]);
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(0, -r * 1.55);
    ctx.lineTo(9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 82, 24);
    ctx.fillStyle = linear(ctx, -20, 0, 20, 0, [[0, "#6b7689"], [0.5, "#dfe5ee"], [1, "#59647a"]]);
    ctx.fillRect(-18, -30, 36, 60);
    ctx.strokeStyle = "#1f2533";
    ctx.lineWidth = 3;
    ctx.strokeRect(-18, -30, 36, 60);
    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(-18, -8, 36, 6);
    ctx.globalCompositeOperation = "lighter";
    const jet = 18 + b.charge * 30 + Math.sin(time * 50 + side) * 5;
    ctx.fillStyle = linear(ctx, 0, 30, 0, 30 + jet, [[0, "rgba(160,230,255,0.95)"], [1, "rgba(60,120,255,0)"]]);
    ctx.beginPath();
    ctx.moveTo(-12, 30);
    ctx.quadraticCurveTo(0, 30 + jet * 2, 12, 30);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = "#4b5568";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 26, 66);
    ctx.lineTo(side * 34, 104 + Math.sin(time * 4 + side) * 3);
    ctx.stroke();
  }
  ellipse(ctx, 0, 10, r, r * 0.92);
  ctx.fillStyle = radial(ctx, 0, 10, r * 1.1, [[0, "#f3f6fa"], [0.55, "#9aa5b8"], [1, "#3c4558"]], -r * 0.3, -r * 0.2);
  ctx.fill();
  ctx.strokeStyle = "#1f2533";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "rgba(31,37,51,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, 10);
  ctx.lineTo(r * 0.7, 10);
  ctx.moveTo(0, -r * 0.5);
  ctx.lineTo(0, r * 0.8);
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  blit(ctx, glowDot("rcore", 30, "#ff5a3d"), 0, 26, 0, 1 + Math.sin(time * 8) * 0.15);
  ctx.restore();
  ctx.save();
  ctx.translate(0, -66);
  const hr = 34;
  ctx.fillStyle = "#e0262b";
  for (let i = 0; i < 5; i += 1) {
    const x = (i - 2) * 11;
    ctx.beginPath();
    ctx.moveTo(x - 7, -hr * 0.7);
    ctx.lineTo(x, -hr * (1.35 + (i % 2) * 0.25));
    ctx.lineTo(x + 7, -hr * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ellipse(ctx, 0, 0, hr, hr * 0.95);
  ctx.fillStyle = radial(ctx, 0, 0, hr * 1.1, [[0, "#ffffff"], [0.6, "#a7b1c2"], [1, "#465063"]], -10, -12);
  ctx.fill();
  ctx.strokeStyle = "#1f2533";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#141824";
  ctx.fillRect(-hr * 0.85, -hr * 0.42, hr * 1.7, hr * 0.42);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const side of [-1, 1]) blit(ctx, glowDot(`visor:${eye}`, 14, eye), side * hr * 0.38, -hr * 0.21, 0, 1.3, 0.7, 0.9);
  ctx.restore();
  ctx.fillStyle = "#f2b632";
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.lineTo(9, 2);
  ctx.lineTo(0, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e0262b";
  ctx.fillRect(-4, 18, 8, 10);
  ctx.restore();
}

function turret(ctx, part, player, time) {
  ctx.save();
  ctx.translate(part.x, part.y);
  if (!part.alive) {
    ellipse(ctx, 0, 0, part.r * 0.8, part.r * 0.6);
    ctx.fillStyle = "#2a2226";
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(Math.atan2(player.y - part.y, player.x - part.x) - Math.PI / 2);
  ctx.fillStyle = "#3c4558";
  ctx.fillRect(-6, 4, 12, part.r + 8);
  ellipse(ctx, 0, 0, part.r, part.r);
  ctx.fillStyle = radial(ctx, 0, 0, part.r, [[0, "#e9eef5"], [1, "#59647a"]], -6, -8);
  ctx.fill();
  ctx.strokeStyle = "#1f2533";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalCompositeOperation = "lighter";
  blit(ctx, glowDot("turret", 12, "#5dffb1"), 0, 0, 0, 1, 1, 0.6 + 0.4 * Math.sin(time * 9 + part.id));
  ctx.restore();
}

function carrier(ctx, b, time) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 80, -20);
    ctx.lineTo(side * 196, 0);
    ctx.lineTo(side * 196, 30);
    ctx.lineTo(side * 80, 46);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, -20, 0, 46, [[0, "#a3263a"], [1, "#5a1220"]]);
    ctx.fill();
    ctx.strokeStyle = "#2a0810";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#e9eef5";
    ctx.fillRect(side * 196 - (side > 0 ? 22 : 0), -6, 22, 42);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    blit(ctx, glowDot("cengine", 22, "#ff9a3d"), side * 185, 44, 0, 1, 1.4, 0.7 + 0.3 * Math.sin(time * 30 + side));
    blit(ctx, glowDot("navlight", 8, side > 0 ? "#5dff8a" : "#ff4a4a"), side * 196, 0, 0, 1, 1, Math.floor(time * 2) % 2 ? 1 : 0.2);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(-104, -36);
  ctx.lineTo(0, -112);
  ctx.lineTo(104, -36);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, -112, 0, -36, [[0, "#5b5f6e"], [1, "#2c2f3a"]]);
  ctx.fill();
  ctx.strokeStyle = "#16171d";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = linear(ctx, 0, -40, 0, 74, [[0, "#d23a4c"], [1, "#7a1424"]]);
  ctx.fillRect(-92, -40, 184, 114);
  ctx.strokeStyle = "#f6efe6";
  ctx.lineWidth = 6;
  ctx.strokeRect(-92, -40, 184, 114);
  ctx.beginPath();
  ctx.moveTo(-92, -40);
  ctx.lineTo(-40, 74);
  ctx.moveTo(-40, -40);
  ctx.lineTo(-92, 74);
  ctx.moveTo(92, -40);
  ctx.lineTo(40, 74);
  ctx.moveTo(40, -40);
  ctx.lineTo(92, 74);
  ctx.lineWidth = 4;
  ctx.stroke();
  const open = Math.min(1, b.mouth * 1.5);
  ctx.fillStyle = "#1a0d12";
  ctx.fillRect(-32, 8, 64, 64);
  if (open > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const side of [-1, 1]) blit(ctx, glowDot("hatcheye", 6, "#ffe066"), side * 12, 34, 0, 1, 1, open);
    ctx.restore();
  }
  ctx.fillStyle = linear(ctx, 0, 8, 0, 72, [[0, "#f6efe6"], [1, "#b9ab98"]]);
  ctx.fillRect(-32, 8 + open * 56, 64, 64 - open * 56);
  ellipse(ctx, 0, -70, 26, 22);
  ctx.fillStyle = "#16263a";
  ctx.fill();
  blit(ctx, creatureSprite("rooster", 1, Math.floor(time * 8) % 6, time % 3 < 0.1, 13), 0, -70);
  ellipse(ctx, 0, -70, 26, 22);
  ctx.strokeStyle = "#cfd8e6";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = rgba("#ffffff", 0.35);
  ellipse(ctx, -8, -78, 8, 5, -0.5);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  blit(ctx, glowDot("antenna", 10, "#ff4a4a"), 0, -120, 0, 1, 1, Math.floor(time * 3) % 2 ? 1 : 0.3);
  ctx.restore();
  ctx.strokeStyle = "#16171d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -112);
  ctx.lineTo(0, -122);
  ctx.stroke();
}

function barnOwl(ctx, b, time) {
  const r = 70;
  const flap = Math.sin(time * 3) * 0.35;
  parts.wing(ctx, r, -1, flap, "#6e5a86", "#2c2038", 1.05);
  parts.wing(ctx, r, 1, flap, "#6e5a86", "#2c2038", 1.05);
  parts.body(ctx, r, { body: "#3a3150", shade: "#1a1424" }, 1.05, 0.95);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.35, -r * 0.85);
    ctx.lineTo(side * r * 0.15, -r * 1.35);
    ctx.lineTo(side * r * 0.7, -r * 0.95);
    ctx.closePath();
    ctx.fillStyle = "#241c32";
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    ellipse(ctx, side * r * 0.32, -r * 0.18, r * 0.28, r * 0.32);
    ctx.fillStyle = "#f4e27a";
    ctx.fill();
    ellipse(ctx, side * r * 0.32, -r * 0.16, r * 0.12, r * 0.16);
    ctx.fillStyle = "#1a1208";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.02);
  ctx.lineTo(-r * 0.1, r * 0.16);
  ctx.lineTo(r * 0.1, r * 0.16);
  ctx.closePath();
  ctx.fillStyle = "#e0a04a";
  ctx.fill();
  if (b.mouth > 0.2) eyeGlow(ctx, r, "#ffe08a", 0.45);
  for (let i = 0; i < 4; i += 1) {
    const a = time * 1.4 + (i / 4) * TAU;
    ellipse(ctx, Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.45 + r * 0.35, 7, 7);
    ctx.fillStyle = "#2a3140";
    ctx.fill();
    ctx.fillStyle = "#ff5a3d";
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.45 + r * 0.28, 2, 0, TAU);
    ctx.fill();
  }
}

function plume(ctx, b, time) {
  const r = 68;
  ctx.save();
  ctx.rotate(Math.sin(time * 1.6) * 0.08);
  for (let i = 0; i < 7; i += 1) {
    const a = -0.9 + (i / 6) * 1.8;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.35, -r * 1.3, 0, -r * 2.15);
    ctx.quadraticCurveTo(-r * 0.35, -r * 1.3, 0, -r * 0.2);
    ctx.fillStyle = i % 2 ? "#fff1c8" : "#ffb15a";
    ctx.fill();
    ctx.strokeStyle = "#7a3410";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  parts.wing(ctx, r, -1, Math.sin(time * 4) * 0.4, "#ffd7a8", "#c47a3a", 1.1);
  parts.wing(ctx, r, 1, Math.sin(time * 4) * 0.4, "#ffd7a8", "#c47a3a", 1.1);
  parts.body(ctx, r, { body: "#f3e2cc", shade: "#c49a6a" });
  parts.eyes(ctx, r, time % 3.4 < 0.1, { angry: b.phase >= 1, size: 0.18 });
  parts.beak(ctx, r, b.mouth > 0.3);
  parts.plume(ctx, r, b.phase >= 2 ? "#ff4a3a" : "#2f8f78");
}

function cycloneBoss(ctx, b, time) {
  const r = 78;
  ctx.save();
  ctx.rotate(b.spin + time * 1.6);
  eggPath(ctx, r);
  ctx.fillStyle = radial(ctx, 0, 0, r, [[0, "#fff6c8"], [0.55, "#ffc21a"], [1, "#e06a00"]], -r * 0.3, -r * 0.4);
  ctx.fill();
  ctx.strokeStyle = "#a34d00";
  ctx.lineWidth = 4;
  ctx.stroke();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU;
    ellipse(ctx, Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, 10, 8);
    ctx.fillStyle = i % 2 ? "#fff1a8" : "#ff8a1a";
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  blit(ctx, glowDot("cyclone", 40, "#ffd24a"), 0, 0, 0, 1.4, 1.4, 0.45 + 0.2 * Math.sin(time * 8));
  ctx.restore();
}

function king(ctx, b, time) {
  const r = 80;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, r * 0.15);
  ctx.quadraticCurveTo(-r * 1.35, r * 1.1, 0, r * 1.35);
  ctx.quadraticCurveTo(r * 1.35, r * 1.1, r * 0.9, r * 0.15);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 0, 0, r * 1.3, [[0, "#8a1d3a"], [1, "#3c0c1c"]]);
  ctx.fill();
  ctx.strokeStyle = "#ffd24a";
  ctx.lineWidth = 4;
  ctx.stroke();
  parts.wing(ctx, r, -1, Math.sin(time * 2.5) * 0.3, "#fff6e4", "#e0b56a", 1.05);
  parts.wing(ctx, r, 1, Math.sin(time * 2.5) * 0.3, "#fff6e4", "#e0b56a", 1.05);
  parts.body(ctx, r, { body: "#fff8ee", shade: "#e2c49a" });
  ctx.save();
  ctx.translate(0, -r * 0.15);
  ctx.scale(1.45, 1.45);
  parts.crown(ctx, r * 0.7);
  ctx.restore();
  parts.eyes(ctx, r, time % 4 < 0.1, { angry: b.phase >= 1, size: 0.2 });
  parts.beak(ctx, r, b.mouth > 0.3);
  if (b.phase >= 1) eyeGlow(ctx, r, "#ffd24a", 0.4 + 0.3 * Math.sin(time * 10));
}

function matron(ctx, b, time) {
  const r = 78;
  parts.wing(ctx, r, -1, Math.sin(time * 3) * 0.4, "#3a2458", "#140818", 1.15);
  parts.wing(ctx, r, 1, Math.sin(time * 3) * 0.4, "#3a2458", "#140818", 1.15);
  parts.body(ctx, r, { body: "#1a1028", shade: "#07040f" }, 1.05, 1);
  ctx.save();
  ctx.translate(0, -r * 0.2);
  ctx.scale(1.2, 1.2);
  parts.crown(ctx, r * 0.55);
  ctx.restore();
  parts.eyes(ctx, r, time % 5 < 0.08, { angry: true, size: 0.24 });
  parts.beak(ctx, r, b.mouth > 0.2);
  eyeGlow(ctx, r, "#b388ff", 0.55 + 0.3 * Math.sin(time * 8));
}

function eternity(ctx, b, time) {
  const r = 88;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  blit(ctx, glowDot("eternal", 70, "#fff1a8"), 0, 0, 0, 1.6, 1.6, 0.35 + 0.15 * Math.sin(time * 6));
  ctx.restore();
  parts.wing(ctx, r, -1, Math.sin(time * 2) * 0.25, "#fff6d0", "#e0b44a", 1.2);
  parts.wing(ctx, r, 1, Math.sin(time * 2) * 0.25, "#fff6d0", "#e0b44a", 1.2);
  parts.body(ctx, r, { body: "#fffaf0", shade: "#f0d48a" }, 1.08, 1.02);
  ctx.save();
  ctx.translate(0, -r * 0.22);
  ctx.scale(1.7, 1.7);
  parts.crown(ctx, r * 0.5);
  ctx.restore();
  parts.eyes(ctx, r, false, { angry: b.phase >= 1, size: 0.22 });
  parts.beak(ctx, r, true);
  eyeGlow(ctx, r, "#ff4a4a", 0.7);
}

const PAINT = {
  grandhen: grandHen,
  reactor,
  ironrooster: ironRooster,
  carrier,
  barnowl: barnOwl,
  plume,
  cyclone: cycloneBoss,
  king,
  matron,
  eternity,
};
const SIZE = {
  grandhen: 110,
  reactor: 120,
  ironrooster: 120,
  carrier: 190,
  barnowl: 130,
  plume: 150,
  cyclone: 120,
  king: 150,
  matron: 140,
  eternity: 170,
};

export function drawBoss(ctx, b, time, player) {
  let x = b.x;
  let y = b.y;
  if (b.charge > 0) x += Math.sin(time * 70) * 3 * b.charge;
  if (b.dying > 0) {
    x += Math.sin(time * 90) * 4;
    y += Math.cos(time * 77) * 4;
  }
  const mark = b.mark || (b.aim != null ? { x: b.aim, y: 600 } : null);
  if (mark) {
    ctx.save();
    const pulse = 0.55 + 0.45 * Math.sin(time * 18);
    ctx.strokeStyle = `rgba(255, 70, 70, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, 28 + pulse * 18, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, 6, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  if (b.dying > 0) ctx.globalAlpha = Math.max(0.3, b.dying / 2.4);
  PAINT[b.kind](ctx, b, time);
  ctx.restore();
  for (const part of b.parts) turret(ctx, part, player, time);
  if (b.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    blit(ctx, glowDot("bossflash", 64, "#ffffff"), x, y, 0, SIZE[b.kind] / 50, SIZE[b.kind] / 60, (b.flash / 0.06) * 0.45);
    ctx.restore();
  }
  if (b.shield > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const k = b.shield / b.maxShield;
    const active = b.shieldActive > 0;
    const ripple = (b.shieldRipple || 0) / 0.35;
    const swell = active ? 1.06 + 0.04 * Math.sin(time * 22) : 1;
    ctx.strokeStyle = rgba(active ? "#d8fbff" : "#9ff0ff", (active ? 0.55 : 0.35) + 0.4 * k);
    ctx.lineWidth = active ? 5 : 4;
    ctx.beginPath();
    ctx.ellipse(x, y, (130 + ripple * 18) * swell, (100 + ripple * 14) * swell, time * 0.8, 0, TAU);
    ctx.stroke();
    if (ripple > 0) {
      ctx.strokeStyle = rgba("#ffffff", 0.35 * ripple);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 130 + ripple * 38, 100 + ripple * 30, time * 0.8, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (b.armored) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba("#7fd8ff", 0.25 + 0.15 * Math.sin(time * 6));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 120, 110, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawBeams(ctx, beams, time) {
  for (const beam of beams) {
    const top = beam.top;
    if (beam.t < beam.warn) {
      const k = beam.t / beam.warn;
      ctx.save();
      ctx.strokeStyle = rgba("#ff3b3b", 0.35 + 0.45 * Math.abs(Math.sin(time * 18)));
      ctx.lineWidth = 2 + k * 3;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -time * 120;
      ctx.beginPath();
      ctx.moveTo(beam.x, top);
      ctx.lineTo(beam.x, H);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    const life = beam.t - beam.warn;
    const fade = life > beam.life ? 1 - (life - beam.life) / 0.3 : Math.min(1, life / 0.08);
    const w = beam.w * (0.8 + 0.2 * Math.sin(time * 50)) * fade;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = linear(ctx, beam.x - w, 0, beam.x + w, 0, [[0, "rgba(255,60,120,0)"], [0.3, "rgba(255,80,140,0.6)"], [0.5, "rgba(255,240,250,1)"], [0.7, "rgba(255,80,140,0.6)"], [1, "rgba(255,60,120,0)"]]);
    ctx.fillRect(beam.x - w, top, w * 2, H - top);
    blit(ctx, glowDot("beamroot", 40, "#ff5aa0"), beam.x, top, 0, 1, 1, fade);
    ctx.restore();
  }
}
