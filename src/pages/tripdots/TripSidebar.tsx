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
                  <span>{UI_COPY.tripDotsPage.distanceKm(trip.distanceKm)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
