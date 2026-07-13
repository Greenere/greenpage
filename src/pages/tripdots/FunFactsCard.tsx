import { UI_COPY } from '../../configs/ui/uiCopy';
import type { FunFacts } from './content/tripDotsData';
import './FunFactsCard.css';

type FunFactsCardProps = {
  facts: FunFacts;
};

// A month with genuinely zero recorded distance still gets a sliver here —
// otherwise it'd be a zero-width, unhoverable gap in the bar.
const MIN_SEGMENT_FLEX = 1.5;

function StatItem({ value, label, place }: { value: string; label: string; place: string }) {
  return (
    <div className="tripdots-funfacts__stat">
      <span className="tripdots-funfacts__value">{value}</span>
      <span className="tripdots-funfacts__label">{label}</span>
      <span className="tripdots-funfacts__place">{place}</span>
    </div>
  );
}

export default function FunFactsCard({ facts }: FunFactsCardProps) {
  const monthNames = UI_COPY.tripDotsPage.monthNamesShort;

  return (
    <div className="tripdots-funfacts">
      <div className="tripdots-funfacts__grid">
        <StatItem
          value={UI_COPY.tripDotsPage.funFactsLatDeg(facts.northmost.lat)}
          label={UI_COPY.tripDotsPage.funFactsNorthmost}
          place={facts.northmost.label}
        />
        <StatItem
          value={UI_COPY.tripDotsPage.funFactsLatDeg(facts.southmost.lat)}
          label={UI_COPY.tripDotsPage.funFactsSouthmost}
          place={facts.southmost.label}
        />
        {facts.highestElevation && (
          <StatItem
            value={UI_COPY.tripDotsPage.funFactsElevationM(facts.highestElevation.elevationM)}
            label={UI_COPY.tripDotsPage.funFactsHighest}
            place={facts.highestElevation.label}
          />
        )}
        {facts.lowestElevation && (
          <StatItem
            value={UI_COPY.tripDotsPage.funFactsElevationM(facts.lowestElevation.elevationM)}
            label={UI_COPY.tripDotsPage.funFactsLowest}
            place={facts.lowestElevation.label}
          />
        )}
      </div>

      <div className="tripdots-funfacts__month">
        <span className="tripdots-funfacts__label">{UI_COPY.tripDotsPage.funFactsMonthlyDistance}</span>
        <div className="tripdots-funfacts__bar">
          {facts.monthlyDistance.map((entry) => (
            <div
              key={entry.month}
              className="tripdots-funfacts__bar-segment"
              style={{ flexGrow: Math.max(entry.pct, MIN_SEGMENT_FLEX) }}
              title={UI_COPY.tripDotsPage.funFactsMonthTooltip(monthNames[entry.month], entry.km, entry.pct)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
