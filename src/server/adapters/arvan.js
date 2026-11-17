import { createEdgeScoreStore } from "../scores/edge-db.js";
import { handleSiteRequest } from "../http/site.js";
import { edgeConfigValue, readEdgeEnv } from "./edge-env.js";
import { SITE_ASSETS } from "./site-assets.js";

/**
 * ArvanCloud Edge Compute adapter for یورش مرغی.
 *
 * The function serves the built browser game and answers /api/scores.
 * The live runtime enters through:
 *   addEventListener("fetch", event => event.respondWith(...))
 *
 * Deploy the one bundled file with the Arvan CLI:
 *   arvan ec deploy -f dist/edge/game-api.js monster
 */

/**
 * @param {Request} request
 * @param {object | undefined} envBinding
 */
export function handleEdgeRequest(request, envBinding) {
  return handleSiteRequest(request, {
    assets: SITE_ASSETS,
    allowedOrigin: edgeConfigValue(readEdgeEnv("FRONTEND_ORIGIN")) || "",
    store: createEdgeScoreStore(envBinding),
  });
}

const edgeApp = {
  /**
   * @param {Request} request
   * @param {object | undefined} envBinding
   */
  fetch(request, envBinding) {
    return handleEdgeRequest(request, envBinding);
  },
};

if (typeof addEventListener === "function") {
  addEventListener("fetch", (event) => {
    event.respondWith(edgeApp.fetch(event.request, event.env));
  });
}
