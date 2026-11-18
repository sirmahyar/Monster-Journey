import { onAudioReady, output } from "./engine.js";
import spriteUrl from "./chickens.mp3?url";

/**
 * [start, length] in seconds inside chickens.mp3 (see README for the recordings).
 * Every clip sits in silence, so the short start delay some MP3 decoders add never clips an attack.
 */
const CLIPS = {
  cluck: [[0.18, 0.19], [0.55, 0.19], [0.92, 0.19], [1.29, 0.19], [1.66, 0.18], [2.02, 0.19], [8.32, 0.14], [9.64, 0.2]],
  soft: [[8.16, 0.14], [8.5, 0.14], [8.74, 0.58], [9.36, 0.16], [9.5, 0.18]],
  bawk: [[2.39, 0.53], [3.1, 0.32], [3.6, 0.36], [4.14, 0.49], [4.81, 0.53]],
  peep: [[5.52, 0.21], [5.91, 0.14], [6.23, 0.15], [6.56, 0.25], [6.99, 0.33], [7.5, 0.15]],
  cackle: [[7.83, 2.17]],
  crow: [[10.18, 1.76], [12.12, 2.62]],
};
const PAD = 0.03;
const MAX_VOICES = 7;

let buffer = null;
let loading = false;
const lastPick = new Map();
const voices = [];

function load(ctx) {
  if (buffer || loading) return;
  loading = true;
  fetch(spriteUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`sprite ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
    .then((decoded) => {
      buffer = decoded;
    })
    .catch(() => {
      loading = false;
    });
}

onAudioReady(load);

function pick(name, index) {
  const list = CLIPS[name];
  if (index != null) return list[index % list.length];
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick.get(name)) i = (i + 1) % list.length;
  lastPick.set(name, i);
  return list[i];
}

/**
 * Plays one recorded call, pitched by `rate`. Returns false while the recordings are still
 * decoding (or failed to load), so the caller can fall back to a synthesized sound.
 */
export function playClip(a, name, { rate = 1, gain = 1, pan = 0, delay = 0, index, maxLength = Infinity, lowpass = 0, reverb = 0, priority = false } = {}) {
  if (!buffer) {
    load(a.ctx);
    return false;
  }
  const ctx = a.ctx;
  const now = ctx.currentTime;
  for (let i = voices.length - 1; i >= 0; i -= 1) if (voices[i] <= now) voices.splice(i, 1);
  if (!priority && voices.length >= MAX_VOICES) return true;
  const t = now + delay;
  const [start, length] = pick(name, index);
  const span = Math.min(length, maxLength);
  const end = t + (span + PAD) / rate;
  voices.push(end);

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  if (span < length) {
    g.gain.setValueAtTime(gain, Math.max(t, end - 0.06));
    g.gain.linearRampToValueAtTime(0.0001, end);
  }
  let node = src;
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(output(a, a.sfx, pan, t));
  if (reverb) {
    const send = ctx.createGain();
    send.gain.value = reverb;
    g.connect(send);
    send.connect(a.verb);
  }
  src.start(t, Math.max(0, start - PAD), span + PAD * 2);
  return true;
}
