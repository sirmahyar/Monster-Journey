import { useEffect, useState } from "react";
import { fetchScores, submitScore } from "./api.js";
import { audioSettings, setAudioSetting, unlockAudio } from "./audio/engine.js";
import { playUi } from "./audio/sfx.js";
import { GameCanvas } from "./components/GameCanvas.jsx";
import { Board, GameOver, Help, Menu, Pause } from "./components/Screens.jsx";
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedId, setSavedId] = useState(null);

  const mode = screen === "play" || screen === "over" ? "play" : "demo";

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
    if (screen !== "board" && screen !== "help") return undefined;
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

  const play = () => {
    unlockAudio();
    playUi("start");
    setResult(null);
    setSavedId(null);
    setSaveError("");
    setPaused(false);
    setRunId((id) => id + 1);
    setScreen("play");
  };

  const finish = (summary) => {
    const score = Math.min(MAX_SCORE, summary.score);
    setResult({ ...summary, score, newBest: score > 0 && score > best });
    if (score > best) {
      setBest(score);
      store(BEST_KEY, score);
    }
    setSavedId(null);
    setScreen("over");
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

  async function save(event) {
    event.preventDefault();
    const clean = name.trim();
    if (!result || saving || savedId != null || !clean) return;
    setSaving(true);
    setSaveError("");
    try {
      const row = await submitScore({ name: clean, score: result.score, chapter: result.chapter, wave: result.wave });
      store(NAME_KEY, clean);
      setSavedId(row?.id ?? -1);
      setScores(await fetchScores());
      setBoardError("");
    } catch (error) {
      setSaveError(error.message || strings.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app">
      <div className="backdrop" aria-hidden="true" />
      <div className={`stage screen-${screen}`}>
        <GameCanvas mode={mode} runId={runId} paused={paused} onFinish={finish} onPause={requestPause} />
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
            onPlay={play}
            onBoard={() => go("board")}
            onHelp={() => go("help")}
          />
        )}
        {screen === "play" && paused && (
          <Pause
            prefs={prefs}
            onToggle={toggle}
            onResume={() => requestPause()}
            onRestart={play}
            onQuit={() => go("menu")}
          />
        )}
        {screen === "over" && result && (
          <GameOver
            result={result}
            name={name}
            setName={setName}
            onSave={save}
            saving={saving}
            saved={savedId != null}
            savedId={savedId}
            saveError={saveError}
            scores={scores}
            error={boardError}
            loading={loading}
            onAgain={play}
            onMenu={() => go("menu")}
          />
        )}
        {screen === "board" && (
          <Board scores={scores} error={boardError} loading={loading} highlight={savedId} onBack={() => go("menu")} />
        )}
        {screen === "help" && <Help onBack={() => go("menu")} />}
      </div>
    </main>
  );
}
