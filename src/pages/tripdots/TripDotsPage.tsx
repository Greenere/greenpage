import { useEffect, useMemo, useState } from 'react';
import { Camera, Globe, Map, Route } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { PAGE_BACK_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import { applyThemeVars } from '../../shared/styles/colors';
import { navigateWithViewTransition } from '../../shared/ui/viewTransitions';
import DetailPageLanguageToggle from '../graph/DetailPageLanguageToggle';
import ThemePicker from '../graph/ThemePicker';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from '../graph/content/BioTheme';
import DetailPageSkeleton from '../../shared/ui/DetailPageSkeleton';
import DisplayToggles from './DisplayToggles';
import FunFactsCard from './FunFactsCard';
import LegendStatsPanel from './LegendStatsPanel';
import TimeRangeSlider from './TimeRangeSlider';
import TripDotsMap from './TripDotsMap';
import TripSidebar from './TripSidebar';
import {
  loadFunFacts,
  loadHomeCenters,
  loadMeta,
  loadTripsIndex,
  type FunFacts,
  type HomeCenter,
  type TripDotsMeta,
  type TripSummary,
} from './content/tripDotsData';
import './TripDotsPage.css';

export default function TripDotsPage() {
  const navigate = useNavigate();
  useAppLanguage(); // subscribes to language context so UI_COPY re-renders on toggle
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [homeCenters, setHomeCenters] = useState<HomeCenter[]>([]);
  const [meta, setMeta] = useState<TripDotsMeta | null>(null);
  const [funFacts, setFunFacts] = useState<FunFacts | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);
  const [viewMode, setViewMode] = useState<'globe' | 'flat'>('globe');
  const [showingAllTrails, setShowingAllTrails] = useState(false);
  const [showPhotoTrips, setShowPhotoTrips] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showFlights, setShowFlights] = useState(true);
  const [highlightOvernight, setHighlightOvernight] = useState(false);

  const handleSelectTrip = (id: string | null) => {
    setSelectedTripId(id);
    if (id) setShowingAllTrails(false);
  };

  const handleToggleAllTrails = () => {
    setShowingAllTrails((prev) => {
      const next = !prev;
      if (next) setSelectedTripId(null);
      return next;
    });
  };

  const handleThemeChange = (nextTheme: Theme) => {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const handleBackToGraph = () => {
    navigateWithViewTransition(
      () => {
        navigate('/');
      },
      { transitionConfig: PAGE_BACK_TRANSITION_CONFIG },
    );
  };

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setTheme(readStoredTheme());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTripsIndex(), loadHomeCenters(), loadMeta(), loadFunFacts()]).then(
      ([tripsIndex, homes, metaPayload, funFactsPayload]) => {
        if (cancelled) return;
        setTrips(tripsIndex);
        setHomeCenters(homes);
        setMeta(metaPayload);
        setFunFacts(funFactsPayload);
        setTimeRange([metaPayload.dateRange.startTs, metaPayload.dateRange.endTs]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setViewMode(selectedTripId ? 'flat' : 'globe');
  }, [selectedTripId]);

  const visibleTrips = useMemo(() => {
    if (!trips) return [];
    return trips.filter((trip) => {
      if (timeRange && (trip.endTs < timeRange[0] || trip.startTs > timeRange[1])) return false;
      if (trip.source === 'photo' && !showPhotoTrips) return false;
      return true;
    });
  }, [trips, timeRange, showPhotoTrips]);

  useEffect(() => {
    if (selectedTripId && !visibleTrips.some((trip) => trip.id === selectedTripId)) {
      setSelectedTripId(null);
    }
  }, [visibleTrips, selectedTripId]);

  const selectedTrip = useMemo(
    () => visibleTrips.find((trip) => trip.id === selectedTripId) ?? null,
    [visibleTrips, selectedTripId],
  );

  const totalDistanceKm = useMemo(
    () => visibleTrips.reduce((sum, trip) => sum + trip.distanceKm, 0),
    [visibleTrips],
  );
  const placeCount = useMemo(() => {
    const places = new Set<string>();
    for (const trip of visibleTrips) {
      for (const place of trip.placeNames) places.add(place);
    }
    return places.size;
  }, [visibleTrips]);

  const visibleTripIds = useMemo(() => visibleTrips.map((trip) => trip.id), [visibleTrips]);

  // Trips are generated in chronological order — show the newest first.
  const visibleTripsNewestFirst = useMemo(() => [...visibleTrips].reverse(), [visibleTrips]);

  if (!trips || !meta || !timeRange) {
    return <DetailPageSkeleton variant="node" />;
  }

  return (
    <div className="tripdots-page">
      <div className="tripdots-page__map-layer">
        <TripDotsMap
          homeCenters={homeCenters}
          visibleTripIds={visibleTripIds}
          selectedTripId={selectedTripId}
          selectedTrip={selectedTrip}
          viewMode={viewMode}
          showingAllTrails={showingAllTrails}
          showDots={showDots}
          showRoutes={showRoutes}
          showFlights={showFlights}
          highlightOvernight={highlightOvernight}
        />
      </div>

      <div className="tripdots-page__topbar">
        <Link
          to="/"
          className="node-card-detail-link node-page-back-link"
          onClick={(event) => {
            event.preventDefault();
            handleBackToGraph();
          }}
        >
          <span>{UI_COPY.nodeDetailPage.backToGraph}</span>
        </Link>
        <div className="tripdots-page__actions">
          <DetailPageLanguageToggle />
          <ThemePicker theme={theme} setTheme={handleThemeChange} variant="inline" />
        </div>
      </div>

      <div className="tripdots-page__intro">
        <div className="tripdots-page__eyebrow">{UI_COPY.tripDotsPage.eyebrow}</div>
        <h1 className="tripdots-page__title">{UI_COPY.tripDotsPage.title}</h1>
        <p className="tripdots-page__subtitle">{UI_COPY.tripDotsPage.subtitle}</p>
        {funFacts ? <FunFactsCard facts={funFacts} /> : null}
      </div>

      <div className="tripdots-page__bottom-left-controls">
        <div className="tripdots-page__view-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'globe'}
            aria-label={UI_COPY.tripDotsPage.viewModeGlobe}
            title={UI_COPY.tripDotsPage.viewModeGlobe}
            className={`tripdots-page__view-button${viewMode === 'globe' ? ' tripdots-page__view-button--active' : ''}`}
            onClick={() => setViewMode('globe')}
          >
            <Globe size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'flat'}
            aria-label={UI_COPY.tripDotsPage.viewModeFlat}
            title={UI_COPY.tripDotsPage.viewModeFlat}
            className={`tripdots-page__view-button${viewMode === 'flat' ? ' tripdots-page__view-button--active' : ''}`}
            onClick={() => setViewMode('flat')}
          >
            <Map size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          aria-label={UI_COPY.tripDotsPage.allTrailsButton}
          title={UI_COPY.tripDotsPage.allTrailsButton}
          className={`tripdots-page__all-trails-button${showingAllTrails ? ' tripdots-page__all-trails-button--active' : ''}`}
          onClick={handleToggleAllTrails}
        >
          <Route size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={UI_COPY.tripDotsPage.photoTripsButton}
          title={UI_COPY.tripDotsPage.photoTripsButton}
          className={`tripdots-page__all-trails-button${showPhotoTrips ? ' tripdots-page__all-trails-button--active' : ''}`}
          onClick={() => setShowPhotoTrips((prev) => !prev)}
        >
          <Camera size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="tripdots-page__panel">
        <div className="tripdots-page__panel-content">
          <LegendStatsPanel tripCount={visibleTrips.length} totalDistanceKm={totalDistanceKm} placeCount={placeCount} />
          <DisplayToggles
            showDots={showDots}
            onShowDotsChange={setShowDots}
            showRoutes={showRoutes}
            onShowRoutesChange={setShowRoutes}
            showFlights={showFlights}
            onShowFlightsChange={setShowFlights}
            highlightOvernight={highlightOvernight}
            onHighlightOvernightChange={setHighlightOvernight}
          />
          <TimeRangeSlider
            min={meta.dateRange.startTs}
            max={meta.dateRange.endTs}
            value={timeRange}
            onChange={setTimeRange}
          />
          <TripSidebar trips={visibleTripsNewestFirst} selectedTripId={selectedTripId} onSelectTrip={handleSelectTrip} />
        </div>
      </div>
    </div>
  );
}
