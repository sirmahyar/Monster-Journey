import { audio } from "./engine.js";

const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, Bb: 10, B: 11 };
const QUALITY = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  7: [0, 4, 7, 10],
  sus4: [0, 5, 7],
};
const TRANSPOSE = [0, 2, -3, 3];

const hz = (n) => 440 * 2 ** ((n - 69) / 12);

function note(name) {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}

/** Every pitch class lands inside one octave window, so neighbouring chords share notes and move smoothly. */
function voicing(chord, low) {
  return chord.tones.map((t) => low + ((((chord.root + t - low) % 12) + 12) % 12)).sort((x, y) => x - y);
}

/** "Em C G D" becomes [{ root, tones }]. */
function progression(text) {
  return text.trim().split(/\s+/).map((symbol) => {
    const m = /^([A-G](?:#|b)?)(.*)$/.exec(symbol);
    return { root: NOTE[m[1]], tones: QUALITY[m[2]] };
  });
}

/** "A4:0:2 C5:2:2 | ..." becomes a map from bar*16+step to [note, length in steps]. */
function melody(text) {
  const events = new Map();
  text.split("|").forEach((bar, b) => {
    for (const token of bar.trim().split(/\s+/)) {
      if (!token) continue;
      const [name, step, len] = token.split(":");
      events.set(b * 16 + Number(step), [note(name), Number(len)]);
    }
  });
  return events;
}

/** "0:0:2 12:4:1" (interval above the chord root : step : length) for bass lines. */
function rhythm(text) {
  const events = new Map();
  for (const token of text.trim().split(/\s+/)) {
    const [interval, step, len] = token.split(":").map(Number);
    events.set(step, [interval, len]);
  }
  return events;
}

const TRACKS = {
  menu: {
    bpm: 88,
    swing: 0.1,
    lead: "flute",
    bass: { kind: "round", line: rhythm("0:0:6 7:6:2 0:8:4 12:12:2 7:14:2") },
    pad: { level: 0.016, cutoff: 1300 },
    keys: [0, 10],
    arp: { every: 2, order: [0, 1, 2, 3, 2, 1, 0, 2], level: 0.016 },
    drums: { kick: [0, 7, 10], clap: [4, 12], hat: [2, 6, 10, 14], open: [], shaker: true, fill: [] },
    mix: { kick: 0.3, clap: 0.05, hat: 0.026, shaker: 0.011 },
    sections: [
      {
        chords: progression("Fmaj7 Em7 Dm7 Cmaj7 Fmaj7 Em7 Dm7 G"),
        melody: melody(
          "A5:0:3 G5:3:1 E5:4:4 C5:8:2 E5:10:2 G5:12:4 | B5:0:3 A5:3:1 G5:4:4 E5:8:4 D5:12:4 | " +
            "F5:0:3 E5:3:1 D5:4:4 A4:8:2 C5:10:2 F5:12:4 | E5:0:8 D5:8:2 E5:10:2 G5:12:4 | " +
            "A5:0:3 C6:3:1 B5:4:2 A5:6:2 G5:8:4 E5:12:4 | G5:0:3 B5:3:1 A5:4:2 G5:6:2 E5:8:4 B4:12:4 | " +
            "D5:0:2 F5:2:2 A5:4:4 G5:8:2 F5:10:2 E5:12:2 D5:14:2 | D5:0:4 B4:4:4 D5:8:4 G5:12:4",
        ),
      },
    ],
  },
  stage: {
    bpm: 120,
    swing: 0.05,
    lead: "synth",
    bass: { kind: "round", line: rhythm("0:0:2 0:3:1 12:4:2 0:6:2 0:8:2 0:11:1 12:12:2 7:14:2") },
    pad: { level: 0.014, cutoff: 1500 },
    keys: null,
    arp: { every: 2, order: [0, 2, 1, 2, 3, 2, 1, 2], level: 0.014 },
    drums: { kick: [0, 7, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [14], shaker: true, fill: [12, 13, 14, 15] },
    mix: { kick: 0.42, snare: 0.15, clap: 0.08, hat: 0.034, shaker: 0.012 },
    sections: [
      {
        chords: progression("Em C G D Em C Am B"),
        melody: melody(
          "B4:0:2 E5:2:2 G5:4:3 F#5:7:1 E5:8:2 D5:10:2 E5:12:4 | E5:0:2 G5:2:2 C6:4:3 B5:7:1 G5:8:4 E5:12:4 | " +
            "D5:0:2 G5:2:2 B5:4:3 A5:7:1 G5:8:2 F#5:10:2 G5:12:4 | F#5:0:3 E5:3:1 D5:4:4 A4:8:2 D5:10:2 F#5:12:4 | " +
            "B5:0:3 A5:3:1 G5:4:2 F#5:6:2 E5:8:4 G5:12:2 B5:14:2 | C6:0:3 B5:3:1 A5:4:2 G5:6:2 E5:8:4 C5:12:4 | " +
            "A5:0:2 G5:2:2 E5:4:2 C5:6:2 D5:8:2 E5:10:2 A5:12:4 | B5:0:4 A5:4:2 G5:6:2 F#5:8:4 D#5:12:4",
        ),
      },
      {
        chords: progression("C D Bm Em C D B7 B7"),
        melody: melody(
          "G5:0:4 E5:4:2 G5:6:2 C6:8:6 B5:14:2 | A5:0:4 F#5:4:2 A5:6:2 D6:8:6 C6:14:2 | " +
            "B5:0:4 A5:4:2 F#5:6:2 D5:8:4 F#5:12:4 | E5:0:6 G5:6:2 B5:8:8 | " +
            "C6:0:4 B5:4:2 A5:6:2 G5:8:4 E5:12:4 | D6:0:4 C6:4:2 B5:6:2 A5:8:4 F#5:12:4 | " +
            "B5:0:6 A5:6:2 G5:8:4 F#5:12:4 | D#5:0:4 F#5:4:4 B5:8:4 A5:12:4",
        ),
        sparkle: true,
        clap: true,
      },
    ],
  },
  boss: {
    bpm: 138,
    swing: 0,
    lead: "brass",
    bass: { kind: "pluck", line: rhythm("0:0:1 0:1:1 12:2:1 0:3:1 0:4:1 0:5:1 12:6:1 0:7:1 0:8:1 0:9:1 12:10:1 0:11:1 7:12:1 7:13:1 10:14:1 12:15:1") },
    pad: { level: 0.013, cutoff: 900 },
    keys: null,
    arp: { every: 2, order: [0, 1, 2, 1], level: 0.012 },
    drums: { kick: [0, 3, 8, 10], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [6, 14], shaker: false, fill: [8, 10, 12, 13, 14, 15] },
    mix: { kick: 0.46, snare: 0.17, clap: 0.09, hat: 0.026, shaker: 0 },
    sections: [
      {
        chords: progression("Dm Bb C A Dm Bb Gm A"),
        melody: melody(
          "D5:0:3 A4:3:1 D5:4:2 E5:6:2 F5:8:4 E5:12:2 D5:14:2 | F5:0:3 D5:3:1 F5:4:2 G5:6:2 A5:8:4 G5:12:2 F5:14:2 | " +
            "G5:0:3 E5:3:1 G5:4:2 A5:6:2 Bb5:8:4 A5:12:2 G5:14:2 | A5:0:6 G5:6:2 F5:8:2 E5:10:2 C#5:12:4 | " +
            "D6:0:4 A5:4:4 F5:8:4 D5:12:4 | D6:0:4 Bb5:4:4 F5:8:4 D5:12:4 | " +
            "G5:0:3 A5:3:1 Bb5:4:4 A5:8:2 G5:10:2 F5:12:2 E5:14:2 | E5:0:4 C#5:4:4 A4:8:4 E5:12:2 G5:14:2",
        ),
        clap: true,
      },
      {
        chords: progression("Bb C Dm Dm Bb C A A"),
        melody: melody(
          "F5:0:2 G5:2:2 A5:4:2 Bb5:6:2 D6:8:4 C6:12:2 Bb5:14:2 | C6:0:2 Bb5:2:2 A5:4:2 G5:6:2 E5:8:4 G5:12:4 | " +
            "A5:0:4 F5:4:4 D5:8:4 F5:12:2 A5:14:2 | D6:0:8 C6:8:2 A5:10:2 F5:12:4 | " +
            "Bb5:0:2 A5:2:2 Bb5:4:2 D6:6:2 F6:8:4 D6:12:4 | E6:0:2 D6:2:2 C6:4:2 G5:6:2 E5:8:4 C6:12:4 | " +
            "C#6:0:4 A5:4:4 E5:8:4 C#5:12:4 | E5:0:2 F5:2:2 G5:4:2 A5:6:2 Bb5:8:2 A5:10:2 G5:12:2 E5:14:2",
        ),
        sparkle: true,
        clap: true,
      },
    ],
  },
};

const player = { timer: 0, key: "", track: null, ctx: null, bus: null, duck: null, echo: null, step: 0, next: 0, shift: 0, tempo: 1, last: null };

function envelope(g, t, peak, attack, dur, release, sustain = 0.8) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(peak * sustain, t + attack, Math.max(0.02, dur * 0.4));
  g.gain.setTargetAtTime(0.0001, t + dur, release / 4);
}

function osc(ctx, type, f, t, end, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.start(t);
  o.stop(end);
  return o;
}

function pad(a, notes, t, dur, { level, cutoff }) {
  const ctx = a.ctx;
  const end = t + dur + 1.2;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = 0.6;
  f.frequency.setValueAtTime(cutoff * 0.55, t);
  f.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.7);
  const g = ctx.createGain();
  envelope(g, t, level, Math.min(0.35, dur * 0.25), dur, 1.1, 0.9);
  f.connect(g);
  g.connect(player.duck);
  for (const n of notes) {
    for (const det of [-8, 7]) osc(ctx, "sawtooth", hz(n), t, end, det).connect(f);
    osc(ctx, "triangle", hz(n - 12), t, end).connect(f);
  }
}

/** Electric-piano chord: FM sine pairs whose brightness fades as the note rings. */
function keys(a, notes, t, dur) {
  const ctx = a.ctx;
  const end = t + dur + 0.6;
  for (const n of notes) {
    const carrier = osc(ctx, "sine", hz(n), t, end);
    const mod = osc(ctx, "sine", hz(n), t, end);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(hz(n) * 1.4, t);
    depth.gain.exponentialRampToValueAtTime(hz(n) * 0.15, t + 0.5);
    mod.connect(depth);
    depth.connect(carrier.frequency);
    const g = ctx.createGain();
    envelope(g, t, 0.026, 0.006, dur, 0.5, 0.4);
    carrier.connect(g);
    g.connect(player.duck);
  }
}

function bell(a, n, t, level, dest) {
  const ctx = a.ctx;
  const f = hz(n);
  const carrier = osc(ctx, "sine", f, t, t + 1);
  const mod = osc(ctx, "sine", f * 3.5, t, t + 1);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(f * 1.1, t);
  depth.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.5);
  mod.connect(depth);
  depth.connect(carrier.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  carrier.connect(g);
  g.connect(dest);
  g.connect(player.echo);
}

const LEADS = {
  flute: { waves: [["triangle", 0], ["sine", 1200]], attack: 0.04, level: 0.07, cutoff: [3200, 3200, 3200], vibrato: 12, breath: true },
  synth: { waves: [["sawtooth", -6], ["sawtooth", 6]], attack: 0.012, level: 0.034, cutoff: [1300, 3400, 2100], vibrato: 9, breath: false },
  brass: { waves: [["sawtooth", -10], ["sawtooth", 10], ["square", -1200]], attack: 0.03, level: 0.03, cutoff: [500, 2600, 1500], vibrato: 7, breath: false },
};

function lead(a, kind, n, t, dur, until) {
  const ctx = a.ctx;
  const spec = LEADS[kind];
  const f = hz(n);
  const end = t + dur + 0.3;
  const prev = player.last;
  const glide = prev && Math.abs(prev.t - t) < 0.01 && Math.abs(prev.n - n) <= 7;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.8;
  const [c0, c1, c2] = spec.cutoff;
  filter.frequency.setValueAtTime(c0, t);
  filter.frequency.exponentialRampToValueAtTime(c1, t + 0.04);
  filter.frequency.exponentialRampToValueAtTime(c2, t + 0.3);
  const g = ctx.createGain();
  envelope(g, t, spec.level, spec.attack, dur, 0.14, 0.82);
  filter.connect(g);
  g.connect(player.bus);
  g.connect(player.echo);
  const wobble = ctx.createGain();
  wobble.gain.setValueAtTime(0, t);
  if (dur > 0.3) {
    wobble.gain.setValueAtTime(0, t + 0.14);
    wobble.gain.linearRampToValueAtTime(spec.vibrato, t + 0.45);
  }
  const lfo = osc(ctx, "sine", 5.3, t, end);
  lfo.connect(wobble);
  for (const [type, detune] of spec.waves) {
    const o = osc(ctx, type, glide ? hz(prev.n) : f, t, end, detune);
    if (glide) o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    wobble.connect(o.detune);
    o.connect(filter);
  }
  if (spec.breath) {
    const src = ctx.createBufferSource();
    src.buffer = a.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f * 2;
    bp.Q.value = 0.7;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(0.012, t + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp);
    bp.connect(bg);
    bg.connect(player.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.2);
  }
  player.last = { n, t: until };
}

function bass(a, kind, n, t, dur) {
  const ctx = a.ctx;
  const end = t + dur + 0.25;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  const g = ctx.createGain();
  if (kind === "round") {
    f.frequency.value = 900;
    osc(ctx, "sine", hz(n), t, end).connect(f);
    const upper = ctx.createGain();
    upper.gain.value = 0.3;
    osc(ctx, "triangle", hz(n + 12), t, end).connect(upper);
    upper.connect(f);
    envelope(g, t, 0.16, 0.008, dur, 0.12, 0.7);
  } else {
    f.frequency.setValueAtTime(1900, t);
    f.frequency.exponentialRampToValueAtTime(280, t + Math.max(0.08, dur));
    f.Q.value = 3;
    osc(ctx, "sawtooth", hz(n), t, end).connect(f);
    osc(ctx, "sine", hz(n), t, end).connect(f);
    envelope(g, t, 0.09, 0.004, dur, 0.08, 0.6);
  }
  f.connect(g);
  g.connect(player.bus);
}

function hit(a, t, { filter, freq, q = 1, dur, level, attack = 0.001 }) {
  const ctx = a.ctx;
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(player.bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function thump(a, t, from, to, fall, dur, level) {
  const o = osc(a.ctx, "sine", from, t, t + dur + 0.05);
  o.frequency.exponentialRampToValueAtTime(to, t + fall);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(player.bus);
}

function drum(a, kind, t, level) {
  const ctx = a.ctx;
  if (kind === "kick") {
    thump(a, t, 150, 46, 0.11, 0.32, level);
    hit(a, t, { filter: "highpass", freq: 2600, dur: 0.012, level: level * 0.18 });
    player.duck.gain.setValueAtTime(0.45, t);
    player.duck.gain.linearRampToValueAtTime(1, t + 0.24);
  } else if (kind === "snare") {
    hit(a, t, { filter: "bandpass", freq: 1900, q: 0.9, dur: 0.2, level });
    const o = osc(ctx, "triangle", 190, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g);
    g.connect(player.bus);
  } else if (kind === "clap") {
    for (const d of [0, 0.011, 0.022]) hit(a, t + d, { filter: "bandpass", freq: 1300, q: 1.3, dur: 0.012, level });
    hit(a, t + 0.03, { filter: "bandpass", freq: 1200, q: 1.1, dur: 0.16, level: level * 0.7 });
  } else if (kind === "hat") hit(a, t, { filter: "highpass", freq: 7800, dur: 0.035, level });
  else if (kind === "open") hit(a, t, { filter: "highpass", freq: 7000, dur: 0.2, level });
  else if (kind === "shaker") hit(a, t, { filter: "bandpass", freq: 5600, q: 1.4, dur: 0.05, level, attack: 0.012 });
}

const human = (amount) => (Math.random() * 2 - 1) * amount;

function playStep(a, track, index, t, stepDur) {
  const s = index % 16;
  const barIndex = Math.floor(index / 16);
  const section = track.sections[Math.floor(barIndex / 8) % track.sections.length];
  const bar = barIndex % 8;
  const shift = player.shift;
  const chord = { root: section.chords[bar].root + shift, tones: section.chords[bar].tones };
  const barDur = stepDur * 16;

  if (s === 0) pad(a, voicing(chord, 55), t, barDur, track.pad);
  if (track.keys && track.keys.includes(s)) keys(a, voicing(chord, 60), t, s === 0 ? stepDur * 9 : stepDur * 5);

  const b = track.bass.line.get(s);
  if (b) bass(a, track.bass.kind, voicing({ root: chord.root, tones: [0] }, 36)[0] + b[0], t, b[1] * stepDur * 0.9);

  if (track.arp && s % track.arp.every === 0) {
    const tones = voicing(chord, 72);
    const k = track.arp.order[(s / track.arp.every) % track.arp.order.length] % tones.length;
    bell(a, tones[k], t + human(0.004), track.arp.level * (section.sparkle ? 1.4 : 1), player.duck);
  }

  const m = section.melody.get(bar * 16 + s);
  if (m) {
    const dur = m[1] * stepDur;
    lead(a, track.lead, m[0] + shift, t, dur * 0.94, t + dur);
    if (section.sparkle) bell(a, m[0] + shift + 12, t, 0.016, player.bus);
  }

  const d = track.drums;
  const mix = track.mix;
  const fill = bar === 7 && d.fill.includes(s);
  if (fill) thump(a, t, 210 - d.fill.indexOf(s) * 22, 130 - d.fill.indexOf(s) * 14, 0.2, 0.3, 0.22);
  if (d.kick.includes(s)) drum(a, "kick", t, mix.kick * (s === 0 ? 1 : 0.85));
  if (!fill && d.snare?.includes(s)) drum(a, "snare", t, mix.snare);
  if (!fill && (d.clap?.includes(s) || (section.clap && d.snare?.includes(s)))) drum(a, "clap", t + 0.004, mix.clap);
  if (d.hat.includes(s)) drum(a, "hat", t + human(0.003), mix.hat * (s % 4 === 0 ? 1 : 0.6 + Math.random() * 0.25));
  if (d.open.includes(s)) drum(a, "open", t, mix.hat * 0.8);
  if (d.shaker) drum(a, "shaker", t + human(0.004), mix.shaker * (s % 2 ? 0.7 : 1));
}

function attach(a) {
  const ctx = a.ctx;
  const now = ctx.currentTime;
  player.ctx = ctx;
  player.bus = ctx.createGain();
  player.bus.gain.setValueAtTime(0.0001, now);
  player.bus.gain.exponentialRampToValueAtTime(1, now + 0.9);
  player.bus.connect(a.music);
  player.duck = ctx.createGain();
  player.duck.connect(player.bus);
  player.echo = ctx.createGain();
  player.echo.gain.value = 0.3;
  player.echo.connect(a.echo);
  const stepDur = 60 / (player.track.bpm * player.tempo) / 4;
  a.echo.delayTime.setTargetAtTime(stepDur * 3, now, 0.05);
  player.last = null;
}

/** Fades the current track out; its notes already scheduled ring out under the fade. */
function release(fade) {
  const { bus, echo, ctx } = player;
  player.bus = null;
  player.duck = null;
  player.echo = null;
  if (!bus) return;
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setTargetAtTime(0.0001, now, fade);
  echo.gain.setTargetAtTime(0, now, fade);
  window.setTimeout(() => {
    bus.disconnect();
    echo.disconnect();
  }, fade * 8000);
}

function tick() {
  const a = audio();
  if (!a || !player.track || !a.settings.music) return;
  if (!player.bus) attach(a);
  const now = a.ctx.currentTime;
  if (player.next < now - 0.2) player.next = now + 0.06;
  const stepDur = 60 / (player.track.bpm * player.tempo) / 4;
  while (player.next < now + 0.14) {
    const swing = player.step % 2 === 1 ? stepDur * player.track.swing : 0;
    playStep(a, player.track, player.step, player.next + swing, stepDur);
    player.next += stepDur;
    player.step += 1;
  }
}

/** Switches the background track with a crossfade; repeated calls with the same track are ignored. */
export function playMusic(name, chapter = 1) {
  const key = `${name}:${chapter}`;
  if (key === player.key) return;
  release(0.45);
  player.key = key;
  player.track = TRACKS[name] || null;
  player.shift = name === "menu" ? 0 : TRANSPOSE[(chapter - 1) % TRANSPOSE.length];
  player.tempo = 1 + (chapter - 1) * 0.025;
  player.step = 0;
  player.next = 0;
  if (player.track && !player.timer) player.timer = window.setInterval(tick, 25);
}

export function stopMusic() {
  release(0.2);
  player.key = "";
  player.track = null;
  if (player.timer) window.clearInterval(player.timer);
  player.timer = 0;
}
