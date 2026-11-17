import { describe, expect, it } from "vitest";
import { CHAPTERS, MAX_WEAPON, circlesOverlap, createRun, shotPattern, step } from "../src/game/sim.js";

describe("Cluck Raid rules", () => {
  it("widens the shot pattern as the weapon level rises", () => {
    expect(shotPattern(1, 0, 0)).toHaveLength(1);
    expect(shotPattern(2, 0, 0)).toHaveLength(2);
    expect(shotPattern(3, 0, 0)).toHaveLength(3);
    expect(shotPattern(4, 0, 0)).toHaveLength(4);
    expect(shotPattern(5, 0, 0)).toHaveLength(5);
    expect(shotPattern(6, 0, 0).some((shot) => shot.missile)).toBe(true);
    expect(shotPattern(99, 0, 0)).toHaveLength(shotPattern(MAX_WEAPON, 0, 0).length);
  });

  it("detects overlapping circles and ignores a miss", () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 10 }, { x: 12, y: 0, r: 4 })).toBe(true);
    expect(circlesOverlap({ x: 0, y: 0, r: 10 }, { x: 40, y: 0, r: 4 })).toBe(false);
  });

  it("scores a hen that is hit and can raise the weapon from a gift", () => {
    const rolls = [0, 0];
    const run = createRun(() => rolls.shift() ?? 0.99);
    run.spawns = [];
    run.enemies = [{
      id: 9,
      kind: "hen",
      x: run.x + 40,
      y: run.y,
      vx: 0,
      hp: 1,
      maxHp: 1,
      r: 18,
      score: 100,
      age: 0,
      eggCd: 99,
      dived: false,
    }];
    step(run, { fire: true }, 0.2);
    for (let frame = 0; frame < 8 && run.enemies.length > 0; frame += 1) step(run, { fire: false }, 0.05);
    expect(run.score).toBeGreaterThanOrEqual(100);
    expect(run.gifts[0]?.gift).toBe("weapon");
    run.gifts[0].x = run.x;
    run.gifts[0].y = run.y;
    step(run, {}, 0.016);
    expect(run.weapon).toBe(2);
  });

  it("spends a bomb to clear eggs", () => {
    const run = createRun(() => 0.99);
    run.eggs = [{ id: 1, x: 10, y: 10, vx: 0, vy: 0, r: 8 }];
    step(run, { bomb: true }, 0.016);
    expect(run.eggs).toHaveLength(0);
    expect(run.bombs).toBe(1);
  });

  it("ends the run when the last life is lost", () => {
    const run = createRun(() => 0.99);
    run.lives = 1;
    run.shield = 0;
    run.invuln = 0;
    run.eggs = [{ id: 3, x: run.x, y: run.y, vx: 0, vy: 0, r: 8 }];
    step(run, {}, 0.016);
    expect(run.phase).toBe("game_over");
    expect(run.lives).toBe(0);
  });

  it("names four chapters", () => {
    expect(CHAPTERS).toHaveLength(4);
    expect(CHAPTERS[3].name).toBe("The Henship");
  });
});
