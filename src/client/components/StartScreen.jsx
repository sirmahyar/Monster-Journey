import { strings } from "../strings.js";
import { Creature } from "./Creatures.jsx";

/** @param {{ hasSave: boolean, busy: boolean, onNew: () => void, onContinue: () => void }} props */
export function StartScreen({ hasSave, busy, onNew, onContinue }) {
  return (
    <section className="screen start-screen">
      <Creature kind="player" label={strings.creatureName} />
      <p className="eyebrow">{strings.englishTitle}</p>
      <h2>{strings.creatureName} آماده راه است</h2>
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
