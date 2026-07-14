// Manually confirmed corrections for specific photo-derived trips, layered
// on top of the automatic reconstruction in photo-trips.mjs — see
// scripts/trip_dots/README.md. Keyed by trip id (`photo-trip-<startTs>`,
// stable since it's derived from the trip's own first stay's timestamp, so
// re-running the pipeline won't change the key as long as the trip's
// boundaries don't shift).
//
// Photo trips normally only connect stays *within* the trip — there's no
// "departed home" / "returned home" boundary hop the way GPS trips have,
// because there's no reliable timestamp at the home end to validate a
// recovered route's duration against (see planPhotoTripSegments in
// write-outputs.mjs) or even to know which mode of travel it was. Each
// correction below supplies that missing boundary leg by hand: an ordered
// chain of waypoints (more than one hop for a connecting flight through
// another city, e.g. Santa Barbara below) and whether to render every hop in
// that chain as a 'flight' (skip route recovery entirely) or a 'gap'
// (attempt a real driving-route recovery, capped at PHOTO_TRIP_MAX_DRIVE_KM —
// reasonable for a bus/train journey that mostly follows the same highway
// corridor a car would).
//
// `departure.waypoints` runs chronologically from home to (but not
// including) the trip's first stay; `return.waypoints` runs from (but not
// including) the trip's last stay back to home.
//
// Every hop in a chain renders with the correction's own `mode` by default,
// but an individual waypoint can carry its own `mode` to override just the
// hop arriving at it — e.g. a flight chain that lands at an airport and
// finishes with a short drive home (NYC -> Denver -> SFO all 'flight', then
// SFO -> the Sunnyvale home as a one-off 'gap' override below).
//
// These are precise home addresses (geocoded via Nominatim), deliberately
// more specific than photo-trips.mjs's ITHACA_ANCHOR/SUNNYVALE_ANCHOR/
// SAN_BRUNO_ANCHOR — those three are only used for the coarse "is this stay
// away from home" distance check and don't need to be precise; a boundary
// hop drawn on the map benefits from actually landing on the right building.
const SAN_BRUNO_HOME = { lon: -122.42115, lat: 37.6347 }; // 1099 Admiral Ct, San Bruno, CA 94066
const ITHACA_HOME = { lon: -76.4728, lat: 42.4392 }; // 121 Veterans Pl, Ithaca, NY 14850 (active Aug 2022+)
// Rough Ithaca reference for trips before the precise home above was
// confirmed active (Philly, Niagara both predate the Aug 2022 move) — same
// point photo-trips.mjs's ITHACA_ANCHOR uses, duplicated here to avoid the
// circular import (see below).
const ITHACA_ROUGH = { lon: -76.4832, lat: 42.4461 };
// Precise pre-move Ithaca address (geocoded via Nominatim), used only for the
// Jan 2022 NYC trip below — more specific than ITHACA_ROUGH, which is still
// used as-is for Philadelphia/Niagara Falls since those weren't re-confirmed
// to this precision.
const DEARBORN_HOME = { lon: -76.4821438, lat: 42.4564552 }; // 216 Dearborn Pl, Ithaca, NY 14850
// Connecting-flight waypoints, city-center coordinates except SFO (named as
// the airport specifically, and it's a real hop away from San Francisco
// proper).
const NYC = { lon: -74.006, lat: 40.7128 };
const DENVER = { lon: -104.9903, lat: 39.7392 };
const SFO_AIRPORT = { lon: -122.379, lat: 37.6213 };
// Same point as photo-trips.mjs's SUNNYVALE_ANCHOR, duplicated here to avoid
// the circular import (see ITHACA_ROUGH above) — a rough city-level
// reference, not a precise street address (none confirmed yet).
const SUNNYVALE_HOME = { lon: -122.0317, lat: 37.377 };

// Shown on the map as home markers, same as the algorithmically-detected
// 2023+ homes in home-centers.json, but these two predate the dense-GPS
// dataset entirely (ANALYSIS_START_TS, 2023-06-01) so there's no weighted-
// dwell signal to detect them from — see write-outputs.mjs, which merges
// this list in at the very end (after the real detectHomeCenters() output is
// already finalized) specifically so these can't influence which home a
// 2023+ GPS stay gets classified against.
//
// Active date ranges are approximate, bounded by actual confirmed evidence:
// Dearborn Pl is the earliest confirmed home (NYC trip, Jan 21 2022) and runs
// up to San Bruno's earliest photo cluster in mid-May 2022; San Bruno in turn
// ends the day of the Virginia/DC trip's return flight into Ithaca (see
// PHOTO_TRIP_CORRECTIONS); Ithaca picks up from there and runs up to the
// main GPS dataset's own first detected home (Atherton, active from
// 2023-06-02).
// home-sunnyvale-2023's range overlaps the tail end of home-ithaca-2022's —
// both were genuinely concurrent bases (same pattern as the coast-splitting
// documented in photo-trips.mjs), not a strict handoff like the earlier
// three. Harmless for matching purposes since the two are thousands of km
// apart (see HOME_MATCH_MAX_KM in write-outputs.mjs).
export const HISTORICAL_HOME_CENTERS = [
  { id: 'home-dearborn-2022', lon: DEARBORN_HOME.lon, lat: DEARBORN_HOME.lat, activeStart: 1640995200, activeEnd: 1651363200 }, // 2022-01-01 -> 2022-05-01
  { id: 'home-san-bruno-2022', lon: SAN_BRUNO_HOME.lon, lat: SAN_BRUNO_HOME.lat, activeStart: 1651363200, activeEnd: 1660953600 }, // 2022-05-01 -> 2022-08-20
  { id: 'home-ithaca-2022', lon: ITHACA_HOME.lon, lat: ITHACA_HOME.lat, activeStart: 1660953600, activeEnd: 1685577600 }, // 2022-08-20 -> 2023-06-01
  { id: 'home-sunnyvale-2023', lon: SUNNYVALE_HOME.lon, lat: SUNNYVALE_HOME.lat, activeStart: 1673827200, activeEnd: 1685577600 }, // 2023-01-16 -> 2023-06-01
];

export const PHOTO_TRIP_CORRECTIONS = {
  // New York City, Jan 21-23 2022: drove both ways, from/to 216 Dearborn Pl.
  'photo-trip-1642767913': {
    departure: { waypoints: [DEARBORN_HOME], mode: 'gap' },
    return: { waypoints: [DEARBORN_HOME], mode: 'gap' },
  },
  // Philadelphia, Feb 25-28 2022: drove both ways, from/to the Ithaca home
  // (still the rough pre-move reference — this predates the Aug 2022 move to
  // 121 Veterans Pl).
  'photo-trip-1645821620': {
    departure: { waypoints: [ITHACA_ROUGH], mode: 'gap' },
    return: { waypoints: [ITHACA_ROUGH], mode: 'gap' },
  },
  // Niagara Falls, Apr 4-7 2022: bus from Ithaca, Ubered to SUNY Buffalo
  // (already an internal hop, handled fine automatically), bus back to
  // Ithaca. Same rough pre-move Ithaca reference as Philadelphia.
  'photo-trip-1649100115': {
    departure: { waypoints: [ITHACA_ROUGH], mode: 'gap' },
    return: { waypoints: [ITHACA_ROUGH], mode: 'gap' },
  },
  // Santa Cruz & Monterey Peninsula, May 29-30 2022: drove down the coast
  // from the San Bruno home to Santa Cruz, continued along the coast through
  // Monterey/Pacific Grove (the 17-Mile Drive), then drove back to San Bruno.
  'photo-trip-1653849389': {
    departure: { waypoints: [SAN_BRUNO_HOME], mode: 'gap' },
    return: { waypoints: [SAN_BRUNO_HOME], mode: 'gap' },
  },
  // Boston, Jun 23-28 2022: summer 2022 was based out of the San Bruno home;
  // flew both ways (only sensible mode for a ~4000km round trip this short).
  'photo-trip-1656023736': {
    departure: { waypoints: [SAN_BRUNO_HOME], mode: 'flight' },
    return: { waypoints: [SAN_BRUNO_HOME], mode: 'flight' },
  },
  // Seattle, Jul 16-18 2022: same San Bruno summer base; flew both ways.
  'photo-trip-1657956002': {
    departure: { waypoints: [SAN_BRUNO_HOME], mode: 'flight' },
    return: { waypoints: [SAN_BRUNO_HOME], mode: 'flight' },
  },
  // Virginia & DC, Aug 16-21 2022: last of the "summer, based in San Bruno"
  // trips, but this one is a transition — flew directly San Bruno home ->
  // Charlottesville (Albemarle County); took the train Charlottesville -> DC
  // (the existing internal route-recovery already handles this reasonably
  // as a 'gap'); after a few days in DC, flew directly DC -> the Ithaca home,
  // where the person was based from here on.
  'photo-trip-1660617447': {
    departure: { waypoints: [SAN_BRUNO_HOME], mode: 'flight' },
    return: { waypoints: [ITHACA_HOME], mode: 'flight' },
  },
  // Watertown, New York, Oct 1-2 2022: based at the Ithaca home by now; drove
  // both ways.
  'photo-trip-1664636182': {
    departure: { waypoints: [ITHACA_HOME], mode: 'gap' },
    return: { waypoints: [ITHACA_HOME], mode: 'gap' },
  },
  // New York City, Jan 10-16 2023: drove from the Ithaca home to start;
  // flew back via two connections (NYC -> Denver -> SFO), then drove the
  // last leg from SFO to the new Sunnyvale home.
  'photo-trip-1673391334': {
    departure: { waypoints: [ITHACA_HOME], mode: 'gap' },
    return: { waypoints: [DENVER, SFO_AIRPORT, { ...SUNNYVALE_HOME, mode: 'gap' }], mode: 'flight' },
  },
  // San Diego & Carlsbad, May 26-29 2023: based at the Sunnyvale home by
  // now; flew both ways.
  'photo-trip-1685126044': {
    departure: { waypoints: [SUNNYVALE_HOME], mode: 'flight' },
    return: { waypoints: [SUNNYVALE_HOME], mode: 'flight' },
  },
  // San Juan, Puerto Rico, Dec 20-25 2022: based at the Ithaca home by now.
  // Took a bus to NYC to start (the automatic reconstruction already picks
  // up from NYC and correctly detects the NYC -> Miami -> San Juan and
  // San Juan -> NYC flights on its own); flew directly from NYC back to
  // Ithaca to finish (see tripline-import.mjs's MANUAL_EXCLUSIONS for the
  // stray mid-flight point that otherwise made this last leg look like a
  // drive).
  'photo-trip-1671577817': {
    departure: { waypoints: [ITHACA_HOME], mode: 'gap' },
    return: { waypoints: [ITHACA_HOME], mode: 'flight' },
  },
  // Santa Barbara, Dec 1-3 2022: based at the Ithaca home by now. Flew out
  // via two connections (Ithaca -> NYC -> Denver -> Santa Barbara) and back
  // via a different three-leg routing (Santa Barbara -> SFO -> NYC ->
  // Ithaca).
  'photo-trip-1669940236': {
    departure: { waypoints: [ITHACA_HOME, NYC, DENVER], mode: 'flight' },
    return: { waypoints: [SFO_AIRPORT, NYC, ITHACA_HOME], mode: 'flight' },
  },
};
