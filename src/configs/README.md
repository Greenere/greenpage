# `src/configs`

This folder is the home for static app configuration: values that shape behavior or presentation, but are not user content and are not loaded from `public/data`.

The current split is:

- `content/`
- `graph/`
- `ui/`

That split is meant to answer a simple question:

- Is this about the content taxonomy?
- Is this about graph behavior or graph visuals?
- Is this about general UI/application presentation?

## Mental model

Use `src/configs` for things that are:

- shared across multiple pages/components
- stable enough to live in source control
- better represented as code constants than as authored content data

Do **not** put these here:

- localized content JSON
- graph node/article data
- one-off component-local style values
- transient runtime state

## Folder structure

## `content/`

- [`domains.ts`](./content/domains.ts)
  Domain taxonomy and domain-level metadata. This is the source of truth for content domains used across the graph, editor, and generated labels.

Put something in `content/` if it defines:

- domain ids
- domain ordering
- domain metadata that affects both data and UI

## `graph/`

- [`focus.ts`](./graph/focus.ts)
  Graph focus/attention behavior.

- [`highlight.ts`](./graph/highlight.ts)
  Shared graph highlight and action-border behavior.

- [`initialLayoutSnapshot.ts`](./graph/initialLayoutSnapshot.ts)
  Optional hand-tuned initial graph layout snapshot, including exported node positions and initial zoom.

- [`layout.ts`](./graph/layout.ts)
  Graph-level layout knobs/config used outside the page-local layout implementation.

- [`generatedGraphLayoutHash.ts`](./graph/generatedGraphLayoutHash.ts)
  Build-generated graph hash used to validate layout snapshots and persisted graph layouts against the current graph structure.

Put something in `graph/` if it controls:

- graph interaction behavior
- graph highlighting
- graph layout or spacing knobs
- graph-specific visual affordances

Graph layout snapshot compatibility uses a generated graph hash rather than article/content text. The hash is produced at build time from `public/data/graph.json` and changes when graph structure changes, such as:

- graph settings flags
- node ids, kinds, domains, or chronology values
- relation ids, endpoints, kinds, or strengths

Editing the authored content of an existing node does not change the hash.

Note that `src/pages/graph/layout/` contains the page-local layout implementation and algorithms, while `src/configs/graph/` is for shared graph configuration values that conceptually belong to app config.

## `ui/`

- [`icons.ts`](./ui/icons.ts)
  Shared icon definitions and icon asset references.

- [`pageTransitions.ts`](./ui/pageTransitions.ts)
  Transition timing/preset configuration for route and language-switch transitions.

- [`siteMeta.ts`](./ui/siteMeta.ts)
  Site-level metadata and title/description helpers.

- [`themes.ts`](./ui/themes.ts)
  Theme definitions and shared theme metadata.

- [`uiCopy.ts`](./ui/uiCopy.ts)
  Locale-aware UI copy accessors used throughout the app.

Put something in `ui/` if it affects:

- theming
- shared transitions
- shared icons
- site metadata
- general UI copy or app-wide UI presentation settings

## How to choose a home

If a new config touches...

- domains or content taxonomy:
  Start in [`content/`](./content)

- graph-only behavior or graph visuals:
  Start in [`graph/`](./graph)

- general UI behavior or presentation:
  Start in [`ui/`](./ui)

If a value is only used by one page or one component, prefer keeping it near that page/component instead of promoting it here too early.

## Design notes

- `src/configs` should stay small and opinionated.
- The goal is not “put every constant here.”
- The goal is “put shared knobs here when they help make the app easier to reason about.”

As a rule of thumb:

- shared policy/config -> `src/configs`
- page-local implementation detail -> keep it near the page
- authored data/content -> `public/data`
