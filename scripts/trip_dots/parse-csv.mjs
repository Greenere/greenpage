import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import { haversineDistanceM } from './geo-utils.mjs';
import {
  ANALYSIS_START_TS,
  ACCURACY_MAX_M,
  DUPLICATE_DIST_M,
  DUPLICATE_MAX_GAP_S,
  FLIGHT_ALTITUDE_THRESHOLD_M,
} from './constants.mjs';

// Stage A: stream-parse the raw ping CSV, clip to the analysis window, drop
// low-accuracy/duplicate-adjacent/high-altitude points, and sort by time. The
// file has no quoting/embedded commas so a plain split is sufficient — no
// CSV library.
export async function loadCleanedPoints(csvPath) {
  const rl = readline.createInterface({
    input: createReadStream(csvPath),
    crlfDelay: Infinity,
  });

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
    const accuracy = Number(parts[5]);
    const altitude = Number(parts[10]);

    if (!Number.isFinite(ts) || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (ts < ANALYSIS_START_TS) continue;
    if (Number.isFinite(accuracy) && accuracy > ACCURACY_MAX_M) continue;

    points.push({ ts, lon, lat, altitude });
  }

  points.sort((a, b) => a.ts - b.ts);

  // Points above FLIGHT_ALTITUDE_THRESHOLD_M are mid-flight, not real ground
  // trace — drop them, but remember that a kept point's predecessor was
  // dropped for being airborne (rather than plain data loss), so write-outputs
  // can render that hop as a confident "flight" segment instead of a
  // generic/ambiguous gap.
  const deduped = [];
  let precededByHighAltitude = false;
  for (const point of points) {
    if (point.altitude > FLIGHT_ALTITUDE_THRESHOLD_M) {
      precededByHighAltitude = true;
      continue;
    }

    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      !precededByHighAltitude &&
      point.ts - prev.ts <= DUPLICATE_MAX_GAP_S &&
      haversineDistanceM(prev.lon, prev.lat, point.lon, point.lat) <= DUPLICATE_DIST_M
    ) {
      continue;
    }
    deduped.push({ ts: point.ts, lon: point.lon, lat: point.lat, altitude: point.altitude, precededByHighAltitude });
    precededByHighAltitude = false;
  }

  return deduped;
}
