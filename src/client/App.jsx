import { useEffect, useRef, useState } from "react";
import { isValidName, normalizeName } from "../shared/pilot-name.js";
import { fetchScores, submitScore, submitScoreOnLeave } from "./api.js";
import { audioSettings, setAudioSetting, unlockAudio } from "./audio/engine.js";
import { whenOpeningMusicReady } from "./audio/music.js";
import { playUi } from "./audio/sfx.js";
import { GameCanvas } from "./components/GameCanvas.jsx";
import { Board, GameOver, Help, Menu, NameGate, Pause } from "./components/Screens.jsx";
import { strings } from "./strings.js";

const BEST_KEY = "cluck-raid-best";
const NAME_KEY = "cluck-raid-name";
const MAX_SCORE = 9_999_999;

function load(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage can be unavailable in private windows */
  }
}

export function App() {
  const [screen, setScreen] = useState("menu");
  const [runId, setRunId] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState(null);
  const [best, setBest] = useState(() => Number(load(BEST_KEY, 0)) || 0);
  const [prefs, setPrefs] = useState(audioSettings);
  const [name, setName] = useState(() => load(NAME_KEY, ""));
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [pending, setPending] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [booting, setBooting] = useState(true);
  const nameRef = useRef(name);
  const posted = useRef(new Set());
  const inflight = useRef(new Set());
  const failed = useRef(new Map());
  nameRef.current = name;

  const mode = screen === "play" || screen === "over" ? "play" : "demo";

  useEffect(() => {
    let cancel = false;
    whenOpeningMusicReady().catch(() => {}).finally(() => {
      if (!cancel) setBooting(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (screen !== "board" && screen !== "over") return undefined;
    let cancel = false;
    setBoardError("");
    setLoading(true);
    fetchScores()
      .then((rows) => !cancel && setScores(rows))
      .catch(() => !cancel && setBoardError(strings.loadFailed))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "board" && screen !== "help" && screen !== "name") return undefined;
    const back = (event) => {
      if (event.key === "Escape") setScreen("menu");
    };
    window.addEventListener("keydown", back);
    return () => window.removeEventListener("keydown", back);
  }, [screen]);

  const go = (next) => {
    unlockAudio();
    playUi();
    setPaused(false);
    setScreen(next);
  };

  const askName = () => {
    unlockAudio();
    playUi();
    setSaveError("");
    setPaused(false);
    setScreen("name");
  };

  const begin = () => {
    const clean = normalizeName(name);
    if (!isValidName(clean)) {
      setSaveError(strings.nameInvalid);
      return;
    }
    store(NAME_KEY, clean);
    setName(clean);
    posted.current = new Set();
    inflight.current = new Set();
    failed.current = new Map();
    unlockAudio();
    playUi("start");
    setResult(null);
    setSavedId(null);
    setSaveError("");
    setPaused(false);
    setRunId((id) => id + 1);
    setScreen("play");
  };

  const record = (entry) => {
    const score = Math.min(MAX_SCORE, Math.floor(Number(entry.score) || 0));
    const { chapter, wave } = entry;
    if (score <= 0 || chapter == null || wave == null) return;
    const clean = normalizeName(nameRef.current);
    if (!isValidName(clean)) return;
    const key = `${score}:${chapter}:${wave}`;
    const book = posted.current;
    const flying = inflight.current;
    const misses = failed.current;
    if (book.has(key) || flying.has(key)) return;
    flying.add(key);
    setPending((n) => n + 1);
    submitScore({ name: clean, score, chapter, wave })
      .then(async (row) => {
        book.add(key);
        misses.delete(key);
        setSavedId(row?.id ?? -1);
        if (misses.size === 0) setSaveError("");
        const rows = await fetchScores().catch(() => null);
        if (rows) {
          setScores(rows);
          setBoardError("");
        }
      })
      .catch(() => {
        misses.set(key, { score, chapter, wave });
        setSaveError(strings.saveFailed);
      })
      .finally(() => {
        flying.delete(key);
        setPending((n) => n - 1);
      });
  };

  const finish = (summary) => {
    const score = Math.min(MAX_SCORE, summary.score);
    const next = { ...summary, score, newBest: score > 0 && score > best };
    setResult(next);
    if (score > best) {
      setBest(score);
      store(BEST_KEY, score);
    }
    if (!summary.victory) record(next);
    setScreen("over");
  };

  const leaveRun = (entry) => {
    const score = Math.min(MAX_SCORE, Math.floor(Number(entry.score) || 0));
    const { chapter, wave } = entry;
    if (score <= 0 || chapter == null || wave == null) return;
    const clean = normalizeName(nameRef.current);
    if (!isValidName(clean)) return;
    const key = `${score}:${chapter}:${wave}`;
    if (posted.current.has(key) || inflight.current.has(key)) return;
    posted.current.add(key);
    submitScoreOnLeave({ name: clean, score, chapter, wave });
  };

  const requestPause = (force) => {
    if (screen !== "play") return;
    playUi("pause");
    setPaused((now) => (force ? true : !now));
  };

  const toggle = (key) => {
    unlockAudio();
    const on = !prefs[key];
    setAudioSetting(key, on);
    setPrefs({ ...prefs, [key]: on });
    playUi();
  };

  return (
    <main className="app">
      <div className="backdrop" aria-hidden="true" />
      <div className={`stage screen-${screen}`}>
        <GameCanvas mode={mode} runId={runId} paused={paused} onFinish={finish} onLeave={leaveRun} onPause={requestPause} />
        {screen === "play" && !paused && (
          <button type="button" className="pause-btn" onClick={() => requestPause(true)} aria-label={strings.pause}>
            <span />
            <span />
          </button>
        )}
        {screen === "menu" && (
          <Menu
            best={best}
            prefs={prefs}
            onToggle={toggle}
            onPlay={askName}
            onBoard={() => go("board")}
            onHelp={() => go("help")}
          />
        )}
        {screen === "play" && paused && (
          <Pause
            prefs={prefs}
            onToggle={toggle}
            onResume={() => requestPause()}
            onRestart={askName}
            onQuit={() => go("menu")}
          />
        )}
        {screen === "name" && (
          <NameGate
            name={name}
            setName={setName}
            error={saveError}
            onStart={begin}
            onBack={() => go("menu")}
          />
        )}
        {screen === "over" && result && (
          <GameOver
            result={result}
            name={name}
            saving={pending > 0}
            saved={savedId != null && !saveError}
            savedId={savedId}
            saveError={saveError}
            onRetry={() => {
              const missed = [...failed.current.values()];
              failed.current.clear();
              for (const entry of missed) record(entry);
              record(result);
            }}
            scores={scores}
            error={boardError}
            loading={loading}
            onAgain={askName}
            onMenu={() => go("menu")}
          />
        )}
        {screen === "board" && (
          <Board scores={scores} error={boardError} loading={loading} highlight={savedId} onBack={() => go("menu")} />
        )}
        {screen === "help" && <Help onBack={() => go("menu")} />}
        {booting && <p className="boot" role="status">{strings.musicLoading}</p>}
      </div>
    </main>
  );
}
