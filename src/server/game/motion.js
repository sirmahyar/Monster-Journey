import { FIELD_HEIGHT, PLAYER_RADIUS, PLAYER_X } from "./balance.js";

const SIN = Object.freeze([
  0, 383, 707, 924, 1000, 924, 707, 383,
  0, -383, -707, -924, -1000, -924, -707, -383,
]);

/** Integer sine over a 16-step cycle. The result is in -1000..1000. */
export function isin(step) {
  const index = ((step % 16) + 16) % 16;
  return SIN[index];
}

/**
 * Screen position of one actor on one tick. The world scrolls left by `speed`.
 * @param {{ x: number, y: number, vx: number, vy: number, amp: number, freq: number, phase: number, radius: number }} actor
 * @param {number} tick
 * @param {number} speed
 */
export function screenPosition(actor, tick, speed) {
  const bob = Math.trunc((actor.amp * isin(actor.phase + actor.freq * tick)) / 1000);
  const x = actor.x + actor.vx * tick - speed * tick;
  let y = actor.y + actor.vy * tick + bob;
  const low = actor.radius;
  const high = FIELD_HEIGHT - actor.radius;
  if (y < low) y = low;
  if (y > high) y = high;
  return { x, y };
}

/**
 * @param {number} playerY
 * @param {{ x: number, y: number }} point
 * @param {number} actorRadius
 */
export function overlaps(playerY, point, actorRadius) {
  const dx = PLAYER_X - point.x;
  const dy = playerY - point.y;
  const reach = PLAYER_RADIUS + actorRadius;
  return dx * dx + dy * dy <= reach * reach;
}

/**
 * @param {{ speed: number, tickCount: number, actors: object[] }} leg
 */
export function tracksFor(leg) {
  return leg.actors.map((actor) => ({
    id: actor.id,
    kind: actor.kind,
    role: actor.role,
    radius: actor.radius,
    power: actor.power,
    points: Array.from({ length: leg.tickCount }, (_, tick) => {
      const point = screenPosition(actor, tick, leg.speed);
      return [point.x, point.y];
    }),
  }));
}
