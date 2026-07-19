import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  addProtocol,
  type GeoJSONSource,
  type StyleSpecification,
  type VectorTileSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers as protomapsLayers, LIGHT, DARK, type Flavor } from '@protomaps/basemaps';

import { UI_COPY } from '../../configs/ui/uiCopy';
import type { AppLanguage } from '../../i18n/config';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import {
  loadAllTrails,
  loadOverviewTrips,
  loadTripDetail,
  loadTripVlogDetails,
  tripDotsBasemapUrl,
  tripDotsRegionalBasemapUrl,
  type HomeCenter,
  type LocalizedText,
  type TripSummary,
  type TripVlog,
  type TripVlogDetails,
} from './content/tripDotsData';
import './TripDotsMap.css';

// Must match the bbox public/data/tripdots/basemap-ca.pmtiles was built with
// (see scripts/trip_dots/README.md) — the regional extract has no data at
// all outside it, so it's only usable when a trip's own bbox fits inside.
const REGIONAL_BASEMAP_BBOX: [number, number, number, number] = [-125, 32, -113, 42.5];

function isBboxInsideRegion(bbox: [number, number, number, number]): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const [regionMinLon, regionMinLat, regionMaxLon, regionMaxLat] = REGIONAL_BASEMAP_BBOX;
  return minLon >= regionMinLon && maxLon <= regionMaxLon && minLat >= regionMinLat && maxLat <= regionMaxLat;
}

let pmtilesProtocolRegistered = false;
export function ensurePmtilesProtocol() {
  if (pmtilesProtocolRegistered) return;
  const protocol = new Protocol();
  addProtocol('pmtiles', protocol.tile);
  pmtilesProtocolRegistered = true;
}

function getLuminanceFromCssColor(cssColor: string): number {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 1;
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function resolveFlavor(): Flavor {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim();
  if (!bg) return LIGHT;
  return getLuminanceFromCssColor(bg) < 0.5 ? DARK : LIGHT;
}

export type TripDotsPalette = {
  tripLine: string;
  tripStay: string;
  overnightHighlight: string;
};

// MapLibre paint properties are style-spec values, not live CSS — they can't
// reference CSS custom properties via var(). Resolve the current theme's
// colors to concrete strings once, at map-creation time, instead.
export function resolvePalette(): TripDotsPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    tripLine: read('--color-primary', '#d3564b'),
    tripStay: read('--color-accent', '#e0a45c'),
    overnightHighlight: '#f4c542',
  };
}

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Great-circle "gap" arcs split into a MultiLineString wherever they cross
// the antimeridian, so line layers need to match both geometry types.
// (typed `any` — MapLibre's FilterSpecification tuple types don't infer
// correctly once this expression is shared across multiple layer filters.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_LINE_GEOMETRY: any = ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']];

export function buildStyle(flavor: Flavor): StyleSpecification {
  return {
    version: 8,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${tripDotsBasemapUrl()}`,
        attribution: '&copy; OpenStreetMap contributors &copy; Protomaps',
      },
    },
    layers: protomapsLayers('protomaps', flavor, { lang: 'en' }),
  };
}

export function addOverlaySourcesAndLayers(map: MapLibreMap, palette: TripDotsPalette) {
  if (!map.getSource('overview-trips')) {
    map.addSource('overview-trips', { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  }
  if (!map.getSource('trip-detail')) {
    map.addSource('trip-detail', { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  }

  // Default/overview rendering uses the same clean lines-and-stay-dots
  // styling as a single selected trip (just thinner/dimmer, since ~30 trips
  // render at once) rather than a separate blurry heatmap layer.
  if (!map.getLayer('overview-trip-line')) {
    map.addLayer({
      id: 'overview-trip-line',
      type: 'line',
      source: 'overview-trips',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'trace']],
      paint: { 'line-color': palette.tripLine, 'line-width': 1.5, 'line-opacity': 0.75 },
    });
  }
  if (!map.getLayer('overview-trip-line-drive')) {
    map.addLayer({
      id: 'overview-trip-line-drive',
      type: 'line',
      source: 'overview-trips',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'drive']],
      paint: { 'line-color': palette.tripLine, 'line-width': 1.2, 'line-opacity': 0.5, 'line-dasharray': [4, 2] },
    });
  }
  if (!map.getLayer('overview-trip-line-gap')) {
    map.addLayer({
      id: 'overview-trip-line-gap',
      type: 'line',
      source: 'overview-trips',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'gap']],
      paint: { 'line-color': palette.tripLine, 'line-width': 1, 'line-opacity': 0.35, 'line-dasharray': [2, 2] },
    });
  }
  // "flight" segments are altitude-confirmed (>6000m) — distinct from a
  // generic ambiguous "gap" so they can be hidden/shown independently.
  if (!map.getLayer('overview-trip-line-flight')) {
    map.addLayer({
      id: 'overview-trip-line-flight',
      type: 'line',
      source: 'overview-trips',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'flight']],
      paint: { 'line-color': palette.tripLine, 'line-width': 1, 'line-opacity': 0.4, 'line-dasharray': [1, 2] },
    });
  }
  if (!map.getLayer('overview-trip-stays')) {
    map.addLayer({
      id: 'overview-trip-stays',
      type: 'circle',
      source: 'overview-trips',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'durationMin'], 20, 2, 1440, 8],
        'circle-color': palette.tripStay,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    });
  }

  if (!map.getLayer('trip-line')) {
    map.addLayer({
      id: 'trip-line',
      type: 'line',
      source: 'trip-detail',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'trace']],
      paint: {
        'line-color': palette.tripLine,
        'line-width': 2.5,
        'line-opacity': 0.9,
      },
    });
  }

  // "drive" segments are gap hops recovered as a real (road-following)
  // driving route — dimmed and dashed like "gap" (still not GPS-confirmed)
  // but a longer dash and slightly higher opacity to read as more confident
  // than a straight-line guess.
  if (!map.getLayer('trip-line-drive')) {
    map.addLayer({
      id: 'trip-line-drive',
      type: 'line',
      source: 'trip-detail',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'drive']],
      paint: {
        'line-color': palette.tripLine,
        'line-width': 2,
        'line-opacity': 0.65,
        'line-dasharray': [4, 2],
      },
    });
  }

  // "gap" segments are unrecovered signal/battery gaps in the raw GPS trace —
  // rendered dimmed and dashed so they read as "not an actual traced path"
  // (line-dasharray isn't data-driven in the style spec, hence separate
  // layers per segment type).
  if (!map.getLayer('trip-line-gap')) {
    map.addLayer({
      id: 'trip-line-gap',
      type: 'line',
      source: 'trip-detail',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'gap']],
      paint: {
        'line-color': palette.tripLine,
        'line-width': 1.5,
        'line-opacity': 0.5,
        'line-dasharray': [2, 2],
      },
    });
  }

  // "flight" segments are altitude-confirmed (>6000m) — distinct from a
  // generic ambiguous "gap" so they can be hidden/shown independently.
  if (!map.getLayer('trip-line-flight')) {
    map.addLayer({
      id: 'trip-line-flight',
      type: 'line',
      source: 'trip-detail',
      filter: ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], 'flight']],
      paint: {
        'line-color': palette.tripLine,
        'line-width': 1.2,
        'line-opacity': 0.55,
        'line-dasharray': [1, 2],
      },
    });
  }

  if (!map.getLayer('trip-stays')) {
    map.addLayer({
      id: 'trip-stays',
      type: 'circle',
      source: 'trip-detail',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'durationMin'], 20, 4, 1440, 11],
        'circle-color': palette.tripStay,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
      },
    });
  }
}

// zh_cn is optional on each hand-edited entry — fall back to English rather
// than showing a blank title/description for a not-yet-translated vlog.
function pickLocalizedText(text: LocalizedText, language: AppLanguage): string {
  return language === 'zh-CN' ? (text.zh_cn ?? text.en) : text.en;
}

// Static, hand-written (not lucide-react — this file builds plain DOM nodes,
// not React elements) so it's safe to insert via innerHTML; every other
// piece of text in this popup is untrusted-ish hand-edited data and goes
// through textContent instead, never this.
// Solid-filled, not stroke-only like lucide's line icons elsewhere on this
// page — a play triangle needs to read at a glance even this small, and a
// 2px outline alone is nearly invisible at 14px.
const PLAY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';

// Same "static, hand-written, safe to insert via innerHTML" reasoning as
// PLAY_ICON_SVG above. Stroke-only (not filled), matching lucide's line-icon
// style used everywhere else on this page outside the popup — a plain
// chevron reads fine as an outline even this small, unlike the play
// triangle, which is why that one stays solid.
const CHEVRON_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

// Tune this directly to resize the vlog pin — nothing else needs to change.
// The rendered pin looks smaller than this number: the teardrop shape only
// fills ~16 of the SVG's 24 viewBox units, so e.g. 22px here reads as ~15px
// wide on screen (roughly a longer-duration stay dot's diameter — see
// trip-stays' circle-radius in addOverlaySourcesAndLayers, which tops out
// at 11px/22px-across).
export const VLOG_PIN_SIZE_PX = 32;

// Minimum zoom level a click-to-open pin brings the camera to (never zooms
// out if already closer than this — see the vlog-pins effect). Capped to
// match the global basemap.pmtiles' own --maxzoom=6 (see
// scripts/trip_dots/README.md) rather than the deeper 12 used for a
// selected trip's bbox — a plain pin click doesn't trigger the
// regional-basemap swap (that's keyed off trip selection, not the pin), so
// zooming past what the active (likely global) source actually has just
// stretches its zoom-6 tile into a blank, detail-less blob.
const VLOG_PIN_FOCUS_MIN_ZOOM = 6;

// Matches the @media (max-width: 720px) breakpoint in TripDotsPage.css,
// where the trip sidebar becomes a collapsed bottom sheet with its own
// floating toggle buttons above it — extra fixed chrome at the bottom of
// the screen that desktop doesn't have. The desktop bottom-padding
// reservation below (160px) leaves the popup with room to spare there, but
// on mobile it's not enough to also clear that sheet+buttons, so the vlog
// card can end up overlapping them. Only affects the click-to-focus camera
// move, not any layout/behavior on desktop.
const VLOG_PIN_FOCUS_MOBILE_QUERY = '(max-width: 720px)';
const VLOG_PIN_FOCUS_BOTTOM_PADDING = 160;
const VLOG_PIN_FOCUS_BOTTOM_PADDING_MOBILE = 340;

// Fade duration for a vlog popup opening/closing — must match the
// `transition: opacity` duration on .maplibregl-popup in TripDotsMap.css,
// since the close path uses this to time the actual DOM removal (popup.
// remove() can't itself be animated — the fade is faked by delaying it
// until the opacity transition has had time to finish).
const VLOG_POPUP_FADE_MS = 160;

// A small flat pin (fill + a plain white dot, no gradients/embossing) rather
// than maplibregl.Marker's default teardrop — that built-in SVG bakes in a
// ground-shadow ellipse, a semi-transparent bezel outline, and a shadowed
// inner dot, all of which read as skeuomorphic next to this page's flat
// circular stay/home dots. Colored via `currentColor`/wrapper.style.color
// (see the vlog-pins effect) since a custom marker element bypasses
// maplibregl.Marker's own `color` option entirely.
export const VLOG_PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${VLOG_PIN_SIZE_PX}" height="${VLOG_PIN_SIZE_PX}" viewBox="0 0 24 24" fill="currentColor">` +
  '<path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z"/>' +
  '<circle cx="12" cy="10" r="3" fill="#fff"/>' +
  '</svg>';

// Appends a bare play icon into any element — shared between the standalone
// link (no cover image) and the badge overlaid on the cover image's corner
// (see buildVlogPopupContent), so the two stay visually identical without
// duplicating markup. Icon-only by design — the caller is responsible for
// giving its own element an aria-label, since there's no visible text here
// for an accessible name to fall back to.
function appendWatchIcon(target: HTMLElement) {
  const icon = document.createElement('span');
  icon.className = 'tripdots-vlog-popup__link-icon';
  icon.innerHTML = PLAY_ICON_SVG;
  target.appendChild(icon);
}

// Built via DOM APIs (not innerHTML) so a title/description containing
// special characters is never at risk of being interpreted as markup — the
// one exception is PLAY_ICON_SVG above, a static constant with no user data
// in it. `onClose` wires the card's own close button — see the vlog-pins
// effect below for why popup lifecycle is managed by hand rather than
// MapLibre's built-in close button/event.
//
// `details` (description/url/coverImageUrl) comes from trip-vlog-details.json
// — fetched lazily, only once a pin is actually clicked (see the vlog-pins
// effect), so this function itself only ever runs after that fetch resolves.
//
// Layout: a full-width hero image on top (native 16:9, edge to edge, never
// cropped since the box matches the image's own aspect ratio), title below
// it, description collapsed by default and only revealed by clicking the
// title. This is what lets the image stay genuinely large — carrying most
// of "what this place feels like" — without also making the *default* card
// tall: the description (the one truly variable-height part) only counts
// against the card's footprint once someone actually asks to read it. Two
// earlier layouts were tried and rejected: a side-by-side thumbnail sized to
// fill the card's height either cropped the image or left it too small to
// read as a real photo; the same full-width banner with the description
// always visible worked but made every card tall regardless of whether
// anyone wanted the extra text. Without a cover image, the "Watch" link
// still renders inline, outside the collapsible region, since it's a
// separate action from reading the description.
function buildVlogPopupContent(details: TripVlogDetails, language: AppLanguage, onClose: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tripdots-vlog-popup';

  // Absolutely positioned over everything (including the cover image, when
  // present) rather than living in a text-row header, so it works the same
  // whether or not this vlog has a cover image.
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'tripdots-vlog-popup__close';
  closeButton.setAttribute('aria-label', UI_COPY.tripDotsPage.vlogCloseLabel);
  closeButton.textContent = '×';
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    onClose();
  });
  container.appendChild(closeButton);

  // coverImageUrl is optional (see TripVlogDetails) — plain thumbnail URL,
  // no i18n, since it's a screenshot rather than text.
  if (details.coverImageUrl) {
    const coverLink = document.createElement('a');
    coverLink.className = 'tripdots-vlog-popup__cover';
    coverLink.href = details.url;
    coverLink.target = '_blank';
    coverLink.rel = 'noopener noreferrer';
    // The badge below is icon-only, so this is the anchor's only accessible
    // name — the image itself carries alt="" since it's purely decorative.
    coverLink.setAttribute('aria-label', UI_COPY.tripDotsPage.vlogWatchLink);

    const img = document.createElement('img');
    // Some CDNs (bilibili's included — confirmed via curl: 403 "deny by
    // referer access rule" for any foreign Referer, 200 with none at all)
    // hotlink-protect by rejecting cross-site Referer headers. Sending none
    // sidesteps that without needing our own proxy.
    img.referrerPolicy = 'no-referrer';
    img.src = details.coverImageUrl;
    img.alt = '';
    img.loading = 'lazy';
    coverLink.appendChild(img);

    const watchBadge = document.createElement('span');
    watchBadge.className = 'tripdots-vlog-popup__watch-badge';
    appendWatchIcon(watchBadge);
    coverLink.appendChild(watchBadge);

    container.appendChild(coverLink);
  }

  const content = document.createElement('div');
  content.className = 'tripdots-vlog-popup__content';

  const descriptionText = pickLocalizedText(details.description, language);

  // A <button> (not a div) so it's keyboard-focusable/activatable like any
  // other toggle on this page — styled to look like plain text, same
  // "override the native chrome" convention as .tripdots-vlog-popup__close.
  // Only wired as a toggle when there's actually a description to reveal;
  // otherwise it renders as inert plain text with no chevron, since there's
  // nothing to expand.
  const title = document.createElement(descriptionText ? 'button' : 'div');
  title.className = 'tripdots-vlog-popup__title';
  if (descriptionText) {
    (title as HTMLButtonElement).type = 'button';
  }
  const titleText = document.createElement('span');
  titleText.textContent = pickLocalizedText(details.title, language);
  title.appendChild(titleText);
  content.appendChild(title);

  if (descriptionText) {
    const chevron = document.createElement('span');
    chevron.className = 'tripdots-vlog-popup__title-chevron';
    chevron.innerHTML = CHEVRON_ICON_SVG;
    title.appendChild(chevron);

    // The CSS grid-template-rows 0fr/1fr trick (see TripDotsMap.css) needs
    // an outer row-animated wrapper plus an inner overflow:hidden clip —
    // a single element can't do both jobs at once.
    const descriptionRow = document.createElement('div');
    descriptionRow.className = 'tripdots-vlog-popup__description-row';
    const descriptionClip = document.createElement('div');
    descriptionClip.className = 'tripdots-vlog-popup__description-clip';
    const description = document.createElement('p');
    description.className = 'tripdots-vlog-popup__description';
    description.textContent = descriptionText;
    descriptionClip.appendChild(description);
    descriptionRow.appendChild(descriptionClip);
    content.appendChild(descriptionRow);

    title.addEventListener('click', (event) => {
      event.stopPropagation();
      container.classList.toggle('tripdots-vlog-popup--expanded');
    });
  }

  if (!details.coverImageUrl) {
    const link = document.createElement('a');
    link.className = 'tripdots-vlog-popup__link';
    link.href = details.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', UI_COPY.tripDotsPage.vlogWatchLink);
    appendWatchIcon(link);
    content.appendChild(link);
  }

  container.appendChild(content);

  return container;
}

// Vlog pins sharing (near-)identical coordinates would otherwise render
// exactly on top of each other and be unclickable individually — fan
// duplicates out along a small golden-angle spiral so every one stays a
// separate, independently-clickable pin, each with its own popup.
export const VLOG_DUPLICATE_JITTER_DEG = 0.0006;
export function jitteredVlogPosition(vlog: TripVlog, occurrenceIndex: number): [number, number] {
  if (occurrenceIndex === 0) return [vlog.lon, vlog.lat];
  const angle = (occurrenceIndex * 137.5 * Math.PI) / 180;
  return [vlog.lon + Math.cos(angle) * VLOG_DUPLICATE_JITTER_DEG, vlog.lat + Math.sin(angle) * VLOG_DUPLICATE_JITTER_DEG];
}

type TripDotsMapProps = {
  homeCenters: HomeCenter[];
  visibleTripIds: string[];
  selectedTripId: string | null;
  selectedTrip: TripSummary | null;
  viewMode: 'globe' | 'flat';
  showingAllTrails: boolean;
  showDots: boolean;
  showRoutes: boolean;
  showFlights: boolean;
  highlightOvernight: boolean;
  tripVlogs: TripVlog[];
  showVlogs: boolean;
};

export default function TripDotsMap({
  homeCenters,
  visibleTripIds,
  selectedTripId,
  selectedTrip,
  viewMode,
  showingAllTrails,
  showDots,
  showRoutes,
  showFlights,
  highlightOvernight,
  tripVlogs,
  showVlogs,
}: TripDotsMapProps) {
  const { language } = useAppLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const paletteRef = useRef<TripDotsPalette>(resolvePalette());
  // Which vlog popups are currently open, kept across marker rebuilds (e.g.
  // a language switch tears down and recreates every marker+popup) so an
  // open card doesn't silently vanish — see the vlog-pins effect below.
  const openVlogIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!containerRef.current) return;
    ensurePmtilesProtocol();

    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle(resolveFlavor()),
      // A rough, hand-picked stand-in for "the mass center of all the trip
      // data" (most of it is North America-heavy) rather than an actual
      // computed centroid — [0, 20] (off the coast of Africa) put the
      // initial view centered on empty ocean with no dots anywhere nearby,
      // which read as a bug on first load rather than a deliberate default.
      center: [-97, 32],
      zoom: 1.4,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    // No NavigationControl: every screen corner is already occupied by our
    // own overlay UI (back link, language/theme, view toggle, panel), and
    // scroll/pinch-zoom + drag-to-rotate already work without it.

    map.on('load', () => {
      map.setProjection({ type: 'globe' });
      addOverlaySourcesAndLayers(map, paletteRef.current);

      loadOverviewTrips().then((overviewTrips) => {
        (map.getSource('overview-trips') as GeoJSONSource | undefined)?.setData(overviewTrips);
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let cancelled = false;
    const dataPromise = showingAllTrails ? loadAllTrails() : loadOverviewTrips();
    dataPromise.then((data) => {
      if (cancelled) return;
      (map.getSource('overview-trips') as GeoJSONSource | undefined)?.setData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [showingAllTrails, mapReady]);

  // The time-range filtering already happened at the page level
  // (visibleTripIds reflects it), applied as a tripId membership filter —
  // except in "all trails" mode, which shows literally everything
  // unconditionally (including home-life features, which have no tripId).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const idFilter: GeoJSON.Feature | unknown = ['in', ['get', 'tripId'], ['literal', visibleTripIds]];
    const lineFilter = (segmentType: string) => {
      const base = ['all', IS_LINE_GEOMETRY, ['==', ['get', 'segmentType'], segmentType]];
      return showingAllTrails ? base : [...base, idFilter];
    };
    if (map.getLayer('overview-trip-line')) map.setFilter('overview-trip-line', lineFilter('trace') as never);
    if (map.getLayer('overview-trip-line-drive')) map.setFilter('overview-trip-line-drive', lineFilter('drive') as never);
    if (map.getLayer('overview-trip-line-gap')) map.setFilter('overview-trip-line-gap', lineFilter('gap') as never);
    if (map.getLayer('overview-trip-line-flight')) map.setFilter('overview-trip-line-flight', lineFilter('flight') as never);

    // When dots are hidden, only overnight stays still render (as hollow
    // rings — see the overnight-highlight effect below) — everything else
    // is filtered out here rather than just left invisible, so hover/click
    // hit-testing doesn't target dots the user can't see.
    const pointFilterBase = ['==', ['geometry-type'], 'Point'];
    const overnightOnlyFilter = ['==', ['get', 'isOvernight'], true];
    if (map.getLayer('overview-trip-stays')) {
      const overviewPointFilter = [
        'all',
        pointFilterBase,
        ...(showingAllTrails ? [] : [idFilter]),
        ...(showDots ? [] : [overnightOnlyFilter]),
      ];
      map.setFilter('overview-trip-stays', overviewPointFilter as never);
    }
    if (map.getLayer('trip-stays')) {
      const tripStaysFilter = showDots ? pointFilterBase : ['all', pointFilterBase, overnightOnlyFilter];
      map.setFilter('trip-stays', tripStaysFilter as never);
    }
  }, [visibleTripIds, showingAllTrails, showDots, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setProjection({ type: viewMode === 'globe' ? 'globe' : 'mercator' });
  }, [viewMode, mapReady]);

  // Data loading / camera-fly only — layer visibility is handled by the
  // dedicated effect below so toggling "routes"/"flights" doesn't refetch
  // data or move the camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!selectedTripId || !selectedTrip) {
      (map.getSource('trip-detail') as GeoJSONSource | undefined)?.setData(EMPTY_FEATURE_COLLECTION);
      return;
    }

    let cancelled = false;
    loadTripDetail(selectedTripId).then((geojson) => {
      if (cancelled) return;
      (map.getSource('trip-detail') as GeoJSONSource | undefined)?.setData(geojson);
      const [minLon, minLat, maxLon, maxLat] = selectedTrip.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 72, duration: 900, maxZoom: 12 },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedTripId, selectedTrip, mapReady]);

  // Vlog pins (see public/data/tripdots/trip-vlogs.json) — independent of
  // the dots/routes/flights toggles, since these are hand-curated
  // highlights rather than derived GPS data. showVlogs (off by default) is a
  // plain visibility switch, not its own "show everything" mode — it
  // combines with trip selection like any other filter: off hides vlog pins
  // unconditionally (even if a trip is selected), on shows just the
  // selected trip's vlogs (matched by vlog.tripId — a vlog with no tripId
  // never shows this way) or, with no trip selected, every vlog at once. A
  // maplibregl.Marker (a small flat pin, tinted to match the route line
  // color) makes clicking-to-open obvious, distinct from the plain circular
  // stay/home dots. At most one popup is open at a time (see openPopup's
  // closePopupById below). Rebuilt on language change too, so an
  // already-open popup's content switches immediately — open/closed state
  // is tracked by hand in openVlogIdsRef (not MapLibre's built-in
  // closeOnClick/close-button/'close' event) specifically so that a
  // rebuild's teardown, which removes every popup, doesn't itself look like
  // the user closing them and wipe that state right before it's needed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const vlogs = !showVlogs ? [] : selectedTripId ? tripVlogs.filter((vlog) => vlog.tripId === selectedTripId) : tripVlogs;
    if (vlogs.length === 0) return;

    const markers: Marker[] = [];
    const popups: Popup[] = [];
    // At most one card open at a time (see openPopup below) — this maps a
    // vlog id back to its own closePopup so a *different* vlog's click
    // handler can close whichever one is currently open. Populated as the
    // loop runs, but only ever read from a click handler after the loop has
    // finished and every entry exists, so iteration order doesn't matter.
    const closePopupById = new Map<string, () => void>();
    const occurrenceByKey = new Map<string, number>();
    for (const vlog of vlogs) {
      const key = `${vlog.lon.toFixed(4)},${vlog.lat.toFixed(4)}`;
      const occurrenceIndex = occurrenceByKey.get(key) ?? 0;
      occurrenceByKey.set(key, occurrenceIndex + 1);
      const position = jitteredVlogPosition(vlog, occurrenceIndex);

      // closeOnClick: false — opening a pin shouldn't get dismissed by the
      // camera pan/click that opening it just did; "only one card open"
      // (see openPopup below) is instead enforced by hand.
      // anchor: 'top' — the popup hangs *below* the pin (tip at its own top
      // edge) rather than above it. This matters for the expand/collapse
      // description: MapLibre keeps a popup's anchor edge pinned to the map
      // coordinate and repositions the *other* edge as content resizes, so
      // an anchor: 'bottom' popup (sitting above the pin) grows upward when
      // expanded — the header visibly slides up the screen. Anchoring from
      // the top instead means growing taller only extends the bottom edge
      // further down, leaving the header (right under the tip) fixed in
      // place. See the padding on the easeTo call below, which reserves
      // room *under* the pin to match.
      const popup = new Popup({ offset: 28, maxWidth: '336px', closeOnClick: false, closeButton: false, anchor: 'top' }).setLngLat(
        position,
      );
      // A custom `element` bypasses maplibregl.Marker's own `color` option
      // (that only styles its built-in default SVG), so the pin's color is
      // set by hand on the wrapper via CSS currentColor instead.
      const pinWrapper = document.createElement('div');
      pinWrapper.innerHTML = VLOG_PIN_SVG;
      pinWrapper.style.color = paletteRef.current.tripLine;
      // opacityWhenCovered: 0 — in globe mode, MapLibre's default is to fade
      // (not hide) markers on the far side of the planet, which reads fine
      // at today's pin count but would turn into visual noise as more vlogs
      // get added; hiding them outright scales better. No effect in flat
      // mode (nothing is ever "occluded" there). MapLibre only toggles this
      // via inline style opacity, not display/pointer-events, hence the
      // .maplibregl-marker-covered CSS rule in TripDotsMap.css disabling
      // clicks/hover on an invisible-but-still-present covered marker.
      const marker = new Marker({ element: pinWrapper, anchor: 'bottom', opacityWhenCovered: 0 })
        .setLngLat(position)
        .addTo(map);
      const markerElement = marker.getElement();
      markerElement.classList.add('tripdots-vlog-pin');

      // popup.remove() can't itself be animated, so the fade-out is faked:
      // drop the CSS class that holds it at opacity 1, then delay the real
      // removal by VLOG_POPUP_FADE_MS so the transition has time to play.
      // fadeOutTimeoutId lets a show-after-close (e.g. rapid double-click)
      // cancel a pending removal instead of it firing late and deleting a
      // popup that was actually just reopened.
      let fadeOutTimeoutId: number | undefined;
      const closePopup = () => {
        openVlogIdsRef.current.delete(vlog.vlogId);
        markerElement.classList.remove('tripdots-vlog-pin--open');
        popup.getElement()?.classList.remove('tripdots-vlog-popup--visible');
        fadeOutTimeoutId = window.setTimeout(() => {
          popup.remove();
          fadeOutTimeoutId = undefined;
        }, VLOG_POPUP_FADE_MS);
      };
      closePopupById.set(vlog.vlogId, closePopup);

      // The popup's DOM content (in particular its <img>, which starts
      // downloading the instant it's created) is built lazily on first
      // open rather than eagerly for every pin up front — with "All vlogs"
      // on, building all of them immediately meant every pin's thumbnail
      // started loading at once, which is what made panning sluggish.
      // loadTripVlogDetails() itself is only fetched once (cached) across
      // every pin, so only the very first open of the whole session pays
      // for that request.
      let contentReady = false;
      const ensureContent = async () => {
        if (contentReady) return;
        const detailsById = await loadTripVlogDetails();
        const details = detailsById[vlog.vlogId];
        if (!details) {
          console.warn(`No trip-vlog-details.json entry for vlogId "${vlog.vlogId}"`);
          return;
        }
        popup.setDOMContent(buildVlogPopupContent(details, language, closePopup));
        contentReady = true;
      };

      const showPopup = async () => {
        if (fadeOutTimeoutId !== undefined) {
          window.clearTimeout(fadeOutTimeoutId);
          fadeOutTimeoutId = undefined;
        }
        await ensureContent();
        popup.addTo(map);
        openVlogIdsRef.current.add(vlog.vlogId);
        markerElement.classList.add('tripdots-vlog-pin--open');
        // Double rAF: a single frame can land in the same paint as the
        // class-less initial state, which some browsers coalesce and skip
        // the transition for entirely.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            popup.getElement()?.classList.add('tripdots-vlog-popup--visible');
          });
        });
      };
      // moveCamera is false when this runs as part of a rebuild reopening an
      // already-open popup (e.g. a language switch tearing every marker
      // down and back up) — only a real click should recenter the map. When
      // it does, the camera settles first and the card only appears once
      // that finishes (map.once('moveend', ...)), rather than popping in
      // immediately and getting dragged along mid-animation.
      const openPopup = (moveCamera: boolean) => {
        // At most one card open at a time — close whichever other one(s)
        // are open first (stacked cards can occlude each other). Snapshot
        // via spread since closePopup mutates openVlogIdsRef as it goes,
        // and mutating a Set mid-iteration can skip entries.
        for (const openId of [...openVlogIdsRef.current]) {
          if (openId !== vlog.vlogId) closePopupById.get(openId)?.();
        }
        if (!moveCamera) {
          void showPopup();
          return;
        }
        map.once('moveend', () => void showPopup());
        const isMobileLayout = window.matchMedia(VLOG_PIN_FOCUS_MOBILE_QUERY).matches;
        map.easeTo({
          center: position,
          zoom: Math.max(map.getZoom(), VLOG_PIN_FOCUS_MIN_ZOOM),
          // Leaves room below the pin for the popup card itself (which now
          // hangs below the pin — see the Popup's anchor: 'top' above), so
          // opening it doesn't require a second pan to actually read it.
          padding: {
            top: 0,
            bottom: isMobileLayout ? VLOG_PIN_FOCUS_BOTTOM_PADDING_MOBILE : VLOG_PIN_FOCUS_BOTTOM_PADDING,
            left: 0,
            right: 0,
          },
          duration: 600,
        });
      };
      popups.push(popup);

      markerElement.addEventListener('click', (event) => {
        event.stopPropagation();
        if (popup.isOpen()) {
          closePopup();
        } else {
          openPopup(true);
        }
      });
      markers.push(marker);

      if (openVlogIdsRef.current.has(vlog.vlogId)) openPopup(false);
    }

    return () => {
      popups.forEach((popup) => popup.remove());
      markers.forEach((marker) => marker.remove());
    };
  }, [selectedTripId, tripVlogs, language, mapReady, showVlogs]);

  // Swap the basemap's tile source between the global (whole-planet,
  // low-zoom) and regional (California + neighbors, real street-level zoom)
  // extracts. The regional file has no data outside its bbox, so it's only
  // used when the selected trip's own bbox fits entirely inside it —
  // otherwise (including the no-selection overview) the global file stays
  // active so areas outside the region don't render blank.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource('protomaps') as VectorTileSource | undefined;
    if (!source) return;
    const useRegional = selectedTrip ? isBboxInsideRegion(selectedTrip.bbox) : false;
    const url = `pmtiles://${useRegional ? tripDotsRegionalBasemapUrl() : tripDotsBasemapUrl()}`;
    if (source.url !== url) source.setUrl(url);
  }, [selectedTrip, mapReady]);

  // Master visibility for line/stay layers: overview lines+stays hide while
  // a specific trip is selected (in favor of that trip's own detail layer);
  // "dots" independently governs the stay-point circles; "routes" hides the
  // non-flight connecting lines (both overview and trip-detail); "flights"
  // independently governs both altitude-confirmed and speed-inferred flight
  // segments — it's a dedicated toggle, so it isn't gated by "routes" at
  // all. Stay layers stay visible when "dots" is off but "overnight" is on —
  // the filter effect above then restricts them to overnight-only points,
  // rendered as hollow rings by the overnight-highlight effect below.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const setVisibility = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    };

    const overviewActive = !selectedTripId;
    const staysVisible = showDots || highlightOvernight;
    setVisibility('overview-trip-line', overviewActive && showRoutes);
    setVisibility('overview-trip-line-drive', overviewActive && showRoutes);
    setVisibility('overview-trip-line-gap', overviewActive && showRoutes);
    setVisibility('overview-trip-line-flight', overviewActive && showFlights);
    setVisibility('overview-trip-stays', overviewActive && staysVisible);

    setVisibility('trip-line', showRoutes);
    setVisibility('trip-line-drive', showRoutes);
    setVisibility('trip-line-gap', showRoutes);
    setVisibility('trip-line-flight', showFlights);
    setVisibility('trip-stays', staysVisible);
  }, [selectedTripId, showDots, showRoutes, showFlights, highlightOvernight, mapReady]);

  // Overnight-stay highlight: bump the stroke width/color for stay dots
  // whose isOvernight property is true, on both the overview and trip-detail
  // stay layers. When "dots" is off, the filter effect above already
  // restricts these layers to overnight-only points, so here the fill is
  // dropped to transparent — leaving just the highlighted stroke, i.e. an
  // empty/hollow ring, instead of the normal filled dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const palette = paletteRef.current;

    const applyOvernightStyle = (layerId: string, baseWidth: number) => {
      if (!map.getLayer(layerId)) return;
      map.setPaintProperty(layerId, 'circle-color', showDots ? palette.tripStay : 'transparent');
      if (highlightOvernight) {
        map.setPaintProperty(
          layerId,
          'circle-stroke-width',
          ['case', ['==', ['get', 'isOvernight'], true], baseWidth + 2, baseWidth] as never,
        );
        map.setPaintProperty(
          layerId,
          'circle-stroke-color',
          ['case', ['==', ['get', 'isOvernight'], true], palette.overnightHighlight, '#fff'] as never,
        );
      } else {
        map.setPaintProperty(layerId, 'circle-stroke-width', baseWidth);
        map.setPaintProperty(layerId, 'circle-stroke-color', '#fff');
      }
    };

    applyOvernightStyle('trip-stays', 1.5);
    applyOvernightStyle('overview-trip-stays', 1);
  }, [highlightOvernight, showDots, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || homeCenters.length === 0) return;
    for (const home of homeCenters) {
      const markerId = `home-marker-${home.id}`;
      if (map.getSource(markerId)) continue;
      map.addSource(markerId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: home.center },
          properties: { label: home.label },
        },
      });
      map.addLayer({
        id: markerId,
        type: 'circle',
        source: markerId,
        paint: {
          'circle-radius': 5,
          'circle-color': paletteRef.current.tripStay,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      });
    }
  }, [homeCenters, mapReady]);

  // Home markers follow the same "dots"/"overnight" language and the same
  // fill/stroke treatment as the stay dots above (a home is just a place you
  // stay, definitionally overnight) — no separate "home" color, so it reads
  // as part of the same dot vocabulary rather than a distinct, louder marker.
  // When a specific trip is selected, only the home(s) actually relevant to
  // that trip (trip.homeCenterIds, computed at build time from the trip's
  // classified home or its confirmed departure/return waypoints — see
  // write-outputs.mjs) stay visible; a trip that departed from one home and
  // returned to a different one shows both. Otherwise every home marker
  // shows regardless of which trip you're looking at.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const palette = paletteRef.current;
    const dotsVisible = showDots || highlightOvernight;
    const relevantHomeIds = selectedTrip ? new Set(selectedTrip.homeCenterIds) : null;
    for (const home of homeCenters) {
      const markerId = `home-marker-${home.id}`;
      if (!map.getLayer(markerId)) continue;
      const isRelevant = !relevantHomeIds || relevantHomeIds.has(home.id);
      map.setLayoutProperty(markerId, 'visibility', dotsVisible && isRelevant ? 'visible' : 'none');
      map.setPaintProperty(markerId, 'circle-color', showDots ? palette.tripStay : 'transparent');
      map.setPaintProperty(markerId, 'circle-stroke-width', highlightOvernight ? 3.5 : 1.5);
      map.setPaintProperty(markerId, 'circle-stroke-color', highlightOvernight ? palette.overnightHighlight : '#fff');
    }
  }, [homeCenters, showDots, highlightOvernight, selectedTrip, mapReady]);

  return (
    <div className="tripdots-map">
      <div ref={containerRef} className="tripdots-map__canvas" />
    </div>
  );
}
