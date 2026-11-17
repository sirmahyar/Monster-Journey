import { useEffect, useRef } from "react";
import { CHAPTERS, WORLD_H, WORLD_W, createRun, step } from "../../game/sim.js";
import { playTone } from "../audio.js";
import { formatNumber, strings } from "../strings.js";

/**
 * @param {{ muted: boolean, onFinish: (result: { score: number, chapter: number, wave: number, victory: boolean }) => void }} props
 */
export function GameCanvas({ muted, onFinish }) {
  const canvasRef = useRef(null);
  const finishRef = useRef(onFinish);
  const mutedRef = useRef(muted);
  finishRef.current = onFinish;
  mutedRef.current = muted;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const keys = new Set();
    const pointer = { on: false, x: 160, y: WORLD_H / 2, fire: false };
    let bombEdge = false;
    let paused = false;
    let finished = false;
    const run = createRun();
    let last = performance.now();
    let raf = 0;

    const keyName = (event) => event.key.toLowerCase();
    const down = (event) => {
      const key = keyName(event);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "escape") paused = !paused;
      if ((key === "b" || key === "shift") && !event.repeat) bombEdge = true;
      keys.add(key);
    };
    const up = (event) => keys.delete(keyName(event));
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * WORLD_W;
      pointer.y = ((event.clientY - rect.top) / rect.height) * WORLD_H;
    };
    const pointerDown = (event) => {
      pointer.on = true;
      pointer.fire = true;
      point(event);
    };
    const pointerUp = () => {
      pointer.on = false;
      pointer.fire = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const pointerMove = (event) => {
      if (pointer.on) point(event);
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused && !finished) {
        const ax = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
        const ay = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
        step(run, {
          ax,
          ay,
          targetX: pointer.on ? pointer.x : null,
          targetY: pointer.on ? pointer.y : null,
          fire: pointer.fire || keys.has(" "),
          bomb: bombEdge,
        }, dt || 0);
        bombEdge = false;
        for (const sound of run.sounds) playTone(sound, mutedRef.current);
        if (run.phase !== "play") {
          finished = true;
          finishRef.current({
            score: run.score,
            chapter: run.chapter + 1,
            wave: Math.min(5, run.wave + 1),
            victory: run.phase === "victory",
          });
        }
      }
      draw(ctx, run, paused);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WORLD_W}
      height={WORLD_H}
      className="playfield"
      aria-label={strings.how}
    />
  );
}

function draw(ctx, run, paused) {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  const sky = ctx.createLinearGradient(0, 0, WORLD_W, WORLD_H);
  sky.addColorStop(0, "#10243f");
  sky.addColorStop(1, "#071018");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = "#ffffff22";
  for (let index = 0; index < 40; index += 1) {
    const x = (index * 137 + run.time * 40) % WORLD_W;
    const y = (index * 89) % WORLD_H;
    ctx.fillRect(x, y, 2, 2);
  }

  for (const gift of run.gifts) drawGift(ctx, gift);
  for (const egg of run.eggs) {
    ctx.fillStyle = "#f2e2b0";
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const foe of run.enemies) drawFoe(ctx, foe);
  for (const shot of run.shots) {
    ctx.fillStyle = shot.missile ? "#ffb020" : "#9ee7ff";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawShip(ctx, run);

  ctx.fillStyle = "#f4f7fb";
  ctx.font = "700 18px Segoe UI, sans-serif";
  ctx.fillText(formatNumber(run.score), 20, 32);
  ctx.font = "14px Segoe UI, sans-serif";
  ctx.fillStyle = "#d5deea";
  const chapter = CHAPTERS[run.chapter];
  ctx.fillText(`${chapter.name} · ${run.wave === 4 ? "Boss" : `Wave ${run.wave + 1}`}`, 20, 54);
  ctx.fillText(`Lives ${run.lives}   Weapon ${run.weapon}   Bombs ${run.bombs}${run.shield ? "   Shield" : ""}`, 20, 76);
  if (run.bannerTime > 0) {
    ctx.fillStyle = "#ffe08a";
    ctx.font = "700 28px Segoe UI, sans-serif";
    ctx.fillText(run.banner, 20, 120);
  }
  const boss = run.enemies.find((foe) => foe.kind === "boss");
  if (boss) {
    ctx.fillStyle = "#ffffff33";
    ctx.fillRect(WORLD_W / 2 - 160, 18, 320, 10);
    ctx.fillStyle = "#e25b4a";
    ctx.fillRect(WORLD_W / 2 - 160, 18, 320 * Math.max(0, boss.hp / boss.maxHp), 10);
  }
  if (paused) {
    ctx.fillStyle = "#000a";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = "#fff";
    ctx.font = "700 36px Segoe UI, sans-serif";
    ctx.fillText(strings.pause, WORLD_W / 2 - 48, WORLD_H / 2);
  }
}

function drawShip(ctx, run) {
  ctx.save();
  ctx.translate(run.x, run.y);
  ctx.globalAlpha = run.invuln > 0 && Math.floor(run.time * 12) % 2 === 0 ? 0.45 : 1;
  ctx.fillStyle = run.shield ? "#8fd0ff" : "#f2f6fb";
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-16, -14);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-16, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#49c2d4";
  ctx.fillRect(-4, -4, 10, 8);
  ctx.restore();
}

function drawFoe(ctx, foe) {
  ctx.save();
  ctx.translate(foe.x, foe.y);
  if (foe.kind === "boss") {
    ctx.fillStyle = "#f0c14a";
    ctx.beginPath();
    ctx.ellipse(0, 0, foe.r, foe.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c4493a";
    ctx.fillRect(-8, -foe.r * 0.7, 16, 14);
    ctx.restore();
    return;
  }
  const color = foe.kind === "chick" ? "#ffe27a" : foe.kind === "rooster" ? "#e07a32" : "#f4f4f4";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, foe.r, foe.r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d94b3a";
  ctx.beginPath();
  ctx.arc(-2, -foe.r * 0.7, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2a01e";
  ctx.beginPath();
  ctx.moveTo(foe.r - 2, 0);
  ctx.lineTo(foe.r + 8, 3);
  ctx.lineTo(foe.r - 2, 6);
  ctx.fill();
  ctx.restore();
}

function drawGift(ctx, gift) {
  const colors = { weapon: "#7ec8ff", shield: "#9ee7c2", bomb: "#ff8d6b", life: "#ff6b8a", score: "#ffe08a" };
  ctx.fillStyle = colors[gift.gift] || "#fff";
  ctx.fillRect(gift.x - 10, gift.y - 10, 20, 20);
  ctx.fillStyle = "#102018";
  ctx.font = "700 12px Segoe UI, sans-serif";
  ctx.fillText(gift.gift.slice(0, 1).toUpperCase(), gift.x - 4, gift.y + 4);
}
