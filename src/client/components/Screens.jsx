import { useEffect, useRef, useState } from "react";
import { CHAPTER_COUNT } from "../../game/config.js";
import { MAX_NAME, NAME_BLOCKED, normalizeName } from "../../shared/pilot-name.js";
import { fa, formatNumber, formatTime, strings } from "../strings.js";
import { Icon } from "./Icon.jsx";

/** Focuses a button at the end of a scrolling card without jumping the card to its bottom. */
function BackButton({ onBack }) {
  const ref = useRef(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return <button ref={ref} type="button" className="btn primary" onClick={onBack}>{strings.back}</button>;
}

/** @param {{ value: number, duration?: number }} props */
export function CountUp({ value, duration = 1.2 }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - start) / (duration * 1000));
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{formatNumber(shown)}</>;
}

/** @param {{ prefs: { sfx: boolean, music: boolean }, onToggle: (key: "sfx"|"music") => void }} props */
export function AudioToggles({ prefs, onToggle }) {
  return (
    <div className="toggles">
      {["sfx", "music"].map((key) => (
        <button
          key={key}
          type="button"
          className={`toggle${prefs[key] ? " is-on" : ""}`}
          aria-pressed={prefs[key]}
          onClick={() => onToggle(key)}
        >
          <span className="toggle-dot" aria-hidden="true" />
          {strings[key]}: {prefs[key] ? strings.on : strings.off}
        </button>
      ))}
    </div>
  );
}

/** @param {{ scores: object[], highlight?: number|null, error?: string, loading?: boolean, compact?: boolean }} props */
export function ScoreList({ scores, highlight = null, error = "", loading = false, compact = false }) {
  if (error) return <p className="note warn" role="alert">{error}</p>;
  if (loading && !scores.length) return <p className="note">{strings.loading}</p>;
  if (!scores.length) return <p className="note">{strings.boardEmpty}</p>;
  return (
    <ol className={`scores${compact ? " is-compact" : ""}`} data-testid="score-list">
      {scores.map((row, index) => (
        <li
          key={row.id}
          className={`${row.id === highlight ? "is-you " : ""}${index < 3 ? `top-${index + 1}` : ""}`}
          style={{ "--i": index }}
        >
          <span className="rank">{fa(index + 1)}</span>
          <span className="pilot" dir="auto">{row.name}</span>
          <span className="where">{strings.where(row.chapter, row.wave)}</span>
          <strong>{formatNumber(row.score)}</strong>
        </li>
      ))}
    </ol>
  );
}

export function Logo({ small = false }) {
  return (
    <div className={`logo${small ? " is-small" : ""}`}>
      <div className="logo-flock" aria-hidden="true">
        <span className="bob bob-1"><Icon kind="chick" size={small ? 34 : 46} /></span>
        <span className="bob bob-2"><Icon kind="rooster" size={small ? 48 : 70} /></span>
        <span className="bob bob-3"><Icon kind="hen" size={small ? 38 : 54} /></span>
      </div>
      <h1>
        <span>یورش</span> <span className="logo-raid">مرغی</span>
      </h1>
    </div>
  );
}

export function Menu({ best, prefs, onToggle, onPlay, onBoard, onHelp }) {
  return (
    <section className="overlay overlay-menu">
      <Logo />
      <p className="tagline">{strings.tagline}</p>
      <div className="menu-actions">
        <button type="button" className="btn primary big" data-testid="launch" onClick={onPlay}>
          {strings.play}
        </button>
        <div className="row">
          <button type="button" className="btn" data-testid="open-board" onClick={onBoard}>{strings.board}</button>
          <button type="button" className="btn" onClick={onHelp}>{strings.help}</button>
        </div>
      </div>
      <div className="menu-foot">
        {best > 0 && <p className="best">{strings.best}: <strong>{formatNumber(best)}</strong></p>}
        <AudioToggles prefs={prefs} onToggle={onToggle} />
        <p className="hint">{strings.controlsShort}</p>
      </div>
    </section>
  );
}

export function Pause({ prefs, onToggle, onResume, onRestart, onQuit }) {
  return (
    <section className="overlay">
      <div className="card card-narrow">
        <h2>{strings.paused}</h2>
        <div className="stack">
          <button type="button" className="btn primary" onClick={onResume} autoFocus>{strings.resume}</button>
          <button type="button" className="btn" onClick={onRestart}>{strings.restart}</button>
          <button type="button" className="btn ghost" onClick={onQuit}>{strings.quit}</button>
        </div>
        <AudioToggles prefs={prefs} onToggle={onToggle} />
        <p className="hint">{strings.controlsShort}</p>
      </div>
    </section>
  );
}

export function NameGate({ name, setName, error, onStart, onBack }) {
  const clean = normalizeName(name);
  return (
    <section className="overlay">
      <div className="card card-narrow">
        <h2>{strings.nameTitle}</h2>
        <p className="note">{strings.nameLead}</p>
        <form
          className="save"
          onSubmit={(event) => {
            event.preventDefault();
            onStart();
          }}
        >
          <label htmlFor="pilot-name">{strings.name}</label>
          <input
            id="pilot-name"
            value={name}
            maxLength={MAX_NAME}
            placeholder={strings.namePlaceholder}
            autoComplete="nickname"
            dir="auto"
            autoFocus
            onChange={(event) => setName(event.target.value.replace(NAME_BLOCKED, "").slice(0, MAX_NAME))}
            data-testid="pilot-name"
          />
          {error && <p className="note warn" role="alert">{error}</p>}
          <div className="stack">
            <button type="submit" className="btn primary" data-testid="confirm-name" disabled={!clean}>
              {strings.nameStart}
            </button>
            <button type="button" className="btn ghost" onClick={onBack}>{strings.back}</button>
          </div>
        </form>
      </div>
    </section>
  );
}

export function GameOver({ result, name, saving, saved, savedId, saveError, onRetry, scores, error, loading, onAgain, onContinue, onMenu }) {
  const stats = [
    [strings.stats.kills, formatNumber(result.kills)],
    [strings.stats.accuracy, `${fa(Math.round(result.accuracy * 100))}٪`],
    [strings.stats.bestCombo, formatNumber(result.bestCombo)],
    [strings.stats.food, formatNumber(result.food)],
    [strings.stats.bosses, `${fa(result.bosses)} از ${fa(CHAPTER_COUNT)}`],
    [strings.stats.time, formatTime(result.time)],
  ];
  return (
    <section className="overlay">
      <div className={`card card-wide${result.victory ? " is-victory" : ""}`}>
        <p className="eyebrow">{result.victory ? strings.victory : strings.over}</p>
        <h2 className="final-score">
          <CountUp value={result.score} />
        </h2>
        {result.newBest && <p className="badge">{strings.newBest}</p>}
        <p className="note">
          {result.victory ? strings.victoryNote : strings.overNote} {strings.reached(result.chapter, result.wave)}
        </p>
        <dl className="stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="note">{strings.pilotLabel} <bdi>{name}</bdi></p>
        {saving && <p className="note" role="status">{strings.saving}</p>}
        {!saving && saved && <p className="note ok" role="status">{strings.savedRun}</p>}
        {!saving && saveError && (
          <div className="stack">
            <p className="note warn" role="alert">{saveError}</p>
            <button type="button" className="btn" onClick={onRetry}>{strings.save}</button>
          </div>
        )}
        <ScoreList scores={scores.slice(0, 10)} highlight={savedId} error={error} loading={loading} compact />
        <div className="row">
          {!result.victory && result.checkpoint && (
            <button type="button" className="btn primary" onClick={onContinue}>{strings.continueChapter}</button>
          )}
          <button type="button" className={`btn ${result.victory || !result.checkpoint ? "primary" : ""}`} onClick={onAgain}>{strings.again}</button>
          <button type="button" className="btn ghost" onClick={onMenu}>{strings.menu}</button>
        </div>
      </div>
    </section>
  );
}

export function Board({ scores, error, loading, highlight, onBack }) {
  return (
    <section className="overlay">
      <div className="card card-wide">
        <h2>{strings.board}</h2>
        <p className="note">{strings.boardNote}</p>
        <ScoreList scores={scores} highlight={highlight} error={error} loading={loading} />
        <BackButton onBack={onBack} />
      </div>
    </section>
  );
}

function Guide({ title, rows, type }) {
  return (
    <section className="guide">
      <h3>{title}</h3>
      <ul>
        {rows.map(([kind, name, text, rowType]) => (
          <li key={kind}>
            <Icon type={rowType || type} kind={kind} size={44} />
            <div>
              <strong>{name}</strong>
              <span>{text}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Help({ onBack }) {
  return (
    <section className="overlay">
      <div className="card card-wide help">
        <h2>{strings.help}</h2>
        <section className="guide">
          <h3>{strings.controlsTitle}</h3>
          <dl className="controls">
            {strings.controls.map(([device, text]) => (
              <div key={device}>
                <dt>{device}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </section>
        <Guide
          title={strings.enemiesTitle}
          rows={[...strings.enemies, ["rock", strings.rockName, strings.rockText, "rock"], ["poop", strings.poopName, strings.poopText, "hazard"]]}
          type="creature"
        />
        <Guide title={strings.lootTitle} rows={strings.loot} type="pickup" />
        <Guide title={strings.weaponsTitle} rows={strings.weapons} type="ship" />
        <section className="guide">
          <h3>{strings.progressionTitle}</h3>
          <ul className="tips">
            {strings.progression.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
        <section className="guide">
          <h3>{strings.tipsTitle}</h3>
          <ul className="tips">
            {strings.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </section>
        <BackButton onBack={onBack} />
      </div>
    </section>
  );
}
