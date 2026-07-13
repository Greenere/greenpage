import { UI_COPY } from '../../configs/ui/uiCopy';
import './DisplayToggles.css';

type DisplayTogglesProps = {
  showDots: boolean;
  onShowDotsChange: (value: boolean) => void;
  showRoutes: boolean;
  onShowRoutesChange: (value: boolean) => void;
  showFlights: boolean;
  onShowFlightsChange: (value: boolean) => void;
  highlightOvernight: boolean;
  onHighlightOvernightChange: (value: boolean) => void;
};

export default function DisplayToggles({
  showDots,
  onShowDotsChange,
  showRoutes,
  onShowRoutesChange,
  showFlights,
  onShowFlightsChange,
  highlightOvernight,
  onHighlightOvernightChange,
}: DisplayTogglesProps) {
  return (
    <div className="tripdots-display-toggles">
      <button
        type="button"
        aria-pressed={showDots}
        className={`tripdots-display-toggles__chip${showDots ? ' tripdots-display-toggles__chip--active' : ''}`}
        onClick={() => onShowDotsChange(!showDots)}
      >
        {UI_COPY.tripDotsPage.showDotsToggle}
      </button>
      <button
        type="button"
        aria-pressed={showRoutes}
        className={`tripdots-display-toggles__chip${showRoutes ? ' tripdots-display-toggles__chip--active' : ''}`}
        onClick={() => onShowRoutesChange(!showRoutes)}
      >
        {UI_COPY.tripDotsPage.showRoutesToggle}
      </button>
      <button
        type="button"
        aria-pressed={showFlights}
        className={`tripdots-display-toggles__chip${showFlights ? ' tripdots-display-toggles__chip--active' : ''}`}
        onClick={() => onShowFlightsChange(!showFlights)}
      >
        {UI_COPY.tripDotsPage.showFlightsToggle}
      </button>
      <button
        type="button"
        aria-pressed={highlightOvernight}
        className={`tripdots-display-toggles__chip${highlightOvernight ? ' tripdots-display-toggles__chip--active' : ''}`}
        onClick={() => onHighlightOvernightChange(!highlightOvernight)}
      >
        {UI_COPY.tripDotsPage.highlightOvernightToggle}
      </button>
    </div>
  );
}
