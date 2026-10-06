import { formatNumber, strings } from "../strings.js";
import { PlayerStats } from "./PlayerStats.jsx";

/** @param {{ view: object, busy: boolean, onChoose: (route: string) => void }} props */
export function RouteScreen({ view, busy, onChoose }) {
  return (
    <section className="screen">
      <header className="screen-head">
        <h2>{strings.routesTitle}</h2>
        <p>{strings.stage} {formatNumber(view.stage)}</p>
      </header>
      <PlayerStats player={view.player} />
      <div className="card-grid">
        {view.routes.map((route) => {
          const copy = strings.routes[route.id];
          const reason = route.reason ? strings.routeReasons[route.reason] : "";
          return (
            <button
              key={route.id}
              type="button"
              className={`choice-card route-${route.id}`}
              data-testid={`route-${route.id}`}
              disabled={busy || !route.available}
              onClick={() => onChoose(route.id)}
            >
              <span className="card-kicker">{copy.title}</span>
              <strong>{copy.summary}</strong>
              <span>{copy.detail}</span>
              {!route.available && <span className="reason">{reason}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
