import { haversineDistanceKm, gridCellKey, estimateLocalHour, isNightHour } from './geo-utils.mjs';
import {
  HOME_GRID_CELL_KM,
  HOME_NIGHT_WEIGHT,
  HOME_NIGHT_START_HOUR,
  HOME_NIGHT_END_HOUR,
  HOME_CANDIDATE_MAX,
  HOME_MIN_WEEKLY_HOURS,
  HOME_MIN_ACTIVE_SPAN_DAYS,
  HOME_RADIUS_KM,
} from './constants.mjs';

function rangeOverlapFraction(aStart, aEnd, bStart, bEnd) {
  const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  if (overlap <= 0) return 0;
  const shorter = Math.min(aEnd - aStart, bEnd - bStart);
  return shorter > 0 ? overlap / shorter : 0;
}

// Buckets stays into ~1km grid cells, sums dwell time weighted toward
// overnight hours, and ranks cells by that weighted total (cells shorter
// than HOME_MIN_ACTIVE_SPAN_DAYS are dropped — too brief to be a real home,
// e.g. a single long overnight stopover).
function rankHomeCandidates(stays) {
  const cells = new Map();

  for (const stay of stays) {
    const key = gridCellKey(stay.lon, stay.lat, HOME_GRID_CELL_KM);
    const midTs = (stay.startTs + stay.endTs) / 2;
    const hour = estimateLocalHour(midTs, stay.lon);
    const weight = isNightHour(hour, HOME_NIGHT_START_HOUR, HOME_NIGHT_END_HOUR) ? HOME_NIGHT_WEIGHT : 1;
    const weightedHours = (stay.durationMin / 60) * weight;

    let cell = cells.get(key);
    if (!cell) {
      cell = { key, sumLon: 0, sumLat: 0, count: 0, weightedHours: 0, startTs: stay.startTs, endTs: stay.endTs };
      cells.set(key, cell);
    }
    cell.sumLon += stay.lon;
    cell.sumLat += stay.lat;
    cell.count += 1;
    cell.weightedHours += weightedHours;
    cell.startTs = Math.min(cell.startTs, stay.startTs);
    cell.endTs = Math.max(cell.endTs, stay.endTs);
  }

  const minSpanSeconds = HOME_MIN_ACTIVE_SPAN_DAYS * 24 * 3600;
  return [...cells.values()]
    .filter((cell) => cell.endTs - cell.startTs >= minSpanSeconds)
    .sort((a, b) => b.weightedHours - a.weightedHours);
}

function toHomeCenter(cell, index) {
  return {
    id: `home-${index}`,
    lon: cell.sumLon / cell.count,
    lat: cell.sumLat / cell.count,
    activeStart: cell.startTs,
    activeEnd: cell.endTs,
    weightedHours: cell.weightedHours,
  };
}

// Stage C: pick up to HOME_CANDIDATE_MAX primary homes — more than one only
// if their active date ranges are largely non-overlapping (covers a
// relocation during the analysis window). Ranked by *total* weighted dwell
// across the whole dataset, so this favors whichever locations were the
// dominant, full-time residence at some point.
function detectPrimaryHomeCenters(stays) {
  const ranked = rankHomeCandidates(stays);
  if (ranked.length === 0) return [];

  const accepted = [ranked[0]];
  for (let i = 1; i < ranked.length && accepted.length < HOME_CANDIDATE_MAX; i++) {
    const candidate = ranked[i];
    const weeks = (candidate.endTs - candidate.startTs) / (7 * 24 * 3600);
    if (candidate.weightedHours / weeks < HOME_MIN_WEEKLY_HOURS) continue;

    const overlapsExisting = accepted.some(
      (home) => rangeOverlapFraction(home.startTs, home.endTs, candidate.startTs, candidate.endTs) > 0.2,
    );
    if (!overlapsExisting) accepted.push(candidate);
  }

  return accepted;
}

// Stage C (continued): the primary-home ranking above is dominated by total
// hours across the *whole* multi-year dataset, so a location that was only
// ever a recurring secondary presence (moderate hours spread over years) can
// outrank the location that was actually home during an early gap not
// covered by any primary home. Re-rank using *only* the stays in that gap so
// a stale, unrelated recurring-visit pattern can't out-vote the place that
// was genuinely home at the time. If the gap winner turns out to be within
// normal home radius of an already-accepted home, it's the same home area
// picked up by a slightly different stay cluster early on — extend that
// home's coverage backward instead of adding a near-duplicate entry.
function applyGapFillHome(stays, primaryHomes) {
  const earliestStart = Math.min(...primaryHomes.map((home) => home.startTs));
  const gapStays = stays.filter((stay) => (stay.startTs + stay.endTs) / 2 < earliestStart);
  if (gapStays.length === 0) return;

  const candidate = rankHomeCandidates(gapStays)[0];
  if (!candidate) return;

  const weeks = (candidate.endTs - candidate.startTs) / (7 * 24 * 3600);
  if (candidate.weightedHours / weeks < HOME_MIN_WEEKLY_HOURS) return;

  const candidateLon = candidate.sumLon / candidate.count;
  const candidateLat = candidate.sumLat / candidate.count;
  const nearbyHome = primaryHomes.find(
    (home) => haversineDistanceKm(home.sumLon / home.count, home.sumLat / home.count, candidateLon, candidateLat) < HOME_RADIUS_KM,
  );
  if (nearbyHome) {
    nearbyHome.startTs = Math.min(nearbyHome.startTs, candidate.startTs);
  } else {
    primaryHomes.push(candidate);
  }
}

export function detectHomeCenters(stays) {
  const primary = detectPrimaryHomeCenters(stays);
  if (primary.length === 0) return [];

  applyGapFillHome(stays, primary);

  return primary.map(toHomeCenter).sort((a, b) => a.activeStart - b.activeStart);
}

function pickHomeCenterForTs(ts, homeCenters) {
  let closest = homeCenters[0];
  let closestGap = Infinity;
  for (const home of homeCenters) {
    const gap = ts < home.activeStart ? home.activeStart - ts : ts > home.activeEnd ? ts - home.activeEnd : 0;
    if (gap < closestGap) {
      closestGap = gap;
      closest = home;
    }
  }
  return closest;
}

// Stage D: for a given stay, pick whichever home center's active range covers
// (or is nearest to) the stay's date, then classify home-vs-away by distance.
// Stays before the earliest detected home's activeStart predate having any
// established home at all, so they're marked "pre-home" (excluded from trip
// segmentation entirely) rather than forced into an away-trip against a home
// that didn't exist yet.
export function classifyStays(stays, homeCenters) {
  if (homeCenters.length === 0) {
    return stays.map((stay) => ({ ...stay, isHome: false, isPreHome: false, homeCenterId: null }));
  }

  const earliestHomeStart = Math.min(...homeCenters.map((home) => home.activeStart));

  return stays.map((stay) => {
    const midTs = (stay.startTs + stay.endTs) / 2;
    if (midTs < earliestHomeStart) {
      return { ...stay, isHome: false, isPreHome: true, homeCenterId: null };
    }
    const home = pickHomeCenterForTs(midTs, homeCenters);
    const distanceKm = haversineDistanceKm(stay.lon, stay.lat, home.lon, home.lat);
    return { ...stay, isHome: distanceKm <= HOME_RADIUS_KM, isPreHome: false, homeCenterId: home.id };
  });
}

