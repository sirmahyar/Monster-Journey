export const strings = {
  title: "Cluck Raid",
  eyebrow: "Space poultry",
  intro: "Hold the left side of the lane. Chickens pour in from the right, and their eggs fall. Gather gifts, keep a combo, and break four chapters.",
  play: "Launch",
  board: "Scoreboard",
  back: "Back",
  again: "Fly again",
  pause: "Pause",
  resume: "Resume",
  bomb: "Bomb",
  mute: "Mute",
  sound: "Sound",
  hull: "Lives",
  weapon: "Weapon",
  score: "Score",
  name: "Pilot name",
  save: "Save score",
  saving: "Saving…",
  saved: "Score posted.",
  saveFailed: "The scoreboard could not save that run.",
  boardEmpty: "No scores yet.",
  boardNote: "This board stores names and scores in the database. It does not prove the score was earned in a fair run.",
  over: "Hull broken",
  victory: "Orbit clear",
  how: "Arrows or WASD move. Mouse or touch steers and fires. B drops a bomb. Esc pauses.",
  loading: "Loading scores…",
};

/** @param {number} value */
export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}
