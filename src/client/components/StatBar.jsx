import { formatNumber } from "../strings.js";

/** @param {{ label: string, value: number, max: number, tone: string }} props */
export function StatBar({ label, value, max, tone }) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`stat-bar ${tone}`}>
      <div className="stat-bar-label">
        <span>{label}</span>
        <span className="stat-nums" dir="ltr">{formatNumber(value)} / {formatNumber(max)}</span>
      </div>
      <div
        className="stat-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
