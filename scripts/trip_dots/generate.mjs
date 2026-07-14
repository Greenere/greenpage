import path from 'node:path';
import os from 'node:os';
import { access } from 'node:fs/promises';
import { loadCleanedPoints } from './parse-csv.mjs';
import { detectStayPoints } from './stay-points.mjs';
import { detectHomeCenters, classifyStays } from './home-base.mjs';
import { segmentTrips } from './trips.mjs';
import { geocodeCentroids } from './geocode.mjs';
import { writeOutputs } from './write-outputs.mjs';
import { getCentralStay } from './trip-naming.mjs';
import { computeFunFacts } from './fun-facts.mjs';
import { detectPhotoTrips } from './photo-trips.mjs';
import { HISTORICAL_HOME_CENTERS } from './photo-trip-corrections.mjs';
import { ANALYSIS_START_TS } from './constants.mjs';

const OUTPUT_RELATIVE_DIR = 'public/data/tripdots';
// Personal location history, deliberately kept outside the repo entirely —
// see scripts/trip_dots/README.md.
const MAIN_CSV_PATH = path.join(os.homedir(), 'files/tripdots/trip_dots_20260712.csv');
const PHOTO_CSV_PATH = path.join(os.homedir(), 'files/tripdots/photo_dots_2023.csv');

function formatTripDebugRow(trip, getLabel) {
  const startDate = new Date(trip.startTs * 1000).toISOString().slice(0, 10);
  const endDate = new Date(trip.endTs * 1000).toISOString().slice(0, 10);
  const central = getCentralStay(trip);
  return {
    id: trip.id,
    start: startDate,
    end: endDate,
    durationDays: ((trip.endTs - trip.startTs) / 86400).toFixed(1),
    distanceKm: Math.round(trip.totalDistanceKm),
    maxDistFromHomeKm: Math.round(trip.maxDistanceFromHomeKm),
    stays: trip.stays.length,
    place: getLabel(central.lon, central.lat),
  };
}

export async function generateTripDots({ rootDir, debug = false }) {
  const csvPath = MAIN_CSV_PATH;
  const outputDir = path.resolve(rootDir, OUTPUT_RELATIVE_DIR);

  // The raw GPS CSV is deliberately not committed (85MB of personal location
  // history) — only its committed, already-generated output under
  // public/data/tripdots/ ships with the repo. Regeneration is only possible
  // with the source file present locally, so skip it gracefully rather than
  // failing predev/prebuild for anyone (including CI) without a local copy.
  const csvExists = await access(csvPath)
    .then(() => true)
    .catch(() => false);
  if (!csvExists) {
    console.log(`Source CSV not found at ${csvPath} — skipping trip-dots regeneration, keeping committed output as-is.`);
    return { tripCount: null, homeCenterCount: null, skipped: true };
  }

  const cleanedPoints = await loadCleanedPoints(csvPath);
  const stays = detectStayPoints(cleanedPoints);
  const homeCenters = detectHomeCenters(stays);
  const classifiedStays = classifyStays(stays, homeCenters);

  const gpsTrips = segmentTrips(classifiedStays, cleanedPoints, homeCenters);
  const photoTrips = await detectPhotoTrips({ csvPath: PHOTO_CSV_PATH, cutoffTs: ANALYSIS_START_TS });
  const trips = [...photoTrips, ...gpsTrips];
  const funFacts = computeFunFacts(cleanedPoints, trips, stays);

  const funFactPoints = [funFacts.northmost, funFacts.southmost, funFacts.highest, funFacts.lowest].filter(Boolean);
  const centroidsToGeocode = [
    ...homeCenters.map((home) => ({ lon: home.lon, lat: home.lat })),
    ...HISTORICAL_HOME_CENTERS.map((home) => ({ lon: home.lon, lat: home.lat })),
    ...trips.flatMap((trip) => trip.stays.map((stay) => ({ lon: stay.lon, lat: stay.lat }))),
    ...funFactPoints.map((point) => ({ lon: point.lon, lat: point.lat })),
  ];
  const getLabel = await geocodeCentroids(centroidsToGeocode);

  if (debug) {
    console.log(`Home center(s): ${homeCenters.length}`);
    console.table(
      homeCenters.map((home) => ({
        id: home.id,
        label: getLabel(home.lon, home.lat),
        activeStart: new Date(home.activeStart * 1000).toISOString().slice(0, 10),
        activeEnd: new Date(home.activeEnd * 1000).toISOString().slice(0, 10),
      })),
    );
    console.log(`Detected trips: ${trips.length}`);
    console.table(trips.map((trip) => formatTripDebugRow(trip, getLabel)));

    console.log('Fun facts:');
    console.table({
      northmost: { ...funFacts.northmost, label: getLabel(funFacts.northmost.lon, funFacts.northmost.lat) },
      southmost: { ...funFacts.southmost, label: getLabel(funFacts.southmost.lon, funFacts.southmost.lat) },
      highest: funFacts.highest && { ...funFacts.highest, label: getLabel(funFacts.highest.lon, funFacts.highest.lat) },
      lowest: funFacts.lowest && { ...funFacts.lowest, label: getLabel(funFacts.lowest.lon, funFacts.lowest.lat) },
    });
  }

  await writeOutputs({
    outputDir,
    trips,
    homeCenters,
    historicalHomeCenters: HISTORICAL_HOME_CENTERS,
    cleanedPoints,
    classifiedStays,
    getLabel,
    funFacts,
    sourceRowCount: cleanedPoints.length,
  });

  return { tripCount: trips.length, homeCenterCount: homeCenters.length };
}
