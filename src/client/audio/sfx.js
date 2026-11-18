import { W } from "../../game/config.js";
import { cdnPath, BITE_FILES } from "../../shared/assets.js";
import { audio, onAudioReady, output } from "./engine.js";
import { playClip } from "./samples.js";

const last = new Map();
const bites = new Map();
let bitesRequested = false;

function loadBites(ctx) {
  if (bitesRequested) return;
  bitesRequested = true;
  for (const [id, name] of Object.entries(BITE_FILES)) {
    fetch(cdnPath(name))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data.slice(0)))
      .then((buffer) => bites.set(id, buffer))
      .catch(() => {});
  }
}

onAudioReady((ctx) => loadBites(ctx));

function playBite(a, id, { gain = 0.9, pan = 0, delay = 0 } = {}) {
  const buffer = bites.get(id);
  if (!buffer) {
    loadBites(a.ctx);
    return;
  }
  const t = a.ctx.currentTime + delay;
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  src.connect(g);
  g.connect(output(a, a.sfx, pan, t));
  src.start(t);
}

function ready(name, gap) {
  const a = audio();
  if (!a || !a.settings.sfx) return null;
  const now = a.ctx.currentTime;
  if (gap && now - (last.get(name) ?? -1) < gap) return null;
  last.set(name, now);
  return a;
}

function free(a, name, gap) {
  const now = a.ctx.currentTime;
  if (now - (last.get(name) ?? -1) < gap) return false;
  last.set(name, now);
  return true;
}

function tone(a, { type = "sine", freq, to, dur, gain = 0.1, attack = 0.004, delay = 0, pan = 0, filter, cutoff = 2000, q = 1, vibrato = 0 }) {
  const ctx = a.ctx;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = cutoff;
    f.Q.value = q;
    node.connect(f);
    node = f;
  }
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vibrato;
    depth.gain.value = freq * 0.05;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  node.connect(g);
  g.connect(output(a, a.sfx, pan, t));
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(a, { dur, gain = 0.1, filter = "bandpass", freq = 1200, to, q = 1, delay = 0, pan = 0, attack = 0.003 }) {
  const ctx = a.ctx;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(output(a, a.sfx, pan, t));
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

/** Two-operator FM bell: a sine carrier with a decaying inharmonic modulator. */
function bell(a, freq, { gain = 0.06, dur = 0.9, delay = 0, pan = 0, ratio = 3.5, index = 1.6 } = {}) {
  const ctx = a.ctx;
  const t = ctx.currentTime + delay;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const depth = ctx.createGain();
  carrier.frequency.value = freq;
  mod.frequency.value = freq * ratio;
  depth.gain.setValueAtTime(freq * index, t);
  depth.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.6);
  mod.connect(depth);
  depth.connect(carrier.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  carrier.connect(g);
  g.connect(output(a, a.sfx, pan, t));
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + dur + 0.05);
  mod.stop(t + dur + 0.05);
}

/** Tiny noise clicks spread over `spread` seconds: shell cracks, debris, glass. */
function crackle(a, { count = 4, spread = 0.03, gain = 0.06, freq = 3500, pan = 0, delay = 0 }) {
  for (let i = 0; i < count; i += 1) {
    const at = delay + (i === 0 ? 0 : Math.random() * spread);
    noise(a, { dur: 0.004 + Math.random() * 0.01, gain: gain * (i === 0 ? 1 : 0.4 + Math.random() * 0.6), filter: "highpass", freq: freq * (0.7 + Math.random() * 0.6), delay: at, pan: pan + (Math.random() - 0.5) * 0.3, attack: 0.001 });
  }
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const panOf = (x) => (typeof x === "number" ? (x / W - 0.5) * 0.9 : 0);
const jitter = (v, amount = 0.08) => v * (1 + (Math.random() * 2 - 1) * amount);
const PENTATONIC = [0, 2, 4, 7, 9];
const scaleNote = (root, step) => root + PENTATONIC[step % 5] + 12 * Math.floor(step / 5);

function chime(a, notes, { step = 0.07, gain = 0.05, dur = 0.8, pan = 0 } = {}) {
  notes.forEach((n, i) => bell(a, midi(n), { gain, dur, delay: i * step, pan }));
}

/** Soft puff of feathers with a short wing flutter. */
function feathers(a, pan, size = 1) {
  noise(a, { dur: 0.2 * size, gain: 0.06 * size, filter: "bandpass", freq: 1500, to: 600, q: 0.7, pan, attack: 0.006 });
  for (let i = 0; i < 3; i += 1) noise(a, { dur: 0.05, gain: 0.025 * size, filter: "bandpass", freq: 900, q: 1.4, delay: 0.05 + i * 0.045, pan });
}

function boom(a, size = 1, pan = 0) {
  tone(a, { freq: 120, to: 34, dur: 0.42 * size, gain: 0.36 * Math.min(1.4, size), pan });
  noise(a, { dur: 0.5 * size, gain: 0.26 * Math.min(1.4, size), filter: "lowpass", freq: 2400, to: 160, pan, attack: 0.002 });
  noise(a, { dur: 0.9 * size, gain: 0.09 * Math.min(1.5, size), filter: "lowpass", freq: 420, to: 90, delay: 0.05, pan, attack: 0.05 });
  crackle(a, { count: Math.round(5 * size), spread: 0.35 * size, gain: 0.035, freq: 2200, pan, delay: 0.03 });
}

/** A recorded call, or the old synthesized chirp while the recordings are still loading. */
function voice(a, clip, { rate = 1, gain = 0.5, pan = 0, delay = 0, index, maxLength, lowpass, reverb, priority } = {}) {
  if (playClip(a, clip, { rate, gain, pan, delay, index, maxLength, lowpass, reverb, priority })) return;
  const pitch = clip === "peep" ? 2.6 * rate : rate;
  tone(a, { type: "square", freq: 620 * pitch, to: 980 * pitch, dur: 0.05, gain: gain * 0.08, filter: "bandpass", cutoff: 1300 * pitch, q: 3, pan, delay });
  tone(a, { type: "square", freq: 940 * pitch, to: 470 * pitch, dur: 0.13, gain: gain * 0.12, filter: "bandpass", cutoff: 1100 * pitch, q: 3, delay: delay + 0.07, pan, vibrato: 34 });
}

/** A few hens clucking over each other as a flock flies in. */
function flock(a, count = 4, spread = 0.7) {
  for (let i = 0; i < count; i += 1) {
    voice(a, "cluck", { rate: 0.82 + Math.random() * 0.45, gain: 0.12 + Math.random() * 0.1, pan: (Math.random() - 0.5) * 1.4, delay: Math.random() * spread });
  }
  noise(a, { dur: 0.7, gain: 0.035, filter: "bandpass", freq: 700, to: 1600, q: 0.8, attack: 0.25 });
}

const CALL_RATE = { chick: 1.04, hen: 1, diver: 1.1, bomber: 0.88, rooster: 0.78, golden: 1.16, saucer: 1.18 };
const HIT_GAIN = { chick: 0.2, hen: 0.24, diver: 0.24, bomber: 0.26, rooster: 0.28, golden: 0.26 };
const BIRDS = new Set(["chick", "hen", "diver", "bomber", "rooster", "golden"]);

const SHOT = {
  pulse: (a, pan) => {
    tone(a, { type: "triangle", freq: jitter(1250, 0.04), to: 560, dur: 0.07, gain: 0.04, pan, filter: "lowpass", cutoff: 3200 });
    noise(a, { dur: 0.025, gain: 0.014, filter: "bandpass", freq: 2600, q: 1.2, pan });
  },
  laser: (a, pan) => {
    tone(a, { freq: jitter(2300, 0.03), to: 1450, dur: 0.06, gain: 0.03, pan });
    tone(a, { freq: jitter(3500, 0.03), to: 2200, dur: 0.04, gain: 0.01, pan });
  },
  ion: (a, pan) => tone(a, { type: "triangle", freq: jitter(260, 0.04), to: 620, dur: 0.13, gain: 0.055, pan, filter: "lowpass", cutoff: 1400, vibrato: 18 }),
};

function bossVoice(a, kind, mood) {
  const angry = mood === "angry";
  if (kind === "grandhen") voice(a, angry ? "bawk" : "cackle", { rate: angry ? 0.62 : 0.72, gain: 0.62, lowpass: 3800, reverb: 0.55, maxLength: angry ? 0.6 : 2.1, priority: true });
  else if (kind === "ironrooster") voice(a, angry ? "bawk" : "crow", { index: angry ? undefined : 1, rate: angry ? 0.58 : 0.8, gain: 0.58, lowpass: 3600, reverb: 0.5, maxLength: angry ? 0.6 : 2.4, priority: true });
  else if (kind === "carrier") flock(a, angry ? 5 : 8, angry ? 0.5 : 1.2);
}

/** Plays the sound that belongs to one simulation event. */
export function playEvent(ev, extra = {}) {
  const pan = panOf(ev.x);
  let a;
  switch (ev.type) {
    case "shot":
      if ((a = ready("shot", 0.05))) SHOT[ev.weapon](a, pan * 0.5);
      break;
    case "rocket":
      if ((a = ready("rocket", 0.25))) {
        noise(a, { dur: 0.2, gain: 0.05, filter: "bandpass", freq: 380, to: 1600, q: 0.8, pan, attack: 0.02 });
        tone(a, { freq: 240, to: 90, dur: 0.18, gain: 0.045, pan });
      }
      break;
    case "hit":
      if (!(a = ready("hit", 0.035))) break;
      if (BIRDS.has(ev.kind)) {
        noise(a, { dur: 0.05, gain: 0.05, filter: "bandpass", freq: 1700, q: 1.1, pan });
        if (free(a, "hitcall", 0.13) && Math.random() < 0.55) voice(a, ev.kind === "chick" ? "peep" : "cluck", { rate: jitter(CALL_RATE[ev.kind]), gain: HIT_GAIN[ev.kind], pan, maxLength: 0.14 });
      } else if (ev.kind === "rock") {
        noise(a, { dur: 0.05, gain: 0.07, filter: "bandpass", freq: 900, q: 2, pan });
        tone(a, { freq: jitter(300), to: 170, dur: 0.05, gain: 0.05, pan });
      } else {
        tone(a, { freq: jitter(2400, 0.03), dur: 0.05, gain: 0.025, pan });
        tone(a, { freq: jitter(3380, 0.03), dur: 0.035, gain: 0.012, pan });
      }
      break;
    case "boss_hit":
      if (!(a = ready("hit", 0.04))) break;
      if (ev.armored) {
        tone(a, { freq: 1900, dur: 0.06, gain: 0.025, pan });
        tone(a, { freq: 2650, dur: 0.05, gain: 0.015, pan });
      } else {
        noise(a, { dur: 0.05, gain: 0.07, filter: "lowpass", freq: 1500, pan });
        tone(a, { freq: jitter(220), to: 140, dur: 0.06, gain: 0.06, pan });
      }
      break;
    case "boss_immune":
      if ((a = ready("immune", 0.09))) tone(a, { freq: 2600, dur: 0.04, gain: 0.02, pan });
      break;
    case "kill":
      if (!(a = ready("kill", 0.025))) break;
      if (ev.kind === "rock") {
        tone(a, { freq: 95, to: 36, dur: 0.26, gain: 0.22, pan });
        noise(a, { dur: 0.3 + ev.size * 0.06, gain: 0.16, filter: "lowpass", freq: 1300, to: 160, pan });
        crackle(a, { count: 5, spread: 0.25, gain: 0.04, freq: 2000, pan });
        break;
      }
      if (ev.kind === "saucer") {
        tone(a, { freq: 1500, to: 380, dur: 0.14, gain: 0.07, pan });
        noise(a, { dur: 0.1, gain: 0.06, filter: "highpass", freq: 3000, pan });
        if (free(a, "call", 0.06)) voice(a, "peep", { rate: jitter(1.12, 0.05), gain: 0.42, pan, delay: 0.05 });
        break;
      }
      tone(a, { freq: jitter(320), to: 90, dur: 0.1, gain: 0.08, pan });
      feathers(a, pan, ev.kind === "chick" ? 0.6 : ev.kind === "rooster" ? 1.25 : 1);
      if (free(a, "call", 0.06)) {
        if (ev.kind === "chick") voice(a, "peep", { rate: jitter(1.04, 0.07), gain: 0.42, pan });
        else voice(a, "bawk", { rate: jitter(CALL_RATE[ev.kind] || 1, 0.06), gain: ev.kind === "rooster" ? 0.55 : 0.46, pan, maxLength: 0.42 });
      }
      if (ev.kind === "golden") chime(a, [88, 91, 95, 98, 100], { step: 0.05, gain: 0.045 });
      break;
    case "egg":
      if (!(a = ready("egg", 0.1))) break;
      if (ev.egg === "spark") tone(a, { freq: 1400, to: 480, dur: 0.09, gain: 0.025, pan, filter: "lowpass", cutoff: 2400 });
      else if (ev.egg === "quill") noise(a, { dur: 0.08, gain: 0.04, filter: "bandpass", freq: 3000, to: 1300, q: 2.5, pan });
      else {
        tone(a, { freq: jitter(700), to: ev.egg === "yolk" ? 260 : 380, dur: 0.06, gain: 0.03, pan });
        if (free(a, "eggcall", 0.22)) voice(a, ev.kind === "chick" ? "peep" : "cluck", { rate: jitter(CALL_RATE[ev.kind] || 1), gain: ev.kind === "chick" ? 0.12 : 0.16, pan, maxLength: 0.16 });
      }
      break;
    case "dive":
      if ((a = ready("dive", 0.35))) {
        voice(a, ev.kind === "chick" ? "peep" : "bawk", { rate: jitter(ev.kind === "chick" ? 1.1 : 1.12, 0.05), gain: 0.3, pan, maxLength: 0.35 });
        noise(a, { dur: 0.45, gain: 0.04, filter: "bandpass", freq: 600, to: 1800, q: 0.9, pan, attack: 0.12 });
      }
      break;
    case "splat":
      if ((a = ready("splat", 0.05))) {
        crackle(a, { count: 3, spread: 0.018, gain: 0.07, freq: 3600, pan });
        noise(a, { dur: 0.15, gain: 0.08, filter: "lowpass", freq: 1700, to: 260, pan, delay: 0.012 });
        tone(a, { freq: 230, to: 85, dur: 0.08, gain: 0.05, pan, delay: 0.01 });
        if (ev.yolk || ev.big) noise(a, { dur: 0.22, gain: 0.06, filter: "bandpass", freq: 760, to: 240, q: 3, pan, delay: 0.03 });
      }
      break;
    case "yolk_split":
    case "pop":
      if ((a = ready("pop", 0.06))) {
        crackle(a, { count: 3, spread: 0.015, gain: 0.05, freq: 4000, pan });
        tone(a, { freq: 720, to: 340, dur: 0.06, gain: 0.05, pan, delay: 0.005 });
      }
      break;
    case "pickup":
      if (!(a = ready(`pickup:${ev.kind}`, 0.04))) break;
      if (ev.kind === "kernel" || ev.kind === "cob" || ev.kind === "nugget" || ev.kind === "burger" || ev.kind === "pizza") {
        if (free(a, "yum", 0.16)) {
          playBite(a, Math.random() < 0.5 ? "munch" : "eating", { gain: 0.32, pan });
        }
      } else if (ev.kind === "crate") {
        noise(a, { dur: 0.05, gain: 0.08, filter: "bandpass", freq: 520, q: 1.5 });
        noise(a, { dur: 0.05, gain: 0.06, filter: "bandpass", freq: 430, q: 1.5, delay: 0.06 });
        chime(a, [79, 83, 86, 91], { step: 0.05 });
      } else if (ev.kind === "power") chime(a, [72, 76, 79, 84], { step: 0.05, gain: 0.055 });
      else if (ev.kind === "life") chime(a, [76, 79, 84, 88, 91], { step: 0.08, gain: 0.06, dur: 1.2 });
      else if (ev.kind === "shield") {
        noise(a, { dur: 0.45, gain: 0.05, filter: "bandpass", freq: 500, to: 3000, q: 1.5, attack: 0.1 });
        bell(a, midi(88), { gain: 0.05, dur: 1 });
      } else if (ev.kind === "coolant") {
        noise(a, { dur: 0.4, gain: 0.06, filter: "highpass", freq: 6000, to: 2500 });
        chime(a, [96, 100, 103], { step: 0.06, gain: 0.035 });
      } else if (ev.kind === "nova") {
        noise(a, { dur: 0.4, gain: 0.05, filter: "bandpass", freq: 300, to: 2000, q: 1.2, attack: 0.1 });
        chime(a, [60, 67, 72], { step: 0.07, gain: 0.06, dur: 1.1 });
      } else chime(a, [79, 86], { step: 0.08 });
      break;
    case "levelup":
    case "weapon":
      if ((a = ready("levelup", 0.1))) chime(a, [72, 76, 79, 84, 88], { step: 0.055, gain: 0.05 });
      break;
    case "bomb_gain":
      if ((a = ready("bombgain", 0.2))) chime(a, [84, 91, 96], { step: 0.06, gain: 0.05 });
      break;
    case "overheat":
      if ((a = ready("overheat", 0.5))) {
        noise(a, { dur: 0.8, gain: 0.08, filter: "highpass", freq: 2600, to: 5200, attack: 0.04 });
        tone(a, { freq: 880, dur: 0.12, gain: 0.04 });
        tone(a, { freq: 660, dur: 0.16, gain: 0.04, delay: 0.14 });
      }
      break;
    case "cooled":
      if ((a = ready("cooled", 0.3))) bell(a, midi(91), { gain: 0.04, dur: 0.6 });
      break;
    case "nova_launch":
      if ((a = ready("novalaunch"))) noise(a, { dur: 0.55, gain: 0.12, filter: "bandpass", freq: 300, to: 3200, q: 1.6, attack: 0.15 });
      break;
    case "nova":
      if (ev.quiet || !(a = ready("nova"))) break;
      boom(a, 2.2);
      noise(a, { dur: 1.4, gain: 0.08, filter: "highpass", freq: 3000, to: 700, delay: 0.05, attack: 0.02 });
      chime(a, [72, 79, 84], { step: 0.09, gain: 0.04, dur: 1.4 });
      break;
    case "death":
      if ((a = ready("death"))) {
        boom(a, 2, pan);
        crackle(a, { count: 9, spread: 0.22, gain: 0.05, freq: 5200, pan });
        tone(a, { type: "triangle", freq: 520, to: 90, dur: 0.8, gain: 0.05, filter: "lowpass", cutoff: 1500 });
        voice(a, "cackle", { gain: 0.34, delay: 0.5, maxLength: 1.5, reverb: 0.2, priority: true });
      }
      break;
    case "respawn":
      if ((a = ready("respawn"))) chime(a, [67, 71, 74, 79, 83], { step: 0.06, gain: 0.045 });
      break;
    case "shield_hit":
    case "shield_block":
      if ((a = ready("shieldhit", 0.06))) {
        tone(a, { freq: 900, to: 700, dur: 0.08, gain: 0.04, pan });
        bell(a, 1400, { gain: 0.02, dur: 0.3, pan });
      }
      break;
    case "shield_on":
      break;
    case "shield_break":
      if ((a = ready("shieldbreak", 0.1))) crackle(a, { count: 10, spread: 0.2, gain: 0.05, freq: 5000, pan });
      break;
    case "combo":
      if ((a = ready("combo", 0.1))) bell(a, midi(scaleNote(76, Math.min(14, ev.mult))), { gain: 0.045, dur: 0.6 });
      break;
    case "golden":
      if ((a = ready("golden"))) {
        chime(a, [88, 91, 95, 100, 103], { step: 0.05, gain: 0.04 });
        voice(a, "cluck", { rate: 1.2, gain: 0.3, delay: 0.15 });
      }
      break;
    case "golden_escape":
      if ((a = ready("goldenescape"))) voice(a, "cackle", { rate: 1.16, gain: 0.34, maxLength: 1.2 });
      break;
    case "wave":
      if (!(a = ready("wave", 0.5))) break;
      if (ev.boss) {
        for (let i = 0; i < 4; i += 1) tone(a, { type: "sawtooth", freq: i % 2 ? 330 : 440, dur: 0.32, gain: 0.045, delay: 0.2 + i * 0.36, filter: "lowpass", cutoff: 1400 });
      } else {
        flock(a);
        chime(a, [76, 83], { step: 0.12, gain: 0.035 });
      }
      break;
    case "boss_intro":
      if ((a = ready("bossintro"))) {
        if (ev.kind === "reactor") {
          tone(a, { type: "sawtooth", freq: 55, dur: 1.6, gain: 0.08, attack: 0.6, filter: "lowpass", cutoff: 420 });
          tone(a, { type: "sawtooth", freq: 82.5, dur: 1.6, gain: 0.05, attack: 0.6, filter: "lowpass", cutoff: 420 });
          crackle(a, { count: 8, spread: 1.2, gain: 0.03, freq: 4500, delay: 0.3 });
        } else bossVoice(a, ev.kind, "intro");
      }
      break;
    case "boss_attack":
      if ((a = ready("bossattack", 0.4))) {
        noise(a, { dur: 0.4, gain: 0.1, filter: "bandpass", freq: 300, to: 160, q: 2 });
        tone(a, { type: "sawtooth", freq: 120, to: 85, dur: 0.4, gain: 0.06, filter: "lowpass", cutoff: 900 });
      }
      break;
    case "boss_shoot":
      if ((a = ready("bossshoot", 0.1))) tone(a, { freq: 180, to: 60, dur: 0.18, gain: 0.16, pan });
      break;
    case "boss_slam":
      if ((a = ready("slam", 0.2))) boom(a, 1.4, pan);
      break;
    case "beam_warn":
      if ((a = ready("beamwarn", 0.3))) tone(a, { type: "sawtooth", freq: 200, to: 900, dur: 0.9, gain: 0.04, filter: "lowpass", cutoff: 1600 });
      break;
    case "beam_fire":
      if ((a = ready("beamfire", 0.1))) {
        tone(a, { type: "sawtooth", freq: 110, dur: 0.7, gain: 0.08, filter: "lowpass", cutoff: 1400, pan });
        noise(a, { dur: 0.6, gain: 0.07, filter: "bandpass", freq: 1800, to: 600, pan });
      }
      break;
    case "missile":
      if ((a = ready("missile", 0.1))) noise(a, { dur: 0.3, gain: 0.06, filter: "bandpass", freq: 900, to: 2600, q: 3, pan, attack: 0.05 });
      break;
    case "boss_phase":
      if ((a = ready("phase", 0.5))) {
        noise(a, { dur: 0.8, gain: 0.12, filter: "bandpass", freq: 260, to: 120, q: 1.5 });
        tone(a, { type: "sawtooth", freq: 160, to: 70, dur: 0.8, gain: 0.08, filter: "lowpass", cutoff: 1100, vibrato: 9 });
        bossVoice(a, extra.boss, "angry");
      }
      break;
    case "part_down":
    case "boss_boom":
      if ((a = ready("bossboom", 0.08))) boom(a, ev.type === "part_down" ? 1.5 : 0.9, pan);
      break;
    case "boss_killed":
      if ((a = ready("bosskilled"))) {
        boom(a, 2.5);
        noise(a, { dur: 1.4, gain: 0.1, filter: "bandpass", freq: 3000, to: 200, q: 1 });
        if (ev.kind === "grandhen" || ev.kind === "ironrooster") voice(a, "bawk", { rate: 0.6, gain: 0.6, lowpass: 3000, reverb: 0.6, priority: true });
      }
      break;
    case "boss_dead":
      if ((a = ready("bossdead"))) {
        boom(a, 3);
        chime(a, [72, 76, 79, 84, 88, 91, 96], { step: 0.07, gain: 0.045, dur: 1.2 });
      }
      break;
    case "clear":
      if ((a = ready("clear", 0.5))) chime(a, ev.flawless ? [72, 76, 79, 84, 88, 91] : [72, 76, 79, 84], { step: 0.08, gain: 0.05, dur: 1 });
      break;
    case "warp":
      if ((a = ready("warp"))) {
        noise(a, { dur: 3, gain: 0.1, filter: "bandpass", freq: 200, to: 4000, q: 1.2, attack: 0.8 });
        tone(a, { type: "sawtooth", freq: 55, to: 440, dur: 3, gain: 0.05, filter: "lowpass", cutoff: 1200, attack: 0.6 });
      }
      break;
    default:
      break;
  }
}

/** Short stings for the end of a run. */
export function playSting(kind) {
  const a = ready(`sting:${kind}`, 0.5);
  if (!a) return;
  if (kind === "victory") {
    [[72, 0], [76, 0.15], [79, 0.3], [84, 0.45], [79, 0.7], [84, 0.85], [88, 1.0]].forEach(([n, d]) => bell(a, midi(n), { gain: 0.06, dur: 1.1, delay: d }));
    voice(a, "crow", { index: 1, gain: 0.5, delay: 1.5, reverb: 0.35, priority: true });
  } else {
    [[67, 0], [64, 0.3], [60, 0.6], [55, 0.9]].forEach(([n, d]) => tone(a, { type: "triangle", freq: midi(n), dur: 0.5, gain: 0.09, delay: d }));
    voice(a, "cackle", { gain: 0.38, delay: 0.4, reverb: 0.25, priority: true });
  }
}

export function playUi(kind = "click") {
  const a = ready(`ui:${kind}`, 0.05);
  if (!a) return;
  if (kind === "start") {
    chime(a, [72, 79, 84, 91], { step: 0.06, gain: 0.045 });
    voice(a, "cluck", { rate: 1.08, gain: 0.3, delay: 0.05 });
  } else if (kind === "pause") tone(a, { type: "triangle", freq: midi(76), to: midi(64), dur: 0.15, gain: 0.06 });
  else bell(a, midi(84), { gain: 0.035, dur: 0.3, ratio: 2, index: 0.6 });
}
