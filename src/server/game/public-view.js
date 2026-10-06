import {
  ENERGY_REGEN_EVERY,
  FIELD_HEIGHT,
  MAX_DY,
  PLAYER_RADIUS,
  PLAYER_X,
  TICK_MS,
  VIEW_WIDTH,
} from "./balance.js";
import { tracksFor } from "./motion.js";

/** @param {object} state */
export function toPublicView(state) {
  return {
    phase: state.phase,
    revision: state.revision,
    distance: state.distance,
    tickMs: TICK_MS,
    regenEvery: ENERGY_REGEN_EVERY,
    player: {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      energy: state.player.energy,
      maxEnergy: state.player.maxEnergy,
      y: state.player.y,
    },
    field: {
      width: VIEW_WIDTH,
      height: FIELD_HEIGHT,
      playerX: PLAYER_X,
      playerRadius: PLAYER_RADIUS,
      maxDy: MAX_DY,
    },
    actors: state.leg ? tracksFor(state.leg) : [],
    speed: state.leg ? state.leg.speed : 0,
  };
}
