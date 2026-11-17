let ctx = null;

/** @param {string} kind @param {boolean} muted */
export function playTone(kind, muted) {
  if (muted || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const tone = {
    shoot: [660, 0.04, "square"],
    pop: [240, 0.07, "triangle"],
    gift: [880, 0.09, "square"],
    hurt: [96, 0.16, "sawtooth"],
    bomb: [150, 0.18, "sawtooth"],
    boss: [190, 0.22, "triangle"],
    clear: [540, 0.12, "square"],
    shield: [420, 0.08, "triangle"],
  }[kind] || [440, 0.05, "square"];
  const [freq, dur, type] = tone;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur);
}
