/** Public Arvan object storage bucket. Music is stored here, not inside the edge bundle. */
export const ASSET_BUCKET = "https://game-assets22.s3.ir-central1.arvanstorage.ir";

/** Object keys exactly as they appear in the bucket. */
export const MUSIC_FILES = Object.freeze({
  boss: "01. C I3 Boss Battle Theme.mp3",
  ingame1: "03. C I3 Ingame1.mp3",
  ingame2: "04. C I3 Ingame2.mp3",
  ingame3: "05. C I3 Ingame3.mp3",
  theme: "06. C I3 Main Theme Final.mp3",
  xmas1: "11. Xmas Edition - Ci3ingame1.mp3",
  xmas2: "12. Xmas Edition - Ci3ingame2.mp3",
  xmas3: "13. Xmas Edition - Ci3ingame3.mp3",
});

/** Same-origin path. The edge function (and the Vite dev proxy) read the bucket. */
export function cdnPath(name) {
  return `/cdn/${encodeURIComponent(name)}`;
}

/**
 * One bucket object key from a /cdn/ request, or null when the path is not a single object name.
 * @param {string} pathname
 * @returns {string | null}
 */
export function bucketKey(pathname) {
  if (!pathname.startsWith("/cdn/")) return null;
  let key = pathname.slice("/cdn/".length);
  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  if (!key || key.includes("/") || key.includes("\\") || key.includes("\0") || key.includes("..")) return null;
  return key;
}

/** @param {string} name */
export function bucketUrl(name) {
  return `${ASSET_BUCKET}/${encodeURIComponent(name)}`;
}
