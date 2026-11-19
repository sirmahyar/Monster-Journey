import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_COUNT } from "../src/game/config.js";
import { createGame, exportRunSave } from "../src/game/sim.js";
import {
  clearRunSave,
  parseRunSave,
  readRunSave,
  verifyRunSaveToken,
  writeRunSave,
} from "../src/client/save-run.js";

const sample = {
  chapter: 3,
  wave: 5,
  score: 12000,
  lives: 3,
  bombs: 2,
  food: 40,
  level: 4,
  weapon: "pulse",
  weapons: ["pulse", "laser"],
  rockets: true,
  stats: { kills: 10, fired: 50, hits: 40, bestCombo: 4, food: 2, bosses: 1, deaths: 0, time: 99 },
};

describe("run save", () => {
  const bag = new Map();

  beforeEach(() => {
    bag.clear();
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("localStorage", {
      getItem: (key) => bag.get(key) ?? null,
      setItem: (key, value) => {
        bag.set(key, value);
      },
      removeItem: (key) => {
        bag.delete(key);
      },
    });
  });

  afterEach(() => {
    clearRunSave();
    vi.unstubAllGlobals();
  });

  it("round-trips a signed token through localStorage", async () => {
    await writeRunSave(sample);
    const stored = bag.get("cluck-raid-run");
    expect(typeof stored).toBe("string");
    expect(stored.startsWith("cr2.")).toBe(true);
    expect(stored.includes(".")).toBe(true);
    const row = await readRunSave();
    expect(row?.chapter).toBe(3);
    expect(row?.wave).toBe(5);
    expect(row?.score).toBe(12000);
  });

  it("rejects tampered tokens", async () => {
    await writeRunSave(sample);
    const stored = bag.get("cluck-raid-run");
    const tampered = `${stored.slice(0, -4)}AAAA`;
    bag.set("cluck-raid-run", tampered);
    expect(await readRunSave()).toBeNull();
    expect(await verifyRunSaveToken(tampered)).toBeNull();
  });

  it("rejects invalid saves", () => {
    expect(parseRunSave({ v: 2, chapter: 0, wave: 1, score: 1, lives: 1, bombs: 1, level: 1, weapon: "pulse", weapons: ["pulse"], stats: {} })).toBeNull();
    expect(parseRunSave({ v: 2, chapter: CHAPTER_COUNT + 1, wave: 1, score: 1, lives: 1, bombs: 1, level: 1, weapon: "pulse", weapons: ["pulse"], stats: {} })).toBeNull();
  });

  it("exports live game progress", () => {
    const state = createGame({ chapter: 2, wave: 3 });
    state.stage = "active";
    state.player.lives = 4;
    state.score = 5000;
    const save = exportRunSave(state);
    expect(save?.chapter).toBe(2);
    expect(save?.wave).toBe(3);
    expect(save?.score).toBe(5000);
  });

  it("resumes at the saved chapter and wave", () => {
    const resume = {
      chapter: 4,
      wave: 6,
      score: 8000,
      lives: 2,
      bombs: 1,
      food: 20,
      level: 3,
      weapon: "laser",
      weapons: ["pulse", "laser", "ion"],
      rockets: true,
      stats: { kills: 1, fired: 1, hits: 1, bestCombo: 1, food: 1, bosses: 0, deaths: 0, time: 1 },
    };
    const state = createGame({ chapter: resume.chapter, wave: resume.wave, resume });
    expect(state.chapter).toBe(4);
    expect(state.wave).toBe(6);
    expect(state.score).toBe(8000);
    expect(state.player.weapon).toBe("laser");
  });
});