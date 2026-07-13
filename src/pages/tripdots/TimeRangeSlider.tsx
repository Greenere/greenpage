import { UI_COPY } from '../../configs/ui/uiCopy';
import './TimeRangeSlider.css';

type TimeRangeSliderProps = {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
};

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(ts * 1000),
  );
}

export default function TimeRangeSlider({ min, max, value, onChange }: TimeRangeSliderProps) {
  const [start, end] = value;
  const isFullRange = start <= min && end >= max;

  return (
    <div className="tripdots-time-slider">
      <div className="tripdots-time-slider__label">
        <span>{UI_COPY.tripDotsPage.timeRangeLabel}</span>
        <span className="tripdots-time-slider__value">
          {isFullRange ? UI_COPY.tripDotsPage.allTimeLabel : `${formatDate(start)} – ${formatDate(end)}`}
        </span>
      </div>
      <div className="tripdots-time-slider__track">
        <input
          type="range"
          min={min}
          max={max}
          value={start}
          onChange={(event) => onChange([Math.min(Number(event.target.value), end), end])}
          aria-label={`${UI_COPY.tripDotsPage.timeRangeLabel} start`}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={end}
          onChange={(event) => onChange([start, Math.max(Number(event.target.value), start)])}
          aria-label={`${UI_COPY.tripDotsPage.timeRangeLabel} end`}
        />
      </div>
    </div>
  );
}
