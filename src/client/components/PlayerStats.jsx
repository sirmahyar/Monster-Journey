import { formatNumber, strings } from "../strings.js";
import { StatBar } from "./StatBar.jsx";

/** @param {{ player: object }} props */
export function PlayerStats({ player }) {
  return (
    <section className="stats" aria-label={strings.creatureName}>
      <StatBar label={strings.stats.hp} value={player.hp} max={player.maxHp} tone="hp" />
      <div className="stat-pills">
        <span>{strings.stats.attack} {formatNumber(player.attack)}</span>
        <span>{strings.stats.defense} {formatNumber(player.defense)}</span>
        <span>{strings.stats.potions} {formatNumber(player.potions)}</span>
      </div>
      <div className="energy" aria-label={strings.stats.energy}>
        <span>{strings.stats.energy}</span>
        <span className="pips">
          {Array.from({ length: Math.min(player.maxEnergy, 14) }, (_, index) => (
            <i key={index} className={index < player.energy ? "on" : ""} />
          ))}
        </span>
        <span className="stat-nums" dir="ltr">{formatNumber(player.energy)} / {formatNumber(player.maxEnergy)}</span>
      </div>
    </section>
  );
}
