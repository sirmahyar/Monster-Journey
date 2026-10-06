import { handleRequest } from "../http/handler.js";
import { edgeConfigValue, readEdgeEnv } from "./edge-env.js";
import { SITE_ASSETS } from "./site-assets.js";

/**
 * ArvanCloud Edge Compute adapter.
 *
 * Confirmed from official examples (fetch listener + Request/Response):
 * https://docs.arvancloud.ir/en/edge-computing/examples/post-json
 * https://docs.arvancloud.ir/fa/edge-computing/examples/redirect
 *
 *   addEventListener("fetch", (event) => {
 *     event.respondWith(handleRequest(event.request));
 *   });
 *
 * Deployment of one bundled JavaScript file is documented:
 *   r1ec deploy [PROJECTNAME] -f <file>
 * This repository does not run that command and does not claim a live deployment.
 *
 * Still unverified on ArvanCloud, so this file must not be treated as production-certified:
 * - Web Crypto (`crypto.subtle` HMAC-SHA-256 sign/verify and `crypto.getRandomValues`)
 * - CPU, memory, request, and response size limits
 * - Whether a classic script bundle is required, or ESM `export` is also accepted
 * - The exact shape of the `env` binding beyond the documented global example
 *
 * If Web Crypto is missing at runtime, requests fail with CONFIGURATION_ERROR.
 * Signing is never replaced with an insecure hash.
 */

export function createEdgeConfig() {
  return {
    signingKey: edgeConfigValue(readEdgeEnv("GAME_SIGNING_KEY")),
    rngKey: edgeConfigValue(readEdgeEnv("GAME_RNG_KEY")),
    allowedOrigin: edgeConfigValue(readEdgeEnv("FRONTEND_ORIGIN")) || "",
    assets: SITE_ASSETS,
    now: () => Date.now(),
  };
}

/** @param {Request} request */
export function handleEdgeRequest(request) {
  return handleRequest(request, createEdgeConfig());
}

if (typeof addEventListener === "function") {
  addEventListener("fetch", (event) => {
    event.respondWith(handleEdgeRequest(event.request));
  });
}
