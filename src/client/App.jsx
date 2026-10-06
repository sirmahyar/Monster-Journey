import { useEffect, useRef, useState } from "react";
import { resumeGame, sendAction, startGame } from "./api.js";
import { CombatScreen } from "./components/CombatScreen.jsx";
import { EdgePanel } from "./components/EdgePanel.jsx";
import { GameOverScreen } from "./components/GameOverScreen.jsx";
import { RewardScreen } from "./components/RewardScreen.jsx";
import { RouteScreen } from "./components/RouteScreen.jsx";
import { StartScreen } from "./components/StartScreen.jsx";
import { effectFor, projectEvent, wait } from "./playback.js";
import { createSaveStore } from "./storage.js";
import { describeEvent, errorText, formatNumber, strings } from "./strings.js";

const store = createSaveStore();

export function App() {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [hasSave, setHasSave] = useState(Boolean(store.read()));
  const [storageNote, setStorageNote] = useState(store.persistent ? "" : strings.storageWarning);
  const [log, setLog] = useState([]);
  const [fx, setFx] = useState(null);
  const [edgeInfo, setEdgeInfo] = useState(null);
  const tokenRef = useRef(store.read());
  const viewRef = useRef(null);
  const serialRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const saved = store.read();
    if (!saved) {
      setBooting(false);
      return;
    }
    tokenRef.current = saved;
    runRequest("resume", null);
    // The initial resume is the only load-time request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runRequest(kind, action) {
    if (inFlightRef.current) return;
    const serial = serialRef.current + 1;
    serialRef.current = serial;
    inFlightRef.current = true;
    setBusy(true);
    setWaiting(true);
    setError(null);
    const started = performance.now();
    const sentAction = kind === "action" ? action : { type: kind };
    try {
      const payload = kind === "start"
        ? await startGame()
        : kind === "resume"
          ? await resumeGame(tokenRef.current)
          : await sendAction(tokenRef.current, action);
      if (serial !== serialRef.current) return;
      tokenRef.current = payload.token;
      const persisted = store.write(payload.token);
      setHasSave(Boolean(store.read() || payload.token));
      if (!persisted) setStorageNote(strings.storageWarning);
      setEdgeInfo({
        action: sentAction,
        revision: payload.view.revision,
        roundTripMs: Math.round(performance.now() - started),
        events: payload.events,
      });
      if (kind === "start") setLog([]);
      setBooting(false);
      setWaiting(false);
      await playEvents(payload.events, payload.view, serial);
      if (serial !== serialRef.current) return;
      setView(payload.view);
      setPending(null);
    } catch (caught) {
      if (serial !== serialRef.current) return;
      const code = caught.code || "NETWORK";
      if (kind === "resume" && (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED" || code === "UNSUPPORTED_VERSION")) {
        store.clear();
        tokenRef.current = null;
        setHasSave(false);
        setView(null);
        setPending(null);
      } else {
        setPending({ kind, action });
      }
      setError(code);
    } finally {
      if (serial === serialRef.current) {
        inFlightRef.current = false;
        setBusy(false);
        setWaiting(false);
        setBooting(false);
        setFx(null);
      }
    }
  }

  async function playEvents(events, finalView, serial) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || events.length === 0) {
      setLog((current) => [...current, ...events.map(describeEvent)].slice(-8));
      setView(finalView);
      return;
    }
    const visual = new Set([
      "player_attacked",
      "enemy_attacked",
      "health_restored",
      "energy_changed",
      "enemy_defeated",
    ]);
    let cursor = viewRef.current;
    for (const event of events) {
      if (serial !== serialRef.current) return;
      if (cursor && visual.has(event.type)) cursor = projectEvent(cursor, event);
      if (cursor) setView(cursor);
      setFx(effectFor(event));
      setLog((current) => [...current, describeEvent(event)].slice(-8));
      await wait(420);
    }
  }

  function newGame() {
    runRequest("start", null);
  }

  function retry() {
    if (!pending) return;
    runRequest(pending.kind, pending.action);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{strings.englishTitle}</p>
          <h1>{strings.title}</h1>
        </div>
        {view && <p className="stage-chip">{strings.stage} {formatNumber(view.stage)}</p>}
      </header>
      {storageNote && <p className="banner warn" role="status">{storageNote}</p>}
      {waiting && <p className="banner" role="status" data-testid="calculating">{strings.calculating}</p>}
      {error && (
        <div className="banner warn" role="alert">
          <p>{errorText(error)}</p>
          {pending && (
            <button type="button" onClick={retry} disabled={busy}>{strings.retry}</button>
          )}
        </div>
      )}
      <main>
        {booting && <p className="loading">{strings.loading}</p>}
        {!booting && !view && (
          <StartScreen
            hasSave={hasSave}
            busy={busy}
            onNew={newGame}
            onContinue={() => runRequest("resume", null)}
          />
        )}
        {view?.phase === "route" && (
          <RouteScreen view={view} busy={busy} onChoose={(route) => runRequest("action", { type: "choose_route", route })} />
        )}
        {view?.phase === "combat" && (
          <CombatScreen
            view={view}
            busy={busy}
            fx={fx}
            log={log}
            onMove={(move) => runRequest("action", { type: "combat_move", move })}
          />
        )}
        {view?.phase === "reward" && (
          <RewardScreen view={view} busy={busy} onChoose={(offerId) => runRequest("action", { type: "choose_reward", offerId })} />
        )}
        {view?.phase === "game_over" && <GameOverScreen view={view} busy={busy} onAgain={newGame} />}
      </main>
      <EdgePanel info={edgeInfo} />
      <footer><p>{strings.footer}</p></footer>
    </div>
  );
}
