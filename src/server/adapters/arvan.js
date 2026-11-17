import { handleSiteRequest } from "../http/site.js";
import { edgeConfigValue, readEdgeEnv } from "./edge-env.js";
import { SITE_ASSETS } from "./site-assets.js";

/**
 * ArvanCloud Edge Compute adapter for یورش مرغی.
 *
 * The function serves the built browser game and answers /api/scores.
 * Confirmed entry styles are both registered:
 *   addEventListener("fetch", event => event.respondWith(...))
 *   export default { fetch(request) { ... } }
 *
 * Deploy the one bundled file with the Arvan CLI:
 *   arvan ec deploy -f dist/edge/game-api.js monster
 */

/** @param {Request} request */
export function handleEdgeRequest(request) {
  return handleSiteRequest(request, {
    assets: SITE_ASSETS,
    allowedOrigin: edgeConfigValue(readEdgeEnv("FRONTEND_ORIGIN")) || "",
  });
}

const edgeApp = {
  /** @param {Request} request */
  fetch(request) {
    return handleEdgeRequest(request);
  },
};

if (typeof addEventListener === "function") {
  addEventListener("fetch", (event) => {
    event.respondWith(edgeApp.fetch(event.request));
  });
}
