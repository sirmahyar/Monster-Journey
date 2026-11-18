import { audio, onAudioReady, unlockAudio } from "./engine.js";
import { cdnPath, MUSIC_FILES } from "../../shared/assets.js";

const FILES = Object.fromEntries(Object.entries(MUSIC_FILES).map(([id, name]) => [id, cdnPath(name)]));
const OPENING = "boss";

/** One looping list per screen. The first thing heard is always the boss-battle theme. */
const PLAYLIST = {
  menu: [OPENING, "theme", "xmas2"],
  stage1: ["ingame1"],
  stage2: ["ingame2"],
  stage3: ["ingame3"],
  stage4: ["xmas1", "xmas3"],
  boss: [OPENING],
};

const buffers = new Map();
const loading = new Map();

function load(ctx, id) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  if (loading.has(id)) return loading.get(id);
  const job = fetch(FILES[id])
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.arrayBuffer();
    })
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

function listFor(name, chapter) {
  if (name === "boss") return "boss";
  if (name === "stage") return `stage${Math.min(4, Math.max(1, chapter))}`;
  return "menu";
}

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

/** Fetches and decodes the opening track. The menu stays behind the loading screen until this finishes. */
export function whenOpeningMusicReady() {
  if (buffers.has(OPENING)) return Promise.resolve(buffers.get(OPENING));
  return fetch(FILES[OPENING]).then(async (response) => {
    if (!response.ok) throw new Error(String(response.status));
    const bytes = await response.arrayBuffer();
    const ctx = unlockAudio();
    if (!ctx) throw new Error("audio");
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    buffers.set(OPENING, buffer);
    loading.delete(OPENING);
    return buffer;
  });
}

/** Starts a playlist. The same screen and chapter keep playing without a restart. */
export function playMusic(name, chapter = 1) {
  const key = listFor(name, chapter);
  if (key === player.key) return;
  fade(player.nodes);
  player.nodes = [];
  player.key = key;
  player.list = PLAYLIST[key] || PLAYLIST.menu;
  player.index = 0;
  const token = ++player.token;
  const start = () => {
    if (player.token !== token) return;
    const a = audio();
    if (!a) {
      window.setTimeout(start, 150);
      return;
    }
    for (const id of Object.keys(FILES)) load(a.ctx, id);
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
