import { audio } from "./engine.js";

const NOTE = { C: 0, "C#": 1, D: 2, Eb: 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, Bb: 10, B: 11 };
const CHORD = { min: [0, 3, 7], maj: [0, 4, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], six: [0, 4, 7, 9] };
const TRANSPOSE = [0, 3, -2, 5];

const freq = (n) => 440 * 2 ** ((n - 69) / 12);

function note(name) {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}

/** "A4:0:2 C5:2:2 | ..." becomes a map from bar*16+step to [note, length]. */
function melody(text) {
  const events = new Map();
  const bars = text.split("|");
  bars.forEach((bar, b) => {
    for (const token of bar.trim().split(/\s+/)) {
      if (!token) continue;
      const [name, step, len] = token.split(":");
      events.set(b * 16 + Number(step), [note(name), Number(len)]);
    }
  });
  return { events, bars: bars.length };
}

const TRACKS = {
  menu: {
    bpm: 100,
    chords: [["C3", "maj7"], ["A2", "min7"], ["F2", "maj7"], ["G2", "six"]],
    lead: melody("E5:0:4 G5:4:4 B5:8:6 | A5:0:4 G5:4:2 E5:6:2 C5:8:8 | F5:0:4 A5:4:4 C6:8:6 | B5:0:4 A5:4:2 G5:6:2 D5:8:8"),
    leadType: "sine",
    bass: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null],
    bassType: "triangle",
    arpEvery: 2,
    arpType: "triangle",
    pad: true,
    drums: { kick: [0, 10], snare: [], hat: [2, 6, 10, 14], open: [] },
  },
  stage: {
    bpm: 132,
    chords: [["A2", "min"], ["F2", "maj"], ["C3", "maj"], ["G2", "maj"], ["A2", "min"], ["F2", "maj"], ["D3", "min"], ["E2", "maj"]],
    lead: melody(
      "A4:0:2 C5:2:2 E5:4:3 D5:7:1 C5:8:2 B4:10:2 A4:12:4 | F4:0:2 A4:2:2 C5:4:3 B4:7:1 A4:8:2 G4:10:2 F4:12:4 | " +
        "E5:0:2 G5:2:2 E5:4:2 C5:6:2 D5:8:2 E5:10:2 G5:12:4 | D5:0:3 B4:3:1 G4:4:4 A4:8:2 B4:10:2 D5:12:4 | " +
        "A5:0:2 G5:2:1 E5:3:1 C5:4:4 E5:8:2 D5:10:2 C5:12:4 | A4:0:2 C5:2:2 F5:4:4 E5:8:2 D5:10:2 C5:12:4 | " +
        "D5:0:2 F5:2:2 A5:4:4 G5:8:2 F5:10:2 E5:12:4 | E5:0:4 G#5:4:4 B5:8:4 G#5:12:2 E5:14:2",
    ),
    leadType: "square",
    bass: [0, null, 0, 12, null, 0, 12, null, 0, null, 0, 12, null, 7, 12, null],
    bassType: "sawtooth",
    arpEvery: 2,
    arpType: "triangle",
    pad: false,
    drums: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [14] },
  },
  boss: {
    bpm: 150,
    chords: [["D3", "min"], ["Bb2", "maj"], ["C3", "maj"], ["A2", "maj"]],
    lead: melody(
      "D5:0:2 D5:3:1 F5:4:2 E5:6:2 D5:8:2 A4:10:2 C5:12:2 D5:14:2 | D5:0:2 F5:2:2 Bb5:4:4 A5:8:2 F5:10:2 D5:12:4 | " +
        "E5:0:2 G5:2:2 C6:4:4 Bb5:8:2 G5:10:2 E5:12:4 | C#5:0:2 E5:2:2 A5:4:4 G5:8:2 E5:10:2 C#5:12:4",
    ),
    leadType: "sawtooth",
    bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 10, 0, 7, 0],
    bassType: "square",
    arpEvery: 0,
    pad: false,
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], open: [2, 6, 10, 14], fill: [13, 14, 15] },
  },
};

const MIX = { lead: 0.07, bass: 0.09, arp: 0.035, pad: 0.018 };

function voice(a, type, n, t, dur, gain, { cutoff = 3000, attack = 0.006, pluck = false, vibrato = 0, detune = 0 } = {}) {
  const ctx = a.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq(n), t);
  osc.detune.value = detune;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, t);
  if (pluck) f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.25), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(pluck ? gain * 0.25 : gain * 0.7, t + Math.max(attack + 0.01, dur * 0.8));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vibrato;
    depth.gain.value = 9;
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.12);
  }
  osc.connect(f);
  f.connect(g);
  g.connect(a.music);
  osc.start(t);
  osc.stop(t + dur + 0.12);
}

function drum(a, kind, t, accent = 1) {
  const ctx = a.ctx;
  if (kind === "kick") {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(0.5 * accent, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    g.connect(a.music);
    osc.start(t);
    osc.stop(t + 0.2);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const snare = kind === "snare";
  f.type = snare ? "bandpass" : "highpass";
  f.frequency.value = snare ? 1800 : 7500;
  const dur = snare ? 0.14 : kind === "open" ? 0.12 : 0.035;
  g.gain.setValueAtTime((snare ? 0.26 : 0.06) * accent, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(a.music);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
  if (snare) voice(a, "triangle", 54, t, 0.06, 0.08 * accent, { cutoff: 1200 });
}

function playStep(a, track, index, t, stepDur, shift) {
  const bar = Math.floor(index / 16);
  const s = index % 16;
  const [rootName, type] = track.chords[bar % track.chords.length];
  const root = note(rootName) + shift;
  const tones = CHORD[type];
  const b = track.bass[s];
  if (b != null) voice(a, track.bassType, root + b, t, stepDur * (track.pad ? 6 : 1.7), MIX.bass, { cutoff: 1100, pluck: true });
  if (track.arpEvery && s % track.arpEvery === 0) {
    const i = (s / track.arpEvery) % (tones.length + 1);
    const n = root + 24 + tones[i % tones.length] + (i >= tones.length ? 12 : 0);
    voice(a, track.arpType, n, t, stepDur * 1.6, MIX.arp, { cutoff: 2600, pluck: true });
  }
  if (track.pad && s === 0) {
    for (const off of tones) {
      for (const det of [-9, 9]) voice(a, "sawtooth", root + 12 + off, t, stepDur * 15, MIX.pad, { cutoff: 1100, attack: 0.5, detune: det });
    }
  }
  const lead = track.lead.events.get((bar % track.lead.bars) * 16 + s);
  if (lead) {
    const [n, len] = lead;
    const dur = len * stepDur * 0.92;
    voice(a, track.leadType, n + shift, t, dur, MIX.lead, { cutoff: track.leadType === "sine" ? 4000 : 2600, vibrato: len >= 3 ? 5.5 : 0 });
    if (track.leadType === "sine") voice(a, "triangle", n + shift + 12, t, dur * 0.6, MIX.lead * 0.25, { cutoff: 5000 });
  }
  const d = track.drums;
  if (d.kick.includes(s)) drum(a, "kick", t, s === 0 ? 1 : 0.8);
  if (d.snare.includes(s)) drum(a, "snare", t);
  if (d.fill && bar % track.chords.length === track.chords.length - 1 && d.fill.includes(s)) drum(a, "snare", t, 0.6);
  if (d.hat.includes(s)) drum(a, "hat", t, s % 4 === 0 ? 1 : 0.7);
  if (d.open.includes(s)) drum(a, "open", t);
}

const player = { timer: 0, key: "", track: null, index: 0, next: 0, shift: 0, tempo: 1 };

function tick() {
  const a = audio();
  if (!a || !player.track || !a.settings.music) return;
  const now = a.ctx.currentTime;
  if (player.next < now - 0.2) player.next = now + 0.05;
  const stepDur = 60 / (player.track.bpm * player.tempo) / 4;
  while (player.next < now + 0.12) {
    playStep(a, player.track, player.index, player.next, stepDur, player.shift);
    player.next += stepDur;
    player.index = (player.index + 1) % (player.track.chords.length * 16 * 2);
  }
}

/** Switches the background track; repeated calls with the same track are ignored. */
export function playMusic(name, chapter = 1) {
  const key = `${name}:${chapter}`;
  if (key === player.key) return;
  player.key = key;
  player.track = TRACKS[name] || null;
  player.shift = TRANSPOSE[(chapter - 1) % TRANSPOSE.length];
  player.tempo = 1 + (chapter - 1) * 0.03;
  player.index = 0;
  player.next = 0;
  if (player.track && !player.timer) player.timer = window.setInterval(tick, 25);
}

export function stopMusic() {
  player.key = "";
  player.track = null;
  if (player.timer) window.clearInterval(player.timer);
  player.timer = 0;
}
