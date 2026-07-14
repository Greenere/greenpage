import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import { access } from 'node:fs/promises';
import { haversineDistanceM, haversineDistanceKm } from './geo-utils.mjs';
import { detectStayPoints } from './stay-points.mjs';
import { loadTriplineStays } from './tripline-import.mjs';
import { PHOTO_TRIP_CORRECTIONS } from './photo-trip-corrections.mjs';
import { DUPLICATE_DIST_M, DUPLICATE_MAX_GAP_S, TRIP_MIN_DISTANCE_KM, HOME_RADIUS_KM } from './constants.mjs';

// One-off historical reconstruction from photo EXIF locations (2022 - 2023,
// before the continuous GPS dataset starts), fusing two sources: this file's
// own CSV loader (sparse, isolated points, no accuracy/altitude signal) and
// the richer, better-clustered per-trip data from ~/projects/tripline (see
// tripline-import.mjs and scripts/trip_dots/README.md). Neither carries the
// kind of continuous trace or reliable density the dense-GPS pipeline
// assumes, so this deliberately doesn't reuse its stay/home/trip logic.
//
// These three anchors are hand-identified from where the photos actually
// cluster, not algorithmically detected — the sparse data doesn't carry
// enough weighted-dwell signal for the normal home-detection logic to find
// them reliably, and the person was genuinely splitting time between both
// coasts rather than living at one sequential address. They're only valid
// for this specific reconstruction, not a general-purpose constant. Exported
// (named, not just the array) so photo-trip-corrections.mjs can reference
// the same points for departure/return boundary hops.
export const ITHACA_ANCHOR = { lon: -76.4832, lat: 42.4461 }; // Ithaca, NY (216 Dearborn Pl / 104 Veterans Pl)
export const SUNNYVALE_ANCHOR = { lon: -122.0317, lat: 37.377 };
export const SAN_BRUNO_ANCHOR = { lon: -122.4213, lat: 37.6353 };
const PHOTO_HOME_ANCHORS = [ITHACA_ANCHOR, SUNNYVALE_ANCHOR, SAN_BRUNO_ANCHOR];

// A real gap of several days between photos is normal even during ordinary
// life (people don't photograph their own home), so unlike the dense-GPS
// pipeline there's no reliable "returned home" signal to close a trip on.
// Trips are segmented purely by elapsed time since the previous away-stay —
// tuned against this specific dataset and cross-checked against known trip
// memory (see conversation/commit history), not a general home-layover rule.
const TRIP_GAP_DAYS = 3;

async function loadPhotoPoints(csvPath, cutoffTs) {
  const rl = readline.createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
  const points = [];
  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line) continue;
    const parts = line.split(',');
    const ts = Number(parts[0]);
    const lon = Number(parts[2]);
    const lat = Number(parts[3]);
    if (!Number.isFinite(ts) || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (ts >= cutoffTs) continue;
    points.push({ ts, lon, lat });
  }
  points.sort((a, b) => a.ts - b.ts);

  const deduped = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      p.ts - prev.ts <= DUPLICATE_MAX_GAP_S &&
      haversineDistanceM(prev.lon, prev.lat, p.lon, p.lat) <= DUPLICATE_DIST_M
    ) {
      continue;
    }
    deduped.push(p);
  }
  return deduped;
}

function minAnchorDistanceKm(stay) {
  return Math.min(...PHOTO_HOME_ANCHORS.map((anchor) => haversineDistanceKm(stay.lon, stay.lat, anchor.lon, anchor.lat)));
}

// Reconstructs trips from sparse, isolated photo locations, fusing two
// sources: the CSV (photo_dots_2023.csv) and the richer, better-clustered
// per-trip JSON output of the ~/projects/tripline project (see
// tripline-import.mjs). Wherever tripline covers a trip, it wins — its data
// is more complete and pre-clustered — and the CSV's cruder stays for that
// same window are dropped so the two don't produce duplicate visits; the CSV
// still supplies whatever trips tripline doesn't have. Returns [] only if
// neither source is present locally — both are personal data, deliberately
// not committed (see the existence checks in generate.mjs for the same
// pattern applied to the main GPS dataset).
export async function detectPhotoTrips({ csvPath, cutoffTs }) {
  const csvExists = await access(csvPath)
    .then(() => true)
    .catch(() => false);
  const csvPoints = csvExists ? await loadPhotoPoints(csvPath, cutoffTs) : [];
  const csvStays = detectStayPoints(csvPoints);

  const { stays: triplineStays, coveredWindows } = await loadTriplineStays();

  const csvStaysOutsideTripline = csvStays.filter(
    (stay) => !coveredWindows.some((w) => stay.startTs >= w.startTs && stay.startTs <= w.endTs),
  );

  const stays = [...triplineStays, ...csvStaysOutsideTripline]
    .map((stay) => ({ ...stay, isHome: false, isPreHome: false, homeCenterId: null }))
    .sort((a, b) => a.startTs - b.startTs);

  if (stays.length === 0) return [];

  const away = stays.filter((stay) => minAnchorDistanceKm(stay) > HOME_RADIUS_KM).sort((a, b) => a.startTs - b.startTs);

  const groups = [];
  let current = null;
  for (const stay of away) {
    if (!current) {
      current = [stay];
    } else {
      const gapDays = (stay.startTs - current[current.length - 1].endTs) / 86400;
      if (gapDays > TRIP_GAP_DAYS) {
        groups.push(current);
        current = [stay];
      } else {
        current.push(stay);
      }
    }
  }
  if (current) groups.push(current);

  return groups
    .map((group) => {
      const startTs = group[0].startTs;
      const endTs = group[group.length - 1].endTs;
      const maxDistanceFromHomeKm = Math.max(...group.map(minAnchorDistanceKm));

      let minLon = Infinity;
      let minLat = Infinity;
      let maxLon = -Infinity;
      let maxLat = -Infinity;
      let totalDistanceKm = 0;
      for (let i = 0; i < group.length; i++) {
        const stay = group[i];
        minLon = Math.min(minLon, stay.lon);
        minLat = Math.min(minLat, stay.lat);
        maxLon = Math.max(maxLon, stay.lon);
        maxLat = Math.max(maxLat, stay.lat);
        if (i > 0) {
          totalDistanceKm += haversineDistanceKm(group[i - 1].lon, group[i - 1].lat, stay.lon, stay.lat);
        }
      }

      const id = `photo-trip-${startTs}`;
      const correction = PHOTO_TRIP_CORRECTIONS[id];

      // Extend the bbox (and total distance) to cover every manually-confirmed
      // departure/return waypoint too (a boundary "leg" can be more than one
      // hop — e.g. a connecting flight through another city — see
      // PHOTO_TRIP_CORRECTIONS), so the trip-detail camera and the legend's
      // distance stat reflect everything planPhotoTripSegments will draw for
      // these (see write-outputs.mjs).
      const extendForChain = (chain) => {
        for (let i = 0; i < chain.length; i++) {
          minLon = Math.min(minLon, chain[i].lon);
          minLat = Math.min(minLat, chain[i].lat);
          maxLon = Math.max(maxLon, chain[i].lon);
          maxLat = Math.max(maxLat, chain[i].lat);
          if (i > 0) totalDistanceKm += haversineDistanceKm(chain[i - 1].lon, chain[i - 1].lat, chain[i].lon, chain[i].lat);
        }
      };
      if (correction?.departure) extendForChain([...correction.departure.waypoints, group[0]]);
      if (correction?.return) extendForChain([group[group.length - 1], ...correction.return.waypoints]);

      return {
        id,
        startTs,
        endTs,
        homeCenterId: null,
        stays: group,
        totalDistanceKm,
        maxDistanceFromHomeKm,
        bbox: [minLon, minLat, maxLon, maxLat],
        source: 'photo',
        departureOverride: correction?.departure ?? null,
        returnOverride: correction?.return ?? null,
        nonDrivableWindow: correction?.nonDrivableWindow ?? null,
      };
    })
    .filter((trip) => trip.maxDistanceFromHomeKm >= TRIP_MIN_DISTANCE_KM);
}
