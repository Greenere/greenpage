# greenpage

`greenpage` is a personal site built with React, TypeScript, Vite, and React Flow.

The main experience is a graph-based homepage with:

- a central bio node
- domain-grouped content nodes such as education, experience, project, research, travel, and writing
- draggable graph interactions and routed detail pages
- an editor workspace for content, relations, and domains
- localized UI and localized content files

## Stack

- React 19
- TypeScript
- Vite
- React Flow
- GitHub Pages deployment

## Development

### Install

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Regenerate generated node indexes manually

```bash
npm run generate:node-index
```

`predev` and `prebuild` already run this for you.

## Project structure

- [`src/pages/graph`](./src/pages/graph)
  The active graph homepage, lazy-loaded detail pages, graph nodes, and graph data loaders.
- [`src/pages/editor`](./src/pages/editor)
  The editor workspace, live preview, templates, browse-node dialog, and section editor.
- [`src/pages/legacy`](./src/pages/legacy)
  Older homepage implementation kept as reference/archive material.
- [`src/configs`](./src/configs)
  Centralized config for domains, themes, icons, transitions, highlight behavior, and shared UI copy.
- [`src/i18n`](./src/i18n)
  Locale registry, language provider, and locale message files.
- [`src/shared`](./src/shared)
  Reusable UI, styling helpers, transitions, chronology helpers, and shared article/gallery UI.
- [`public/data`](./public/data)
  Graph structure, localized bio data, and localized node JSON content.

## Routes

- `/` for the graph homepage
- `/nodes/:nodeId` for content detail pages
- `/nodes/bio` for the bio detail page
- `/editor` for the editor landing route, which defaults to the bio editor
- `/editor/nodes/:nodeId` for opening a specific node or the bio workspace directly

The two detail routes are lazy-loaded and now use a shared layout skeleton while the route chunk or localized content is loading.

## Data model

### Graph structure

- [`public/data/graph.json`](./public/data/graph.json)
  The graph registry: nodes, explicit relations, and graph-level settings.

Each graph node entry contains structural fields such as:

- `id`
- `kind`
- `domain`
- `chronology`
- optional `contentPath`

### Bio content

- [`public/data/bio.en.json`](./public/data/bio.en.json)
- [`public/data/bio.zh_cn.json`](./public/data/bio.zh_cn.json)

The bio page is localized with separate files per locale.

### Node content

Localized node articles live under [`public/data/nodes`](./public/data/nodes), grouped by domain.

Examples:

- `public/data/nodes/education/cornell.en.json`
- `public/data/nodes/education/cornell.zh_cn.json`
- `public/data/nodes/project/data_visualizations_2021.en.json`

### Generated indexes

The generator produces two locale-specific indexes per language:

- `index.{locale}.json`
  Full article payloads for fallback and tooling.
- `node_cards.{locale}.json`
  Lightweight graph-card payloads used by the graph homepage and bio path views.

Current generated files include:

- [`public/data/nodes/node_cards.en.json`](./public/data/nodes/node_cards.en.json)
- [`public/data/nodes/node_cards.zh_cn.json`](./public/data/nodes/node_cards.zh_cn.json)

The graph page now loads card-scale content only, while detail pages lazy-load the full article for the selected node.

## Localization

The app supports both UI localization and content localization.

### UI localization

UI copy is driven by:

- [`src/i18n/locales/en.ts`](./src/i18n/locales/en.ts)
- [`src/i18n/locales/zh_cn.ts`](./src/i18n/locales/zh_cn.ts)
- [`src/i18n/LanguageProvider.tsx`](./src/i18n/LanguageProvider.tsx)

### Content localization

Content uses per-locale JSON files rather than inline translation objects.

Examples:

- `bio.en.json` and `bio.zh_cn.json`
- `cornell.en.json` and `cornell.zh_cn.json`

Fallback order is locale-aware and currently prefers:

- requested locale
- English
- other supported locale
- legacy unlocalized file if present

## Editor

The project includes an editor for creating and editing:

- node content
- explicit graph relations
- node metadata
- the bio page
- new nodes from templates
- new domains

### Open it

Start the dev server:

```bash
npm run dev
```

Then open:

- `/editor`

Important notes:

- `/editor` now opens the bio workspace by default
- in development, the editor can write back to the repo through Vite dev endpoints
- in production, the editor is still accessible for preview/local draft editing, but write/create/delete actions are disabled
- create/delete domain operations still reload the editor because domains are stored in [`src/configs/content/domains.ts`](./src/configs/content/domains.ts)

### What it can do

- edit localized node content with a live article preview
- edit localized bio content with the same section editor and markdown subset
- edit raw JSON
- create new nodes from templates
- edit explicit graph relations from the connected-nodes UI
- create and delete domains
- switch editor language without changing the current editing context
- autosave local drafts by default

### Editor rules

- node ids and domain ids must use lowercase letters, numbers, and hyphens
- chronology accepts `yyyy`, `yyyymm`, or `yyyymmdd`
- incomplete connection drafts stay in the editor but are skipped on save
- timeline links and latest-bio links are inferred automatically
- dangerous actions like write, reset, and delete use confirmations

## Detail-page rendering

The graph detail pages share a small rendering layer under [`src/pages/graph`](./src/pages/graph):

- [`DetailContent.tsx`](./src/pages/graph/DetailContent.tsx)
  Shared content-block rendering, inline markdown handling, and base-aware internal/external link behavior for graph detail pages.
- [`BioDetailPage.tsx`](./src/pages/graph/BioDetailPage.tsx)
  Bio detail page with localized content, theme/language controls, and graph-path cards.
- [`NodeDetailPage.tsx`](./src/pages/graph/NodeDetailPage.tsx)
  Content-node detail page that lazy-loads full article data and related nodes.
- [`src/shared/ui/DetailPageSkeleton.tsx`](./src/shared/ui/DetailPageSkeleton.tsx)
  Shared skeleton used during detail-route lazy loading and localized content fetches.

## Content format

Node article JSON typically includes:

```json
{
  "title": "Node Title",
  "subtitle": "Optional subtitle",
  "summary": "Short summary used in cards and previews.",
  "tags": ["optional", "tags"],
  "meta": {
    "dateLabel": "2024",
    "location": "Somewhere"
  },
  "sections": [
    {
      "id": "overview",
      "label": "Overview",
      "blocks": [
        {
          "type": "text",
          "text": "Supports inline markdown like [links](/nodes/bio), *italic*, **bold**, ***bold italic***, and `code`."
        }
      ]
    }
  ]
}
```

Supported block types include:

- `text`
- `list`
- `quote`
- `image`
- `link`
- `gallery`
- `callout`

## Manual content workflow

The recommended path is the node editor, but manual editing is still straightforward.

### Add a new node manually

1. Create localized content files under the correct domain folder in [`public/data/nodes`](./public/data/nodes).
2. Add the node entry to [`public/data/graph.json`](./public/data/graph.json).
3. Add explicit relations in `graph.json` if needed.
4. Regenerate indexes with `npm run generate:node-index`.
5. Verify with `npm run build`.

Example graph node entry:

```json
{
  "id": "new-trip",
  "kind": "travel",
  "domain": "travel",
  "chronology": 202603
}
```

Example explicit relation entry:

```json
{
  "id": "new-trip-verily-link",
  "from": "new-trip",
  "to": "verily-intern",
  "kind": "location",
  "labels": {
    "en": "California period",
    "zh-CN": "加州阶段"
  },
  "strength": 2
}
```

## Domains

Domains are defined in [`src/configs/content/domains.ts`](./src/configs/content/domains.ts).

Each domain entry controls:

- domain id
- display label
- card tag
- initial orbital layout seed angle

If you add a domain manually, also create its folder under [`public/data/nodes`](./public/data/nodes).

## Themes and UI config

Important config files:

- [`src/configs/content/domains.ts`](./src/configs/content/domains.ts)
- [`src/configs/ui/themes.ts`](./src/configs/ui/themes.ts)
- [`src/configs/ui/icons.ts`](./src/configs/ui/icons.ts)
- [`src/configs/ui/uiCopy.ts`](./src/configs/ui/uiCopy.ts)
- [`src/configs/graph/highlight.ts`](./src/configs/graph/highlight.ts)
- [`src/configs/graph/focus.ts`](./src/configs/graph/focus.ts)
- [`src/configs/ui/pageTransitions.ts`](./src/configs/ui/pageTransitions.ts)

To change the default theme, edit `DEFAULT_THEME` in [`src/configs/ui/themes.ts`](./src/configs/ui/themes.ts).

Note:

- a saved theme in local storage overrides the default

## Deployment

This repo is configured for GitHub Pages.

Relevant pieces:

- [`vite.config.ts`](./vite.config.ts) sets `base: "/greenpage/"`
- [`src/main.tsx`](./src/main.tsx) uses `BrowserRouter basename="/greenpage"`
- [`package.json`](./package.json) includes `predeploy`, `postbuild`, and `deploy`

Typical deploy command:

```bash
npm run deploy
```
