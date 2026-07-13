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
