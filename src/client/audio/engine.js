const STORAGE_KEY = "cluck-raid-audio";

const state = {
  ctx: null,
  sfx: null,
  music: null,
  noise: null,
  paused: false,
  settings: loadSettings(),
};

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

function build(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 16;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  comp.connect(master);
  master.connect(ctx.destination);

  state.sfx = ctx.createGain();
  state.sfx.connect(comp);

  state.music = ctx.createGain();
  const dry = ctx.createGain();
  const delay = ctx.createDelay(1);
  const feedback = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  delay.delayTime.value = 0.34;
  feedback.gain.value = 0.28;
  tone.type = "lowpass";
  tone.frequency.value = 2400;
  state.music.connect(dry);
  dry.connect(comp);
  state.music.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(comp);

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
  state.music.gain.setTargetAtTime(state.settings.music ? 0.34 : 0, now, 0.08);
}

/** Creates or resumes the audio context; call from a user gesture. */
export function unlockAudio() {
  if (!state.ctx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    state.ctx = new AudioCtor();
    build(state.ctx);
  }
  if (state.ctx.state === "suspended" && !state.paused) state.ctx.resume().catch(() => {});
  return state.ctx;
}

export function audio() {
  return state.ctx && state.ctx.state === "running" ? state : null;
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
