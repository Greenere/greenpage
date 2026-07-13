import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, addProtocol, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers as protomapsLayers, LIGHT, DARK, type Flavor } from '@protomaps/basemaps';

import {
  loadAllTrails,
  loadOverviewTrips,
  loadTripDetail,
  tripDotsBasemapUrl,
  type HomeCenter,
  type TripSummary,
} from './content/tripDotsData';
import './TripDotsMap.css';

let pmtilesProtocolRegistered = false;
function ensurePmtilesProtocol() {
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

function resolveFlavor(): Flavor {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim();
  if (!bg) return LIGHT;
  return getLuminanceFromCssColor(bg) < 0.5 ? DARK : LIGHT;
}

type TripDotsPalette = {
  tripLine: string;
  tripStay: string;
  homeMarker: string;
  overnightHighlight: string;
};

// MapLibre paint properties are style-spec values, not live CSS — they can't
// reference CSS custom properties via var(). Resolve the current theme's
// colors to concrete strings once, at map-creation time, instead.
function resolvePalette(): TripDotsPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    tripLine: read('--color-primary', '#d3564b'),
    tripStay: read('--color-accent', '#e0a45c'),
    homeMarker: read('--color-text', '#46513a'),
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

function buildStyle(flavor: Flavor): StyleSpecification {
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

function addOverlaySourcesAndLayers(map: MapLibreMap, palette: TripDotsPalette) {
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
}: TripDotsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const paletteRef = useRef<TripDotsPalette>(resolvePalette());

  useEffect(() => {
    if (!containerRef.current) return;
    ensurePmtilesProtocol();

    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle(resolveFlavor()),
      center: [0, 20],
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
          'circle-radius': 6,
          'circle-color': paletteRef.current.homeMarker,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });
    }
  }, [homeCenters, mapReady]);

  // Home markers follow the same "dots"/"overnight" language as the stay
  // dots above: "dots" governs whether they show at all, and since a home
  // is by definition a place you stay overnight, "overnight" always
  // highlights them (no isOvernight property needed) and — when dots are
  // off — keeps them visible as a hollow ring instead of hiding them too.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const palette = paletteRef.current;
    const visible = showDots || highlightOvernight;
    for (const home of homeCenters) {
      const markerId = `home-marker-${home.id}`;
      if (!map.getLayer(markerId)) continue;
      map.setLayoutProperty(markerId, 'visibility', visible ? 'visible' : 'none');
      map.setPaintProperty(markerId, 'circle-color', showDots ? palette.homeMarker : 'transparent');
      map.setPaintProperty(markerId, 'circle-stroke-width', highlightOvernight ? 4 : 2);
      map.setPaintProperty(markerId, 'circle-stroke-color', highlightOvernight ? palette.overnightHighlight : '#fff');
    }
  }, [homeCenters, showDots, highlightOvernight, mapReady]);

  return (
    <div className="tripdots-map">
      <div ref={containerRef} className="tripdots-map__canvas" />
    </div>
  );
}
