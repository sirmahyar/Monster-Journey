import { numericLimit } from "../errors.js";

/**
 * @param {number} numerator
 * @param {number} denominator
 */
export function ceilDiv(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw numericLimit("Arithmetic left the supported integer range");
  }
  if (numerator <= 0) return 0;
  const sum = numerator + denominator - 1;
  if (!Number.isSafeInteger(sum)) {
    throw numericLimit("Arithmetic left the supported integer range");
  }
  return Math.floor(sum / denominator);
}

/**
 * ceil(amount * percent / 100) using integers.
 * @param {number} amount
 * @param {number} percent
 */
export function percentCeil(amount, percent) {
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(percent)) {
    throw numericLimit("Arithmetic left the supported integer range");
  }
  const product = amount * percent;
  if (!Number.isSafeInteger(product)) {
    throw numericLimit("Arithmetic left the supported integer range");
  }
  return ceilDiv(product, 100);
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * @param {number} current
 * @param {number} delta
 * @param {number} max
 * @param {string} label
 */
export function addBounded(current, delta, max, label) {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(delta) || !Number.isSafeInteger(max)) {
    throw numericLimit(`${label} left the supported integer range`);
  }
  const next = current + delta;
  if (!Number.isSafeInteger(next) || next > max || next < 0) {
    throw numericLimit(`${label} would leave the supported range`);
  }
  return next;
}

/**
 * Integer form of the attack multipliers.
 * standard = 1, special = 2, heavy = 8/5 (the exact value of 1.6).
 * @param {number} attack
 * @param {"standard" | "special" | "heavy"} kind
 */
export function attackAfterMultiplier(attack, kind) {
  if (!Number.isSafeInteger(attack) || attack < 0) {
    throw numericLimit("Attack left the supported integer range");
  }
  if (kind === "standard") return attack;
  if (kind === "special") {
    const value = attack * 2;
    if (!Number.isSafeInteger(value)) {
      throw numericLimit("Attack left the supported integer range");
    }
    return value;
  }
  if (kind === "heavy") {
    const product = attack * 8;
    if (!Number.isSafeInteger(product)) {
      throw numericLimit("Attack left the supported integer range");
    }
    return Math.floor(product / 5);
  }
  throw numericLimit("Unknown attack multiplier");
}
