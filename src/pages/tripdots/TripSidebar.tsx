import { Car, Plane } from 'lucide-react';
import { UI_COPY } from '../../configs/ui/uiCopy';
import type { TripSummary } from './content/tripDotsData';
import './TripSidebar.css';

type TripSidebarProps = {
  trips: TripSummary[];
  selectedTripId: string | null;
  onSelectTrip: (id: string | null) => void;
};

function formatDateRange(startTs: number, durationDays: number): string {
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const endTs = startTs + durationDays * 86400;
  return `${formatter.format(new Date(startTs * 1000))} – ${formatter.format(new Date(endTs * 1000))}`;
}

// Most trips are ground-only (flightDistanceKm === 0), so they keep the
// plain single figure — only a trip that actually includes a flight leg
// splits into the two icon+km parts, since lumping the two together
// otherwise overstates how far was actually driven (a road trip's mileage
// vs. a long-haul flight read very differently, even at the same km).
function DistanceSummary({ groundKm, flightKm }: { groundKm: number; flightKm: number }) {
  if (flightKm === 0) {
    return <span>{UI_COPY.tripDotsPage.distanceKm(groundKm)}</span>;
  }
  return (
    <span className="tripdots-sidebar__item-distance">
      {groundKm > 0 && (
        <span className="tripdots-sidebar__item-distance-part" title={UI_COPY.tripDotsPage.groundDistanceLabel}>
          <Car size={12} strokeWidth={2} aria-hidden="true" />
          {UI_COPY.tripDotsPage.distanceKm(groundKm)}
        </span>
      )}
      <span className="tripdots-sidebar__item-distance-part" title={UI_COPY.tripDotsPage.flightDistanceLabel}>
        <Plane size={12} strokeWidth={2} aria-hidden="true" />
        {UI_COPY.tripDotsPage.distanceKm(flightKm)}
      </span>
    </span>
  );
}

export default function TripSidebar({ trips, selectedTripId, onSelectTrip }: TripSidebarProps) {
  return (
    <div className="tripdots-sidebar">
      <div className="tripdots-sidebar__heading">
        <h2>{UI_COPY.tripDotsPage.tripsPanelTitle}</h2>
        <p>{UI_COPY.tripDotsPage.tripsPanelDetail(trips.length)}</p>
      </div>

      {trips.length === 0 ? (
        <div className="tripdots-sidebar__empty">{UI_COPY.tripDotsPage.noTripsInFilter}</div>
      ) : (
        <div className="tripdots-sidebar__list">
          {trips.map((trip) => {
            const isSelected = trip.id === selectedTripId;
            return (
              <button
                key={trip.id}
                type="button"
                className={`tripdots-sidebar__item${isSelected ? ' tripdots-sidebar__item--active' : ''}`}
                onClick={() => onSelectTrip(isSelected ? null : trip.id)}
              >
                <div className="tripdots-sidebar__item-title">{trip.title}</div>
                <div className="tripdots-sidebar__item-meta">
                  <span>{formatDateRange(trip.displayStartTs, trip.displayDurationDays)}</span>
                  <span>{UI_COPY.tripDotsPage.tripDurationDays(trip.displayDurationDays)}</span>
                  <DistanceSummary groundKm={trip.groundDistanceKm} flightKm={trip.flightDistanceKm} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
