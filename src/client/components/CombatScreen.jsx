import { formatNumber, strings } from "../strings.js";
import { Creature } from "./Creatures.jsx";
import { PlayerStats } from "./PlayerStats.jsx";
import { StatBar } from "./StatBar.jsx";

/** @param {{ view: object, busy: boolean, fx: string | null, log: string[], onMove: (move: string) => void }} props */
export function CombatScreen({ view, busy, fx, log, onMove }) {
  const enemy = view.enemy;
  const enemyName = strings.enemies[enemy?.archetype] || "دشمن";
  return (
    <section className="screen">
      <header className="screen-head">
        <h2>{strings.combatTitle}</h2>
        <p>{strings.stage} {formatNumber(view.stage)}</p>
      </header>
      <div className="arena">
        <figure className={fx === "player" ? "struck" : ""}>
          <Creature kind="player" label={strings.creatureName} mood={fx === "player" ? "hit" : ""} />
          <figcaption>{strings.creatureName}</figcaption>
        </figure>
        <figure className={fx === "enemy" ? "struck" : ""}>
          <Creature kind={enemy?.archetype || "forest_slime"} label={enemyName} mood={fx === "enemy" ? "hit" : ""} />
          <figcaption>{enemyName}</figcaption>
        </figure>
      </div>
      {enemy && (
        <>
          <StatBar label={strings.stats.hp} value={enemy.hp} max={enemy.maxHp} tone="enemy" />
          <p className="intention" data-testid="intention">
            {strings.enemyIntent}: {strings.intentions[enemy.intention]}
            <span>
              {strings.stats.attack} {formatNumber(enemy.attack)} · {strings.stats.defense} {formatNumber(enemy.defense)}
            </span>
          </p>
        </>
      )}
      <PlayerStats player={view.player} />
      <div className="card-grid actions">
        {view.actions.map((action) => {
          const reason = action.reason ? strings.actionReasons[action.reason] : "";
          return (
            <button
              key={action.id}
              type="button"
              className="choice-card"
              data-testid={`move-${action.id}`}
              disabled={busy || !action.available}
              aria-label={strings.moves[action.id]}
              onClick={() => onMove(action.id)}
            >
              <strong>{strings.moves[action.id]}</strong>
              <span>{strings.moveHints[action.id]}</span>
              {!action.available && reason && <span className="reason">{reason}</span>}
            </button>
          );
        })}
      </div>
      <section className="log" aria-live="polite" aria-label={strings.localLog}>
        <h3>{strings.localLog}</h3>
        {log.length === 0 ? <p>هنوز ضربه‌ای رد و بدل نشده است.</p> : log.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
      </section>
    </section>
  );
}
