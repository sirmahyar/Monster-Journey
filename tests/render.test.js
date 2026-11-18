import { describe, expect, it } from "vitest";
import { ENEMY_TYPES } from "../src/game/enemies.js";
import { CHAPTERS } from "../src/game/waves.js";
import { CREATURE_PAINTER_KINDS } from "../src/client/render/creatures.js";
import { PICKUP_COLOR } from "../src/client/render/items.js";
import { PICKUPS } from "../src/game/loot.js";

const SKETCH_HAZARDS = new Set(["rock", "poop", "net"]);

describe("creature art", () => {
  it("covers every drawable enemy kind", () => {
    const kinds = Object.keys(ENEMY_TYPES).filter((kind) => !SKETCH_HAZARDS.has(kind));
    for (const kind of kinds) {
      expect(CREATURE_PAINTER_KINDS.includes(kind), `missing painter: ${kind}`).toBe(true);
    }
  });
});

describe("pickup art", () => {
  it("defines tint for every pickup kind", () => {
    for (const kind of Object.keys(PICKUPS)) {
      if (kind === "crate") continue;
      expect(PICKUP_COLOR[kind], `missing tint: ${kind}`).toBeTruthy();
    }
  });
});

describe("content", () => {
  it("names every chapter", () => {
    expect(CHAPTERS.length).toBeGreaterThan(0);
    for (const chapter of CHAPTERS) expect(chapter.name).toBeTruthy();
  });
});