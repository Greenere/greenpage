import path from 'node:path';
import os from 'node:os';

// Personal location history, deliberately kept outside the repo entirely —
// see scripts/trip_dots/README.md. A single fixed filename (not date-stamped)
// so both the regeneration pipeline and trip_extract.mjs always agree on
// where the canonical merged source lives — trip_extract merges new exports
// into this same file in place rather than producing a new dated file each
// time.
export const MAIN_CSV_PATH = path.join(os.homedir(), 'files/tripdots/trip_dots_main.csv');
export const PHOTO_CSV_PATH = path.join(os.homedir(), 'files/tripdots/photo_dots_2023.csv');
