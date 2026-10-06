/** @param {{ kind: string, label: string, mood?: string }} props */
export function Creature({ kind, label, mood = "" }) {
  return (
    <svg className={`creature ${mood}`} viewBox="0 0 160 150" role="img" aria-label={label}>
      <title>{label}</title>
      <ellipse cx="80" cy="136" rx="42" ry="8" className="shadow" />
      {kind === "player" && <PlayerBody />}
      {kind === "forest_slime" && <SlimeBody />}
      {kind === "cave_bat" && <BatBody />}
      {kind === "stone_golem" && <GolemBody />}
    </svg>
  );
}

function PlayerBody() {
  return (
    <g>
      <path d="M80 18c8 10 8 22 0 28" className="antenna" />
      <circle cx="80" cy="16" r="8" className="lantern" />
      <ellipse cx="80" cy="86" rx="38" ry="34" className="body player-body" />
      <ellipse cx="80" cy="96" rx="22" ry="16" className="belly" />
      <path d="M48 70c6-24 58-24 64 0" className="cap" />
      <circle cx="66" cy="82" r="7" className="eye" />
      <circle cx="94" cy="82" r="7" className="eye" />
      <circle cx="68" cy="82" r="3" className="pupil" />
      <circle cx="96" cy="82" r="3" className="pupil" />
      <path d="M70 100c6 6 14 6 20 0" className="smile" />
      <ellipse cx="52" cy="118" rx="10" ry="6" className="foot" />
      <ellipse cx="108" cy="118" rx="10" ry="6" className="foot" />
    </g>
  );
}

function SlimeBody() {
  return (
    <g>
      <path d="M30 96c0-36 22-58 50-58s50 22 50 58c0 22-20 36-50 36S30 118 30 96z" className="body slime-body" />
      <ellipse cx="62" cy="78" rx="8" ry="10" className="eye" />
      <ellipse cx="98" cy="78" rx="8" ry="10" className="eye" />
      <circle cx="64" cy="80" r="3" className="pupil" />
      <circle cx="100" cy="80" r="3" className="pupil" />
      <circle cx="48" cy="58" r="6" className="bubble" />
      <circle cx="112" cy="64" r="4" className="bubble" />
    </g>
  );
}

function BatBody() {
  return (
    <g>
      <path d="M80 78c-18-8-34-28-48-24 8 18 16 28 28 34-16 8-24 22-20 32 16-6 28-8 40-8s24 2 40 8c4-10-4-24-20-32 12-6 20-16 28-34-14-4-30 16-48 24z" className="body bat-body" />
      <circle cx="68" cy="78" r="5" className="eye" />
      <circle cx="92" cy="78" r="5" className="eye" />
      <circle cx="68" cy="78" r="2" className="pupil" />
      <circle cx="92" cy="78" r="2" className="pupil" />
      <path d="M74 90h4l-2 8zm8 0h4l-2 8z" className="fang" />
    </g>
  );
}

function GolemBody() {
  return (
    <g>
      <rect x="48" y="28" width="64" height="28" rx="10" className="body golem-body" />
      <rect x="40" y="60" width="80" height="36" rx="12" className="body golem-body" />
      <rect x="50" y="100" width="60" height="28" rx="10" className="body golem-body" />
      <path d="M58 46l10 8M96 70l14 16M70 112l8 10" className="crack" />
      <circle cx="68" cy="74" r="4" className="glow" />
      <circle cx="92" cy="74" r="4" className="glow" />
    </g>
  );
}
