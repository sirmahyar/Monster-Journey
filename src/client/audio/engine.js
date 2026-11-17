const STORAGE_KEY = "cluck-raid-audio";

const state = {
  ctx: null,
  sfx: null,
  music: null,
  verb: null,
  echo: null,
  noise: null,
  paused: false,
  settings: loadSettings(),
};

const readyHooks = [];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { sfx: saved.sfx !== false, music: saved.music !== false };
  } catch {
    return { sfx: true, music: true };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  } catch {
    /* storage can be unavailable in private windows */
  }
}

/** A soft stereo room: decaying noise with a darker tail, slightly different per ear. */
function roomImpulse(ctx, seconds = 2.2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = ir.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / ctx.sampleRate;
      const white = Math.random() * 2 - 1;
      const k = Math.min(0.9, 0.25 + t * 0.4);
      smooth = smooth * k + white * (1 - k);
      const early = t < 0.012 ? 0 : 1;
      data[i] = smooth * early * Math.exp(-t * 3.1) * 1.6;
    }
  }
  return ir;
}

function build(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 18;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.92;
  comp.connect(master);
  master.connect(ctx.destination);

  const convolver = ctx.createConvolver();
  convolver.buffer = roomImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  state.verb = ctx.createGain();
  state.verb.connect(convolver);
  convolver.connect(wet);
  wet.connect(comp);

  state.sfx = ctx.createGain();
  state.sfx.connect(comp);
  const sfxSend = ctx.createGain();
  sfxSend.gain.value = 0.12;
  state.sfx.connect(sfxSend);
  sfxSend.connect(state.verb);

  state.music = ctx.createGain();
  state.music.connect(comp);
  const musicSend = ctx.createGain();
  musicSend.gain.value = 0.38;
  state.music.connect(musicSend);
  musicSend.connect(state.verb);

  state.echo = ctx.createDelay(2);
  state.echo.delayTime.value = 0.34;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const darken = ctx.createBiquadFilter();
  darken.type = "lowpass";
  darken.frequency.value = 2600;
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.55;
  state.echo.connect(darken);
  darken.connect(feedback);
  feedback.connect(state.echo);
  darken.connect(echoOut);
  echoOut.connect(state.music);

  const length = ctx.sampleRate;
  state.noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = state.noise.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  applySettings();
}

function applySettings() {
  if (!state.ctx) return;
  const now = state.ctx.currentTime;
  state.sfx.gain.setTargetAtTime(state.settings.sfx ? 0.85 : 0, now, 0.03);
  state.music.gain.setTargetAtTime(state.settings.music ? 0.42 : 0, now, 0.08);
}

/** Runs `fn(ctx)` once the audio context exists (right away if it already does). */
export function onAudioReady(fn) {
  if (state.ctx) fn(state.ctx);
  else readyHooks.push(fn);
}

/** Creates or resumes the audio context; call from a user gesture. */
export function unlockAudio() {
  if (!state.ctx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    state.ctx = new AudioCtor();
    build(state.ctx);
    for (const fn of readyHooks.splice(0)) fn(state.ctx);
  }
  if (state.ctx.state === "suspended" && !state.paused) state.ctx.resume().catch(() => {});
  return state.ctx;
}

export function audio() {
  return state.ctx && state.ctx.state === "running" ? state : null;
}

/** Destination for one sound: the bus itself, or a panner in front of it. */
export function output(a, bus, pan, t) {
  if (!pan) return bus;
  const p = a.ctx.createStereoPanner();
  p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
  p.connect(bus);
  return p;
}

export function audioSettings() {
  return { ...state.settings };
}

export function setAudioSetting(key, on) {
  state.settings[key] = on;
  saveSettings();
  applySettings();
}

/** Ducks everything while the game is paused or hidden. */
export function suspendAudio(paused) {
  state.paused = paused;
  if (!state.ctx) return;
  if (paused && state.ctx.state === "running") state.ctx.suspend().catch(() => {});
  if (!paused && state.ctx.state === "suspended") state.ctx.resume().catch(() => {});
}
