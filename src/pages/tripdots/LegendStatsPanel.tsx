import { UI_COPY } from '../../configs/ui/uiCopy';
import './LegendStatsPanel.css';

type LegendStatsPanelProps = {
  tripCount: number;
  totalDistanceKm: number;
  placeCount: number;
};

export default function LegendStatsPanel({ tripCount, totalDistanceKm, placeCount }: LegendStatsPanelProps) {
  return (
    <div className="tripdots-legend">
      <div className="tripdots-legend__stat">
        <span className="tripdots-legend__value">{tripCount}</span>
        <span className="tripdots-legend__label">{UI_COPY.tripDotsPage.legendTripsLabel}</span>
      </div>
      <div className="tripdots-legend__stat">
        <span className="tripdots-legend__value">{UI_COPY.tripDotsPage.distanceKm(totalDistanceKm)}</span>
        <span className="tripdots-legend__label">{UI_COPY.tripDotsPage.legendDistanceLabel}</span>
      </div>
      <div className="tripdots-legend__stat">
        <span className="tripdots-legend__value">{placeCount}</span>
        <span className="tripdots-legend__label">{UI_COPY.tripDotsPage.legendPlacesLabel}</span>
      </div>
    </div>
  );
}
