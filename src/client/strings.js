export const strings = {
  title: "Endless Monster Journey",
  creatureName: "Lumen",
  intro: "Fly the lane. Steer up and down, and dash through anything you cannot dodge. The swarm gets faster. The run ends when your hull hits zero.",
  newGame: "New run",
  continueGame: "Continue",
  loading: "Reading the saved run…",
  storageWarning: "This browser cannot store the save. The run stays in memory until you reload.",
  retry: "Retry the same stretch",
  syncing: "The edge is resolving this stretch.",
  distance: "Distance",
  hull: "Hull",
  energy: "Dash",
  dash: "Dash",
  steer: "Steer",
  how: "Arrows or drag to steer. Space or the dash button to phase through a vector.",
  gameOver: "Hull broken",
  gameOverNote: "This distance is the edge’s result for this run. It is not a verified global score.",
  again: "Fly again",
  edgeSummary: "Edge calculation",
  edgeEmpty: "A stretch has not been sent yet.",
  edgeAction: "Last action",
  edgeRevision: "State revision",
  edgeRoundTrip: "Round trip",
  edgeEvents: "Events computed by the edge",
  edgeRoundTripNote: "Round trip is measured in the browser. It is not CPU time and it is not edge execution time.",
  footer: "The browser flies the picture. The edge decides hits, healing, and distance.",
  calculating: "Waiting for the edge…",
};

/** @param {number} value */
export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

/** @param {string} code */
export function errorText(code) {
  if (code === "NETWORK") return "The edge could not be reached. The same stretch can be sent again.";
  if (code === "TOKEN_EXPIRED") return "This save expired. Start a new run.";
  if (code === "INVALID_TOKEN" || code === "UNSUPPORTED_VERSION") return "This save cannot be used. Start a new run.";
  if (code === "INVALID_ACTION") return "That move does not fit the current stretch.";
  if (code === "CONFIGURATION_ERROR") return "The edge is missing its signing configuration.";
  return "The edge rejected that request.";
}
