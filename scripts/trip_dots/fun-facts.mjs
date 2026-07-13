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

  const monthlyDistanceKm = new Array(12).fill(0);
  for (const trip of trips) {
    const month = new Date(trip.startTs * 1000).getUTCMonth();
    monthlyDistanceKm[month] += trip.totalDistanceKm;
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
