import { API_PATHS } from "../shared/protocol.js";

/**
 * @param {string} path
 * @param {object} body
 */
export async function postGame(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    const error = new Error("network");
    error.code = "NETWORK";
    throw error;
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "request failed");
    error.code = payload?.error?.code || "NETWORK";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function startGame() {
  return postGame(API_PATHS.start, {});
}

/** @param {string} token @param {object} action */
export function sendAction(token, action) {
  return postGame(API_PATHS.action, { token, action });
}

/** @param {string} token */
export function resumeGame(token) {
  return postGame(API_PATHS.resume, { token });
}
