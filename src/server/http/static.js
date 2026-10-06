import { base64ToBytes } from "../security/encoding.js";

/**
 * Serves the built browser files when the edge bundle embeds them.
 * Game rules stay on POST /api/game/*. A missing asset returns null.
 * @param {string} pathname
 * @param {string} method
 * @param {Record<string, { type?: string, cache?: string, encoding?: string, body?: string }> | undefined} assets
 * @returns {Response | null}
 */
export function staticResponse(pathname, method, assets) {
  const asset = findAsset(pathname, assets);
  if (!asset) return null;
  const headers = new Headers();
  headers.set("content-type", asset.type || "application/octet-stream");
  headers.set("cache-control", asset.cache || "no-cache");
  headers.set("x-content-type-options", "nosniff");
  const body = method === "HEAD" ? null : assetBody(asset);
  return new Response(body, { status: 200, headers });
}

/**
 * @param {string} pathname
 * @param {Record<string, { type?: string, cache?: string, encoding?: string, body?: string }> | undefined} assets
 */
function findAsset(pathname, assets) {
  if (!assets || typeof assets !== "object") return null;
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.includes("\\") || path.includes("\0")) return null;
  if (path.split("/").includes("..")) return null;
  if (path === "/") path = "/index.html";
  if (path.startsWith("/api/")) return null;
  const asset = assets[path];
  if (!asset || typeof asset.body !== "string" || asset.body.length === 0) return null;
  return asset;
}

/** @param {{ encoding?: string, body: string }} asset */
function assetBody(asset) {
  if (asset.encoding === "base64url") return base64ToBytes(asset.body);
  return asset.body;
}
