import type { TripVlogDetails } from './content/tripDotsData';

// Client for the dev-only save endpoints in vite.config.ts
// (createVlogPinEditorPlugin) — only reachable while running `vite dev`,
// same convention as src/pages/editor/editorApi.ts's `/__editor/*` calls.
export async function saveVlogPinPosition(vlogId: string, lon: number, lat: number): Promise<{ lon: number; lat: number }> {
  const response = await fetch('/__vlog-editor/pin/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vlogId, lon, lat }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Save failed.');
  }
  return { lon: payload.lon, lat: payload.lat };
}

export type VlogDetailsDraft = {
  vlogId: string;
  titleEn: string;
  titleZhCn: string;
  descriptionEn: string;
  descriptionZhCn: string;
  url: string;
  coverImageUrl: string;
};

export async function saveVlogDetails(draft: VlogDetailsDraft): Promise<TripVlogDetails> {
  const response = await fetch('/__vlog-editor/details/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Save failed.');
  }
  return payload.details as TripVlogDetails;
}
