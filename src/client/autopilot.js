import { H, PLAYER, W } from "../game/config.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function threat(state) {
  const p = state.player;
  let push = 0;
  for (const g of state.eggs) {
    const dy = p.y - g.y;
    if (dy < -24 || dy > 300) continue;
    const t = dy / Math.max(80, g.vy);
    const dx = p.x - (g.x + g.vx * Math.max(0, t));
    const reach = 40 + g.r;
    if (Math.abs(dx) < reach) push += (dx >= 0 ? 1 : -1) * (1 - Math.abs(dx) / reach) * (1 - Math.max(0, dy) / 300);
  }
  for (const e of state.enemies) {
    if (e.mode !== "dive" || e.hidden) continue;
    const dx = p.x - e.x;
    if (Math.abs(dx) < 90 && e.y > p.y - 320 && e.y < p.y + 20) push += (dx >= 0 ? 1 : -1) * 0.8;
  }
  return push;
}

function pickTarget(state, p) {
  if (state.boss && state.boss.dying <= 0 && !state.boss.intro) return state.boss;
  let best = null;
  let score = Infinity;
  for (const e of state.enemies) {
    if (e.hidden || e.y < 10 || e.y > p.y - 40) continue;
    const s = Math.abs(e.x - p.x) - e.y * 0.4 + (e.kind === "golden" ? -400 : 0);
    if (s < score) {
      score = s;
      best = e;
    }
  }
  return best;
}

/**
 * Input for the menu's attract mode: hunts, collects drops, and sidesteps eggs.
 * @param {any} state
 * @param {{ x: number, y: number }} memory smoothed aim that persists between frames
 */
export function autopilot(state, memory) {
  const p = state.player;
  const t = state.time;
  const target = pickTarget(state, p);
  const drop = state.pickups.find((k) => k.kind !== "kernel" && k.y > p.y - 260 && Math.abs(k.x - p.x) < 220);
  let tx = drop ? drop.x : target ? target.x + Math.sin(t * 1.9) * 26 : W / 2 + Math.sin(t * 0.55) * 220;
  let ty = drop ? clamp(drop.y + 30, H - 330, PLAYER.maxY) : H - 150 + Math.sin(t * 0.8) * 50;
  tx += threat(state) * 150;
  memory.x += (clamp(tx, 30, W - 30) - memory.x) * 0.12;
  memory.y += (ty - memory.y) * 0.08;
  return {
    targetX: memory.x,
    targetY: memory.y,
    fire: !p.overheated && p.heat < 88 && state.stage !== "clear",
    bomb: state.eggs.length > 34 && p.bombs > 0,
  };
}
