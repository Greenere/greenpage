// Computed/derived fields, regenerated from raw GPS data on every build.
// "photo" trips are a one-off historical reconstruction from photo EXIF
// locations (2022-2023, before continuous GPS tracking starts) — sparser and
// less precise than "gps" trips (see scripts/trip_dots/photo-trips.mjs).
type TripIndexEntry = {
  id: string;
  startTs: number;
  endTs: number;
  placeNames: string[];
  distanceKm: number;
  bbox: [number, number, number, number];
  stayPoints: [number, number][];
  source: 'gps' | 'photo';
  homeCenterIds: string[];
};

// Human-editable fields, hand-tuned per trip and preserved across
// regenerations (see scripts/trip_dots/write-outputs.mjs) — displayStartTs/
// displayDurationDays may deliberately diverge slightly from the precisely
// computed startTs/endTs (e.g. rounding a trip to whole days for display).
type TripMetaEntry = {
  title: string;
  displayStartTs: number;
  displayDurationDays: number;
};

type TripsMeta = Record<string, TripMetaEntry>;

export type TripSummary = TripIndexEntry & TripMetaEntry;

export type HomeCenter = {
  id: string;
  label: string;
  center: [number, number];
  activeStart: number;
  activeEnd: number;
};

export type TripDotsMeta = {
  generatedAt: string;
  sourceRowCount: number;
  cleanedPointCount: number;
  tripCount: number;
  dateRange: { startTs: number; endTs: number };
};

export type FunFactPoint = {
  lat: number;
  lon: number;
  ts: number;
  label: string;
};

export type FunFacts = {
  northmost: FunFactPoint;
  southmost: FunFactPoint;
  highestElevation: (FunFactPoint & { elevationM: number }) | null;
  lowestElevation: (FunFactPoint & { elevationM: number }) | null;
  monthlyDistance: { month: number; km: number; pct: number }[];
};

const TRIPDOTS_BASE_URL = `${import.meta.env.BASE_URL}data/tripdots`;

function fetchJson<T>(path: string): Promise<T> {
  return fetch(`${TRIPDOTS_BASE_URL}/${path}`).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json() as Promise<T>;
  });
}

let tripsIndexPromise: Promise<TripSummary[]> | null = null;
export function loadTripsIndex(): Promise<TripSummary[]> {
  if (!tripsIndexPromise) {
    tripsIndexPromise = Promise.all([
      fetchJson<TripIndexEntry[]>('trips-index.json'),
      fetchJson<TripsMeta>('trips-meta.json'),
    ]).then(([index, meta]) => index.map((entry) => ({ ...entry, ...meta[entry.id] })));
  }
  return tripsIndexPromise;
}

let homeCentersPromise: Promise<HomeCenter[]> | null = null;
export function loadHomeCenters(): Promise<HomeCenter[]> {
  if (!homeCentersPromise) {
    homeCentersPromise = fetchJson<HomeCenter[]>('home-centers.json');
  }
  return homeCentersPromise;
}

let metaPromise: Promise<TripDotsMeta> | null = null;
export function loadMeta(): Promise<TripDotsMeta> {
  if (!metaPromise) {
    metaPromise = fetchJson<TripDotsMeta>('meta.json');
  }
  return metaPromise;
}

let funFactsPromise: Promise<FunFacts> | null = null;
export function loadFunFacts(): Promise<FunFacts> {
  if (!funFactsPromise) {
    funFactsPromise = fetchJson<FunFacts>('fun-facts.json');
  }
  return funFactsPromise;
}

let overviewTripsPromise: Promise<GeoJSON.FeatureCollection> | null = null;
export function loadOverviewTrips(): Promise<GeoJSON.FeatureCollection> {
  if (!overviewTripsPromise) {
    overviewTripsPromise = fetchJson<GeoJSON.FeatureCollection>('overview-trips.geojson');
  }
  return overviewTripsPromise;
}

let allTrailsPromise: Promise<GeoJSON.FeatureCollection> | null = null;
export function loadAllTrails(): Promise<GeoJSON.FeatureCollection> {
  if (!allTrailsPromise) {
    allTrailsPromise = fetchJson<GeoJSON.FeatureCollection>('all-trails.geojson');
  }
  return allTrailsPromise;
}

const tripDetailCache = new Map<string, Promise<GeoJSON.FeatureCollection>>();
export function loadTripDetail(tripId: string): Promise<GeoJSON.FeatureCollection> {
  let cached = tripDetailCache.get(tripId);
  if (!cached) {
    cached = fetchJson<GeoJSON.FeatureCollection>(`trips/${tripId}.geojson`);
    tripDetailCache.set(tripId, cached);
  }
  return cached;
}

export function tripDotsBasemapUrl(): string {
  return `${TRIPDOTS_BASE_URL}/basemap.pmtiles`;
}

// Higher-detail extract covering just California + neighboring states (see
// scripts/trip_dots/README.md for the bbox/maxzoom it was built with) — swapped
// in only when the selected trip's bbox falls entirely inside that region,
// since it has no data at all outside it.
export function tripDotsRegionalBasemapUrl(): string {
  return `${TRIPDOTS_BASE_URL}/basemap-ca.pmtiles`;
}
