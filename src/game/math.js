export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** @param {() => number} rng */
export function rand(rng, min, max) {
  return min + (max - min) * rng();
}

/** @param {() => number} rng */
export function randInt(rng, min, max) {
  return Math.min(max, Math.floor(min + (max - min + 1) * rng()));
}

/** @param {() => number} rng @param {any[]} list */
export function pick(rng, list) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/**
 * @param {() => number} rng
 * @param {[any, number][]} entries
 */
export function weighted(rng, entries) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

export function overlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy <= reach * reach;
}

/** Cubic bezier over [x0, y0, x1, y1, x2, y2, x3, y3]. */
export function bezier(pts, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * pts[0] + b * pts[2] + c * pts[4] + d * pts[6],
    y: a * pts[1] + b * pts[3] + c * pts[5] + d * pts[7],
  };
}

export function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeInCubic(t) {
  return t * t * t;
}

export function easeInOutSine(t) {
  return 0.5 - Math.cos(Math.PI * t) / 2;
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** Turns a moving object toward a point without changing its speed. */
export function steer(obj, targetX, targetY, turnRate, dt) {
  const speed = Math.hypot(obj.vx, obj.vy);
  if (speed === 0) return;
  const current = Math.atan2(obj.vy, obj.vx);
  const desired = Math.atan2(targetY - obj.y, targetX - obj.x);
  const turn = clamp(wrapAngle(desired - current), -turnRate * dt, turnRate * dt);
  obj.vx = Math.cos(current + turn) * speed;
  obj.vy = Math.sin(current + turn) * speed;
}
