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
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Score was rejected");
    error.code = payload?.error?.code || "NETWORK";
    throw error;
  }
  return payload.score;
}
