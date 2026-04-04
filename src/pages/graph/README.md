# `src/pages/graph`

This folder contains the runtime graph experience for the site:

- the graph homepage
- the bio and node detail pages
- graph-specific content loading
- graph layout logic
- graph node/edge renderers

## Mental model

There are three main layers here:

1. `NodeHomePage.tsx`
   The interactive graph surface. It loads the graph model, computes the initial layout, restores/reset viewport state, and renders the React Flow canvas.

2. Detail pages
   `BioDetailPage.tsx` and `NodeDetailPage.tsx` render the routed long-form pages for `/nodes/bio` and `/nodes/:nodeId`.

3. Data + presentation helpers
   The `content/`, `layout/`, and `nodes/` subfolders hold the graph data model, layout rules, and React Flow node pieces that the pages build on.

## Top-level files

- [`NodeHomePage.tsx`](./NodeHomePage.tsx)
  Main graph page. Owns graph loading, viewport restore/reset, initial node positioning, and graph-level interactions.

- [`NodeDetailPage.tsx`](./NodeDetailPage.tsx)
  Routed content-node detail page. It loads lightweight graph data first, then lazy-loads the full selected article content.

- [`BioDetailPage.tsx`](./BioDetailPage.tsx)
  Routed bio detail page. It loads localized bio content plus graph data for the generated “Pages through the graph” section.

- [`DetailContent.tsx`](./DetailContent.tsx)
  Shared detail-page rendering helpers. This is the graph-side renderer for section blocks, inline markdown, and safe internal/external link behavior.

- [`DetailPageLanguageToggle.tsx`](./DetailPageLanguageToggle.tsx)
  Small language toggle used on the detail pages.

- [`ThemePicker.tsx`](./ThemePicker.tsx)
  Shared theme picker used on the graph page and detail pages.

## `content/`

- [`Nodes.ts`](./content/Nodes.ts)
  Core graph content/data layer. Defines node/relation/content types, resolves localized content files, loads graph structure, loads card indexes, and loads full node articles.

- [`BioPage.ts`](./content/BioPage.ts)
  Localized bio content types, normalization, loading, fallback resolution, and portrait-link resolution.

- [`BioTheme.ts`](./content/BioTheme.ts)
  Graph bio portrait assets and theme persistence helpers.

- [`Intros.tsx`](./content/Intros.tsx)
  Small intro copy/render helpers used by the graph surface.

## `layout/`

- [`graphLayout.ts`](./layout/graphLayout.ts)
  Layout math and positioning helpers for the homepage graph.

- [`graphLayoutConfig.ts`](./layout/graphLayoutConfig.ts)
  Tunable graph-layout constants, such as spacing/tightness and camera timing.

Keep this split in mind:

- `graphLayoutConfig.ts` is for knobs
- `graphLayout.ts` is for actual layout behavior

## `nodes/`

These are the React Flow node/edge building blocks.

- [`StoryNode.tsx`](./nodes/StoryNode.tsx)
  Standard content card in the graph.

- [`BioNode.tsx`](./nodes/BioNode.tsx)
  Central bio node on the homepage.

- [`BioToggleNode.tsx`](./nodes/BioToggleNode.tsx)
  Small style node that hosts theme and language controls on the graph page.

- [`Handles.tsx`](./nodes/Handles.tsx)
  Shared handle primitives and handle-position helpers.

- [`EdgeTypes.tsx`](./nodes/EdgeTypes.tsx)
  Custom edge rendering for the graph.

## Data flow

Homepage:

1. `NodeHomePage.tsx` loads the graph structure plus localized `node_cards.{locale}.json`.
2. It creates graph nodes/edges for React Flow.
3. It applies initial layout and later measured-layout settling.

Detail page:

1. Route enters `NodeDetailPage.tsx` or `BioDetailPage.tsx`.
2. The page reads cached localized content if available.
3. If needed, it fetches the localized payload.
4. The page renders through `DetailContent.tsx` so inline links stay router-aware.

## When changing things

If you want to change...

- graph spacing or recenter timing:
  Start in [`graphLayoutConfig.ts`](./layout/graphLayoutConfig.ts)

- graph node composition:
  Look at [`StoryNode.tsx`](./nodes/StoryNode.tsx), [`BioNode.tsx`](./nodes/BioNode.tsx), and [`BioToggleNode.tsx`](./nodes/BioToggleNode.tsx)

- graph/detail content loading:
  Start in [`Nodes.ts`](./content/Nodes.ts) and [`BioPage.ts`](./content/BioPage.ts)

- detail page block rendering:
  Start in [`DetailContent.tsx`](./DetailContent.tsx)

- language/theme controls on detail pages:
  Look at [`DetailPageLanguageToggle.tsx`](./DetailPageLanguageToggle.tsx) and [`ThemePicker.tsx`](./ThemePicker.tsx)

## Design notes

- The homepage graph is optimized around lightweight card data.
- Full article payloads are only loaded on detail pages.
- Detail pages intentionally keep their own renderer instead of reusing the editor preview renderer directly, because graph runtime navigation needs router-aware links and production-safe URL handling.
