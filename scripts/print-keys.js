import { randomBytes } from "../src/server/security/crypto.js";
import { bytesToBase64Url } from "../src/server/security/encoding.js";

const signing = bytesToBase64Url(randomBytes(32));
const rng = bytesToBase64Url(randomBytes(32));
console.log("Add these to .env. Do not commit that file.");
console.log(`GAME_SIGNING_KEY=${signing}`);
console.log(`GAME_RNG_KEY=${rng}`);
