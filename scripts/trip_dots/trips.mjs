import { haversineDistanceKm } from './geo-utils.mjs';
import { HOME_LAYOVER_MAX_HOURS, TRIP_MIN_DISTANCE_KM, TRIP_MIN_DURATION_HOURS } from './constants.mjs';

function findHomeCenter(homeCenters, id) {
  return homeCenters.find((home) => home.id === id) ?? homeCenters[0] ?? null;
}

// Stage E: walk the chronological, classified stay sequence and group
// consecutive away stays (allowing brief home layovers) into candidate trips.
// Also records the real boundary timestamps — when the preceding confirmed
// home stay ended, and when the following one began — so the departure and
// return legs can later be validated against the time actually available,
// rather than left unvalidated (see write-outputs.mjs / route-recovery.mjs).
function groupIntoRawTrips(classifiedStays) {
  const rawTrips = [];
  let current = null;
  let previousStay = null;

  for (const stay of classifiedStays) {
    if (!stay.isPreHome && !stay.isHome) {
      if (!current) {
        current = { stays: [], precedingHomeStayEndTs: previousStay?.isHome ? previousStay.endTs : null };
      }
      current.stays.push(stay);
    } else if (!stay.isPreHome && stay.isHome && current) {
      const homeDurationHours = stay.durationMin / 60;
      if (homeDurationHours <= HOME_LAYOVER_MAX_HOURS) {
        current.stays.push(stay);
      } else {
        current.followingHomeStayStartTs = stay.startTs;
        rawTrips.push(current);
        current = null;
      }
    }
    previousStay = stay;
  }
  if (current) rawTrips.push(current);
  return rawTrips;
}

// Stage E (continued): attach the raw cleaned points within each trip's time
// window (for accurate distance/bbox), compute totals, and drop anything
// that doesn't clear the min distance-from-home/duration bar.
export function segmentTrips(classifiedStays, rawPoints, homeCenters) {
  const rawTrips = groupIntoRawTrips(classifiedStays);
  const trips = [];
  let cursor = 0;

  for (const raw of rawTrips) {
    const startTs = raw.stays[0].startTs;
    const endTs = raw.stays[raw.stays.length - 1].endTs;

    // Widen the point window out to the surrounding confirmed-home
    // boundaries (not just the first/last *away* stay) — real tracked
    // departure/return driving happens before a stay far enough from home to
    // register as "away" is even detected, so using only startTs/endTs here
    // was silently discarding real GPS trace in favor of a synthetic
    // gap/recovered-route guess in write-outputs.mjs.
    const windowStartTs = raw.precedingHomeStayEndTs ?? startTs;
    const windowEndTs = raw.followingHomeStayStartTs ?? endTs;

    while (cursor < rawPoints.length && rawPoints[cursor].ts < windowStartTs) cursor++;
    const startIdx = cursor;
    let endIdx = startIdx;
    while (endIdx < rawPoints.length && rawPoints[endIdx].ts <= windowEndTs) endIdx++;
    const tripPoints = rawPoints.slice(startIdx, endIdx);
    cursor = endIdx; // trips are chronological & non-overlapping, safe to leave cursor here

    const home = findHomeCenter(homeCenters, raw.stays[0].homeCenterId);

    let totalDistanceKm = 0;
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    let maxDistanceFromHomeKm = 0;

    for (let i = 0; i < tripPoints.length; i++) {
      const point = tripPoints[i];
      minLon = Math.min(minLon, point.lon);
      minLat = Math.min(minLat, point.lat);
      maxLon = Math.max(maxLon, point.lon);
      maxLat = Math.max(maxLat, point.lat);
      if (home) {
        maxDistanceFromHomeKm = Math.max(
          maxDistanceFromHomeKm,
          haversineDistanceKm(point.lon, point.lat, home.lon, home.lat),
        );
      }
      if (i > 0) {
        totalDistanceKm += haversineDistanceKm(tripPoints[i - 1].lon, tripPoints[i - 1].lat, point.lon, point.lat);
      }
    }

    const durationHours = (endTs - startTs) / 3600;
    if (durationHours < TRIP_MIN_DURATION_HOURS || maxDistanceFromHomeKm < TRIP_MIN_DISTANCE_KM) continue;

    trips.push({
      id: `trip-${startTs}`,
      startTs,
      endTs,
      homeCenterId: home ? home.id : null,
      stays: raw.stays,
      points: tripPoints,
      totalDistanceKm,
      maxDistanceFromHomeKm,
      bbox: [minLon, minLat, maxLon, maxLat],
      precedingHomeStayEndTs: raw.precedingHomeStayEndTs ?? null,
      followingHomeStayStartTs: raw.followingHomeStayStartTs ?? null,
    });
  }

  return trips;
}
