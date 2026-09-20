import { haversineDistanceKm } from './geo-utils.mjs';

export function monthYearLabel(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// The default title write-outputs.mjs seeds trips-meta.json with for a
// genuinely new trip id, and what trip_extract.mjs proposes as a candidate's
// starting-point title for review before that happens.
export function defaultTripTitle(trip, getLabel) {
  const central = getCentralStay(trip);
  return `${getLabel(central.lon, central.lat)} · ${monthYearLabel(trip.startTs)}`;
}

// Consecutive stays at the same place collapse into one entry — used for
// trips-index.json's placeNames and, by trip_extract.mjs, for a candidate's
// review summary.
export function buildPlaceNames(trip, getLabel) {
  const placeNames = [];
  for (const stay of trip.stays) {
    const label = getLabel(stay.lon, stay.lat);
    if (placeNames[placeNames.length - 1] !== label) placeNames.push(label);
  }
  return placeNames;
}

// Finds the stay closest to the duration-weighted centroid of a trip's
// away-stays — a better "what was this trip about" anchor than picking
// whichever single stay happened to have the longest duration, which can
// land on an atypical outlier (e.g. one long hotel night far from the
// places the trip was actually centered on).
export function getCentralStay(trip) {
  const awayStays = trip.stays.filter((stay) => !stay.isHome);
  const candidates = awayStays.length > 0 ? awayStays : trip.stays;

  let sumLon = 0;
  let sumLat = 0;
  let sumWeight = 0;
  for (const stay of candidates) {
    sumLon += stay.lon * stay.durationMin;
    sumLat += stay.lat * stay.durationMin;
    sumWeight += stay.durationMin;
  }
  const centroidLon = sumLon / sumWeight;
  const centroidLat = sumLat / sumWeight;

  let closest = candidates[0];
  let closestDistanceKm = Infinity;
  for (const stay of candidates) {
    const distanceKm = haversineDistanceKm(stay.lon, stay.lat, centroidLon, centroidLat);
    if (distanceKm < closestDistanceKm) {
      closestDistanceKm = distanceKm;
      closest = stay;
    }
  }
  return closest;
}
