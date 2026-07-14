# Trip-dots basemap

`public/data/tripdots/basemap.pmtiles` is a self-hosted vector basemap (land/water/borders/labels only — no street detail) served directly by GitHub Pages via HTTP range requests, so the `/tripdots` page has no external tile-service dependency at runtime.

It's a one-time, manual step — not part of `predev`/`prebuild` — since it needs an external CLI and network access to Protomaps' hosted planet build, and only needs re-running if trips start covering regions this extract doesn't already have global coverage for (it currently doesn't need that: it's a full-planet extract, just at low zoom).

## Regenerating

1. Install the Go `pmtiles` CLI (not the `pmtiles` npm package — that's the JS runtime reader used in the browser):
   ```
   curl -sL https://github.com/protomaps/go-pmtiles/releases/download/v1.31.0/go-pmtiles-1.31.0_Darwin_arm64.zip -o /tmp/pmtiles.zip
   unzip -o /tmp/pmtiles.zip -d /tmp/pmtiles-cli
   ```
   (swap the asset name for your platform — see `https://github.com/protomaps/go-pmtiles/releases/latest`)

2. Extract a global, low-zoom subset of Protomaps' daily-built planet archive (find today's filename pattern at `https://build.protomaps.com/YYYYMMDD.pmtiles`):
   ```
   /tmp/pmtiles-cli/pmtiles extract \
     "https://build.protomaps.com/<date>.pmtiles" \
     public/data/tripdots/basemap.pmtiles \
     --bbox=-180,-85,180,85 \
     --maxzoom=6
   ```

   `--maxzoom=6` was chosen as the size/detail tradeoff for this dataset (trips span North America, South America, and Asia, so a small regional bbox isn't an option — the whole planet has to be covered):

   | maxzoom | size |
   |---|---|
   | 4 | ~6MB |
   | 5 | ~15MB |
   | **6** | **~45MB** (current) |
   | 7 | ~186MB |

   Add `--dry-run` to estimate size before committing to a re-extract.

3. Commit the resulting `basemap.pmtiles` (same convention as the trip CSV — this repo commits its large static data files directly).

The frontend renders it with `@protomaps/basemaps`' `layers()` helper (see `src/pages/tripdots/TripDotsMap.tsx`), which generates the MapLibre style-layer array for this schema in a light/dark flavor.

## Regional high-detail extract

`public/data/tripdots/basemap-ca.pmtiles` is a second, much higher-zoom extract limited to California + neighboring states (NV, AZ, southern OR) — most trips are clustered there, so a real street-level basemap is affordable for that region even though it's not affordable globally (see the maxzoom/size table above: a global maxzoom-7 extract alone would already be ~186MB, over GitHub's 100MB single-file push limit).

`src/pages/tripdots/TripDotsMap.tsx` swaps the map's `protomaps` vector source to this file (via `VectorTileSource.setUrl`) only when the selected trip's own bbox fits entirely inside `REGIONAL_BASEMAP_BBOX` — that constant **must** match the `--bbox` this was built with, since the file has no data at all outside it. Any other trip (or the no-selection overview) falls back to the global `basemap.pmtiles`.

Regenerate the same way as above, but bbox-limited and at a much higher zoom:
```
/tmp/pmtiles-cli/pmtiles extract \
  "https://build.protomaps.com/<date>.pmtiles" \
  public/data/tripdots/basemap-ca.pmtiles \
  --bbox=-125,32,-113,42.5 \
  --maxzoom=10
```
This bbox/maxzoom combination measured ~21MB (`--dry-run` first to confirm before a real re-extract). If future trips add another cluster of destinations outside this box, consider a similar bbox-limited extract for that region rather than raising the global maxzoom.

# Photo-derived historical trips (2022-2023)

Before continuous GPS tracking starts (`ANALYSIS_START_TS`, 2023-06-01), there's a gap in real location history. `scripts/trip_dots/photo-trips.mjs` reconstructs a handful of real trips from that gap using GPS coordinates extracted from photo EXIF metadata, fusing **two** sources — both **kept entirely outside the repo** (personal data, not even gitignored-in-place like the main CSV):
- `~/files/tripdots/photo_dots_2023.csv` — same column schema as the main dataset, raw/sparse points.
- `~/projects/tripline` — a separate, earlier personal project (per-city hand-styled maps) that ran its own EXIF-extraction pass over the same 2022 photo library. Its per-trip JSON output (`tripline-import.mjs`) is richer, better pre-clustered, and covers three trips the CSV has no data for at all (Philadelphia, New York in Jan 2022, Niagara Falls).

Wherever tripline covers a trip, it wins — `detectPhotoTrips` excludes the CSV's cruder stays for that same date window (see `coveredWindows` in `tripline-import.mjs`) so the two sources don't produce duplicate stays for one real visit. The CSV still supplies whatever tripline doesn't have (Watertown NY, the Jan 2023 NYC trip, San Diego).

**This is deliberately not the same algorithm as the main pipeline**:
- Home detection doesn't run against it — weighted-dwell home detection needs enough density to accumulate signal, and this data doesn't have it. `PHOTO_HOME_ANCHORS` in `photo-trips.mjs` are three hand-identified reference points (Ithaca, NY; Sunnyvale, CA; San Bruno, CA) treated as *simultaneously* "home" for the whole window, since the person was genuinely splitting time between both coasts rather than living sequentially at one address. If this ever gets extended to a different era/region, these need to be re-identified by hand, not just recomputed.
- Trip boundaries aren't closed by "returned home" (unreliable with this data) but by elapsed time since the last away-stay (`TRIP_GAP_DAYS = 3`). Tuned and cross-checked against actual trip memory during the session that built this — see the conversation/commit history for the full back-and-forth (several candidate trips came out wrong on the first pass: routine SF-area visits were misclassified as "away" because the anchor points were initially inaccurate; a naive `HOME_LAYOVER_MAX_HOURS`-based close merged unrelated trips together because sparse data rarely has a real "return home" data point between them; and the main pipeline's `TRIP_MIN_DURATION_HOURS` filter silently dropped two real trips — Watertown, NY and a Monterey-area overnight — because their *photographed* span was shorter than a continuously-tracked trip's would be).
- The CSV source has no `accuracy`/`altitude` signal (both always `0`) and no reliable per-point timing gaps, so its hops are all planned as a generic dotted "gap" and never attempted for OSRM driving-route recovery when only the CSV is available for a stretch.
- tripline's per-trip files *do* carry real photo timestamps throughout, so `planPhotoTripSegments` in `write-outputs.mjs` classifies each hop by implied speed (same `GAP_MIN_SPEED_KMH` threshold as the main pipeline) into `'flight'` (skip recovery) or `'gap'` (attempt a driving route, capped by `PHOTO_TRIP_MAX_DRIVE_KM` since there's no duration to validate a candidate route against — a technically-valid highway route between two cities doesn't mean this particular hop was actually driven rather than flown). tripline's own points have no altitude either — its flight detection is this speed heuristic, not the main pipeline's altitude threshold. This exact case bit the Puerto Rico trip on the first pass: the raw EXIF data included in-flight GPS pings (a smooth ~650km/h arc up the Atlantic) plus what looks like stale/cached location fixes tagged onto later photos (values that "teleport" back and forth implausibly) — `dropImplausiblePoints` in `tripline-import.mjs` iteratively removes any point whose implied speed to *both* remaining neighbors exceeds the threshold, which cleans up both failure modes without needing to tell them apart.

Each reconstructed trip is tagged `source: "photo"` in `trips-index.json` (vs. `"gps"` for the main pipeline) so the frontend can filter/label them separately — this is a lower-confidence reconstruction (no real continuous trace, dates bounded only by when photos happen to exist), not to be trusted quite the same as continuously-tracked trips. The "Photo trips" toggle in `TripDotsPage.tsx` lets it be hidden.

`generateTripDots()` in `generate.mjs` calls `detectPhotoTrips()` unconditionally and merges its output into the same `trips` array the main pipeline produces. Each source degrades independently and gracefully: if `~/files/tripdots/photo_dots_2023.csv` isn't present, the CSV side just contributes nothing; if `~/projects/tripline` isn't present, `loadTriplineStays()` returns empty stays/windows and every trip falls back to CSV-only (or is dropped if the CSV doesn't cover it either). Only if *both* are absent does `detectPhotoTrips` return `[]` — same graceful-skip convention as the main CSV.
