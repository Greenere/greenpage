import { haversineDistanceKm } from './geo-utils.mjs';
import { ALTITUDE_SENTINEL_M } from './constants.mjs';

// Fun facts for the intro card: geographic extremes (lat/lon + the ground
// elevation extremes) plus a month-of-year breakdown of trip distance
// (aggregated across every year in range, so it reads as "which month do I
// travel most").
export function computeFunFacts(cleanedPoints, trips, stays) {
  let northmost = null;
  let southmost = null;
  let highest = null;
  let lowest = null;

  // Elevation extremes only consider points that fall within a detected stay
  // (dwelled >=20 min at low displacement) — momentary altitude readings
  // during a flight's climb/descent aren't reliably excluded by the
  // FLIGHT_ALTITUDE_THRESHOLD_M cutoff alone (a descent passes through every
  // altitude below it) and this dataset has confirmed bogus ~5950-6000m
  // readings recurring across several unrelated flight days — well above
  // any real paved road. A fast-moving descent point never lands inside a
  // real ground stay, so this filters them out without an arbitrary second
  // altitude cutoff.
  let stayIndex = 0;

  for (const point of cleanedPoints) {
    if (!northmost || point.lat > northmost.lat) northmost = point;
    if (!southmost || point.lat < southmost.lat) southmost = point;

    while (stayIndex < stays.length - 1 && point.ts > stays[stayIndex].endTs) stayIndex++;
    const currentStay = stays[stayIndex];
    const isDuringStay = currentStay && point.ts >= currentStay.startTs && point.ts <= currentStay.endTs;
    if (isDuringStay && Number.isFinite(point.altitude) && point.altitude !== ALTITUDE_SENTINEL_M) {
      if (!highest || point.altitude > highest.altitude) highest = point;
      if (!lowest || point.altitude < lowest.altitude) lowest = point;
    }
  }

  // Attributed hop-by-hop (not the trip's whole distance dumped into its
  // start month) — a trip spanning a month boundary, or a multi-month trip
  // like a long road trip, would otherwise wildly overcount whichever month
  // it happened to start in. Photo-derived trips have no continuous trace
  // (no trip.points), so their stay centroids stand in as hop endpoints —
  // the same straight-line approximation already used for their distance
  // and line rendering elsewhere (see photo-trips.mjs / planPhotoTripSegments).
  const monthlyDistanceKm = new Array(12).fill(0);
  for (const trip of trips) {
    const points = trip.points ?? trip.stays.map((stay) => ({ lon: stay.lon, lat: stay.lat, ts: (stay.startTs + stay.endTs) / 2 }));
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const midTs = (a.ts + b.ts) / 2;
      const month = new Date(midTs * 1000).getUTCMonth();
      monthlyDistanceKm[month] += haversineDistanceKm(a.lon, a.lat, b.lon, b.lat);
    }
  }
  const totalDistanceKm = monthlyDistanceKm.reduce((sum, km) => sum + km, 0);

  return {
    northmost,
    southmost,
    highest,
    lowest,
    monthlyDistanceKm,
    totalDistanceKm,
  };
}
