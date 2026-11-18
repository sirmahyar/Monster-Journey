import { audio, onAudioReady } from "./engine.js";
import { cdnPath, MUSIC_FILES } from "../../shared/assets.js";

const FILES = Object.fromEntries(Object.entries(MUSIC_FILES).map(([id, name]) => [id, cdnPath(name)]));
const OPENING = "boss";

/** The boss theme plays first. Later tracks follow only when the current one ends. */
const ORDER = [OPENING, "ingame1", "ingame2", "ingame3", "theme", "xmas1", "xmas2", "xmas3"];

const buffers = new Map();
const loading = new Map();
let openingBytes = null;
let openingFetch = null;

/** Downloads the background track. Decoding waits for a click, so the page does not create an AudioContext on its own. */
export function whenOpeningMusicReady() {
  if (openingBytes) return Promise.resolve();
  if (!openingFetch) {
    openingFetch = fetch(FILES[OPENING]).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      openingBytes = await response.arrayBuffer();
    });
  }
  return openingFetch;
}

function load(ctx, id) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  if (loading.has(id)) return loading.get(id);
  const bytes = id === OPENING
    ? whenOpeningMusicReady().then(() => openingBytes.slice(0))
    : fetch(FILES[id]).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.arrayBuffer();
    });
  const job = bytes
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      buffers.set(id, buffer);
      return buffer;
    })
    .catch(() => null);
  loading.set(id, job);
  return job;
}

const player = { active: false, index: 0, nodes: [], token: 0, skips: 0 };

function fade(nodes, seconds = 0.9) {
  const a = audio();
  if (!a) {
    for (const node of nodes) node.src.stop();
    return;
  }
  const now = a.ctx.currentTime;
  for (const node of nodes) {
    node.g.gain.cancelScheduledValues(now);
    node.g.gain.setTargetAtTime(0.0001, now, seconds / 4);
    window.setTimeout(() => {
      try { node.src.stop(); } catch { /* already ended */ }
    }, seconds * 1000);
  }
}

function arm(token) {
  const a = audio();
  if (!a || player.token !== token || !player.active) return;
  const id = ORDER[player.index % ORDER.length];
  load(a.ctx, id).then((buffer) => {
    if (player.token !== token || !player.active) return;
    if (!buffer) {
      player.skips += 1;
      if (player.skips >= ORDER.length) return;
      player.index += 1;
      arm(token);
      return;
    }
    player.skips = 0;
    const ctx = a.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = false;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(1, now + 0.9);
    src.connect(g);
    g.connect(a.music);
    src.start(now);
    const node = { src, g };
    player.nodes.push(node);
    load(ctx, ORDER[(player.index + 1) % ORDER.length]);
    src.onended = () => {
      player.nodes = player.nodes.filter((n) => n !== node);
      if (player.token !== token || !player.active) return;
      player.index += 1;
      arm(token);
    };
  });
}

/** Starts the background once. Wave changes do not restart it or jump back to the first track. */
export function playMusic() {
  if (player.active) return;
  player.active = true;
  player.index = 0;
  player.skips = 0;
  const token = ++player.token;
  const start = () => {
    if (player.token !== token) return;
    const a = audio();
    if (!a) {
      window.setTimeout(start, 150);
      return;
    }
    arm(token);
  };
  if (audio()) start();
  else onAudioReady(start);
}

export function stopMusic() {
  player.token += 1;
  player.active = false;
  fade(player.nodes, 0.4);
  player.nodes = [];
}
