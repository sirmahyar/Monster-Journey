# Endless Monster Journey

Endless Monster Journey is a single-player endless flight. The browser draws Lumen and the moving vectors. The game API, intended to run on ArvanCloud Edge Compute, builds each stretch, resolves hits, healing, and distance, and signs the next state.

There is no database, KV store, filesystem save, or shared memory between requests. The signed token carried by the browser is the whole save.

## Architecture

```text
browser (React, Vite)
  draws the lane, steers the creature, and plays the stretch
  stores the latest signed token
  sends the recorded flight inputs plus that token

handleRequest(request, config)  →  Response
  validates the body and token
  calls the pure engine
  signs the next state

src/server/game/engine.js
  transition(state, action, rng)
  no HTTP, clock, secrets, or React
```

The client never imports `src/server`. Shared protocol constants live in `src/shared/protocol.js`. Actor paths, damage, and signing keys do not.

Authoritative work on the edge:

- which vectors appear, and how each one moves
- hull damage, healing, dash energy, and distance
- the next signed state

The picture can flash a hit immediately from the tracks the edge already sent. The hull and distance that persist are the ones the edge returns. A forged token or a forged distance is rejected. Disconnecting the API stops the run.

## State machine

`run` → finish the stretch → `run`, until hull reaches zero → `game_over`

`game_over` accepts no gameplay action. A new run uses `POST /api/game/start`. Each stretch is a fixed number of ticks. The browser records one lane position and one dash flag per tick. The edge replays those inputs against the signed vectors.

## Signed saves

Token shape: `base64url(payloadBytes).base64url(signatureBytes)`

The payload is canonical JSON signed with HMAC-SHA-256. Verification checks those exact bytes with Web Crypto `subtle.verify` before parsing. The token is readable. It does not contain the signing key or the RNG key.

Lifetime is seven days from the last accepted action, including start. Resume checks the token and does not refresh the expiry or the revision. Rotating `GAME_SIGNING_KEY` invalidates existing saves; this version has no key-migration path.

The signature stops a player from editing hull, distance, or vector paths into a new accepted state. It does not stop them from replaying an old token or trying several flight paths from the same saved stretch. There is no replay protection, exactly-once processing, or server-side attempt limit. This is a casual game, not a prize leaderboard, and it cannot certify a winning score.

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
npm run keys
```

Put the printed values in `.env` (see `.env.example`). Do not commit `.env`. Each secret must be at least 32 bytes, encoded as base64url. On ArvanCloud the same values are JSON strings, so the panel value includes quotes, for example `"the-base64url-key"`. A `hex:` prefix is also accepted.

```bash
npm run dev
```

This starts the API on `http://127.0.0.1:8787` and Vite on `http://127.0.0.1:5173`. Vite proxies `/api` to the API. Open the Vite URL.

Other commands:

```bash
npm test
npm run build
npm run dev:api
npm run dev:web
```

`npm run build` writes the static client to `dist/client` and one edge file to `dist/edge/game-api.js`. That edge file contains the built page and the game API.

## Hosting

Deploy `dist/edge/game-api.js` again after each build:

```bash
arvan ec deploy -f dist/edge/game-api.js monster-journey
```

Use the project name already created in the panel. Opening the edge URL returns the game page. `POST /api/game/start`, `/action`, and `/resume` on that same origin run the rules. The React code runs in the browser. It does not decide hits, healing, or distance.

`dist/client` remains a separate static build if you later put the page on a CDN and route only `/api` to the edge. `FRONTEND_ORIGIN` is only the browser origin allowed to read cross-origin API responses. Same-origin play does not need it. It is not authentication and it is not replay protection.

The local Node adapter (`src/server/adapters/local.js`) exists for development. It is not part of the edge bundle.

## API

`POST /api/game/start` with `{}`

`POST /api/game/action` with `{ "token", "action" }`

Action:

- `{ "type": "finish_leg", "inputs": [{ "y": 180, "dash": 0 }, ...] }`

`POST /api/game/resume` with `{ "token" }`

Success: `{ "token", "view", "events" }`

Errors use `INVALID_REQUEST`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `UNSUPPORTED_VERSION`, `INVALID_ACTION`, `NUMERIC_LIMIT`, `CONFIGURATION_ERROR`, and `INTERNAL_ERROR`. Bodies larger than 32 KiB are rejected even when `Content-Length` is missing or wrong. Responses send `Cache-Control: no-store`. Unexpected fields are rejected, so the client cannot submit its own stat changes.

## ArvanCloud runtime

Checked against the public docs while building this repository:

| Topic | Status |
| --- | --- |
| Request delivery | Confirmed. Official examples use `addEventListener("fetch", (event) => { event.respondWith(...) })` and a standard `Request`. |
| Response | Confirmed. Examples return a standard `Response`. |
| Bundle deploy command | The panel documents `arvan ec deploy -f <file> <project-name>`, and also uploading a built file. An older English page documents `r1ec deploy`. This repository does not run either command. |
| Environment variables | Confirmed as per-app JSON values, including encrypted runtime-only values, read from a global `env` binding. `EC_URL` is reserved. The docs' own example names `test-variable` and then reads `env.test.status`, so this project uses unsuffixed names: `env.GAME_SIGNING_KEY` and `env.GAME_RNG_KEY`. |
| ES modules vs a classic bundle | Not fully confirmed. Official samples are classic scripts. The committed edge artifact is one IIFE bundle with the fetch listener and no `export`. |
| Web Crypto HMAC-SHA-256 sign, verify, and `getRandomValues` | Confirmed on the deployed `monster.mahyarrrba3r.arvanedge.ir` function: `POST /api/game/start` returned a signed token. The handler still returns `CONFIGURATION_ERROR` if Web Crypto is missing. There is no unsigned or hashed fallback. |
| CPU, memory, request, and response limits | Not documented in the pages reviewed. The app enforces a 32 KiB request body itself and keeps tokens small, but platform limits still need to be checked before a production claim. |

The API bundle was deployed by hand to `monster.mahyarrrba3r.arvanedge.ir`. CPU, memory, and platform body limits are still not documented. The app enforces a 32 KiB request body itself and keeps tokens small.

`src/server/adapters/arvan.js` is the only place that touches the fetch listener and `env`. Game rules stay in the engine. `handleRequest(request, config)` is the platform-independent entry used by both adapters.

## Rules, briefly

Lumen starts with 100 hull and 3 dash charges. The creature stays on the left of the lane. Shards weave, bats cut across, and boulders drift on their own vectors. Hearts restore hull. Sparks restore a dash charge. A dash spends one charge and ignores hazards for that tick. The edge applies each hazard once per stretch. Speed rises with distance. A killing hit ends the run.

Random draws are HMAC-SHA-256 over `gameId`, an incrementing counter, and a purpose string (`actor_kind`, `actor_y`, `actor_x`, `actor_phase`, `actor_vy`), using unbiased bounded integers. The same token and the same inputs produce the same gameplay result. Issuance timestamps may differ. `Math.random` is not used for rules.

Very long runs that would leave safe integer limits are rejected instead of being allowed to corrupt stats.

## UI

The interface is English and left-to-right. Strings are centralized in `src/client/strings.js`. The latest token is stored in `localStorage` when that storage works. On reload the client calls resume and renders the returned view. It does not treat a local display cache as authority. Only one gameplay request is in flight. The token is saved before the next stretch is shown. A failed request keeps the previous token and can be retried with the same inputs. The edge panel shows the last action, revision, browser round-trip time, and returned events. Round-trip time is not server CPU time. Old turn-based saves are rejected because the rules version changed.
