import { audio, onAudioReady } from "./engine.js";
import { cdnPath, MUSIC_FILES } from "../../shared/assets.js";

const FILES = Object.fromEntries(Object.entries(MUSIC_FILES).map(([id, name]) => [id, cdnPath(name)]));
const OPENING = "boss";

/** Menu and every wave share this one looping track, so entering a stage does not restart it. */
const BACKGROUND = [OPENING];

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

const player = { key: "", list: [], index: 0, nodes: [], token: 0 };

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
  if (!a || player.token !== token || player.list.length === 0) return;
  const id = player.list[player.index % player.list.length];
  load(a.ctx, id).then((buffer) => {
    if (!buffer || player.token !== token) return;
    const ctx = a.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = player.list.length === 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(1, now + 0.9);
    src.connect(g);
    g.connect(a.music);
    src.start(now);
    const node = { src, g };
    player.nodes.push(node);
    src.onended = () => {
      player.nodes = player.nodes.filter((n) => n !== node);
      if (player.token !== token || src.loop) return;
      player.index += 1;
      arm(token);
    };
  });
}

/** Starts the shared background track. Menu, stages, and bosses all keep the same loop. */
export function playMusic() {
  const key = "background";
  if (key === player.key) return;
  fade(player.nodes);
  player.nodes = [];
  player.key = key;
  player.list = BACKGROUND;
  player.index = 0;
  const token = ++player.token;
  const start = () => {
    if (player.token !== token) return;
    const a = audio();
    if (!a) {
      window.setTimeout(start, 150);
      return;
    }
    load(a.ctx, OPENING);
    arm(token);
  };
  if (audio()) start();
  else onAudioReady(start);
}

export function stopMusic() {
  player.token += 1;
  player.key = "";
  player.list = [];
  fade(player.nodes, 0.4);
  player.nodes = [];
}
