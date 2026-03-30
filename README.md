# greenpage

`greenpage` is an unfinished personal website prototype built with React, TypeScript, Vite, and React Flow.

The main idea is a portfolio homepage represented as a small graph:

- a central bio node
- surrounding topic nodes like research, education, travel, blogs, and experience
- dotted edges connecting everything back to the bio
- a theme toggle that swaps portrait photos and color palettes

This README is meant to help you re-enter the project quickly and understand what is already implemented, what is still rough, and where to pick things back up.

## What the app is trying to be

The current direction is a node-based personal homepage where each major part of your background is a node on a draggable canvas instead of a normal list of sections.

The interaction model today is:

- click a node to zoom/focus it
- drag nodes around the canvas
- keep nodes from visually overlapping too much while dragging
- change the bio theme by switching between different portrait/photo presets

There is also an older, more traditional homepage implementation still in the repo. That version reads content from JSON and opens external section links, but it is not the active app anymore.

## Source layout

The codebase is now grouped by feature instead of by broad file type:

- `src/features/graph-home`
  The active node-based homepage.
- `src/features/legacy-home`
  The older JSON-driven homepage, kept as a reference/archive path.
- `src/shared`
  Reusable UI primitives and shared styling helpers.

That split makes it easier to answer: "is this part of the current graph homepage, the old homepage, or truly shared?"

## Current status

What is working in the code:

- the app boots into the node-based homepage
- the graph is rendered with [`@xyflow/react`](https://reactflow.dev/)
- story nodes are connected to the bio node with custom dotted edges
- clicking a node triggers `fitView`
- dragging a node pushes overlapping nodes away with a lightweight axis-aligned collision pass
- switching themes updates CSS variables and the portrait shown in the bio node

What is still unfinished or inconsistent:

- most node content is still hard-coded in React instead of being data-driven
- [`src/features/graph-home/content/Nodes.ts`](./src/features/graph-home/content/Nodes.ts) is effectively a placeholder
- the old minimal homepage still exists as a legacy path and may or may not be worth keeping
- the graph and content model are still tightly coupled inside the active page component
- some content and links still point to older external pages rather than internal routes/pages

## How the app is wired

### Entry point

- [`src/main.tsx`](./src/main.tsx) mounts the app inside a `BrowserRouter` with `basename="/greenpage"`.
- [`vite.config.ts`](./vite.config.ts) also uses `base: "/greenpage/"`, which matches GitHub Pages deployment.
- [`src/App.tsx`](./src/App.tsx) currently renders the node-based homepage only.

### Active homepage: the graph prototype

- [`src/features/graph-home/NodeHomePage.tsx`](./src/features/graph-home/NodeHomePage.tsx) is the real center of the current project.
- It defines the initial graph directly in code: one bio node, one theme toggle node, and several story nodes.
- It also defines the connecting edges and interaction behavior.

Important behaviors inside this file:

- `initialNodes` and `initialEdges` are the current source of truth for the graph layout
- `onNodeClick` zooms to a clicked node with `fitView`
- `onInit` starts the page focused on the bio node
- `onNodeDrag` runs a small collision/relaxation routine so dragged nodes do not stack directly on top of each other
- a `useEffect` syncs the selected theme into the bio node and theme-toggle node data
- another `useEffect` calls `applyThemeVars(...)` to update CSS custom properties globally

### Node components

These files define the visual pieces used by React Flow:

- [`src/features/graph-home/nodes/BioNode.tsx`](./src/features/graph-home/nodes/BioNode.tsx)
  Shows your name, location blurb, email, portrait, and connection handles.
- [`src/features/graph-home/nodes/BioToggleNode.tsx`](./src/features/graph-home/nodes/BioToggleNode.tsx)
  Renders small circular theme selectors and changes the active photo/theme.
- [`src/features/graph-home/nodes/StoryNode.tsx`](./src/features/graph-home/nodes/StoryNode.tsx)
  Generic card-style node used for Research, Education, Travel, Blogs, and Experience.
- [`src/features/graph-home/nodes/EdgeTypes.tsx`](./src/features/graph-home/nodes/EdgeTypes.tsx)
  Defines the custom dotted edge used between nodes.
- [`src/features/graph-home/nodes/Handles.tsx`](./src/features/graph-home/nodes/Handles.tsx)
  Provides the styled React Flow handles.

### Content and themes

- [`src/features/graph-home/content/Intros.tsx`](./src/features/graph-home/content/Intros.tsx)
  Short intro paragraphs for the story nodes. These are hard-coded today.
- [`src/features/graph-home/content/BioTheme.ts`](./src/features/graph-home/content/BioTheme.ts)
  Maps theme ids like `nyc`, `joshua`, `mty`, and `atlp` to portrait images, URLs, and descriptions.
- [`src/shared/styles/colors.ts`](./src/shared/styles/colors.ts)
  Maps each theme to a palette and exposes `applyThemeVars(...)`.

In practice, the theme system works like this:

1. `BioToggleNode` calls `setTheme(...)`
2. `NodeHomePage` stores the selected theme in React state
3. `applyThemeVars(...)` writes CSS variables to `document.documentElement`
4. `BioNode` reads the selected theme and swaps the portrait/info

### Legacy homepage path

There is an older implementation still present:

- [`src/features/legacy-home/MinimalHomePage.tsx`](./src/features/legacy-home/MinimalHomePage.tsx)
- [`public/data/home.json`](./public/data/home.json)
- [`src/features/legacy-home/components/HomeSection.tsx`](./src/features/legacy-home/components/HomeSection.tsx)
- [`src/features/legacy-home/components/SectionCard.tsx`](./src/features/legacy-home/components/SectionCard.tsx)
- [`src/features/legacy-home/components/Portrait.tsx`](./src/features/legacy-home/components/Portrait.tsx)

That version appears to have been a simpler homepage with icon cards linking out to other pages. It is useful as reference for content structure, but it is not the active experience and currently has some stale imports.
That version appears to have been a simpler homepage with icon cards linking out to other pages. It is useful as reference for content structure, but it is not the active experience.

## File map

If you want the shortest path to understanding the repo, start here:

1. [`src/App.tsx`](./src/App.tsx)
2. [`src/features/graph-home/NodeHomePage.tsx`](./src/features/graph-home/NodeHomePage.tsx)
3. [`src/features/graph-home/nodes/BioNode.tsx`](./src/features/graph-home/nodes/BioNode.tsx)
4. [`src/features/graph-home/nodes/StoryNode.tsx`](./src/features/graph-home/nodes/StoryNode.tsx)
5. [`src/features/graph-home/nodes/BioToggleNode.tsx`](./src/features/graph-home/nodes/BioToggleNode.tsx)
6. [`src/features/graph-home/content/BioTheme.ts`](./src/features/graph-home/content/BioTheme.ts)
7. [`src/shared/styles/colors.ts`](./src/shared/styles/colors.ts)

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

## Deployment

This repo is configured for GitHub Pages.

Relevant pieces:

- [`vite.config.ts`](./vite.config.ts) sets `base: "/greenpage/"`
- [`src/main.tsx`](./src/main.tsx) uses `BrowserRouter basename="/greenpage"`
- [`package.json`](./package.json) includes:
  - `predeploy`: runs the build
  - `postbuild`: copies `dist/index.html` to `dist/404.html`
  - `deploy`: publishes `dist` with the `gh-pages` package

Typical deploy command:

```bash
npm run deploy
```

That publishes the built site to the `gh-pages` branch, which GitHub Pages serves at:

- `https://greenere.github.io/greenpage/`

The configured remote for this repo is:

- `git@github.com:Greenere/greenpage.git`

## Build status

`npm run build` currently succeeds.

That means the basic Vite + TypeScript + GitHub Pages pipeline is working again, and `npm run deploy` should publish the current app structure without extra cleanup first.

## Suggested next steps

If you want to continue this project, the cleanest sequence is probably:

1. Decide whether `MinimalHomePage` should be deleted, preserved as an archive, or revived as a fallback route.
2. Move graph node definitions out of [`src/features/graph-home/NodeHomePage.tsx`](./src/features/graph-home/NodeHomePage.tsx) into structured content/data.
3. Flesh out [`src/features/graph-home/content/Nodes.ts`](./src/features/graph-home/content/Nodes.ts) so the graph can become content-driven instead of hard-coded.
4. Expand each story node from a short intro into deeper subgraphs, overlays, or routed detail pages.
5. Replace external links/older placeholders with internal content owned by this repo.

## Original idea, restated

If you were trying to remember what you were building: this looks like the start of a personal website where your background is presented as an explorable graph instead of a standard resume page. The central bio node acts like a hub, and each experience area branches from it as a connected story node.

That core idea is still visible in the code. The main unfinished part is not the concept, but the content model and the polish needed to turn the prototype into a maintainable site.
