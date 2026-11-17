import { W } from "../../game/config.js";
import { audio } from "./engine.js";

const last = new Map();

function ready(name, gap) {
  const a = audio();
  if (!a || !a.settings.sfx) return null;
  const now = a.ctx.currentTime;
  if (gap && now - (last.get(name) ?? -1) < gap) return null;
  last.set(name, now);
  return a;
}

function out(a, pan, t) {
  if (!pan) return a.sfx;
  const p = a.ctx.createStereoPanner();
  p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
  p.connect(a.sfx);
  return p;
}

function tone(a, { type = "square", freq, to, dur, gain = 0.15, attack = 0.004, delay = 0, pan = 0, filter, cutoff = 2000, q = 1, vibrato = 0 }) {
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
    depth.gain.value = freq * 0.06;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  node.connect(g);
  g.connect(out(a, pan, t));
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(a, { dur, gain = 0.2, filter = "bandpass", freq = 1200, to, q = 1, delay = 0, pan = 0, attack = 0.003 }) {
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
  g.connect(out(a, pan, t));
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const panOf = (x) => (typeof x === "number" ? (x / W - 0.5) * 0.9 : 0);
const jitter = (v, amount = 0.08) => v * (1 + (Math.random() * 2 - 1) * amount);

function arpeggio(a, notes, { step = 0.07, type = "triangle", gain = 0.12, dur = 0.16 } = {}) {
  notes.forEach((n, i) => tone(a, { type, freq: midi(n), dur, gain, delay: i * step }));
}

function cluck(a, pitch, pan, gain = 0.14) {
  tone(a, { type: "square", freq: 620 * pitch, to: 980 * pitch, dur: 0.05, gain: gain * 0.7, filter: "bandpass", cutoff: 1300, q: 3, pan });
  tone(a, { type: "square", freq: 940 * pitch, to: 470 * pitch, dur: 0.13, gain, filter: "bandpass", cutoff: 1100, q: 3, delay: 0.07, pan, vibrato: 34 });
}

function boom(a, size = 1, pan = 0) {
  noise(a, { dur: 0.5 * size, gain: 0.35 * Math.min(1.4, size), filter: "lowpass", freq: 1800, to: 120, pan });
  tone(a, { type: "sine", freq: 150, to: 32, dur: 0.45 * size, gain: 0.45 * Math.min(1.3, size), pan });
}

const KILL_PITCH = { chick: 1.5, hen: 1, diver: 1.1, bomber: 0.85, rooster: 0.72, saucer: 1.25, golden: 1.3 };
const SHOT = {
  pulse: (a, pan) => {
    tone(a, { type: "square", freq: jitter(920, 0.04), to: 380, dur: 0.07, gain: 0.05, filter: "lowpass", cutoff: 3200, pan });
    noise(a, { dur: 0.03, gain: 0.04, filter: "highpass", freq: 4000, pan });
  },
  laser: (a, pan) => tone(a, { type: "sawtooth", freq: jitter(1500, 0.03), to: 760, dur: 0.06, gain: 0.04, filter: "bandpass", cutoff: 2200, q: 2, pan }),
  ion: (a, pan) => tone(a, { type: "sine", freq: jitter(480, 0.04), to: 1080, dur: 0.13, gain: 0.08, pan, vibrato: 22 }),
};

/** Plays the sound that belongs to one simulation event. */
export function playEvent(ev, extra = {}) {
  const pan = panOf(ev.x);
  let a;
  switch (ev.type) {
    case "shot":
      if ((a = ready("shot", 0.045))) SHOT[ev.weapon](a, pan * 0.5);
      break;
    case "hit":
    case "boss_hit":
      if ((a = ready("hit", 0.035))) {
        if (ev.armored) tone(a, { type: "square", freq: 2200, to: 1800, dur: 0.03, gain: 0.03, pan });
        else {
          noise(a, { dur: 0.04, gain: 0.07, filter: "highpass", freq: 2500, pan });
          tone(a, { type: "triangle", freq: jitter(340), to: 220, dur: 0.05, gain: 0.06, pan });
        }
      }
      break;
    case "boss_immune":
      if ((a = ready("immune", 0.08))) tone(a, { type: "square", freq: 2600, dur: 0.025, gain: 0.025, pan });
      break;
    case "kill":
      if (!(a = ready("kill", 0.028))) break;
      if (ev.kind === "rock") {
        noise(a, { dur: 0.22 + ev.size * 0.06, gain: 0.18, filter: "lowpass", freq: 900, to: 150, pan });
        tone(a, { type: "sine", freq: 130, to: 40, dur: 0.2, gain: 0.2, pan });
        break;
      }
      tone(a, { type: "sine", freq: jitter(620), to: 110, dur: 0.12, gain: 0.22, pan });
      noise(a, { dur: 0.14, gain: 0.1, filter: "lowpass", freq: 2400, to: 400, pan });
      if (ready("cluck", 0.09)) cluck(a, jitter(KILL_PITCH[ev.kind] || 1, 0.1), pan, 0.09);
      if (ev.kind === "golden") arpeggio(a, [84, 88, 91, 96, 100], { step: 0.05, type: "sine", gain: 0.1 });
      break;
    case "egg":
      if ((a = ready("egg", 0.07))) {
        if (ev.egg === "spark") tone(a, { type: "sawtooth", freq: 1200, to: 300, dur: 0.09, gain: 0.04, filter: "lowpass", cutoff: 2500, pan });
        else if (ev.egg === "quill") noise(a, { dur: 0.08, gain: 0.06, filter: "bandpass", freq: 3000, to: 1200, q: 3, pan });
        else tone(a, { type: "sine", freq: jitter(320), to: 560, dur: 0.08, gain: 0.05, pan });
      }
      break;
    case "dive":
      if ((a = ready("dive", 0.3))) cluck(a, jitter(1.15, 0.1), pan, 0.13);
      break;
    case "splat":
      if ((a = ready("splat", 0.06))) {
        noise(a, { dur: 0.14, gain: 0.08, filter: "lowpass", freq: 700, to: 200, pan });
        tone(a, { type: "sine", freq: 200, to: 70, dur: 0.1, gain: 0.07, pan });
      }
      break;
    case "pickup":
      if (!(a = ready(`pickup:${ev.kind}`, 0.04))) break;
      if (ev.kind === "kernel" || ev.kind === "cob") tone(a, { type: "triangle", freq: midi(88 + ((extra.food || 0) % 8)), dur: 0.08, gain: 0.07, pan });
      else if (ev.kind === "crate") arpeggio(a, [72, 79, 84, 91], { step: 0.05 });
      else if (ev.kind === "power") arpeggio(a, [72, 76, 79, 84], { step: 0.05, type: "square", gain: 0.06 });
      else if (ev.kind === "life") arpeggio(a, [76, 79, 84, 88, 91], { step: 0.08, gain: 0.12 });
      else if (ev.kind === "shield") tone(a, { type: "sine", freq: 300, to: 900, dur: 0.35, gain: 0.12, vibrato: 12 });
      else if (ev.kind === "coolant") {
        noise(a, { dur: 0.35, gain: 0.08, filter: "highpass", freq: 6000, to: 2000 });
        arpeggio(a, [96, 100, 103], { step: 0.06, type: "sine", gain: 0.06 });
      } else arpeggio(a, [79, 86], { step: 0.08, type: "sine" });
      break;
    case "levelup":
    case "weapon":
      if ((a = ready("levelup", 0.1))) arpeggio(a, [72, 76, 79, 84, 88], { step: 0.055, type: "square", gain: 0.05, dur: 0.2 });
      break;
    case "bomb_gain":
      if ((a = ready("bombgain", 0.2))) arpeggio(a, [84, 91, 96], { step: 0.06, type: "sine", gain: 0.1 });
      break;
    case "overheat":
      if ((a = ready("overheat", 0.5))) {
        for (let i = 0; i < 3; i += 1) tone(a, { type: "square", freq: i % 2 ? 660 : 880, dur: 0.09, gain: 0.06, delay: i * 0.11, filter: "lowpass", cutoff: 2500 });
        noise(a, { dur: 0.6, gain: 0.08, filter: "highpass", freq: 3000, delay: 0.1 });
      }
      break;
    case "cooled":
      if ((a = ready("cooled", 0.3))) tone(a, { type: "sine", freq: midi(91), dur: 0.15, gain: 0.06 });
      break;
    case "nova_launch":
      if ((a = ready("novalaunch"))) noise(a, { dur: 0.5, gain: 0.16, filter: "bandpass", freq: 400, to: 3200, q: 2 });
      break;
    case "nova":
      if (ev.quiet || !(a = ready("nova"))) break;
      boom(a, 2.2);
      tone(a, { type: "sawtooth", freq: 90, to: 30, dur: 1.2, gain: 0.2, filter: "lowpass", cutoff: 600 });
      noise(a, { dur: 1.2, gain: 0.12, filter: "highpass", freq: 3000, to: 800, delay: 0.05 });
      break;
    case "death":
      if ((a = ready("death"))) {
        boom(a, 2, pan);
        tone(a, { type: "square", freq: 420, to: 70, dur: 0.7, gain: 0.08, filter: "lowpass", cutoff: 1500 });
      }
      break;
    case "respawn":
      if ((a = ready("respawn"))) arpeggio(a, [67, 71, 74, 79, 83], { step: 0.06, type: "sine", gain: 0.08 });
      break;
    case "shield_hit":
      if ((a = ready("shieldhit", 0.06))) tone(a, { type: "triangle", freq: 900, to: 600, dur: 0.06, gain: 0.05, pan });
      break;
    case "shield_break":
      if ((a = ready("shieldbreak", 0.1))) noise(a, { dur: 0.25, gain: 0.14, filter: "highpass", freq: 3500, pan });
      break;
    case "shield_block":
      if ((a = ready("block", 0.06))) tone(a, { type: "sine", freq: 1400, to: 1900, dur: 0.06, gain: 0.06, pan });
      break;
    case "yolk_split":
    case "pop":
      if ((a = ready("pop", 0.06))) tone(a, { type: "sine", freq: 500, to: 180, dur: 0.09, gain: 0.08, pan });
      break;
    case "rock_split":
      break;
    case "combo":
      if ((a = ready("combo", 0.1))) tone(a, { type: "square", freq: midi(72 + Math.min(10, ev.mult) * 2), dur: 0.12, gain: 0.05, filter: "lowpass", cutoff: 3000 });
      break;
    case "golden":
      if ((a = ready("golden"))) arpeggio(a, [88, 91, 95, 100, 103, 107], { step: 0.05, type: "sine", gain: 0.07 });
      break;
    case "wave":
      if ((a = ready("wave", 0.5))) {
        noise(a, { dur: 0.6, gain: 0.07, filter: "bandpass", freq: 600, to: 2400, q: 1.5 });
        if (ev.boss) for (let i = 0; i < 4; i += 1) tone(a, { type: "sawtooth", freq: i % 2 ? 330 : 440, dur: 0.32, gain: 0.07, delay: 0.2 + i * 0.36, filter: "lowpass", cutoff: 1800 });
        else arpeggio(a, [76, 83], { step: 0.12, type: "triangle", gain: 0.08, dur: 0.3 });
      }
      break;
    case "boss_attack":
      if ((a = ready("bossattack", 0.4))) {
        noise(a, { dur: 0.4, gain: 0.12, filter: "bandpass", freq: 300, to: 160, q: 2 });
        tone(a, { type: "sawtooth", freq: 120, to: 85, dur: 0.4, gain: 0.08, filter: "lowpass", cutoff: 900 });
      }
      break;
    case "boss_shoot":
      if ((a = ready("bossshoot", 0.1))) tone(a, { type: "sine", freq: 180, to: 60, dur: 0.18, gain: 0.18, pan });
      break;
    case "boss_slam":
      if ((a = ready("slam", 0.2))) boom(a, 1.4, pan);
      break;
    case "beam_warn":
      if ((a = ready("beamwarn", 0.3))) tone(a, { type: "sawtooth", freq: 200, to: 900, dur: 0.9, gain: 0.05, filter: "lowpass", cutoff: 1600 });
      break;
    case "beam_fire":
      if ((a = ready("beamfire", 0.1))) {
        tone(a, { type: "sawtooth", freq: 110, dur: 0.7, gain: 0.1, filter: "lowpass", cutoff: 1400, pan });
        noise(a, { dur: 0.6, gain: 0.08, filter: "bandpass", freq: 1800, to: 600, pan });
      }
      break;
    case "missile":
      if ((a = ready("missile", 0.1))) noise(a, { dur: 0.25, gain: 0.07, filter: "bandpass", freq: 900, to: 2600, q: 3, pan });
      break;
    case "boss_phase":
      if ((a = ready("phase", 0.5))) {
        noise(a, { dur: 0.8, gain: 0.16, filter: "bandpass", freq: 260, to: 120, q: 1.5 });
        tone(a, { type: "sawtooth", freq: 160, to: 70, dur: 0.8, gain: 0.12, filter: "lowpass", cutoff: 1100, vibrato: 9 });
      }
      break;
    case "part_down":
    case "boss_boom":
      if ((a = ready("bossboom", 0.08))) boom(a, ev.type === "part_down" ? 1.5 : 0.9, pan);
      break;
    case "boss_killed":
      if ((a = ready("bosskilled"))) {
        boom(a, 2.5);
        noise(a, { dur: 1.4, gain: 0.12, filter: "bandpass", freq: 3000, to: 200, q: 1 });
      }
      break;
    case "boss_dead":
      if ((a = ready("bossdead"))) {
        boom(a, 3);
        arpeggio(a, [72, 76, 79, 84, 88, 91, 96], { step: 0.07, type: "square", gain: 0.05, dur: 0.3 });
      }
      break;
    case "clear":
      if ((a = ready("clear", 0.5))) arpeggio(a, ev.flawless ? [72, 76, 79, 84, 88, 91] : [72, 76, 79, 84], { step: 0.08, gain: 0.1, dur: 0.25 });
      break;
    case "warp":
      if ((a = ready("warp"))) {
        noise(a, { dur: 3, gain: 0.12, filter: "bandpass", freq: 200, to: 4000, q: 1.2, attack: 0.8 });
        tone(a, { type: "sawtooth", freq: 55, to: 440, dur: 3, gain: 0.07, filter: "lowpass", cutoff: 1200, attack: 0.6 });
      }
      break;
    case "life":
      break;
    default:
      break;
  }
}

/** Short melodic stings for the end of a run. */
export function playSting(kind) {
  const a = ready(`sting:${kind}`, 0.5);
  if (!a) return;
  if (kind === "victory") {
    [[72, 0], [76, 0.15], [79, 0.3], [84, 0.45], [79, 0.7], [84, 0.85], [88, 1.0]].forEach(([n, d]) => tone(a, { type: "square", freq: midi(n), dur: 0.35, gain: 0.07, delay: d, filter: "lowpass", cutoff: 3000 }));
  } else {
    [[67, 0], [64, 0.3], [60, 0.6], [55, 0.9]].forEach(([n, d]) => tone(a, { type: "triangle", freq: midi(n), dur: 0.45, gain: 0.12, delay: d }));
  }
}

export function playUi(kind = "click") {
  const a = ready(`ui:${kind}`, 0.05);
  if (!a) return;
  if (kind === "start") arpeggio(a, [72, 79, 84, 91], { step: 0.06, type: "square", gain: 0.05 });
  else if (kind === "pause") tone(a, { type: "triangle", freq: midi(76), to: midi(64), dur: 0.15, gain: 0.08 });
  else tone(a, { type: "triangle", freq: midi(84), dur: 0.06, gain: 0.06 });
}
