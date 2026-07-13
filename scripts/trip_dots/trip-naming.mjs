import { haversineDistanceKm } from './geo-utils.mjs';

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
