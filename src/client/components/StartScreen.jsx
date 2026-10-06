import { strings } from "../strings.js";

/** @param {{ hasSave: boolean, busy: boolean, onNew: () => void, onContinue: () => void }} props */
export function StartScreen({ hasSave, busy, onNew, onContinue }) {
  return (
    <section className="screen start-screen">
      <p className="eyebrow">Endless flight</p>
      <h2>{strings.creatureName} is in the lane</h2>
      <p className="lead">{strings.intro}</p>
      <div className="button-row">
        <button type="button" data-testid="start-new" onClick={onNew} disabled={busy}>
          {strings.newGame}
        </button>
        {hasSave && (
          <button type="button" className="secondary" data-testid="continue" onClick={onContinue} disabled={busy}>
            {strings.continueGame}
          </button>
        )}
      </div>
    </section>
  );
}
