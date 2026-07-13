import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { haversineDistanceKm } from './geo-utils.mjs';
import {
  ROUTE_RECOVERY_MAX_RAW_SPEED_KMH,
  ROUTE_MAX_DISTANCE_RATIO,
  ROUTE_DURATION_SLACK_RATIO,
  ROUTE_CACHE_PRECISION,
  ROUTE_THROTTLE_MS,
  OSRM_USER_AGENT,
} from './constants.mjs';

const CACHE_PATH = path.resolve(import.meta.dirname, 'route-cache.json');
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

function cacheKey(a, b) {
  const round = (n) => n.toFixed(ROUTE_CACHE_PRECISION);
  return `${round(a.lon)},${round(a.lat)};${round(b.lon)},${round(b.lat)}`;
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOsrmRoute(a, b) {
  const url = `${OSRM_ROUTE_URL}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  const response = await fetch(url, { headers: { 'User-Agent': OSRM_USER_AGENT } });
  if (!response.ok) return null;
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    coordinates: route.geometry.coordinates,
    distanceKm: route.distance / 1000,
    durationHours: route.duration / 3600,
  };
}

// Attempts to recover a plausible driving route for each gap hop. Two kinds
// of hop are passed in:
//  - intra-trip gaps, where both endpoints have a real `ts` — validated on
//    both distance and duration (driving it must fit in the time actually
//    observed, or it almost certainly wasn't driven — i.e. it was a flight).
//  - departure/return "close the loop" hops out to a home center, where the
//    home endpoint has no associated `ts` — there's no reliable time budget
//    to validate against, so these are judged on distance plausibility alone
//    (a genuinely undrivable hop, e.g. across the Darién Gap, simply won't
//    resolve to a route at all).
// Results are cached on disk (keyed by rounded endpoints, shared across
// trips) so re-runs only hit the network for genuinely new hops. Returns a
// Map from hop.key to `{coordinates}` for hops judged plausible — callers
// should fall back to a straight line for any hop missing from the map.
export async function recoverDriveSegments(hops) {
  const cache = await loadCache();
  const recovered = new Map();
  let cacheDirty = false;

  for (const hop of hops) {
    const { key: hopKey, a, b } = hop;
    const distanceKm = haversineDistanceKm(a.lon, a.lat, b.lon, b.lat);
    const hasTiming = typeof a.ts === 'number' && typeof b.ts === 'number';
    const timeHours = hasTiming ? (b.ts - a.ts) / 3600 : null;

    if (hasTiming) {
      const rawSpeedKmh = timeHours > 0 ? distanceKm / timeHours : Infinity;
      if (rawSpeedKmh >= ROUTE_RECOVERY_MAX_RAW_SPEED_KMH) continue;
    }

    const routeKey = cacheKey(a, b);
    let route = cache[routeKey];
    if (route === undefined) {
      route = await fetchOsrmRoute(a, b).catch(() => null);
      cache[routeKey] = route;
      cacheDirty = true;
      await sleep(ROUTE_THROTTLE_MS);
    }
    if (!route) continue;

    const distancePlausible = route.distanceKm <= distanceKm * ROUTE_MAX_DISTANCE_RATIO;
    const durationPlausible = !hasTiming || route.durationHours <= timeHours * ROUTE_DURATION_SLACK_RATIO;
    if (distancePlausible && durationPlausible) {
      recovered.set(hopKey, { coordinates: route.coordinates });
    }
  }

  if (cacheDirty) await saveCache(cache);
  return recovered;
}
