# greenpage

`greenpage` is a personal website prototype built with React, TypeScript, Vite, and React Flow.

The active experience is a graph-based homepage:

- a central bio node
- content nodes grouped into domains like research, education, travel, writing, experience, and project
- draggable connections between those nodes
- routed detail pages for each node
- a theme/style system that swaps palette and portrait framing across both graph and detail pages

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

### Regenerate the node index manually

```bash
npm run generate:node-index
```

`predev` and `prebuild` already run this for you.

## Project structure

- [`src/features/graph-home`](./src/features/graph-home)
  The active graph homepage, node detail pages, and graph-specific components.
- [`src/configs`](./src/configs)
  Small centralized config files for themes, domains, copy, highlight behavior, focus behavior, and transitions.
- [`public/data`](./public/data)
  Data files for the graph structure, bio page, and node content.
- [`src/features/legacy-home`](./src/features/legacy-home)
  Older homepage implementation kept as reference/archive material.

## Important data/config files

- [`public/data/graph.json`](./public/data/graph.json)
  Graph structure: node registry, relations, and graph-level settings.
- [`public/data/bio.json`](./public/data/bio.json)
  Data for the bio detail page and bio card content.
- [`public/data/nodes`](./public/data/nodes)
  Node content JSON files, grouped into domain folders.
- [`src/configs/domains.ts`](./src/configs/domains.ts)
  Single source of truth for domain ids, display labels, card tags, and layout seed angles.
- [`src/configs/themes.ts`](./src/configs/themes.ts)
  Theme/style definitions and the default theme.
- [`src/configs/uiCopy.ts`](./src/configs/uiCopy.ts)
  Shared UI copy that is not stored in node JSON.

## Node editor

The project now includes a dev-only node editor for creating and editing nodes, relations, and domains.

### Open it

Start the dev server:

```bash
npm run dev
```

Then open:

- `/editor`

Important:

- the editor uses Vite dev-only endpoints, so it is available during `npm run dev`
- create/delete domain operations still reload the editor because domains are stored in [`src/configs/domains.ts`](./src/configs/domains.ts), not in data yet

### What it can do

- edit node content with a live article preview
- edit raw JSON
- create new nodes from templates
- edit explicit graph relations from the connected-nodes UI
- create new domains
- delete zero-node domains from the domain statistics view

### Notes

- node ids and domain ids must use lowercase letters, numbers, and hyphens
- chronology accepts `yyyy`, `yyyymm`, or `yyyymmdd`
- incomplete connection drafts stay in the editor, but they are skipped on save
- chronology timeline links and the latest bio link are inferred automatically
- dangerous actions like write, reset, and delete ask for confirmation first

## How to use the editor

### Edit an existing node

1. Open `/editor`
2. Choose a node from `Open node`
3. Edit content in the `Edit` tab or raw JSON in the `JSON` tab
4. Use `Write to file` to persist changes

### Create a new node

1. Open `/editor`
2. Go to `New Node`
3. Pick a domain and template
4. Fill in `node id`, chronology, and the basic article fields
5. Review the live preview on the right
6. Click `Create node`

### Create a new domain

1. Open `/editor`
2. Go to `New Domain`
3. Fill in:
   - `Domain id`: internal id, folder name, and URL-safe key
   - `Display label`: human-readable UI name
   - `Card tag`: short badge text shown on graph cards
   - `Seed angle`: default orbital position in the graph layout
4. Review the domain statistics panel on the right
5. Click `Create domain`

After creating a domain, the editor reopens in `New Node` with that domain preselected.

## How to add a new node

The recommended path is the node editor described above. If you want to work manually, follow the steps below.

### 1. Create the node content file

Add a JSON file under the correct domain folder in [`public/data/nodes`](./public/data/nodes).

Example:

- `public/data/nodes/travel/new-trip.json`
- `public/data/nodes/research/new-paper.json`

The filename should usually match the node id you plan to use in `graph.json`.

Example shape:

```json
{
  "title": "New Node Title",
  "subtitle": "Optional subtitle",
  "summary": "Short summary used in cards and previews.",
  "tags": ["optional", "tags"],
  "sections": [
    {
      "id": "overview",
      "label": "Overview",
      "blocks": [
        {
          "type": "text",
          "text": "This node supports lightweight inline markdown like [links](/nodes/bio), *italic*, **bold**, ***bold italic***, and `code`."
        }
      ]
    }
  ]
}
```

Supported article block types include:

- `text`
- `list`
- `quote`
- `image`
- `link`
- `gallery`
- `callout`

### 2. Register the node in the graph

Add an entry to [`public/data/graph.json`](./public/data/graph.json) inside `nodes`.

Example:

```json
{
  "id": "new-trip",
  "kind": "travel",
  "domain": "travel",
  "chronology": 202603
}
```

Notes:

- `id` should match the JSON filename by default
- `domain` must match one of the registered domains in [`src/configs/domains.ts`](./src/configs/domains.ts)
- `kind` is still separate from `domain`, so follow the existing values in `graph.json`
- `chronology` is used for ordering and auto-derived temporal relations

### 3. Add relations

Add edges to [`public/data/graph.json`](./public/data/graph.json) inside `relations` if you want the node connected to others beyond the auto-derived domain timeline/bio relations.

Example:

```json
{
  "id": "new-trip-verily-link",
  "from": "new-trip",
  "to": "verily-intern",
  "kind": "location",
  "label": "California period",
  "strength": 2
}
```

### 4. Regenerate the node index

Run:

```bash
npm run generate:node-index
```

This updates [`public/data/nodes/index.json`](./public/data/nodes/index.json).

### 5. Verify

Recommended quick check:

```bash
npm run lint
npm run build
```

## How to add a new domain

The recommended path is the `New Domain` flow in the node editor. If you want to work manually, the main registration point is still [`src/configs/domains.ts`](./src/configs/domains.ts).

### 1. Add the domain to `domains.ts`

Create a new entry in [`src/configs/domains.ts`](./src/configs/domains.ts).

Example:

```ts
archive: {
  display: 'archive',
  cardTag: 'ARCHIVE',
  seedAngle: 180,
}
```

This single entry controls:

- the domain id
- the display label shown in the UI
- the top tag shown on node cards
- the initial orbital layout angle in the graph

### 2. Add node content files for that domain

Create a new folder under [`public/data/nodes`](./public/data/nodes), for example:

- `public/data/nodes/archive/`

Then add the node JSON files for that domain there.

### 3. Add graph nodes using the new domain

Add node entries in [`public/data/graph.json`](./public/data/graph.json) with:

- `"domain": "archive"`

### 4. Regenerate and verify

Run:

```bash
npm run generate:node-index
npm run lint
npm run build
```

## Themes and default style

Theme definitions live in [`src/configs/themes.ts`](./src/configs/themes.ts).

To change the default theme used when no stored preference exists yet, edit:

```ts
export const DEFAULT_THEME: Theme = '...';
```

Important:

- if a visitor already has a saved theme in local storage, that saved value overrides the default
- the saved key is managed through [`src/features/graph-home/content/BioTheme.ts`](./src/features/graph-home/content/BioTheme.ts)

## UI copy and localization

Most body/article content is already data-driven in JSON. Shared UI labels that are still in code are centralized in:

- [`src/configs/uiCopy.ts`](./src/configs/uiCopy.ts)

That is the right place to start if you want to support language switching later.

## Routing

The main routes are:

- `/` for the graph homepage
- `/nodes/:nodeId` for node detail pages
- `/nodes/bio` for the bio detail page

## Deployment

This repo is configured for GitHub Pages.

Relevant pieces:

- [`vite.config.ts`](./vite.config.ts) sets `base: "/greenpage/"`
- [`src/main.tsx`](./src/main.tsx) uses `BrowserRouter basename="/greenpage"`
- [`package.json`](./package.json) includes:
  - `predeploy`: runs the build
  - `postbuild`: copies `dist/index.html` to `dist/404.html`
  - `deploy`: publishes `dist` with `gh-pages`

Typical deploy command:

```bash
npm run deploy
```
