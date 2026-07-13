import { haversineDistanceM } from './geo-utils.mjs';
import { STAY_DIST_THRESHOLD_M, STAY_MIN_DURATION_MIN } from './constants.mjs';

// Stage B: classic Li et al. (2008) stay-point detection. Extends a window
// from an anchor point while subsequent points stay within STAY_DIST_THRESHOLD_M;
// when the window breaks, emits a stay if its time span clears the minimum
// dwell duration, then jumps past the whole window (keeps this amortized
// linear even through long stationary bursts).
export function detectStayPoints(points) {
  const stays = [];
  const n = points.length;
  let i = 0;

  while (i < n) {
    const anchor = points[i];
    let j = i + 1;
    while (j < n && haversineDistanceM(anchor.lon, anchor.lat, points[j].lon, points[j].lat) <= STAY_DIST_THRESHOLD_M) {
      j++;
    }

    const windowEnd = points[j - 1];
    const durationMin = (windowEnd.ts - anchor.ts) / 60;

    if (durationMin >= STAY_MIN_DURATION_MIN) {
      let sumLon = 0;
      let sumLat = 0;
      for (let k = i; k < j; k++) {
        sumLon += points[k].lon;
        sumLat += points[k].lat;
      }
      const count = j - i;
      stays.push({
        lon: sumLon / count,
        lat: sumLat / count,
        startTs: anchor.ts,
        endTs: windowEnd.ts,
        durationMin,
        pointCount: count,
      });
      i = j;
    } else {
      i++;
    }
  }

  return stays;
}
