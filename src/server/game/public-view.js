import {
  POTION_HEAL_PERCENT,
  SPECIAL_ENERGY_COST,
  SPRING_EVERY_N_STAGES,
} from "./balance.js";

/**
 * Authoritative display state. Omits the RNG counter, game id, and signing material.
 * @param {object} state
 */
export function toPublicView(state) {
  const stage = state.completedStages + 1;
  return {
    phase: state.phase,
    revision: state.revision,
    stage,
    completedStages: state.completedStages,
    player: { ...state.player },
    enemy: state.encounter
      ? {
          archetype: state.encounter.archetype,
          route: state.encounter.route,
          hp: state.encounter.hp,
          maxHp: state.encounter.maxHp,
          attack: state.encounter.attack,
          defense: state.encounter.defense,
          intention: state.encounter.intention,
        }
      : null,
    routes: routeOptions(state, stage),
    actions: actionOptions(state),
    rewardOffers: state.rewardOffers.map((offer) => ({
      id: offer.id,
      category: offer.category,
      effects: { ...offer.effects },
    })),
  };
}

/** @param {object} state @param {number} stage */
function routeOptions(state, stage) {
  const choosing = state.phase === "route";
  const springOpen = stage % SPRING_EVERY_N_STAGES === 0;
  return [
    { id: "forest", available: choosing, reason: choosing ? null : "wrong_phase" },
    { id: "cave", available: choosing, reason: choosing ? null : "wrong_phase" },
    {
      id: "spring",
      available: choosing && springOpen,
      reason: !choosing ? "wrong_phase" : springOpen ? null : "spring_unavailable",
    },
  ];
}

/** @param {object} state */
function actionOptions(state) {
  const inCombat = state.phase === "combat";
  const energyOk = state.player.energy >= SPECIAL_ENERGY_COST;
  const hasPotion = state.player.potions > 0;
  const injured = state.player.hp < state.player.maxHp;
  return [
    { id: "attack", available: inCombat, reason: inCombat ? null : "wrong_phase" },
    { id: "defend", available: inCombat, reason: inCombat ? null : "wrong_phase" },
    {
      id: "special",
      available: inCombat && energyOk,
      reason: !inCombat ? "wrong_phase" : energyOk ? null : "insufficient_energy",
      cost: SPECIAL_ENERGY_COST,
    },
    {
      id: "potion",
      available: inCombat && hasPotion && injured,
      reason: !inCombat ? "wrong_phase" : !hasPotion ? "no_potions" : !injured ? "health_full" : null,
      healPercent: POTION_HEAL_PERCENT,
    },
  ];
}
