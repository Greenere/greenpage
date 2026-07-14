import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { haversineDistanceKm } from './geo-utils.mjs';
import { GAP_MIN_SPEED_KMH } from './constants.mjs';

// `~/projects/tripline` is an earlier, separate personal project (per-city
// hand-styled maps) that ran its own EXIF-extraction pass over the same
// 2022 photo library — its per-trip JSON output is richer and better
// pre-clustered than what ended up in photo_dots_2023.csv for the same
// trips, plus it covers three trips that CSV doesn't have data for at all
// (Philadelphia, New York in Jan 2022, Niagara Falls). See
// scripts/trip_dots/README.md.
const TRIPLINE_DIR = path.join(os.homedir(), 'projects/tripline');

// UTC offset (hours) for each trip, computed from its known location + date.
// Safe as a single fixed value per trip — none of these spans a US DST
// transition (2022: spring-forward Mar 13, fall-back Nov 6), confirmed
// against each trip's actual date range before hardcoding this.
const TRIPLINE_TRIPS = [
  { dir: 'philly2022', files: ['philly2022.json'], utcOffsetHours: -5 }, // EST
  { dir: 'boston2022', files: ['boston2022.json'], utcOffsetHours: -4 }, // EDT
  { dir: 'californiaone2022', files: ['californiaone2022.json'], utcOffsetHours: -7 }, // PDT
  { dir: 'newyork2022', files: ['newyork2022.json'], utcOffsetHours: -5 }, // EST
  { dir: 'niagara2022', files: ['niagara2022.json'], utcOffsetHours: -4 }, // EDT
  // Old San Juan is a closer-zoom detail layer for the same trip as
  // puertorico2022 (identical date range), not a separate trip — folded
  // into the same entry so its points contribute to one combined trip.
  { dir: 'puertorico2022', files: ['puertorico2022.json'], siblingDir: 'oldsanjuan2022', siblingFile: 'osj2022.json', utcOffsetHours: -4 }, // AST, no DST
  { dir: 'santabarbara2022', files: ['santabarbara2022.json'], utcOffsetHours: -8 }, // PST
  { dir: 'seattle2022', files: ['seattle2022.json'], utcOffsetHours: -7 }, // PDT
  { dir: 'virginiadc2022', files: ['virginiadc2022.json'], utcOffsetHours: -4 }, // EDT
];

// "YYYY-MM-DD HH:MM:SS" naive local time -> epoch seconds. Parsed as if it
// were UTC, then shifted by the known offset (local = UTC + offset, so
// UTC = local - offset).
function localToEpoch(localDateTimeStr, utcOffsetHours) {
  const asUtcMs = Date.parse(`${localDateTimeStr.replace(' ', 'T')}Z`);
  return Math.round(asUtcMs / 1000 - utcOffsetHours * 3600);
}

async function loadTripFile(filePath, utcOffsetHours) {
  const raw = await readFile(filePath, 'utf8').catch(() => null);
  if (!raw) return [];
  const data = JSON.parse(raw);
  // tripline already merges photos within ~50m of each other (mergeDots in
  // extract_exif.py) into one entry with a time range and count — these are
  // pre-clustered "stay"-shaped points already, not raw pings, so they skip
  // our own Li et al. stay detection entirely.
  return data.locations.map((loc) => ({
    lon: loc.location[1],
    lat: loc.location[0],
    startTs: localToEpoch(loc.time[0], utcOffsetHours),
    endTs: localToEpoch(loc.time[1], utcOffsetHours),
    durationMin: loc.duration / 60,
    pointCount: loc.count,
  }));
}

// Hand-confirmed spurious points dropImplausiblePoints's speed heuristic
// can't catch: the Lackawaxen Township, PA point is the *last* entry in the
// whole puertorico2022 file (so there's no "next" neighbor to compare
// against — nextOk defaults to true) and its gap from the preceding Kearny,
// NJ stay implies a plausible-looking ground speed (~150km/h) purely by
// coincidence of timing, even though it's a stale/cached GPS fix tagged onto
// a photo taken mid-flight on the NYC -> Ithaca return leg, not a real stop
// (see PHOTO_TRIP_CORRECTIONS' returnOverride for that trip, which supplies
// the real NYC -> Ithaca flight this point would otherwise masquerade as a
// driving hop for).
const MANUAL_EXCLUSIONS = [{ dir: 'puertorico2022', startTs: 1672015885 }];

function impliedSpeedKmh(a, b) {
  const distanceKm = haversineDistanceKm(a.lon, a.lat, b.lon, b.lat);
  const timeHours = (b.startTs - a.startTs) / 3600;
  return timeHours > 0 ? distanceKm / timeHours : Infinity;
}

// tripline has no altitude signal to filter mid-flight points the way the
// main GPS pipeline does (photo EXIF rarely carries a usable altitude tag) —
// confirmed on the actual data: the Puerto Rico trip's raw points traced a
// smooth ~650km/h arc from San Juan up the Atlantic coast (the return
// flight), plus some points that "teleport" back and forth implausibly
// (almost certainly a stale/cached GPS fix tagged onto a later photo, a
// known phone-camera quirk) — neither is a place anyone actually stood.
// Iteratively drops any point whose implied speed to *both* remaining
// neighbors looks like transit rather than a stay — a real stay just before
// or after a flight is kept, since it's still slow relative to its other,
// genuine neighbor.
function dropImplausiblePoints(points) {
  let current = [...points].sort((a, b) => a.startTs - b.startTs);
  while (true) {
    const next = current.filter((point, i) => {
      const prevOk = i === 0 || impliedSpeedKmh(current[i - 1], point) < GAP_MIN_SPEED_KMH;
      const nextOk = i === current.length - 1 || impliedSpeedKmh(point, current[i + 1]) < GAP_MIN_SPEED_KMH;
      return prevOk || nextOk;
    });
    if (next.length === current.length) return next;
    current = next;
  }
}

// Loads every known tripline trip as a flat list of pre-clustered stay
// objects, plus each trip's own covered [startTs, endTs] window — the
// caller (photo-trips.mjs) uses those windows to exclude the equivalent,
// cruder span from the CSV source so the two don't produce duplicate stays
// for the same real visit.
export async function loadTriplineStays() {
  const allStays = [];
  const coveredWindows = [];

  for (const trip of TRIPLINE_TRIPS) {
    const fileLists = [path.join(TRIPLINE_DIR, trip.dir, trip.files[0])];
    if (trip.siblingDir) fileLists.push(path.join(TRIPLINE_DIR, trip.siblingDir, trip.siblingFile));

    const rawStays = (await Promise.all(fileLists.map((filePath) => loadTripFile(filePath, trip.utcOffsetHours)))).flat();
    if (rawStays.length === 0) continue;
    const stays = dropImplausiblePoints(rawStays).filter(
      (stay) => !MANUAL_EXCLUSIONS.some((ex) => ex.dir === trip.dir && ex.startTs === stay.startTs),
    );

    allStays.push(...stays);
    coveredWindows.push({
      startTs: Math.min(...stays.map((s) => s.startTs)),
      endTs: Math.max(...stays.map((s) => s.endTs)),
    });
  }

  allStays.sort((a, b) => a.startTs - b.startTs);
  return { stays: allStays, coveredWindows };
}
