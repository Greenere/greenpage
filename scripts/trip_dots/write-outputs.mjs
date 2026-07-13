import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import simplify from '@turf/simplify';
import bboxOf from '@turf/bbox';
import greatCircle from '@turf/great-circle';
import { lineString, point, featureCollection } from '@turf/helpers';
import { haversineDistanceKm, estimateLocalHour, isNightHour } from './geo-utils.mjs';
import { getCentralStay } from './trip-naming.mjs';
import { recoverDriveSegments } from './route-recovery.mjs';
import {
  TRIP_SIMPLIFY_TOLERANCE_DEG,
  HOME_LIFE_SIMPLIFY_TOLERANCE_DEG,
  GAP_MIN_DISTANCE_KM,
  GAP_MIN_SPEED_KMH,
  GAP_MIN_TIME_MINUTES,
  HOME_RADIUS_KM,
  HOME_NIGHT_START_HOUR,
  HOME_NIGHT_END_HOUR,
  OVERNIGHT_MIN_DURATION_MIN,
} from './constants.mjs';

function monthYearLabel(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// A stay "included an overnight" if it's long enough to plausibly involve
// real sleep and its midpoint falls in the estimated-local-time night window.
function isOvernightStay(stay) {
  if (stay.durationMin < OVERNIGHT_MIN_DURATION_MIN) return false;
  const midTs = (stay.startTs + stay.endTs) / 2;
  const hour = estimateLocalHour(midTs, stay.lon);
  return isNightHour(hour, HOME_NIGHT_START_HOUR, HOME_NIGHT_END_HOUR);
}

// Classifies a hop between consecutive points that isn't a real traced path:
// - 'flight' — altitude evidence (precededByHighAltitude, from parse-csv.mjs)
//   or an implausibly high implied speed. Either way, confident enough that
//   the "Flights" toggle should govern it, and not worth attempting
//   driving-route recovery for.
// - 'gap' — a large time jump at an otherwise-plausible speed: ambiguous
//   signal/battery loss, could still have been driven, so route-recovery is
//   attempted for these.
// - null — not a gap at all, continue the current trace.
function classifyHop(a, b) {
  if (b.precededByHighAltitude) return 'flight';
  const distanceKm = haversineDistanceKm(a.lon, a.lat, b.lon, b.lat);
  if (distanceKm < GAP_MIN_DISTANCE_KM) return null;
  if (typeof a.ts !== 'number' || typeof b.ts !== 'number') return 'gap'; // no timing to assess speed
  const timeMinutes = (b.ts - a.ts) / 60;
  const speedKmh = timeMinutes > 0 ? distanceKm / (timeMinutes / 60) : Infinity;
  if (speedKmh >= GAP_MIN_SPEED_KMH) return 'flight';
  if (timeMinutes >= GAP_MIN_TIME_MINUTES) return 'gap';
  return null;
}

// Departure/return hops are always split regardless of distance/speed (a
// trip always needs some connector back to home) — fall back to 'gap' for
// the rare case classifyHop doesn't clearly flag it as either.
function classifyBoundaryHop(a, b) {
  return classifyHop(a, b) ?? 'gap';
}

function makeLineFeature(coordinates, segmentType, simplifyToleranceDeg) {
  const feature =
    segmentType === 'trace' && coordinates.length > 2
      ? simplify(lineString(coordinates), { tolerance: simplifyToleranceDeg, highQuality: false })
      : lineString(coordinates);
  feature.properties = { ...(feature.properties ?? {}), segmentType };
  return feature;
}

// A naive straight line between two raw lon/lat values takes the *longer*
// way around the globe whenever the shorter path crosses the antimeridian
// (e.g. US <-> China should arc west over the Pacific, not east through
// Europe/Central Asia). greatCircle computes the actual shortest path and
// splits it into a MultiLineString where it crosses ±180°.
function makeGapFeature(a, b, segmentType) {
  const feature = greatCircle([a.lon, a.lat], [b.lon, b.lat], { npoints: 64 });
  feature.properties = { ...(feature.properties ?? {}), segmentType };
  return feature;
}

// Splits a chronological point run into contiguous "trace" segments (real
// GPS path) wherever a gap hop breaks continuity. Shared between a trip's
// own points and the "everything else" home-life point runs between trips.
function planTraceSegments(points, keyPrefix) {
  const segments = [];
  if (points.length === 0) return segments;

  let currentRun = [points[0]];
  let gapIndex = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const hopType = classifyHop(prev, curr);
    if (hopType) {
      if (currentRun.length >= 2) segments.push({ type: 'trace', points: currentRun });
      segments.push({ type: hopType, key: `${keyPrefix}:${hopType}:${gapIndex++}`, a: prev, b: curr });
      currentRun = [curr];
    } else {
      currentRun.push(curr);
    }
  }
  if (currentRun.length >= 2) segments.push({ type: 'trace', points: currentRun });
  return segments;
}

// Plans a trip's line segments as descriptors rather than final features:
// contiguous "trace" runs split wherever a gap hop breaks continuity, plus
// (if beyond home radius) a departure hop before the first point and a
// return hop after the last — trips are conceptually loops, but the
// departure/return legs fall inside home-classified stays and so are
// excluded from trip.points entirely. The home endpoint of those two hops
// carries the real timestamp of when the adjacent confirmed home stay
// ended/began, so route-recovery can validate them against the time actually
// available instead of accepting any route regardless of how implausibly
// long it would take to drive (which is what let flights get misclassified
// as recovered drives before this was added). Each "gap" descriptor carries
// a unique key so a later batch pass can try to resolve it to a real route.
function planTripSegments(trip, home) {
  const segments = [];
  const points = trip.points;
  if (points.length === 0) return segments;

  if (home && haversineDistanceKm(points[0].lon, points[0].lat, home.lon, home.lat) > HOME_RADIUS_KM) {
    const homeEndpoint = { lon: home.lon, lat: home.lat, ts: trip.precedingHomeStayEndTs };
    const departType = classifyBoundaryHop(homeEndpoint, points[0]);
    segments.push({ type: departType, key: `${trip.id}:depart`, a: homeEndpoint, b: points[0] });
  }

  segments.push(...planTraceSegments(points, trip.id));

  const lastPoint = points[points.length - 1];
  if (home && haversineDistanceKm(lastPoint.lon, lastPoint.lat, home.lon, home.lat) > HOME_RADIUS_KM) {
    const homeEndpoint = { lon: home.lon, lat: home.lat, ts: trip.followingHomeStayStartTs };
    const returnType = classifyBoundaryHop(lastPoint, homeEndpoint);
    segments.push({ type: returnType, key: `${trip.id}:return`, a: lastPoint, b: homeEndpoint });
  }

  return segments;
}

// Turns segment descriptors into GeoJSON line features. A "gap" segment
// renders as the recovered driving route if one was found and judged
// plausible, otherwise falls back to a great-circle arc (the shortest real
// path between the two points, not a naive straight lon/lat interpolation).
// "flight" segments (altitude-confirmed) always render as that arc — no
// route-recovery is attempted since we already know it wasn't driven.
function renderTripLineFeatures(segments, recoveredRoutes) {
  return segments.map((segment) => {
    if (segment.type === 'trace') {
      return makeLineFeature(
        segment.points.map((pt) => [pt.lon, pt.lat]),
        'trace',
        TRIP_SIMPLIFY_TOLERANCE_DEG,
      );
    }
    if (segment.type === 'flight') {
      return makeGapFeature(segment.a, segment.b, 'flight');
    }
    const recovered = recoveredRoutes.get(segment.key);
    if (recovered) return makeLineFeature(recovered.coordinates, 'drive', TRIP_SIMPLIFY_TOLERANCE_DEG);
    return makeGapFeature(segment.a, segment.b, 'gap');
  });
}

function buildTripGeoJson(trip, getLabel, segments, recoveredRoutes) {
  const features = renderTripLineFeatures(segments, recoveredRoutes);

  for (const stay of trip.stays) {
    features.push(
      point([stay.lon, stay.lat], {
        startTs: stay.startTs,
        endTs: stay.endTs,
        durationMin: Math.round(stay.durationMin),
        placeName: getLabel(stay.lon, stay.lat),
        isHomeLayover: stay.isHome === true,
        isOvernight: isOvernightStay(stay),
      }),
    );
  }
  const fc = featureCollection(features);
  fc.bbox = features.length > 0 ? bboxOf(fc) : trip.bbox;
  return fc;
}

// Everything a trip's own point window *doesn't* cover — ordinary home-life
// driving/errands between trips, plus the ~1-day span still outside any home
// coverage. Trips are chronological and non-overlapping, so a single forward
// pass captures the gaps between (and before/after) them.
function computeNonTripChunks(cleanedPoints, trips) {
  const chunks = [];
  let cursor = 0;

  for (const trip of trips) {
    if (trip.points.length === 0) continue;
    const windowStartTs = trip.points[0].ts;
    const windowEndTs = trip.points[trip.points.length - 1].ts;

    let idx = cursor;
    while (idx < cleanedPoints.length && cleanedPoints[idx].ts < windowStartTs) idx++;
    if (idx > cursor) chunks.push(cleanedPoints.slice(cursor, idx));

    let endIdx = idx;
    while (endIdx < cleanedPoints.length && cleanedPoints[endIdx].ts <= windowEndTs) endIdx++;
    cursor = endIdx;
  }
  if (cursor < cleanedPoints.length) chunks.push(cleanedPoints.slice(cursor));

  return chunks;
}

// "All trails" mode shows literally everywhere you've been, not just
// detected trips — ordinary home-life driving/errands rendered the same
// clean-lines-and-dots way, at a coarser simplify tolerance since the same
// commute roads get retraced for years. No route-recovery is attempted for
// gaps here (rare for continuously-tracked home life, and not worth an
// unbounded OSRM batch) — unresolved gaps fall back to a plain great-circle
// arc like any other unrecovered gap.
function buildHomeLifeFeatures(cleanedPoints, trips, classifiedStays) {
  const features = [];
  const chunks = computeNonTripChunks(cleanedPoints, trips);
  chunks.forEach((chunkPoints, chunkIndex) => {
    const segments = planTraceSegments(chunkPoints, `home-life:${chunkIndex}`);
    for (const segment of segments) {
      if (segment.type === 'trace') {
        features.push(
          makeLineFeature(
            segment.points.map((pt) => [pt.lon, pt.lat]),
            'trace',
            HOME_LIFE_SIMPLIFY_TOLERANCE_DEG,
          ),
        );
      } else {
        features.push(makeGapFeature(segment.a, segment.b, segment.type));
      }
    }
  });

  const tripStaySet = new Set(trips.flatMap((trip) => trip.stays));
  for (const stay of classifiedStays) {
    if (tripStaySet.has(stay)) continue;
    features.push(
      point([stay.lon, stay.lat], {
        durationMin: Math.round(stay.durationMin),
        isOvernight: isOvernightStay(stay),
      }),
    );
  }

  return features;
}

function buildFunFactsOutput(funFacts, getLabel) {
  const namedPoint = (point) =>
    point && {
      lat: Number(point.lat.toFixed(4)),
      lon: Number(point.lon.toFixed(4)),
      ts: point.ts,
      label: getLabel(point.lon, point.lat),
    };

  const monthlyDistance = funFacts.monthlyDistanceKm.map((km, month) => ({
    month,
    km: Math.round(km),
    pct: funFacts.totalDistanceKm > 0 ? Number(((km / funFacts.totalDistanceKm) * 100).toFixed(1)) : 0,
  }));

  return {
    northmost: namedPoint(funFacts.northmost),
    southmost: namedPoint(funFacts.southmost),
    highestElevation: funFacts.highest && { ...namedPoint(funFacts.highest), elevationM: Math.round(funFacts.highest.altitude) },
    lowestElevation: funFacts.lowest && { ...namedPoint(funFacts.lowest), elevationM: Math.round(funFacts.lowest.altitude) },
    monthlyDistance,
  };
}

export async function writeOutputs({
  outputDir,
  trips,
  homeCenters,
  cleanedPoints,
  classifiedStays,
  getLabel,
  funFacts,
  sourceRowCount,
}) {
  const tripsDir = path.join(outputDir, 'trips');
  await mkdir(tripsDir, { recursive: true });

  // Trip ids are derived from a trip's start timestamp, so retuning the
  // detection algorithm shifts trip boundaries and leaves stale files behind
  // from previous runs — clear out anything that isn't a current trip.
  const expectedFileNames = new Set(trips.map((trip) => `${trip.id}.geojson`));
  for (const fileName of await readdir(tripsDir)) {
    if (!expectedFileNames.has(fileName)) await rm(path.join(tripsDir, fileName));
  }

  const homeById = new Map(homeCenters.map((home) => [home.id, home]));

  const tripsIndex = trips.map((trip) => {
    const placeNames = [];
    for (const stay of trip.stays) {
      const label = getLabel(stay.lon, stay.lat);
      if (placeNames[placeNames.length - 1] !== label) placeNames.push(label);
    }
    return {
      id: trip.id,
      startTs: trip.startTs,
      endTs: trip.endTs,
      placeNames,
      distanceKm: Math.round(trip.totalDistanceKm),
      bbox: trip.bbox,
      stayPoints: trip.stays.map((stay) => [Number(stay.lon.toFixed(4)), Number(stay.lat.toFixed(4))]),
    };
  });

  await writeFile(path.join(outputDir, 'trips-index.json'), JSON.stringify(tripsIndex), 'utf8');

  // trips-meta.json holds the human-editable display fields (title, and a
  // displayed start/duration that's allowed to diverge slightly from the
  // precise computed values — e.g. if the algorithm's boundary doesn't quite
  // match memory). Existing entries are preserved across regenerations so
  // hand edits survive re-running the pipeline; only genuinely new trip ids
  // get a freshly-computed default.
  const metaPath = path.join(outputDir, 'trips-meta.json');
  let tripsMeta = {};
  try {
    tripsMeta = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    // no existing file yet — start fresh
  }
  for (const trip of trips) {
    if (tripsMeta[trip.id]) continue;
    const central = getCentralStay(trip);
    tripsMeta[trip.id] = {
      title: `${getLabel(central.lon, central.lat)} · ${monthYearLabel(trip.startTs)}`,
      displayStartTs: trip.startTs,
      displayDurationDays: Math.max(1, Math.round((trip.endTs - trip.startTs) / 86400)),
    };
  }
  await writeFile(metaPath, `${JSON.stringify(tripsMeta, null, 2)}\n`, 'utf8');

  // Plan every trip's gap hops first, then resolve driving-route recovery in
  // one batch (shared cache across trips, one throttled pass over the net).
  const tripPlans = trips.map((trip) => ({
    trip,
    segments: planTripSegments(trip, homeById.get(trip.homeCenterId)),
  }));
  const allGapHops = tripPlans.flatMap(({ segments }) => segments.filter((segment) => segment.type === 'gap'));
  const recoveredRoutes = await recoverDriveSegments(allGapHops);

  // Compute each trip's GeoJSON once, write it to its own lazy-loaded file,
  // and reuse the same features (tagged with tripId) to build a merged
  // "all trips" overview file — the default globe/overview render uses the
  // same clean lines-and-stay-dots styling as a single selected trip, rather
  // than a separate blurry heatmap layer.
  const tripGeojsons = tripPlans.map(({ trip, segments }) => ({
    trip,
    geojson: buildTripGeoJson(trip, getLabel, segments, recoveredRoutes),
  }));

  await Promise.all(
    tripGeojsons.map(({ trip, geojson }) =>
      writeFile(path.join(outputDir, 'trips', `${trip.id}.geojson`), JSON.stringify(geojson), 'utf8'),
    ),
  );

  const overviewFeatures = tripGeojsons.flatMap(({ trip, geojson }) =>
    geojson.features.map((feature) => ({ ...feature, properties: { ...feature.properties, tripId: trip.id } })),
  );
  await writeFile(
    path.join(outputDir, 'overview-trips.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: overviewFeatures }),
    'utf8',
  );

  const homeLifeFeatures = buildHomeLifeFeatures(cleanedPoints, trips, classifiedStays);
  await writeFile(
    path.join(outputDir, 'all-trails.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: [...overviewFeatures, ...homeLifeFeatures] }),
    'utf8',
  );

  await writeFile(
    path.join(outputDir, 'home-centers.json'),
    JSON.stringify(
      homeCenters.map((home) => ({
        id: home.id,
        label: getLabel(home.lon, home.lat),
        center: [Number(home.lon.toFixed(5)), Number(home.lat.toFixed(5))],
        activeStart: home.activeStart,
        activeEnd: home.activeEnd,
      })),
    ),
    'utf8',
  );

  await writeFile(
    path.join(outputDir, 'fun-facts.json'),
    JSON.stringify(buildFunFactsOutput(funFacts, getLabel)),
    'utf8',
  );

  const dateRange = cleanedPoints.reduce(
    (range, pt) => ({ startTs: Math.min(range.startTs, pt.ts), endTs: Math.max(range.endTs, pt.ts) }),
    { startTs: Infinity, endTs: -Infinity },
  );

  await writeFile(
    path.join(outputDir, 'meta.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      sourceRowCount,
      cleanedPointCount: cleanedPoints.length,
      tripCount: trips.length,
      dateRange,
    }),
    'utf8',
  );
}
