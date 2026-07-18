import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, Popup, type GeoJSONSource, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Link } from 'react-router-dom';

import {
  addOverlaySourcesAndLayers,
  buildStyle,
  ensurePmtilesProtocol,
  jitteredVlogPosition,
  resolveFlavor,
  resolvePalette,
  VLOG_PIN_SVG,
} from './TripDotsMap';
import { loadAllTrails, loadTripVlogDetails, loadTripVlogs, type TripVlog, type TripVlogDetails } from './content/tripDotsData';
import { saveVlogDetails, saveVlogPinPosition, type VlogDetailsDraft } from './vlogPinEditorApi';
import './TripVlogPinEditorPage.css';

type SaveStatus = { vlogId: string; ok: boolean; message: string };

// Builds the double-click edit card as plain DOM (not JSX) — the card is
// hosted inside a maplibregl.Popup via setDOMContent, which only accepts a
// real HTMLElement, so there's no React tree to render into here. Returns
// small imperative handles (setStatus/setSaving) instead of taking props,
// since a Popup's content is built once per open and then lives outside
// React's render cycle until the popup closes.
function buildVlogEditCardContent(
  vlogId: string,
  existing: TripVlogDetails | undefined,
  onSave: (draft: VlogDetailsDraft) => void,
) {
  const container = document.createElement('div');
  container.className = 'tripdots-vlog-edit-card';

  const heading = document.createElement('div');
  heading.className = 'tripdots-vlog-edit-card__heading';
  heading.textContent = vlogId;
  container.appendChild(heading);

  function addField(labelText: string, tag: 'input' | 'textarea', value: string) {
    const label = document.createElement('label');
    label.className = 'tripdots-vlog-edit-card__label';
    label.textContent = labelText;
    const control = document.createElement(tag);
    control.className = 'tripdots-vlog-edit-card__input';
    control.value = value;
    label.appendChild(control);
    container.appendChild(label);
    return control;
  }

  const titleEnInput = addField('Title (EN)', 'input', existing?.title.en ?? '');
  const titleZhCnInput = addField('Title (中文, optional)', 'input', existing?.title.zh_cn ?? '');
  const descriptionEnInput = addField('Description (EN)', 'textarea', existing?.description.en ?? '');
  const descriptionZhCnInput = addField('Description (中文, optional)', 'textarea', existing?.description.zh_cn ?? '');
  const urlInput = addField('Video URL', 'input', existing?.url ?? '');
  const coverImageUrlInput = addField('Cover image URL (optional)', 'input', existing?.coverImageUrl ?? '');

  const actions = document.createElement('div');
  actions.className = 'tripdots-vlog-edit-card__actions';

  const statusEl = document.createElement('span');
  statusEl.className = 'tripdots-vlog-edit-card__status';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'tripdots-vlog-edit-card__button tripdots-vlog-edit-card__button--primary';
  saveButton.textContent = 'Save';
  saveButton.addEventListener('click', () => {
    onSave({
      vlogId,
      titleEn: titleEnInput.value.trim(),
      titleZhCn: titleZhCnInput.value.trim(),
      descriptionEn: descriptionEnInput.value.trim(),
      descriptionZhCn: descriptionZhCnInput.value.trim(),
      url: urlInput.value.trim(),
      coverImageUrl: coverImageUrlInput.value.trim(),
    });
  });

  actions.appendChild(statusEl);
  actions.appendChild(saveButton);
  container.appendChild(actions);

  return {
    element: container,
    setStatus: (message: string, isError: boolean) => {
      statusEl.textContent = message;
      statusEl.classList.toggle('tripdots-vlog-edit-card__status--error', isError);
    },
    setSaving: (saving: boolean) => {
      saveButton.disabled = saving;
    },
  };
}

// Dev-only tool (see vite.config.ts's createVlogPinEditorPlugin) for
// correcting the lon/lat of hand-placed vlog pins by dragging them on a map,
// since eyeballing coordinates by hand (the way public/data/tripdots/
// trip-vlogs.json's entries were originally created) is error-prone, and
// (since a double-click) editing a vlog's title/description/url/cover image
// (trip-vlog-details.json) without hand-editing JSON. Every vlog renders at
// once, regardless of tripId — unlike TripDotsMap, there's no trip selection
// here, just "show me everything so I can fix what's wrong." Hovering a pin
// shows its title (from trip-vlog-details.json) so it's identifiable without
// opening anything; dragging it saves the new position immediately (no
// separate "save" step), and double-clicking opens an editable card (see
// buildVlogEditCardContent/openEditCard) with an explicit Save button, since
// unlike a single lon/lat a whole form full of text fields needs a moment to
// review before persisting. Both save paths only ever run against a local
// dev server with git tracking the result — an unwanted change is a
// `git diff`/`git checkout` away from being undone.
export default function TripVlogPinEditorPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hasFitBoundsRef = useRef(false);
  // At most one edit card open at a time — opening a new one (or a rebuild
  // of the markers effect, e.g. after a save updates detailsById) closes
  // whichever was already open, same "single active popup" convention as
  // TripDotsMap's read-only vlog popups.
  const activeEditPopupRef = useRef<Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [vlogs, setVlogs] = useState<TripVlog[] | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, TripVlogDetails> | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);

  useEffect(() => {
    Promise.all([loadTripVlogs(), loadTripVlogDetails()]).then(([loadedVlogs, loadedDetails]) => {
      setVlogs(loadedVlogs);
      setDetailsById(loadedDetails);
    });
  }, []);

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

    map.on('load', () => {
      // Flat, not globe — a pin-editing tool benefits from predictable
      // screen-space dragging, not a globe's curved projection.
      map.setProjection({ type: 'mercator' });

      // Same trip lines/stay dots TripDotsMap renders in its "all trails"
      // overview — shown underneath every vlog pin unconditionally (no
      // toggle) so it's obvious which actual GPS trace/stay a pin should
      // sit on top of while dragging it into place.
      addOverlaySourcesAndLayers(map, resolvePalette());
      loadAllTrails().then((trails) => {
        (map.getSource('overview-trips') as GeoJSONSource | undefined)?.setData(trails);
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const tooltip = tooltipRef.current;
    if (!map || !mapReady || !vlogs || !detailsById || !tooltip || vlogs.length === 0) return;

    const markers: Marker[] = [];
    const occurrenceByKey = new Map<string, number>();
    const bounds = new LngLatBounds();

    // Opens the double-click edit card for one vlog, closing whichever other
    // one was already open first (see activeEditPopupRef). Saving updates
    // detailsById, which is itself a dependency of this whole effect — the
    // resulting rebuild is what refreshes the hover tooltip's title, at the
    // cost of tearing down and recreating every marker; acceptable for a
    // ~100-pin dev tool run purely against localhost.
    const openEditCard = (vlog: TripVlog, position: LngLatLike) => {
      activeEditPopupRef.current?.remove();

      const popup = new Popup({ offset: 28, maxWidth: '320px', closeOnClick: false }).setLngLat(position);
      popup.on('close', () => {
        if (activeEditPopupRef.current === popup) activeEditPopupRef.current = null;
      });

      const card = buildVlogEditCardContent(vlog.vlogId, detailsById[vlog.vlogId], (draft) => {
        card.setSaving(true);
        card.setStatus('Saving…', false);
        saveVlogDetails(draft)
          .then((savedDetails) => {
            setDetailsById((prev) => ({ ...(prev ?? {}), [vlog.vlogId]: savedDetails }));
            setSaveStatus({ vlogId: vlog.vlogId, ok: true, message: `Saved details for ${vlog.vlogId}` });
            popup.remove();
          })
          .catch((error: unknown) => {
            card.setSaving(false);
            card.setStatus(error instanceof Error ? error.message : 'Save failed.', true);
          });
      });

      popup.setDOMContent(card.element);
      popup.addTo(map);
      activeEditPopupRef.current = popup;
    };

    for (const vlog of vlogs) {
      const key = `${vlog.lon.toFixed(4)},${vlog.lat.toFixed(4)}`;
      const occurrenceIndex = occurrenceByKey.get(key) ?? 0;
      occurrenceByKey.set(key, occurrenceIndex + 1);
      const position = jitteredVlogPosition(vlog, occurrenceIndex);
      bounds.extend(position);

      const pinWrapper = document.createElement('div');
      pinWrapper.innerHTML = VLOG_PIN_SVG;
      // A vlog with no tripId (a daily/virtual one, not tied to a detected
      // trip) is dimmed rather than tinted the same as every other pin, so
      // it's obvious at a glance which ones those are while editing.
      pinWrapper.style.color = vlog.tripId ? '#d3564b' : '#8a8a8a';
      pinWrapper.classList.add('tripdots-vlog-editor-pin');

      const marker = new Marker({ element: pinWrapper, anchor: 'bottom', draggable: true }).setLngLat(position).addTo(map);
      const markerElement = marker.getElement();

      const showTooltip = () => {
        const details = detailsById[vlog.vlogId];
        tooltip.textContent = details
          ? `${details.title.en}${vlog.tripId ? '' : '  ·  no trip'}`
          : `(no details entry — ${vlog.vlogId})`;
        tooltip.dataset.vlogId = vlog.vlogId;
        tooltip.style.display = 'block';
      };
      const positionTooltip = (event: MouseEvent) => {
        tooltip.style.left = `${event.clientX + 14}px`;
        tooltip.style.top = `${event.clientY + 14}px`;
      };
      const hideTooltip = () => {
        if (tooltip.dataset.vlogId === vlog.vlogId) tooltip.style.display = 'none';
      };

      markerElement.addEventListener('mouseenter', showTooltip);
      markerElement.addEventListener('mousemove', positionTooltip);
      markerElement.addEventListener('mouseleave', hideTooltip);
      markerElement.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        hideTooltip();
        openEditCard(vlog, position);
      });
      marker.on('dragstart', hideTooltip);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setSaveStatus({ vlogId: vlog.vlogId, ok: true, message: `Saving ${vlog.vlogId}…` });
        saveVlogPinPosition(vlog.vlogId, lngLat.lng, lngLat.lat)
          .then(({ lon, lat }) => {
            setSaveStatus({ vlogId: vlog.vlogId, ok: true, message: `Saved ${vlog.vlogId} → ${lon}, ${lat}` });
          })
          .catch((error: unknown) => {
            setSaveStatus({
              vlogId: vlog.vlogId,
              ok: false,
              message: `Failed to save ${vlog.vlogId}: ${error instanceof Error ? error.message : 'unknown error'}`,
            });
          });
      });

      markers.push(marker);
    }

    if (!hasFitBoundsRef.current) {
      hasFitBoundsRef.current = true;
      map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 8 });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
      activeEditPopupRef.current?.remove();
    };
  }, [mapReady, vlogs, detailsById]);

  useEffect(() => {
    if (!saveStatus) return;
    const timeoutId = window.setTimeout(() => setSaveStatus(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [saveStatus]);

  return (
    <div className="tripdots-vlog-editor">
      <div className="tripdots-vlog-editor__header">
        <Link to="/tripdots" className="tripdots-vlog-editor__back">
          ← Trip dots
        </Link>
        <span className="tripdots-vlog-editor__title">Vlog pin editor (dev only)</span>
        <span className="tripdots-vlog-editor__count">
          {vlogs ? `${vlogs.length} pins — drag to reposition, double-click to edit details` : 'Loading…'}
        </span>
      </div>
      <div ref={containerRef} className="tripdots-vlog-editor__canvas" />
      <div ref={tooltipRef} className="tripdots-vlog-editor__tooltip" style={{ display: 'none' }} />
      {saveStatus && (
        <div className={`tripdots-vlog-editor__toast${saveStatus.ok ? '' : ' tripdots-vlog-editor__toast--error'}`}>
          {saveStatus.message}
        </div>
      )}
    </div>
  );
}
