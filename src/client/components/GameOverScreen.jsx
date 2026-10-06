import { formatNumber, strings } from "../strings.js";

/** @param {{ view: object, busy: boolean, onAgain: () => void }} props */
export function GameOverScreen({ view, busy, onAgain }) {
  return (
    <section className="screen over-screen">
      <p className="eyebrow">{strings.gameOver}</p>
      <h2>{formatNumber(view.distance)}</h2>
      <p>{strings.distance}</p>
      <p className="lead">{strings.gameOverNote}</p>
      <button type="button" data-testid="play-again" onClick={onAgain} disabled={busy}>
        {strings.again}
      </button>
    </section>
  );
}
