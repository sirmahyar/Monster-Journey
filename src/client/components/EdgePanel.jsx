import { formatNumber, strings } from "../strings.js";

/** @param {{ info: object | null }} props */
export function EdgePanel({ info }) {
  return (
    <details className="edge-panel" data-testid="edge-panel">
      <summary>{strings.edgeSummary}</summary>
      {!info && <p>{strings.edgeEmpty}</p>}
      {info && (
        <dl>
          <div>
            <dt>{strings.edgeAction}</dt>
            <dd><code>{JSON.stringify(info.action)}</code></dd>
          </div>
          <div>
            <dt>{strings.edgeRevision}</dt>
            <dd>{formatNumber(info.revision)}</dd>
          </div>
          <div>
            <dt>{strings.edgeRoundTrip}</dt>
            <dd>{formatNumber(info.roundTripMs)} ms</dd>
          </div>
          <div>
            <dt>{strings.edgeEvents}</dt>
            <dd>
              <ol>
                {info.events.map((event, index) => (
                  <li key={`${event.type}-${index}`}><code>{event.type}</code></li>
                ))}
              </ol>
            </dd>
          </div>
        </dl>
      )}
      <p className="note">{strings.edgeRoundTripNote}</p>
    </details>
  );
}
