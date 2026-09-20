import { loadCleanedPoints } from './parse-csv.mjs';
import { detectStayPoints } from './stay-points.mjs';
import { detectHomeCenters, classifyStays } from './home-base.mjs';
import { segmentTrips } from './trips.mjs';
import { geocodeCentroids } from './geocode.mjs';
import { computeFunFacts } from './fun-facts.mjs';
import { detectPhotoTrips } from './photo-trips.mjs';
import { HISTORICAL_HOME_CENTERS } from './photo-trip-corrections.mjs';
import { ANALYSIS_START_TS } from './constants.mjs';

// Stages A-F of the detection pipeline, shared between the full regeneration
// (generate.mjs, which additionally writes public/data/tripdots/ via
// write-outputs.mjs) and trip_extract.mjs (which stops here and only reports
// what's new, never writing build output).
export async function computeTripData({ csvPath, photoCsvPath }) {
  const cleanedPoints = await loadCleanedPoints(csvPath);
  const stays = detectStayPoints(cleanedPoints);
  const homeCenters = detectHomeCenters(stays);
  const classifiedStays = classifyStays(stays, homeCenters);

  const gpsTrips = segmentTrips(classifiedStays, cleanedPoints, homeCenters);
  const photoTrips = await detectPhotoTrips({ csvPath: photoCsvPath, cutoffTs: ANALYSIS_START_TS });
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

  return { cleanedPoints, stays, homeCenters, classifiedStays, trips, funFacts, getLabel };
}
