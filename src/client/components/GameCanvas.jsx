import { useEffect, useRef, useState } from "react";
import { H, PLAYER, STEP, W } from "../../game/config.js";
import { createGame, drainEvents, gameSummary, stepGame } from "../../game/sim.js";
import { WEAPON_ORDER } from "../../game/weapons.js";
import { suspendAudio, unlockAudio } from "../audio/engine.js";
import { playMusic, stopMusic } from "../audio/music.js";
import { playEvent, playSting } from "../audio/sfx.js";
import { autopilot } from "../autopilot.js";
import { createRenderer, drawGame, handleEvents, resetRenderer, resizeRenderer, timeScale } from "../render/draw.js";
import { strings } from "../strings.js";

const MOVE_KEYS = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};
const FIRE_KEYS = [" ", "j", "z"];
const BOMB_KEYS = ["b", "k", "x", "shift"];
const TOUCH_GAIN = 1.15;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

function makeDemo() {
  const game = createGame({ chapter: randInt(1, 4), wave: randInt(1, 7) });
  const p = game.player;
  p.weapon = WEAPON_ORDER[randInt(0, WEAPON_ORDER.length - 1)];
  p.level = randInt(3, 5);
  p.lives = 9;
  p.bombs = 2;
  return game;
}

function typing(event) {
  return event.target instanceof HTMLElement && Boolean(event.target.closest("input, textarea, select"));
}

/**
 * The playfield. In "demo" mode an autopilot flies behind the menu; in "play" mode the player does.
 * @param {{ mode: "demo"|"play", runId: number, paused: boolean, onFinish: (summary: object) => void, onPause: (force?: boolean) => void }} props
 */
export function GameCanvas({ mode, runId, paused, onFinish, onPause }) {
  const canvasRef = useRef(null);
  const props = useRef({ mode, paused, onFinish, onPause });
  props.current = { mode, paused, onFinish, onPause };
  const control = useRef({ reset: null, bomb: null, mode: null });
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const r = createRenderer(canvas);
    const keys = new Set();
    const pointer = { active: false, x: W / 2, y: H - 150, fire: false, touchId: null, ox: 0, oy: 0, sx: 0, sy: 0 };
    const memory = { x: W / 2, y: H - 150 };
    let game = null;
    let finished = false;
    let bombPulse = 0;
    let acc = 0;
    let demoClock = 0;
    let last = performance.now();
    let raf = 0;

    const reset = () => {
      const play = props.current.mode === "play";
      game = play ? createGame() : makeDemo();
      control.current.mode = props.current.mode;
      finished = false;
      resetRenderer(r, game.chapter);
      keys.clear();
      Object.assign(pointer, { fire: false, touchId: null });
      acc = 0;
      demoClock = 0;
      playMusic(play ? "stage" : "menu", 1);
    };
    control.current.reset = reset;
    control.current.bomb = () => {
      bombPulse = 0.2;
    };
    reset();

    const toWorld = (event) => {
      const rect = canvas.getBoundingClientRect();
      return [((event.clientX - rect.left) / rect.width) * W, ((event.clientY - rect.top) / rect.height) * H];
    };
    const playing = () => props.current.mode === "play" && !props.current.paused && !game.over;

    const keyDown = (event) => {
      unlockAudio();
      if (typing(event)) return;
      const key = event.key.toLowerCase();
      if (key === "p" || key === "escape") {
        if (props.current.mode === "play" && !game.over && !event.repeat) props.current.onPause();
        return;
      }
      if (!playing()) return;
      if (MOVE_KEYS[key] || FIRE_KEYS.includes(key)) event.preventDefault();
      if (MOVE_KEYS[key]) pointer.active = false;
      keys.add(key);
    };
    const keyUp = (event) => keys.delete(event.key.toLowerCase());
    const pointerDown = (event) => {
      unlockAudio();
      if (!playing()) return;
      const [x, y] = toWorld(event);
      if (event.pointerType === "touch") {
        setTouch(true);
        if (pointer.touchId == null) {
          const p = game.player;
          Object.assign(pointer, { touchId: event.pointerId, active: true, fire: true, sx: x, sy: y, ox: p.x, oy: p.y, x: p.x, y: p.y });
        }
        return;
      }
      if (event.button === 1 || event.button === 2) bombPulse = 0.2;
      else Object.assign(pointer, { active: true, fire: true, x, y });
      canvas.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event) => {
      if (!playing()) return;
      const [x, y] = toWorld(event);
      if (event.pointerType !== "touch") {
        Object.assign(pointer, { active: true, x, y });
        return;
      }
      if (event.pointerId !== pointer.touchId) return;
      const tx = pointer.ox + (x - pointer.sx) * TOUCH_GAIN;
      const ty = pointer.oy + (y - pointer.sy) * TOUCH_GAIN;
      pointer.x = clamp(tx, 24, W - 24);
      pointer.y = clamp(ty, PLAYER.minY, PLAYER.maxY);
      pointer.sx += (tx - pointer.x) / TOUCH_GAIN;
      pointer.sy += (ty - pointer.y) / TOUCH_GAIN;
    };
    const pointerUp = (event) => {
      if (event.pointerType === "touch") {
        if (event.pointerId === pointer.touchId) Object.assign(pointer, { touchId: null, fire: false });
      } else if (event.button === 0) pointer.fire = false;
    };
    const blockMenu = (event) => event.preventDefault();
    const leave = (event) => {
      keys.clear();
      pointer.fire = false;
      if (playing() && (document.hidden || event.type === "blur")) props.current.onPause(true);
    };

    const readInput = () => {
      let mx = 0;
      let my = 0;
      for (const key of keys) {
        const m = MOVE_KEYS[key];
        if (m) {
          mx += m[0];
          my += m[1];
        }
      }
      const aim = pointer.active && !(mx || my);
      return {
        moveX: Math.sign(mx),
        moveY: Math.sign(my),
        targetX: aim ? pointer.x : null,
        targetY: aim ? pointer.y : null,
        fire: pointer.fire || FIRE_KEYS.some((k) => keys.has(k)),
        bomb: bombPulse > 0 || BOMB_KEYS.some((k) => keys.has(k)),
      };
    };

    const react = (events) => {
      handleEvents(r, events);
      if (control.current.mode !== "play") return;
      for (const ev of events) {
        playEvent(ev, { food: game.player.food });
        if (ev.type === "wave") playMusic(ev.boss ? "boss" : "stage", ev.chapter);
        else if (ev.type === "boss_dead") playMusic("stage", game.chapter);
        else if (ev.type === "gameover" || ev.type === "victory") {
          stopMusic();
          playSting(ev.type);
        }
      }
    };

    const loop = (now) => {
      const real = Math.min(0.1, (now - last) / 1000);
      last = now;
      const frozen = props.current.paused;
      const scale = timeScale(r);
      const demo = control.current.mode !== "play";
      if (!frozen) {
        acc += real * scale;
        let steps = 0;
        while (acc >= STEP && steps < 6) {
          stepGame(game, demo ? autopilot(game, memory) : readInput(), STEP);
          bombPulse = Math.max(0, bombPulse - STEP);
          acc -= STEP;
          steps += 1;
        }
        if (steps === 6) acc = 0;
        react(drainEvents(game));
        if (demo) {
          demoClock += real;
          if (game.over || demoClock > 70) reset();
        } else if (game.over && !finished) {
          finished = true;
          props.current.onFinish(gameSummary(game));
        }
      }
      drawGame(r, game, frozen ? 0 : real * scale, { hud: !demo });
      raf = requestAnimationFrame(loop);
    };

    const fit = () => resizeRenderer(r, canvas.getBoundingClientRect().width || W, window.devicePixelRatio);
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();
    const listeners = [
      [window, "keydown", keyDown],
      [window, "keyup", keyUp],
      [window, "pointerup", pointerUp],
      [window, "pointercancel", pointerUp],
      [window, "blur", leave],
      [document, "visibilitychange", leave],
      [canvas, "pointerdown", pointerDown],
      [canvas, "pointermove", pointerMove],
      [canvas, "contextmenu", blockMenu],
    ];
    for (const [target, type, fn] of listeners) target.addEventListener(type, fn);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      stopMusic();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
    };
  }, []);

  useEffect(() => {
    const c = control.current;
    if (c.reset && (c.mode !== mode || mode === "play")) c.reset();
  }, [mode, runId]);

  useEffect(() => {
    suspendAudio(paused);
  }, [paused]);

  const bomb = (event) => {
    event.preventDefault();
    event.stopPropagation();
    control.current.bomb?.();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`playfield${mode === "play" && !paused ? " is-playing" : ""}`}
        aria-label={mode === "play" ? strings.controlsShort : strings.title}
      />
      {mode === "play" && touch && !paused && (
        <button type="button" className="touch-nova" onPointerDown={bomb} aria-label={strings.nova}>
          {strings.nova}
        </button>
      )}
    </>
  );
}
