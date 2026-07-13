import path from 'node:path';
import { loadCleanedPoints } from './parse-csv.mjs';
import { detectStayPoints } from './stay-points.mjs';
import { detectHomeCenters, classifyStays } from './home-base.mjs';
import { segmentTrips } from './trips.mjs';
import { geocodeCentroids } from './geocode.mjs';
import { writeOutputs } from './write-outputs.mjs';
import { getCentralStay } from './trip-naming.mjs';
import { computeFunFacts } from './fun-facts.mjs';

const CSV_RELATIVE_PATH = 'public/data/trip_dots_20260712.csv';
const OUTPUT_RELATIVE_DIR = 'public/data/tripdots';

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
  const csvPath = path.resolve(rootDir, CSV_RELATIVE_PATH);
  const outputDir = path.resolve(rootDir, OUTPUT_RELATIVE_DIR);

  const cleanedPoints = await loadCleanedPoints(csvPath);
  const stays = detectStayPoints(cleanedPoints);
  const homeCenters = detectHomeCenters(stays);
  const classifiedStays = classifyStays(stays, homeCenters);

  const trips = segmentTrips(classifiedStays, cleanedPoints, homeCenters);
  const funFacts = computeFunFacts(cleanedPoints, trips, stays);

  const funFactPoints = [funFacts.northmost, funFacts.southmost, funFacts.highest, funFacts.lowest].filter(Boolean);
  const centroidsToGeocode = [
    ...homeCenters.map((home) => ({ lon: home.lon, lat: home.lat })),
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
    cleanedPoints,
    classifiedStays,
    getLabel,
    funFacts,
    sourceRowCount: cleanedPoints.length,
  });

  return { tripCount: trips.length, homeCenterCount: homeCenters.length };
}
