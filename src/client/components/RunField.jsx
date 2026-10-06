import { useEffect, useRef, useState } from "react";
import { formatNumber, strings } from "../strings.js";

/**
 * Plays one edge-authored stretch. Positions come from the server tracks.
 * Hull shown here is a local preview and is replaced by the next edge view.
 * @param {{ view: object, onDone: (inputs: {y: number, dash: number}[]) => void }} props
 */
export function RunField({ view, onDone }) {
  const svgRef = useRef(null);
  const doneRef = useRef(false);
  const targetRef = useRef(view.player.y);
  const dashRef = useRef(false);
  const [snap, setSnap] = useState({
    tick: 0,
    frac: 0,
    y: view.player.y,
    flown: 0,
    hp: view.player.hp,
    energy: view.player.energy,
    dash: false,
    hit: false,
    coast: 0,
  });

  useEffect(() => {
    const keys = { up: false, down: false };
    const onKey = (event, down) => {
      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") keys.up = down;
      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") keys.down = down;
      if (event.key === " " || event.key === "Spacebar") {
        dashRef.current = down;
        event.preventDefault();
      }
      if (event.key.startsWith("Arrow")) event.preventDefault();
    };
    const down = (event) => onKey(event, true);
    const up = (event) => onKey(event, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    const ticks = view.actors[0]?.points.length ?? 0;
    const inputs = [];
    let y = view.player.y;
    let hp = view.player.hp;
    let energy = view.player.energy;
    const spent = new Set();
    let tick = 0;
    let flown = 0;
    let deathTick = null;
    let acc = 0;
    let last = performance.now();
    let coast = 0;

    const step = () => {
      if (keys.up) targetRef.current -= view.field.maxDy;
      if (keys.down) targetRef.current += view.field.maxDy;
      targetRef.current = clamp(targetRef.current, view.field.playerRadius, view.field.height - view.field.playerRadius);
      const delta = clamp(targetRef.current - y, -view.field.maxDy, view.field.maxDy);
      y += delta;
      const wantDash = dashRef.current;
      const dashed = wantDash && energy > 0;
      if (dashed) energy -= 1;
      let hit = false;
      if (hp > 0) {
        for (const actor of view.actors) {
          if (spent.has(actor.id)) continue;
          const [ax, ay] = actor.points[tick];
          if (!near(view.field.playerX, y, ax, ay, view.field.playerRadius + actor.radius)) continue;
          spent.add(actor.id);
          if (actor.role === "hazard") {
            if (!dashed) {
              hp = Math.max(0, hp - actor.power);
              hit = true;
            }
          } else if (actor.role === "heal") {
            hp = Math.min(view.player.maxHp, hp + actor.power);
          } else if (actor.role === "energy") {
            energy = Math.min(view.player.maxEnergy, energy + actor.power);
          }
        }
      }
      if (!dashed && (tick + 1) % view.regenEvery === 0 && energy < view.player.maxEnergy) energy += 1;
      if (deathTick === null) {
        flown = tick + 1;
        if (hp === 0) deathTick = tick;
      }
      inputs.push({ y, dash: dashed ? 1 : 0 });
      setSnap({ tick, flown, frac: 0, y, hp, energy, dash: dashed, hit, coast: 0 });
      tick += 1;
      if (tick >= ticks && !doneRef.current) {
        doneRef.current = true;
        onDone(inputs);
      }
    };

    let raf = 0;
    const loop = (now) => {
      const dt = Math.min(80, now - last);
      last = now;
      if (!doneRef.current) {
        acc += dt;
        let guard = 0;
        while (acc >= view.tickMs && tick < ticks && guard < 2) {
          acc -= view.tickMs;
          step();
          guard += 1;
        }
      } else {
        coast += dt * 0.12;
        setSnap((current) => ({ ...current, coast, hit: false, dash: false }));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onDone, view]);

  const pointAt = (actor) => {
    const index = Math.min(snap.tick, actor.points.length - 1);
    const next = Math.min(index + 1, actor.points.length - 1);
    const [x1, y1] = actor.points[index] || [0, 0];
    const [x2, y2] = actor.points[next] || [x1, y1];
    const t = snap.tick >= actor.points.length ? 1 : 0;
    return { x: x1 + (x2 - x1) * t + (snap.coast || 0) * -1, y: y1 + (y2 - y1) * t };
  };

  const shift = view.distance + snap.tick * view.speed + (snap.coast || 0);
  const width = view.field.width;
  const height = view.field.height;

  return (
    <section className={`lane ${snap.hit ? "is-hit" : ""} ${snap.dash ? "is-dash" : ""}`} aria-label="Flight lane">
      <div className="stage">
      <div className="hud">
        <div>
          <span>{strings.distance}</span>
          <strong>{formatNumber(view.distance + snap.flown * view.speed)}</strong>
        </div>
        <div className="hull">
          <span>{strings.hull}</span>
          <div className="bar" role="meter" aria-valuenow={snap.hp} aria-valuemax={view.player.maxHp}>
            <i style={{ width: `${(snap.hp / view.player.maxHp) * 100}%` }} />
          </div>
        </div>
        <div className="pips" aria-label={strings.energy}>
          {Array.from({ length: view.player.maxEnergy }, (_, index) => (
            <i key={index} className={index < snap.energy ? "on" : ""} />
          ))}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${strings.creatureName} flying through moving vectors`}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientY - rect.top) / rect.height;
          targetRef.current = Math.round(ratio * height);
        }}
      >
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#123" />
            <stop offset="1" stopColor="#07110e" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#sky)" />
        <g className="far" transform={`translate(${-wrap(shift * 0.15, width)} 0)`}>
          {ridges(width, height, 0.55)}
          <g transform={`translate(${width} 0)`}>{ridges(width, height, 0.55)}</g>
        </g>
        <g className="near" transform={`translate(${-wrap(shift * 0.45, width)} 0)`}>
          {ridges(width, height, 1)}
          <g transform={`translate(${width} 0)`}>{ridges(width, height, 1)}</g>
        </g>
        {view.actors.map((actor) => {
          const point = pointAt(actor);
          if (point.x < -80 || point.x > width + 80) return null;
          return (
            <g key={actor.id} transform={`translate(${point.x} ${point.y})`}>
              <Vector kind={actor.kind} />
            </g>
          );
        })}
        <g transform={`translate(${view.field.playerX} ${snap.y}) rotate(${snap.dash ? -12 : 0})`}>
          {snap.dash && <ellipse className="ghost" cx="0" cy="0" rx="22" ry="14" />}
          <Player />
        </g>
      </svg>
      </div>
      <div className="controls">
        <p>{strings.how}</p>
        <button
          type="button"
          data-testid="dash"
          onPointerDown={(event) => {
            event.preventDefault();
            dashRef.current = true;
          }}
          onPointerUp={() => {
            dashRef.current = false;
          }}
          onPointerLeave={() => {
            dashRef.current = false;
          }}
        >
          {strings.dash}
        </button>
      </div>
    </section>
  );
}

function ridges(width, height, scale) {
  const hills = [];
  for (let index = 0; index < 8; index += 1) {
    const x = index * 90 - 40;
    hills.push(
      <polygon
        key={index}
        points={`${x},${height} ${x + 40},${height - 70 * scale} ${x + 90},${height}`}
        fill={scale > 0.8 ? "#16342a" : "#10261f"}
      />,
    );
  }
  return hills;
}

function Player() {
  return (
    <g>
      <ellipse cx="0" cy="16" rx="16" ry="4" fill="#000" opacity="0.35" />
      <circle cx="0" cy="0" r="16" fill="#7eae67" />
      <circle cx="0" cy="-16" r="4" fill="#e2a53a" />
      <circle cx="-5" cy="-2" r="2" fill="#102018" />
      <circle cx="5" cy="-2" r="2" fill="#102018" />
      <path d="M-4 5 Q0 9 4 5" fill="none" stroke="#102018" strokeWidth="1.5" />
    </g>
  );
}

/** @param {{ kind: string }} props */
function Vector({ kind }) {
  if (kind === "bat") {
    return (
      <g fill="#8d74c9">
        <polygon points="0,0 -22,-12 -8,-2" />
        <polygon points="0,0 22,-12 8,-2" />
        <circle cx="0" cy="0" r="4" fill="#f2e7ff" />
      </g>
    );
  }
  if (kind === "boulder") {
    return <polygon points="0,-18 16,-8 16,8 0,18 -16,8 -16,-8" fill="#c9843a" />;
  }
  if (kind === "heart") {
    return (
      <g>
        <circle r="12" fill="#3faf86" />
        <path d="M0 5 V-5 M-5 0 H5" stroke="#e9fff6" strokeWidth="2" />
      </g>
    );
  }
  if (kind === "spark") {
    return <polygon points="0,-14 4,-4 14,0 4,4 0,14 -4,4 -14,0 -4,-4" fill="#e2a53a" />;
  }
  return <polygon points="0,-16 14,10 -14,10" fill="#6ec8d8" />;
}

/** @param {number} value @param {number} min @param {number} max */
function wrap(value, size) {
  const mod = value % size;
  return mod < 0 ? mod + size : mod;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** @param {number} px @param {number} py @param {number} ax @param {number} ay @param {number} reach */
function near(px, py, ax, ay, reach) {
  const dx = px - ax;
  const dy = py - ay;
  return dx * dx + dy * dy <= reach * reach;
}
