import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Pending review file written by trip_extract.mjs (npm run trip_extract --
// --file <csv>) — every trip id detected in the merged source that isn't yet
// in the committed public/data/tripdots/trips-index.json, so a hand-edited
// `title` here can be reviewed before the next full regeneration bakes it
// into trips-meta.json. Not committed to the repo — see .gitignore — since
// it's working-review state, not build output.
export const CANDIDATES_PATH = path.resolve(import.meta.dirname, 'new-trip-candidates.json');

export async function readCandidates() {
  try {
    return JSON.parse(await readFile(CANDIDATES_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export async function writeCandidates(candidates) {
  await writeFile(CANDIDATES_PATH, `${JSON.stringify(candidates, null, 2)}\n`, 'utf8');
}

// Called after a successful generate run: any candidate whose trip id made
// it into this run's trips-meta.json (every current trip does — see
// write-outputs.mjs) has now been permanently baked in and preserved across
// future regenerations, so it no longer needs to sit in the review file.
export async function pruneBakedCandidates(currentTripIds) {
  const candidates = await readCandidates();
  let prunedCount = 0;
  for (const id of Object.keys(candidates)) {
    if (currentTripIds.has(id)) {
      delete candidates[id];
      prunedCount++;
    }
  }
  if (prunedCount > 0) await writeCandidates(candidates);
  return prunedCount;
}
