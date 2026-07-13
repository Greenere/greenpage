import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gridCellKey } from './geo-utils.mjs';
import { NOMINATIM_THROTTLE_MS, NOMINATIM_USER_AGENT, GEOCODE_CACHE_PRECISION } from './constants.mjs';

const LABEL_DEDUP_CELL_KM = 15; // city-scale: avoids one Nominatim call per stay

const CACHE_PATH = path.resolve(import.meta.dirname, 'geocode-cache.json');

function cacheKey(lon, lat) {
  return `${lat.toFixed(GEOCODE_CACHE_PRECISION)},${lon.toFixed(GEOCODE_CACHE_PRECISION)}`;
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

function labelFromAddress(address, displayName) {
  if (!address) return displayName ?? 'Unknown location';
  const place = address.city || address.town || address.village || address.county || address.state_district;
  const region = address.state || address.region;
  const country = address.country;
  return [place, region && region !== place ? region : null, country].filter(Boolean).join(', ') || displayName;
}

async function reverseGeocode(lon, lat) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const response = await fetch(url, { headers: { 'User-Agent': NOMINATIM_USER_AGENT } });
  if (!response.ok) throw new Error(`Nominatim request failed: ${response.status}`);
  const data = await response.json();
  return labelFromAddress(data.address, data.display_name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Stage F: reverse-geocode {lon, lat} centroids into place labels, throttled
// to Nominatim's 1 req/sec usage policy. Centroids are first deduplicated at
// city-scale (~15km grid cells) — a trip's dozens of stays in the same city
// would otherwise each cost a separate network call. Results are cached on
// disk (keyed by rounded lat/lon of the representative point) and committed
// to git, so re-runs only hit the network for genuinely new places.
export async function geocodeCentroids(centroids) {
  const cache = await loadCache();
  const representativeByCell = new Map();
  for (const { lon, lat } of centroids) {
    const cell = gridCellKey(lon, lat, LABEL_DEDUP_CELL_KM);
    if (!representativeByCell.has(cell)) representativeByCell.set(cell, { lon, lat });
  }

  const labels = new Map();
  let cacheDirty = false;

  for (const [cell, { lon, lat }] of representativeByCell) {
    const key = cacheKey(lon, lat);
    if (cache[key]) {
      labels.set(cell, cache[key]);
      continue;
    }
    const label = await reverseGeocode(lon, lat).catch(() => 'Unknown location');
    cache[key] = label;
    labels.set(cell, label);
    cacheDirty = true;
    await sleep(NOMINATIM_THROTTLE_MS);
  }

  if (cacheDirty) await saveCache(cache);
  return (lon, lat) => labels.get(gridCellKey(lon, lat, LABEL_DEDUP_CELL_KM)) ?? 'Unknown location';
}
