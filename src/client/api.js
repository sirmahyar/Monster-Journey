export async function fetchScores() {
  const response = await fetch("/api/scores");
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Scoreboard unavailable");
    error.code = payload?.error?.code || "NETWORK";
    throw error;
  }
  return payload.scores;
}

/** @param {{ name: string, score: number, chapter: number, wave: number }} entry */
export async function submitScore(entry) {
  const response = await fetch("/api/scores", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
    keepalive: true,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Score was rejected");
    error.code = payload?.error?.code || "NETWORK";
    throw error;
  }
  return payload.score;
}

/** Posts a score while the page is going away. The response is not needed. */
export function submitScoreOnLeave(entry) {
  const body = JSON.stringify(entry);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/scores", blob)) return;
  }
  fetch("/api/scores", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
