import { useState } from 'react';
import { UI_COPY } from '../../configs/ui/uiCopy';
import type { FunFacts } from './content/tripDotsData';
import './FunFactsCard.css';

type FunFactsCardProps = {
  facts: FunFacts;
};

// Everything is laid out in a fixed viewBox, centered on the "globe" —
// coordinates below are all relative to this box, not real geography (the
// globe is decorative, not a projection).
const SIZE = 176;
const CENTER = SIZE / 2;
const GLOBE_R = 32;
const RING_INNER_R = 40;
const RING_MAX_OUTER_R = 78;
const RING_GAP_DEG = 3;
const MARKER_R = 3.5;
// A month with genuinely zero recorded distance still gets a sliver here —
// otherwise it'd be a zero-thickness, unhoverable gap in the ring.
const MIN_RING_THICKNESS = 3;

function polarPoint(r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

// An annulus wedge (donut segment) between two radii and two angles — the
// month ring is built from twelve of these rather than a pie/sector, so
// distance is encoded as radial thickness (like a bar chart bent into a
// circle), not swept angle.
function wedgePath(innerR: number, outerR: number, startAngle: number, endAngle: number) {
  const outerStart = polarPoint(outerR, startAngle);
  const outerEnd = polarPoint(outerR, endAngle);
  const innerEnd = polarPoint(innerR, endAngle);
  const innerStart = polarPoint(innerR, startAngle);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function FunFactsCard({ facts }: FunFactsCardProps) {
  const monthNames = UI_COPY.tripDotsPage.monthNamesShort;
  const maxPct = Math.max(...facts.monthlyDistance.map((entry) => entry.pct), 0.0001);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  const markers = [
    { angle: 0, label: UI_COPY.tripDotsPage.funFactsNorthmost, value: UI_COPY.tripDotsPage.funFactsLatDeg(facts.northmost.lat), place: facts.northmost.label },
    facts.highestElevation && {
      angle: 90,
      label: UI_COPY.tripDotsPage.funFactsHighest,
      value: UI_COPY.tripDotsPage.funFactsElevationM(facts.highestElevation.elevationM),
      place: facts.highestElevation.label,
    },
    { angle: 180, label: UI_COPY.tripDotsPage.funFactsSouthmost, value: UI_COPY.tripDotsPage.funFactsLatDeg(facts.southmost.lat), place: facts.southmost.label },
    facts.lowestElevation && {
      angle: 270,
      label: UI_COPY.tripDotsPage.funFactsLowest,
      value: UI_COPY.tripDotsPage.funFactsElevationM(facts.lowestElevation.elevationM),
      place: facts.lowestElevation.label,
    },
  ].filter((marker): marker is { angle: number; label: string; value: string; place: string } => Boolean(marker));

  return (
    <div className="tripdots-funfacts">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="tripdots-funfacts__globe"
        role="img"
        aria-label={UI_COPY.tripDotsPage.funFactsChartLabel}
        onMouseLeave={() => setHoverInfo(null)}
      >
        <defs>
          <radialGradient id="tripdots-funfacts-sphere" cx="35%" cy="30%" r="75%">
            <stop offset="0%" className="tripdots-funfacts__sphere-stop-start" />
            <stop offset="100%" className="tripdots-funfacts__sphere-stop-end" />
          </radialGradient>
        </defs>

        {facts.monthlyDistance.map((entry) => {
          const startAngle = entry.month * 30 + RING_GAP_DEG / 2;
          const endAngle = (entry.month + 1) * 30 - RING_GAP_DEG / 2;
          const thickness = Math.max((entry.pct / maxPct) * (RING_MAX_OUTER_R - RING_INNER_R), MIN_RING_THICKNESS);
          const tooltip = UI_COPY.tripDotsPage.funFactsMonthTooltip(monthNames[entry.month], entry.km, entry.pct);
          return (
            <path
              key={entry.month}
              className="tripdots-funfacts__wedge"
              d={wedgePath(RING_INNER_R, RING_INNER_R + thickness, startAngle, endAngle)}
              onMouseEnter={() => setHoverInfo(tooltip)}
              onFocus={() => setHoverInfo(tooltip)}
              tabIndex={0}
            >
              <title>{tooltip}</title>
            </path>
          );
        })}

        <circle cx={CENTER} cy={CENTER} r={GLOBE_R} className="tripdots-funfacts__sphere" />
        <ellipse cx={CENTER} cy={CENTER} rx={GLOBE_R} ry={GLOBE_R * 0.32} className="tripdots-funfacts__meridian" />
        <ellipse cx={CENTER} cy={CENTER} rx={GLOBE_R * 0.32} ry={GLOBE_R} className="tripdots-funfacts__meridian" />
        <line x1={CENTER - GLOBE_R} y1={CENTER} x2={CENTER + GLOBE_R} y2={CENTER} className="tripdots-funfacts__meridian" />

        {markers.map((marker) => {
          const pos = polarPoint(GLOBE_R, marker.angle);
          const tooltip = UI_COPY.tripDotsPage.funFactsPointTooltip(marker.label, marker.value, marker.place);
          return (
            <circle
              key={marker.angle}
              cx={pos.x}
              cy={pos.y}
              r={MARKER_R}
              className="tripdots-funfacts__marker"
              onMouseEnter={() => setHoverInfo(tooltip)}
              onFocus={() => setHoverInfo(tooltip)}
              tabIndex={0}
            >
              <title>{tooltip}</title>
            </circle>
          );
        })}
      </svg>
      <div className="tripdots-funfacts__readout">{hoverInfo ?? UI_COPY.tripDotsPage.funFactsHoverHint}</div>
    </div>
  );
}
