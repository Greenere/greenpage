// Tunable thresholds for the trip-detection pipeline. Retune these after
// eyeballing the --debug trip list output against real travel memory.

// Stage A — clean/sort
export const ANALYSIS_START_TS = 1685644724; // 2023-06-01, drops ~7 stray pre-2020 outliers
export const ACCURACY_MAX_M = 200;
export const DUPLICATE_DIST_M = 10;
export const DUPLICATE_MAX_GAP_S = 5;
// Above this, a ping is almost certainly mid-flight, not a real ground
// position — well above the highest place tracked so far (~5,600m, the
// highest paved roads), comfortably below cruise altitude (~10,000-12,000m).
// These get dropped as unreliable "trace" data; the resulting hole in the
// point stream is what the gap-detection logic in write-outputs.mjs turns
// into a confident "flight" segment (see FLIGHT_ALTITUDE_THRESHOLD_M usage).
export const FLIGHT_ALTITUDE_THRESHOLD_M = 6000;

// Stage B — stay-point detection (Li et al. 2008 sliding window)
export const STAY_DIST_THRESHOLD_M = 200;
export const STAY_MIN_DURATION_MIN = 20;
export const MAX_GAP_MIN = 180;

// Stage C — home-base detection
export const HOME_GRID_CELL_KM = 1;
export const HOME_NIGHT_WEIGHT = 1.75;
export const HOME_NIGHT_START_HOUR = 22;
export const HOME_NIGHT_END_HOUR = 7;
export const HOME_CANDIDATE_MAX = 3;
export const HOME_MIN_WEEKLY_HOURS = 1;
export const HOME_MIN_ACTIVE_SPAN_DAYS = 21;

// Stage D — home vs. away
// 45km covers a full Bay Area Peninsula daily-life radius (Atherton <-> SF is
// ~40km) so ordinary commuting/errands don't get counted as "away".
export const HOME_RADIUS_KM = 45;

// A stay "included an overnight" if it's long enough to plausibly involve
// real sleep and its midpoint falls in the estimated-local-time night window
// (reuses HOME_NIGHT_START_HOUR/HOME_NIGHT_END_HOUR above).
export const OVERNIGHT_MIN_DURATION_MIN = 180;

// Stage E — trip segmentation
export const HOME_LAYOVER_MAX_HOURS = 12;
export const TRIP_MIN_DISTANCE_KM = 70;
export const TRIP_MIN_DURATION_HOURS = 8;

// Stage F — reverse geocoding
export const NOMINATIM_THROTTLE_MS = 1000;
export const NOMINATIM_USER_AGENT = 'greenpage-tripdots-builder/1.0 (personal site build script)';
export const GEOCODE_CACHE_PRECISION = 3; // decimal places, ~100m

// Output line simplification
export const TRIP_SIMPLIFY_TOLERANCE_DEG = 0.0005;
// Coarser than trip traces — ordinary home-life driving retraces the same
// roads for years, so a looser tolerance keeps "all trails" mode's file size
// reasonable without losing the "these roads were driven" shape.
export const HOME_LIFE_SIMPLIFY_TOLERANCE_DEG = 0.001;

// Gap detection: a hop between consecutive points that isn't a real traced
// path — either a flight (fast) or a signal/battery gap (slow but huge time
// jump) — gets rendered as a dimmed dotted line instead of a solid trace.
// Calibrated against this dataset's actual gaps: real flights show implied
// speeds of 600-1000km/h in the air, but connecting/domestic flights with
// boarding+taxi+deplaning baked into the same timestamp gap can average as
// low as ~177km/h; data gaps show huge time jumps (hours) at only a few
// km/h; legitimate fast highway driving tops out around 150-160km/h.
export const GAP_MIN_DISTANCE_KM = 15;
export const GAP_MIN_SPEED_KMH = 165;
export const GAP_MIN_TIME_MINUTES = 120;

// Driving-route recovery: for a gap hop that isn't an obvious flight, try
// fetching a real driving route (OSRM) instead of drawing a straight line.
// The result is only trusted if it's actually plausible — a route that would
// take far longer to drive than the observed time gap means the hop almost
// certainly wasn't driven (it was a flight), so it falls back to a straight
// dotted line instead.
export const ROUTE_RECOVERY_MAX_RAW_SPEED_KMH = 250; // above this, don't even bother trying OSRM
export const ROUTE_MAX_DISTANCE_RATIO = 2.5; // OSRM route distance vs. straight-line distance
export const ROUTE_DURATION_SLACK_RATIO = 1.15; // OSRM's estimated duration vs. the observed time gap
export const ROUTE_CACHE_PRECISION = 3; // decimal places, ~100m
export const ROUTE_THROTTLE_MS = 500;
export const OSRM_USER_AGENT = 'greenpage-tripdots-builder/1.0 (personal site build script)';

// Fun facts (intro-card stats): a bogus GPS altitude reading recurs as this
// exact value (found identically 8 times across unrelated points in this
// dataset — real altitude noise never repeats exactly) — almost certainly a
// device/OS sentinel for "no altitude fix", not a real reading, so it's
// excluded from the highest/lowest-elevation stat.
export const ALTITUDE_SENTINEL_M = -500;
