import path from 'node:path';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { mergeCsvInto } from './merge-csv.mjs';
import { computeTripData } from './pipeline.mjs';
import { defaultTripTitle, buildPlaceNames } from './trip-naming.mjs';
import { MAIN_CSV_PATH, PHOTO_CSV_PATH } from './paths.mjs';
import { readCandidates, writeCandidates, CANDIDATES_PATH } from './trip-candidates.mjs';

function expandHome(inputPath) {
  return inputPath.startsWith('~') ? path.join(os.homedir(), inputPath.slice(1)) : inputPath;
}

function parseArgs(argv) {
  const fileIndex = argv.indexOf('--file');
  if (fileIndex === -1 || !argv[fileIndex + 1]) {
    throw new Error('Usage: npm run trip_extract -- --file <path-to-new-export.csv>');
  }
  return { file: expandHome(argv[fileIndex + 1]) };
}

async function loadKnownTripIds(rootDir) {
  const indexPath = path.resolve(rootDir, 'public/data/tripdots/trips-index.json');
  try {
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    return new Set(index.map((trip) => trip.id));
  } catch {
    return new Set();
  }
}

async function main() {
  const { file } = parseArgs(process.argv.slice(2));

  console.log(`Merging ${file} into ${MAIN_CSV_PATH}...`);
  const { beforeCount, afterCount, addedCount } = await mergeCsvInto(MAIN_CSV_PATH, file);
  console.log(`Merged: ${beforeCount} existing rows + ${addedCount} new rows = ${afterCount} total.`);

  console.log('Running trip detection...');
  const { trips, getLabel } = await computeTripData({ csvPath: MAIN_CSV_PATH, photoCsvPath: PHOTO_CSV_PATH });

  const knownIds = await loadKnownTripIds(process.cwd());
  const newTrips = trips.filter((trip) => !knownIds.has(trip.id));

  // Carry over any hand-edited title for a candidate still pending review;
  // drop entries for ids that aren't "new" any more this run (either already
  // baked into trips-meta.json by a generate run since, or shifted away by a
  // retuned detection algorithm).
  const previousCandidates = await readCandidates();
  const candidates = {};
  for (const trip of newTrips) {
    const previous = previousCandidates[trip.id];
    const suggestedTitle = defaultTripTitle(trip, getLabel);
    candidates[trip.id] = {
      title: previous?.title ?? suggestedTitle,
      suggestedTitle,
      startDate: new Date(trip.startTs * 1000).toISOString().slice(0, 10),
      endDate: new Date(trip.endTs * 1000).toISOString().slice(0, 10),
      durationDays: Math.max(1, Math.round((trip.endTs - trip.startTs) / 86400)),
      distanceKm: Math.round(trip.totalDistanceKm),
      placeNames: buildPlaceNames(trip, getLabel),
      source: trip.source ?? 'gps',
    };
  }
  await writeCandidates(candidates);

  if (newTrips.length === 0) {
    console.log('No new trips detected.');
    return;
  }

  console.log(`\n${newTrips.length} new trip candidate(s) — review/edit "title" in ${path.relative(process.cwd(), CANDIDATES_PATH)}:`);
  console.table(
    Object.entries(candidates).map(([id, c]) => ({
      id,
      title: c.title,
      start: c.startDate,
      end: c.endDate,
      durationDays: c.durationDays,
      distanceKm: c.distanceKm,
      place: c.placeNames[0],
    })),
  );
  console.log('\nOnce titles look right, run `npm run predev` (or `npm run generate:trip-dots`) to bake them in.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
