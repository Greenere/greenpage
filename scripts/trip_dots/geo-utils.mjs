const EARTH_RADIUS_M = 6371000;

// Fast haversine distance in meters, used in hot loops (stay-point detection
// runs this per-point over ~1M rows) — avoids per-call turf/point object overhead.
export function haversineDistanceM(lon1, lat1, lon2, lat2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function haversineDistanceKm(lon1, lat1, lon2, lat2) {
  return haversineDistanceM(lon1, lat1, lon2, lat2) / 1000;
}

const KM_PER_DEGREE = 111;

// Approximate square grid cell key at ~cellKm resolution, used to bucket
// points/stays geographically without a full spatial index.
export function gridCellKey(lon, lat, cellKm) {
  const cellDeg = cellKm / KM_PER_DEGREE;
  return `${Math.floor(lon / cellDeg)}:${Math.floor(lat / cellDeg)}`;
}

// Crude UTC-offset estimate from longitude (no timezone database) — good
// enough for the "was this stay overnight" / "is this dwell a home-like
// overnight presence" heuristics, not for precise local-time display.
export function estimateLocalHour(ts, lon) {
  const utcHour = new Date(ts * 1000).getUTCHours();
  const offset = Math.round(lon / 15);
  return ((utcHour + offset) % 24 + 24) % 24;
}

export function isNightHour(hour, nightStartHour, nightEndHour) {
  return hour >= nightStartHour || hour < nightEndHour;
}
