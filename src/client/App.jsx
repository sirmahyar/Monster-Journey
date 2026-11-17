import { useEffect, useState } from "react";
import { fetchScores, submitScore } from "./api.js";
import { GameCanvas } from "./components/GameCanvas.jsx";
import { formatNumber, strings } from "./strings.js";

export function App() {
  const [screen, setScreen] = useState("menu");
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState(null);
  const [name, setName] = useState("Pilot");
  const [scores, setScores] = useState([]);
  const [boardError, setBoardError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (screen !== "board" && screen !== "over") return;
    let cancel = false;
    setBoardError("");
    fetchScores()
      .then((rows) => {
        if (!cancel) setScores(rows);
      })
      .catch(() => {
        if (!cancel) setBoardError(strings.saveFailed);
      });
    return () => {
      cancel = true;
    };
  }, [screen]);

  async function save(event) {
    event.preventDefault();
    if (!result || saving || saved) return;
    setSaving(true);
    setBoardError("");
    try {
      await submitScore({
        name,
        score: result.score,
        chapter: result.chapter,
        wave: result.wave,
      });
      const rows = await fetchScores();
      setScores(rows);
      setSaved(true);
    } catch (error) {
      setBoardError(error.message || strings.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  function launch() {
    setResult(null);
    setSaved(false);
    setBoardError("");
    setScreen("play");
  }

  return (
    <div className="sky">
      <header className="topbar">
        <div>
          <p className="eyebrow">{strings.eyebrow}</p>
          <h1>{strings.title}</h1>
        </div>
        <button type="button" className="secondary" onClick={() => setMuted((value) => !value)}>
          {muted ? strings.mute : strings.sound}
        </button>
      </header>

      {screen === "menu" && (
        <section className="panel">
          <p className="lead">{strings.intro}</p>
          <p className="how">{strings.how}</p>
          <div className="button-row">
            <button type="button" data-testid="launch" onClick={launch}>{strings.play}</button>
            <button type="button" className="secondary" data-testid="open-board" onClick={() => setScreen("board")}>
              {strings.board}
            </button>
          </div>
        </section>
      )}

      {screen === "play" && (
        <GameCanvas
          muted={muted}
          onFinish={(next) => {
            setResult(next);
            setScreen("over");
          }}
        />
      )}

      {screen === "over" && result && (
        <section className="panel">
          <p className="eyebrow">{result.victory ? strings.victory : strings.over}</p>
          <h2>{formatNumber(result.score)}</h2>
          <p>Chapter {result.chapter} · wave {result.wave}</p>
          <form className="save-form" onSubmit={save}>
            <label>
              {strings.name}
              <input
                value={name}
                maxLength={16}
                onChange={(event) => setName(event.target.value)}
                data-testid="pilot-name"
              />
            </label>
            <button type="submit" data-testid="save-score" disabled={saving || saved}>
              {saving ? strings.saving : strings.save}
            </button>
          </form>
          {saved && <p role="status">{strings.saved}</p>}
          {boardError && <p className="warn" role="alert">{boardError}</p>}
          <ScoreTable scores={scores} />
          <div className="button-row">
            <button type="button" onClick={launch}>{strings.again}</button>
            <button type="button" className="secondary" onClick={() => setScreen("menu")}>{strings.back}</button>
          </div>
        </section>
      )}

      {screen === "board" && (
        <section className="panel">
          <h2>{strings.board}</h2>
          <p className="how">{strings.boardNote}</p>
          {boardError && <p className="warn" role="alert">{boardError}</p>}
          <ScoreTable scores={scores} />
          <button type="button" onClick={() => setScreen("menu")}>{strings.back}</button>
        </section>
      )}
    </div>
  );
}

/** @param {{ scores: object[] }} props */
function ScoreTable({ scores }) {
  if (!scores.length) return <p>{strings.boardEmpty}</p>;
  return (
    <ol className="board" data-testid="score-list">
      {scores.map((row) => (
        <li key={row.id}>
          <span>{row.name}</span>
          <strong>{formatNumber(row.score)}</strong>
          <em>C{row.chapter} W{row.wave}</em>
        </li>
      ))}
    </ol>
  );
}
