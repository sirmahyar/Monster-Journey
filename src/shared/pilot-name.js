export const MAX_NAME = 16;

// Latin letters and digits, Persian digits, Arabic-script letters including the
// Persian-only ones (پ چ ژ ک گ ی), the zero-width non-joiner, and plain spaces.
const ALLOWED = "A-Za-z0-9\\u06F0-\\u06F9\\u0621-\\u063A\\u0641-\\u064A\\u067E\\u0686\\u0698\\u06A9\\u06AF\\u06CC\\u200C ";

/** Matches every character a pilot name may not contain. */
export const NAME_BLOCKED = new RegExp(`[^${ALLOWED}]`, "g");

const NAME_PATTERN = new RegExp(`^[${ALLOWED}]+$`);

/** Collapses whitespace runs to one space and trims spaces and joiners from both ends. */
export function normalizeName(value) {
  return value.replace(/\s+/g, " ").replace(/^[ \u200C]+|[ \u200C]+$/g, "");
}

export function isValidName(name) {
  return name.length >= 1 && name.length <= MAX_NAME && NAME_PATTERN.test(name);
}
