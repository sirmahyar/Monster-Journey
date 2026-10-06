import { formatNumber, strings } from "../strings.js";
import { Creature } from "./Creatures.jsx";

/** @param {{ view: object, busy: boolean, onAgain: () => void }} props */
export function GameOverScreen({ view, busy, onAgain }) {
  const player = view.player;
  return (
    <section className="screen game-over">
      <Creature kind="player" label={strings.creatureName} mood="hit" />
      <h2>{strings.gameOverTitle}</h2>
      <p className="score">{strings.completed}: {formatNumber(view.completedStages)}</p>
      <ul className="final-stats">
        <li>{strings.stats.hp} {formatNumber(player.maxHp)}</li>
        <li>{strings.stats.attack} {formatNumber(player.attack)}</li>
        <li>{strings.stats.defense} {formatNumber(player.defense)}</li>
        <li>{strings.stats.energy} {formatNumber(player.maxEnergy)}</li>
        <li>{strings.stats.potions} {formatNumber(player.potions)}</li>
      </ul>
      <p className="note">{strings.gameOverNote}</p>
      <button type="button" data-testid="play-again" onClick={onAgain} disabled={busy}>
        {strings.playAgain}
      </button>
    </section>
  );
}
