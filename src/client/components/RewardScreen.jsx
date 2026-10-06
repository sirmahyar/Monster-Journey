import { describeEffects, strings } from "../strings.js";

/** @param {{ view: object, busy: boolean, onChoose: (offerId: string) => void }} props */
export function RewardScreen({ view, busy, onChoose }) {
  return (
    <section className="screen">
      <header className="screen-head">
        <h2>{strings.rewardTitle}</h2>
        <p>یکی را انتخاب کن. مقدارها همان عددهایی است که لبه ساخته است.</p>
      </header>
      <div className="card-grid">
        {view.rewardOffers.map((offer) => (
          <button
            key={offer.id}
            type="button"
            className="choice-card reward-card"
            data-testid={`reward-${offer.id}`}
            disabled={busy}
            onClick={() => onChoose(offer.id)}
          >
            <span className="card-kicker">{strings.rewards[offer.category] || offer.category}</span>
            <strong>{describeEffects(offer.effects)}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
