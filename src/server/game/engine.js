import { SCHEMA_VERSION, RULES_VERSION } from "../../shared/protocol.js";
import { invalidAction, numericLimit } from "../errors.js";
import {
  ATTACK_ENERGY_GAIN,
  DAMAGE_VARIANCE,
  DEFEND_ENERGY_GAIN,
  ENEMY_RECOVER_PERCENT,
  INITIAL_PLAYER,
  LIMITS,
  OFFER_COUNT,
  POTION_HEAL_PERCENT,
  SPECIAL_ENERGY_COST,
  SPRING_ENERGY_GAIN,
  SPRING_EVERY_N_STAGES,
  SPRING_HEAL_PERCENT,
} from "./balance.js";
import { ARCHETYPES, ROUTE_POOLS, scaleEnemy } from "./enemies.js";
import { REWARD_CATEGORIES, effectsFor } from "./upgrades.js";
import { addBounded, attackAfterMultiplier, ceilDiv, clamp, percentCeil } from "./math.js";

/**
 * @param {string} gameId
 * @param {{ issuedAt?: number, expiresAt?: number }} [timestamps]
 */
export function createInitialState(gameId, timestamps = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    gameId,
    revision: 0,
    rngCounter: 0,
    issuedAt: timestamps.issuedAt ?? 0,
    expiresAt: timestamps.expiresAt ?? 0,
    phase: "route",
    completedStages: 0,
    player: { ...INITIAL_PLAYER },
    encounter: null,
    rewardOffers: [],
  };
}

/**
 * Pure transition. Does not read the clock, secrets, or the network.
 * Rejected actions throw and leave the input state untouched.
 * @param {object} state
 * @param {object} action
 * @param {{ integer: (min: number, max: number, purpose: string) => Promise<number>, counter: number }} rng
 */
export async function transition(state, action, rng) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw invalidAction("Action is missing");
  }
  if (state.revision >= LIMITS.maxRevision || state.rngCounter >= LIMITS.maxRngCounter) {
    throw numericLimit("This journey exceeded the supported length");
  }
  switch (action.type) {
    case "choose_route":
      return chooseRoute(state, action, rng);
    case "combat_move":
      return combatMove(state, action, rng);
    case "choose_reward":
      return chooseReward(state, action);
    default:
      throw invalidAction("Unsupported action");
  }
}

/**
 * @param {object} state
 * @param {object} action
 * @param {{ integer: Function, counter: number }} rng
 */
async function chooseRoute(state, action, rng) {
  if (state.phase !== "route") throw invalidAction("Route selection is only available on the route");
  if (state.completedStages >= LIMITS.maxCompletedStages) {
    throw numericLimit("This journey exceeded the supported length");
  }
  if (action.route === "spring") return applySpring(state);
  if (action.route !== "forest" && action.route !== "cave") throw invalidAction("Unknown route");

  const pool = ROUTE_POOLS[action.route];
  const index = await rng.integer(0, pool.length - 1, "enemy_selection");
  const archetype = pool[index];
  const stage = state.completedStages + 1;
  const scaled = scaleEnemy(archetype, stage, action.route);
  const intention = await rollIntention(archetype, rng);
  const next = cloneState(state);
  next.encounter = {
    archetype,
    route: action.route,
    maxHp: scaled.maxHp,
    hp: scaled.hp,
    attack: scaled.attack,
    defense: scaled.defense,
    intention,
  };
  next.rewardOffers = [];
  next.phase = "combat";
  finish(next, state, rng);
  return {
    state: next,
    events: [
      {
        type: "encounter_started",
        route: action.route,
        enemy: enemyView(next.encounter),
      },
    ],
  };
}

/** @param {object} state */
function applySpring(state) {
  const stage = state.completedStages + 1;
  if (stage % SPRING_EVERY_N_STAGES !== 0) {
    throw invalidAction("The spring is not available this stage");
  }
  const next = cloneState(state);
  const hpBefore = next.player.hp;
  const energyBefore = next.player.energy;
  const attempted = percentCeil(next.player.maxHp, SPRING_HEAL_PERCENT);
  next.player.hp = clamp(hpBefore + attempted, 0, next.player.maxHp);
  next.player.energy = clamp(energyBefore + SPRING_ENERGY_GAIN, 0, next.player.maxEnergy);
  next.completedStages += 1;
  next.phase = "route";
  next.encounter = null;
  next.rewardOffers = [];
  next.revision = state.revision + 1;
  return {
    state: next,
    events: [
      {
        type: "health_restored",
        source: "spring",
        target: "player",
        amount: next.player.hp - hpBefore,
        attempted,
        hpBefore,
        hpAfter: next.player.hp,
      },
      {
        type: "energy_changed",
        source: "spring",
        energyBefore,
        energyAfter: next.player.energy,
        maxEnergyBefore: next.player.maxEnergy,
        maxEnergyAfter: next.player.maxEnergy,
      },
      {
        type: "stage_completed",
        completedStages: next.completedStages,
        source: "spring",
      },
    ],
  };
}

/**
 * @param {object} state
 * @param {object} action
 * @param {{ integer: Function, counter: number }} rng
 */
async function combatMove(state, action, rng) {
  if (state.phase !== "combat") throw invalidAction("Combat actions are only available during combat");
  const move = action.move;
  if (!["attack", "defend", "special", "potion"].includes(move)) {
    throw invalidAction("Unknown combat move");
  }
  if (move === "special" && state.player.energy < SPECIAL_ENERGY_COST) {
    throw invalidAction("Not enough energy");
  }
  if (move === "potion" && state.player.potions <= 0) throw invalidAction("No potions left");
  if (move === "potion" && state.player.hp >= state.player.maxHp) {
    throw invalidAction("Health is already full");
  }

  const next = cloneState(state);
  const events = [];
  let defending = false;

  if (move === "attack" || move === "special") {
    const energyBefore = next.player.energy;
    if (move === "special") next.player.energy -= SPECIAL_ENERGY_COST;
    else next.player.energy = clamp(next.player.energy + ATTACK_ENERGY_GAIN, 0, next.player.maxEnergy);
    const damage = await rollDamage(next.player.attack, next.encounter.defense, move === "special" ? "special" : "standard", rng);
    const enemyHpBefore = next.encounter.hp;
    next.encounter.hp = clamp(enemyHpBefore - damage, 0, next.encounter.maxHp);
    events.push({
      type: "player_attacked",
      move,
      damage,
      enemyHpBefore,
      enemyHpAfter: next.encounter.hp,
      energyBefore,
      energyAfter: next.player.energy,
    });
  } else if (move === "defend") {
    const energyBefore = next.player.energy;
    next.player.energy = clamp(energyBefore + DEFEND_ENERGY_GAIN, 0, next.player.maxEnergy);
    defending = true;
    events.push({
      type: "energy_changed",
      source: "defend",
      energyBefore,
      energyAfter: next.player.energy,
      maxEnergyBefore: next.player.maxEnergy,
      maxEnergyAfter: next.player.maxEnergy,
    });
  } else {
    const hpBefore = next.player.hp;
    const potionsBefore = next.player.potions;
    const attempted = percentCeil(next.player.maxHp, POTION_HEAL_PERCENT);
    next.player.potions -= 1;
    next.player.hp = clamp(hpBefore + attempted, 0, next.player.maxHp);
    events.push({
      type: "health_restored",
      source: "potion",
      target: "player",
      amount: next.player.hp - hpBefore,
      attempted,
      hpBefore,
      hpAfter: next.player.hp,
      potionsBefore,
      potionsAfter: next.player.potions,
    });
  }

  if (next.encounter.hp <= 0) {
    events.push({ type: "enemy_defeated", archetype: next.encounter.archetype });
    next.rewardOffers = await createOffers(next.encounter.route === "cave", rng);
    next.phase = "reward";
    finish(next, state, rng);
    events.push({
      type: "rewards_ready",
      offers: next.rewardOffers.map(copyOffer),
    });
    return { state: next, events };
  }

  await resolveEnemyIntention(next, defending, rng, events);
  if (next.player.hp <= 0) {
    next.phase = "game_over";
    next.rewardOffers = [];
    finish(next, state, rng);
    events.push({ type: "player_defeated", hpAfter: 0 });
    return { state: next, events };
  }

  next.encounter.intention = await rollIntention(next.encounter.archetype, rng);
  finish(next, state, rng);
  events.push({ type: "enemy_intention", intention: next.encounter.intention });
  return { state: next, events };
}

/**
 * The stored intention is the one already shown to the player.
 * @param {object} next
 * @param {boolean} defending
 * @param {{ integer: Function }} rng
 * @param {object[]} events
 */
async function resolveEnemyIntention(next, defending, rng, events) {
  const intention = next.encounter.intention;
  if (intention === "recover") {
    const hpBefore = next.encounter.hp;
    const attempted = percentCeil(next.encounter.maxHp, ENEMY_RECOVER_PERCENT);
    next.encounter.hp = clamp(hpBefore + attempted, 0, next.encounter.maxHp);
    events.push({
      type: "health_restored",
      source: "enemy_recover",
      target: "enemy",
      amount: next.encounter.hp - hpBefore,
      attempted,
      hpBefore,
      hpAfter: next.encounter.hp,
    });
    return;
  }
  const kind = intention === "heavy_attack" ? "heavy" : "standard";
  const rawDamage = await rollDamage(next.encounter.attack, next.player.defense, kind, rng);
  const damage = defending ? ceilDiv(rawDamage, 2) : rawDamage;
  const hpBefore = next.player.hp;
  next.player.hp = clamp(hpBefore - damage, 0, next.player.maxHp);
  events.push({
    type: "enemy_attacked",
    intention,
    damage,
    rawDamage,
    defended: defending,
    hpBefore,
    hpAfter: next.player.hp,
  });
}

/**
 * @param {number} attack
 * @param {number} defense
 * @param {"standard" | "special" | "heavy"} kind
 * @param {{ integer: Function }} rng
 */
async function rollDamage(attack, defense, kind, rng) {
  const scaled = attackAfterMultiplier(attack, kind);
  const base = Math.max(1, scaled - defense);
  const variance = await rng.integer(-DAMAGE_VARIANCE, DAMAGE_VARIANCE, "damage_roll");
  return Math.max(1, base + variance);
}

/**
 * @param {string} archetype
 * @param {{ integer: Function }} rng
 */
async function rollIntention(archetype, rng) {
  const weights = ARCHETYPES[archetype].intentions;
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  const roll = await rng.integer(0, total - 1, "enemy_intent");
  let cursor = 0;
  for (const item of weights) {
    cursor += item.weight;
    if (roll < cursor) return item.type;
  }
  return weights[weights.length - 1].type;
}

/**
 * @param {boolean} cave
 * @param {{ integer: Function }} rng
 */
async function createOffers(cave, rng) {
  const pool = [...REWARD_CATEGORIES];
  const offers = [];
  for (let i = 0; i < OFFER_COUNT; i += 1) {
    const index = await rng.integer(0, pool.length - 1, "reward_selection");
    const category = pool.splice(index, 1)[0];
    offers.push({
      id: category,
      category,
      effects: effectsFor(category, cave),
    });
  }
  return offers;
}

/** @param {object} state */
function chooseReward(state, action) {
  if (state.phase !== "reward") throw invalidAction("Rewards can only be chosen after a victory");
  if (typeof action.offerId !== "string") throw invalidAction("That reward is not available");
  const offer = state.rewardOffers.find((item) => item.id === action.offerId);
  if (!offer) throw invalidAction("That reward is not available");
  if (state.completedStages >= LIMITS.maxCompletedStages) {
    throw numericLimit("This journey exceeded the supported length");
  }

  const next = cloneState(state);
  const playerBefore = { ...next.player };
  applyEffects(next.player, offer.effects);
  next.completedStages += 1;
  next.encounter = null;
  next.rewardOffers = [];
  next.phase = "route";
  next.revision = state.revision + 1;
  const playerAfter = { ...next.player };
  const events = [
    {
      type: "reward_selected",
      offerId: offer.id,
      category: offer.category,
      effects: { ...offer.effects },
      playerBefore,
      playerAfter,
    },
  ];
  if (playerAfter.hp !== playerBefore.hp || playerAfter.maxHp !== playerBefore.maxHp) {
    events.push({
      type: "health_restored",
      source: "reward",
      target: "player",
      amount: playerAfter.hp - playerBefore.hp,
      hpBefore: playerBefore.hp,
      hpAfter: playerAfter.hp,
      maxHpBefore: playerBefore.maxHp,
      maxHpAfter: playerAfter.maxHp,
    });
  }
  if (playerAfter.energy !== playerBefore.energy || playerAfter.maxEnergy !== playerBefore.maxEnergy) {
    events.push({
      type: "energy_changed",
      source: "reward",
      energyBefore: playerBefore.energy,
      energyAfter: playerAfter.energy,
      maxEnergyBefore: playerBefore.maxEnergy,
      maxEnergyAfter: playerAfter.maxEnergy,
    });
  }
  events.push({
    type: "stage_completed",
    completedStages: next.completedStages,
    source: "reward",
  });
  return { state: next, events };
}

/** @param {object} player @param {object} effects */
function applyEffects(player, effects) {
  const maxHp = effects.maxHp ? addBounded(player.maxHp, effects.maxHp, LIMITS.maxHp, "maxHp") : player.maxHp;
  const attack = effects.attack ? addBounded(player.attack, effects.attack, LIMITS.maxAttack, "attack") : player.attack;
  const defense = effects.defense ? addBounded(player.defense, effects.defense, LIMITS.maxDefense, "defense") : player.defense;
  const maxEnergy = effects.maxEnergy
    ? addBounded(player.maxEnergy, effects.maxEnergy, LIMITS.maxEnergy, "maxEnergy")
    : player.maxEnergy;
  const potions = effects.potions ? addBounded(player.potions, effects.potions, LIMITS.maxPotions, "potions") : player.potions;
  const hp = clamp(player.hp + (effects.hp || 0), 0, maxHp);
  const energy = clamp(player.energy + (effects.energy || 0), 0, maxEnergy);
  player.maxHp = maxHp;
  player.hp = hp;
  player.attack = attack;
  player.defense = defense;
  player.maxEnergy = maxEnergy;
  player.energy = energy;
  player.potions = potions;
}

/** @param {object} next @param {object} previous @param {{ counter: number }} rng */
function finish(next, previous, rng) {
  next.rngCounter = rng.counter;
  next.revision = previous.revision + 1;
  if (next.rngCounter > LIMITS.maxRngCounter || next.revision > LIMITS.maxRevision) {
    throw numericLimit("This journey exceeded the supported length");
  }
}

/** @param {object} encounter */
function enemyView(encounter) {
  return {
    archetype: encounter.archetype,
    route: encounter.route,
    hp: encounter.hp,
    maxHp: encounter.maxHp,
    attack: encounter.attack,
    defense: encounter.defense,
    intention: encounter.intention,
  };
}

/** @param {object} offer */
function copyOffer(offer) {
  return { id: offer.id, category: offer.category, effects: { ...offer.effects } };
}

/** @param {object} state */
export function cloneState(state) {
  return {
    schemaVersion: state.schemaVersion,
    rulesVersion: state.rulesVersion,
    gameId: state.gameId,
    revision: state.revision,
    rngCounter: state.rngCounter,
    issuedAt: state.issuedAt,
    expiresAt: state.expiresAt,
    phase: state.phase,
    completedStages: state.completedStages,
    player: { ...state.player },
    encounter: state.encounter ? { ...state.encounter } : null,
    rewardOffers: Array.isArray(state.rewardOffers) ? state.rewardOffers.map(copyOffer) : [],
  };
}
