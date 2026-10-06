/**
 * @param {string} code
 * @param {string} message
 * @param {number} status
 */
export class GameError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "GameError";
    this.code = code;
    this.status = status;
  }
}

export function invalidRequest(message) {
  return new GameError("INVALID_REQUEST", message, 400);
}

export function invalidAction(message) {
  return new GameError("INVALID_ACTION", message, 400);
}

export function invalidToken(message = "Token is not valid") {
  return new GameError("INVALID_TOKEN", message, 401);
}

export function tokenExpired() {
  return new GameError("TOKEN_EXPIRED", "Token has expired", 401);
}

export function unsupportedVersion() {
  return new GameError("UNSUPPORTED_VERSION", "This save uses an unsupported rules version", 400);
}

export function numericLimit(message) {
  return new GameError("NUMERIC_LIMIT", message, 422);
}

export function configurationError(message) {
  return new GameError("CONFIGURATION_ERROR", message, 500);
}
