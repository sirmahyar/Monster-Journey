import { describe, expect, it } from "vitest";
import { LIMITS } from "../src/server/game/balance.js";
import { scaleEnemy } from "../src/server/game/enemies.js";
import { effectsFor } from "../src/server/game/upgrades.js";
import { cloneState, transition } from "../src/server/game/engine.js";
import { combatState, freezeState, routeState, scriptedRng } from "./helpers.js";

async function play(state, action, rolls = []) {
  const before = structuredClone(state);
  freezeState(state);
  const rng = scriptedRng(rolls);
  const result = await transition(state, action, rng);
  expect(state).toEqual(before);
  return result;
}

async function expectReject(state, action, code = "INVALID_ACTION") {
  const before = structuredClone(state);
  freezeState(state);
  await expect(transition(state, action, scriptedRng([]))).rejects.toMatchObject({ code });
  expect(state).toEqual(before);
}

describe("phase transitions", () => {
  it("starts on the route and enters combat from the forest", async () => {
    const result = await play(routeState(), { type: "choose_route", route: "forest" }, [0, 0]);
    expect(result.state.phase).toBe("combat");
    expect(result.state.revision).toBe(1);
    expect(result.state.encounter).toMatchObject({
      archetype: "forest_slime",
      route: "forest",
      maxHp: 45,
      hp: 45,
      attack: 9,
      defense: 2,
      intention: "attack",
    });
    expect(result.events[0].type).toBe("encounter_started");
  });

  it("enters combat from the cave with the health bonus", async () => {
    const result = await play(routeState(), { type: "choose_route", route: "cave" }, [0, 0]);
    expect(result.state.encounter).toMatchObject({
      archetype: "cave_bat",
      route: "cave",
      maxHp: 41,
      hp: 41,
      attack: 13,
      defense: 1,
    });
  });

  it("selects the second enemy in each pool", async () => {
    const forest = await play(routeState(), { type: "choose_route", route: "forest" }, [1, 0]);
    const cave = await play(routeState(), { type: "choose_route", route: "cave" }, [1, 0]);
    expect(forest.state.encounter.archetype).toBe("cave_bat");
    expect(cave.state.encounter.archetype).toBe("stone_golem");
    expect(cave.state.encounter.maxHp).toBe(66);
  });

  it("wins a battle, offers three rewards, then returns to the route", async () => {
    const state = combatState({ encounter: { hp: 12 } });
    const fought = await play(state, { type: "combat_move", move: "attack" }, [0, 0, 0, 0]);
    expect(fought.state.phase).toBe("reward");
    expect(fought.state.encounter.hp).toBe(0);
    expect(fought.state.completedStages).toBe(0);
    expect(fought.events.map((event) => event.type)).toEqual([
      "player_attacked",
      "enemy_defeated",
      "rewards_ready",
    ]);
    expect(fought.state.rewardOffers.map((offer) => offer.category)).toEqual(["vitality", "power", "armor"]);
    for (const offer of fought.state.rewardOffers) {
      expect(offer.effects).toEqual(effectsFor(offer.category, false));
    }

    const rewarded = await play(fought.state, { type: "choose_reward", offerId: "vitality" });
    expect(rewarded.state.phase).toBe("route");
    expect(rewarded.state.completedStages).toBe(1);
    expect(rewarded.state.encounter).toBeNull();
    expect(rewarded.state.rewardOffers).toEqual([]);
    expect(rewarded.state.player.maxHp).toBe(115);
    expect(rewarded.state.player.hp).toBe(115);
    expect(rewarded.events.at(-1)).toMatchObject({ type: "stage_completed", completedStages: 1, source: "reward" });
  });

  it("applies cave reward bonuses from the stored offer", async () => {
    const state = combatState({
      encounter: { route: "cave", archetype: "cave_bat", maxHp: 41, hp: 1, attack: 13, defense: 1 },
    });
    const fought = await play(state, { type: "combat_move", move: "attack" }, [0, 0, 0, 0]);
    expect(fought.state.rewardOffers.map((offer) => offer.effects)).toEqual([
      effectsFor("vitality", true),
      effectsFor("power", true),
      effectsFor("armor", true),
    ]);
    expect(effectsFor("vitality", true)).toEqual({ maxHp: 23, hp: 23 });
    expect(effectsFor("power", true)).toEqual({ attack: 5 });
    expect(effectsFor("armor", true)).toEqual({ defense: 3 });
    expect(effectsFor("energy", true)).toEqual({ maxEnergy: 2, energy: 2 });
    expect(effectsFor("supplies", true)).toEqual({ potions: 2, hp: 15 });
  });

  it("rejects reward ids that were not offered", async () => {
    const state = combatState({ encounter: { hp: 1 } });
    const fought = await play(state, { type: "combat_move", move: "attack" }, [0, 0, 0, 0]);
    await expectReject(fought.state, { type: "choose_reward", offerId: "supplies" });
  });

  it("opens the spring only on every third stage and completes that stage", async () => {
    await expectReject(routeState(), { type: "choose_route", route: "spring" });
    const ready = routeState();
    ready.completedStages = 2;
    ready.player.hp = 50;
    ready.player.energy = 3;
    const result = await play(ready, { type: "choose_route", route: "spring" });
    expect(result.state.phase).toBe("route");
    expect(result.state.completedStages).toBe(3);
    expect(result.state.player.hp).toBe(80);
    expect(result.state.player.energy).toBe(5);
    expect(result.state.encounter).toBeNull();
    expect(result.events.map((event) => event.type)).toEqual([
      "health_restored",
      "energy_changed",
      "stage_completed",
    ]);
  });

  it("rejects actions that do not belong to the current phase", async () => {
    const route = routeState();
    const combat = combatState();
    const reward = combatState({ encounter: { hp: 0 } });
    reward.phase = "reward";
    reward.rewardOffers = [
      { id: "power", category: "power", effects: { attack: 3 } },
      { id: "armor", category: "armor", effects: { defense: 2 } },
      { id: "energy", category: "energy", effects: { maxEnergy: 1, energy: 1 } },
    ];
    const over = combatState({ player: { hp: 0 } });
    over.phase = "game_over";

    await expectReject(route, { type: "combat_move", move: "attack" });
    await expectReject(route, { type: "choose_reward", offerId: "power" });
    await expectReject(combat, { type: "choose_route", route: "forest" });
    await expectReject(combat, { type: "choose_reward", offerId: "power" });
    await expectReject(reward, { type: "choose_route", route: "forest" });
    await expectReject(reward, { type: "combat_move", move: "attack" });
    await expectReject(over, { type: "choose_route", route: "forest" });
    await expectReject(over, { type: "combat_move", move: "attack" });
    await expectReject(over, { type: "choose_reward", offerId: "power" });
  });
});

describe("combat math", () => {
  it("applies attack damage, energy gain, and the stored enemy intention", async () => {
    const result = await play(combatState(), { type: "combat_move", move: "attack" }, [0, 0, 70]);
    expect(result.events[0]).toMatchObject({
      type: "player_attacked",
      damage: 12,
      enemyHpBefore: 45,
      enemyHpAfter: 33,
      energyBefore: 3,
      energyAfter: 4,
    });
    expect(result.events[1]).toMatchObject({
      type: "enemy_attacked",
      intention: "attack",
      rawDamage: 5,
      damage: 5,
      defended: false,
      hpBefore: 100,
      hpAfter: 95,
    });
    expect(result.state.encounter.intention).toBe("heavy_attack");
    expect(result.state.phase).toBe("combat");
  });

  it("halves incoming damage upward while defending, then expires", async () => {
    const defended = await play(
      combatState({ encounter: { intention: "recover", hp: 40 } }),
      { type: "combat_move", move: "defend" },
      [0],
    );
    expect(defended.events.map((event) => event.type)).toEqual([
      "energy_changed",
      "health_restored",
      "enemy_intention",
    ]);
    expect(defended.state.player.energy).toBe(5);
    expect(defended.state.encounter.hp).toBe(45);
    expect(defended.state.encounter.intention).toBe("attack");

    const followed = await play(defended.state, { type: "combat_move", move: "attack" }, [0, 0, 0]);
    expect(followed.events.find((event) => event.type === "enemy_attacked")).toMatchObject({
      damage: 5,
      defended: false,
    });
  });

  it("uses the heavy intention that was already shown", async () => {
    const state = combatState({ encounter: { intention: "heavy_attack" } });
    const result = await play(state, { type: "combat_move", move: "defend" }, [0, 0]);
    expect(result.events[1]).toMatchObject({
      type: "enemy_attacked",
      intention: "heavy_attack",
      rawDamage: 10,
      damage: 5,
      defended: true,
    });
  });

  it("spends three energy for a special and rejects a shortfall without changing state", async () => {
    const broke = combatState({ player: { energy: 2 } });
    await expectReject(broke, { type: "combat_move", move: "special" });

    const result = await play(combatState(), { type: "combat_move", move: "special" }, [0, 0, 0]);
    expect(result.events[0]).toMatchObject({
      type: "player_attacked",
      move: "special",
      damage: 26,
      energyBefore: 3,
      energyAfter: 0,
    });
  });

  it("clamps energy gains and attack energy at the maximum", async () => {
    const result = await play(combatState({ player: { energy: 5 } }), { type: "combat_move", move: "attack" }, [0, 0, 0]);
    expect(result.state.player.energy).toBe(5);
    const defended = await play(combatState({ player: { energy: 4 } }), { type: "combat_move", move: "defend" }, [0, 0]);
    expect(defended.state.player.energy).toBe(5);
  });

  it("heals with a potion, then lets the enemy act, and rejects empty or full uses", async () => {
    await expectReject(combatState({ player: { potions: 0, hp: 40 } }), { type: "combat_move", move: "potion" });
    await expectReject(combatState(), { type: "combat_move", move: "potion" });

    const result = await play(
      combatState({ player: { hp: 90 }, encounter: { intention: "attack" } }),
      { type: "combat_move", move: "potion" },
      [0, 0],
    );
    expect(result.events[0]).toMatchObject({
      type: "health_restored",
      source: "potion",
      attempted: 35,
      amount: 10,
      hpBefore: 90,
      hpAfter: 100,
      potionsBefore: 2,
      potionsAfter: 1,
    });
    expect(result.events[1].type).toBe("enemy_attacked");
    expect(result.state.player.hp).toBeLessThanOrEqual(100);
  });

  it("does not let a killed enemy retaliate", async () => {
    const result = await play(combatState({ encounter: { hp: 12 } }), { type: "combat_move", move: "attack" }, [0, 0, 0, 0]);
    expect(result.events.some((event) => event.type === "enemy_attacked")).toBe(false);
    expect(result.state.phase).toBe("reward");
  });

  it("ends the run when health reaches zero", async () => {
    const state = combatState({
      player: { hp: 1 },
      encounter: { intention: "attack", attack: 30, hp: 40 },
    });
    const result = await play(state, { type: "combat_move", move: "defend" }, [0]);
    expect(result.state.phase).toBe("game_over");
    expect(result.state.player.hp).toBe(0);
    expect(result.events.at(-1).type).toBe("player_defeated");
    expect(result.events.some((event) => event.type === "enemy_intention")).toBe(false);
    await expectReject(result.state, { type: "combat_move", move: "attack" });
  });

  it("caps enemy recovery at maximum health", async () => {
    const result = await play(
      combatState({ encounter: { intention: "recover", hp: 44 } }),
      { type: "combat_move", move: "defend" },
      [0],
    );
    const heal = result.events.find((event) => event.source === "enemy_recover");
    expect(heal).toMatchObject({ attempted: 5, amount: 1, hpAfter: 45 });
  });

  it("caps spring healing at maximum health", async () => {
    const state = routeState();
    state.completedStages = 2;
    const result = await play(state, { type: "choose_route", route: "spring" });
    expect(result.state.player.hp).toBe(100);
    expect(result.events[0]).toMatchObject({ source: "spring", attempted: 30, amount: 0, hpAfter: 100 });
  });

  it("scales later stages upward and keeps the same input reusable", async () => {
    expect(scaleEnemy("forest_slime", 5, "forest")).toEqual({ maxHp: 67, hp: 67, attack: 12, defense: 3 });
    expect(scaleEnemy("forest_slime", 5, "cave").maxHp).toBe(81);
    const state = routeState();
    state.completedStages = 4;
    const first = await play(cloneState(state), { type: "choose_route", route: "forest" }, [0, 0]);
    const second = await play(cloneState(state), { type: "choose_route", route: "forest" }, [0, 0]);
    expect(first.state.encounter).toEqual(second.state.encounter);
    expect(first.events).toEqual(second.events);
    expect(first.state.encounter.maxHp).toBe(67);
  });

  it("rejects a reward that would pass the supported numeric range", async () => {
    const state = combatState({ encounter: { hp: 0 }, player: { maxHp: LIMITS.maxHp, hp: LIMITS.maxHp } });
    state.phase = "reward";
    state.rewardOffers = [
      { id: "vitality", category: "vitality", effects: { maxHp: 15, hp: 15 } },
      { id: "power", category: "power", effects: { attack: 3 } },
      { id: "armor", category: "armor", effects: { defense: 2 } },
    ];
    await expectReject(state, { type: "choose_reward", offerId: "vitality" }, "NUMERIC_LIMIT");
  });
});
