import { useCallback, useEffect, useRef, useState } from "react";
import { resumeGame, sendAction, startGame } from "./api.js";
import { EdgePanel } from "./components/EdgePanel.jsx";
import { GameOverScreen } from "./components/GameOverScreen.jsx";
import { RunField } from "./components/RunField.jsx";
import { StartScreen } from "./components/StartScreen.jsx";
import { createSaveStore } from "./storage.js";
import { errorText, strings } from "./strings.js";

const store = createSaveStore();

export function App() {
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [hasSave, setHasSave] = useState(Boolean(store.read()));
  const [storageNote, setStorageNote] = useState(store.persistent ? "" : strings.storageWarning);
  const [edgeInfo, setEdgeInfo] = useState(null);
  const tokenRef = useRef(store.read());
  const serialRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const saved = store.read();
    if (!saved) {
      setBooting(false);
      return;
    }
    tokenRef.current = saved;
    runRequest("resume", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runRequest = useCallback(async (kind, action) => {
    if (inFlightRef.current) return;
    const serial = serialRef.current + 1;
    serialRef.current = serial;
    inFlightRef.current = true;
    setBusy(true);
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
      const actionSummary = sentAction?.type === "finish_leg"
        ? { type: "finish_leg", ticks: sentAction.inputs.length }
        : sentAction;
      setEdgeInfo({
        action: actionSummary,
        revision: payload.view.revision,
        roundTripMs: Math.round(performance.now() - started),
        events: payload.events,
      });
      setPending(null);
      setView(payload.view);
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
        setBooting(false);
      }
    }
  }, []);

  const finishLeg = useCallback((inputs) => {
    runRequest("action", { type: "finish_leg", inputs });
  }, [runRequest]);

  function retry() {
    if (!pending) return;
    runRequest(pending.kind, pending.action);
  }

  return (
    <div className="sky">
      <header className="topbar">
        <p className="eyebrow">Vector run</p>
        <h1>{strings.title}</h1>
      </header>
      {storageNote && <p className="banner warn" role="status">{storageNote}</p>}
      {error && (
        <div className="banner warn" role="alert">
          <p>{errorText(error)}</p>
          {pending && <button type="button" onClick={retry} disabled={busy}>{strings.retry}</button>}
        </div>
      )}
      <main>
        {booting && <p className="loading">{strings.loading}</p>}
        {!booting && !view && (
          <StartScreen hasSave={hasSave} busy={busy} onNew={() => runRequest("start", null)} onContinue={() => runRequest("resume", null)} />
        )}
        {view?.phase === "run" && (
          <RunField
            key={view.revision}
            view={view}
            onDone={finishLeg}
          />
        )}
        {view?.phase === "game_over" && (
          <GameOverScreen view={view} busy={busy} onAgain={() => runRequest("start", null)} />
        )}
      </main>
      {busy && view?.phase === "run" && <p className="sync" role="status">{strings.syncing}</p>}
      <EdgePanel info={edgeInfo} />
      <footer><p>{strings.footer}</p></footer>
    </div>
  );
}
