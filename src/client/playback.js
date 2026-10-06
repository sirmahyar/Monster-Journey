/** Applies server-provided before/after values. It does not calculate combat. */

/** @param {object | null} view @param {object} event */
export function projectEvent(view, event) {
  if (!view) return view;
  const next = structuredClone(view);
  switch (event.type) {
    case "player_attacked":
      if (next.enemy) next.enemy.hp = event.enemyHpAfter;
      next.player.energy = event.energyAfter;
      return next;
    case "enemy_attacked":
      next.player.hp = event.hpAfter;
      return next;
    case "health_restored":
      if (event.target === "enemy" && next.enemy) next.enemy.hp = event.hpAfter;
      if (event.target === "player") {
        next.player.hp = event.hpAfter;
        if (event.maxHpAfter != null) next.player.maxHp = event.maxHpAfter;
        if (event.potionsAfter != null) next.player.potions = event.potionsAfter;
      }
      return next;
    case "energy_changed":
      next.player.energy = event.energyAfter;
      if (event.maxEnergyAfter != null) next.player.maxEnergy = event.maxEnergyAfter;
      return next;
    case "encounter_started":
      next.phase = "combat";
      next.enemy = event.enemy;
      next.rewardOffers = [];
      return next;
    case "enemy_defeated":
      if (next.enemy) next.enemy.hp = 0;
      return next;
    case "rewards_ready":
      next.phase = "reward";
      next.rewardOffers = event.offers;
      return next;
    case "player_defeated":
      next.phase = "game_over";
      next.player.hp = 0;
      return next;
    case "reward_selected":
      next.player = event.playerAfter;
      next.rewardOffers = [];
      return next;
    case "stage_completed":
      next.phase = "route";
      next.completedStages = event.completedStages;
      next.stage = event.completedStages + 1;
      next.enemy = null;
      next.rewardOffers = [];
      return next;
    default:
      return next;
  }
}

/** @param {object} event */
export function effectFor(event) {
  switch (event.type) {
    case "player_attacked":
      return "enemy";
    case "enemy_attacked":
    case "player_defeated":
      return "player";
    case "health_restored":
      return event.target === "enemy" ? "enemy" : "player";
    case "enemy_defeated":
      return "enemy";
    default:
      return null;
  }
}

/** @param {number} ms */
export function wait(ms) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
