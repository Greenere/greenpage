# Node Editor Proposal

## Goal

Design an editing experience that makes node JSON feel more like writing an article than editing raw data, while still preserving the current structured content model.

The editor should:

- let a user open an existing node JSON file
- make the content easy to edit in a guided way
- show the final rendered result in real time
- stay semi-separated from the production graph/detail pages
- be safe to develop locally without pretending static GitHub Pages can write files directly

## Core recommendation

Build a **dev-only node editor shell** that reuses the real detail-page renderer for preview, but keeps editing concerns outside the production routes.

Recommended route shape:

- `/editor/nodes/:nodeId`

Optional later:

- `/editor/file?path=...`

The editor should not be the production detail page with input fields added on top. It should be a separate workspace that feeds draft data into the same rendering components the real pages use.

That gives us:

- real preview fidelity
- clear separation between reading and editing
- lower risk of production-route complexity
- a clean path to keep the editor dev-only

## Sanity-check constraints

Before implementation, these constraints should be treated as hard requirements rather than nice-to-haves.

### 1. Editor must be dev-only

The editor should only exist in local development and should not be reachable in production.

Recommended enforcement:

- only register `/editor/*` routes when `import.meta.env.DEV` is true
- only import editor modules behind that dev guard so they are not part of the production path
- only enable file write endpoints in the Vite dev server, never in the production build

This is important both for safety and for bundle hygiene.

The intended result is:

- local development: full editor available
- production / GitHub Pages: no editor route, no editor save endpoint, no accidental exposure

### 2. Editor must support both existing and new content

The editor should not be limited to modifying existing nodes only.

It should support:

- opening an existing node JSON by node id
- creating a new node JSON from a template under a selected domain
- creating a new domain and then creating nodes under it

That means the editor should really have two closely related modes:

- **node content editing**
- **content scaffolding / registry editing**

I would still keep these visually separate inside the editor shell:

- `Edit node`
- `New node`
- `New domain`

Reason:

Editing an article and registering new structure are related, but they are not the same task.

### 3. Preview must update immediately

Immediate preview is a core requirement, not a later enhancement.

The editor should let the user see the rendered result as they type, including:

- article structure
- inline markdown rendering
- galleries
- hero image
- theme changes

If the editor requires manual refresh, it loses much of its value.

### 4. Editor should be semi-separated from production pages

The editor should reuse production renderers, but not share production route shells.

That means:

- separate editor route
- separate editor toolbar/layout
- shared render-only components underneath

This is the right compromise between fidelity and safety.

## Why this needs careful scoping

The biggest constraint is architectural, not visual:

- the public site is static
- node data lives in local JSON files under `public/data/nodes/*`
- a browser app running on GitHub Pages cannot directly write those files back to disk

So the editor must distinguish between:

1. **editing state in the browser**
2. **previewing the rendered result**
3. **persisting changes back to local files**

If we do not separate those concerns, the editor will feel magical in development but impossible in the deployed site.

## Design principles

### 1. Preview must use the real renderer

The preview should not be a “fake editor preview.”

It should reuse the same rendering logic as:

- [`NodeDetailPage.tsx`](../src/features/graph_home/NodeDetailPage.tsx)
- [`BioDetailPage.tsx`](../src/features/graph_home/BioDetailPage.tsx)

That likely means extracting the shared article rendering into one or two presentational components such as:

- `NodeArticleView`
- `BioArticleView`

Then:

- production pages pass in loaded persisted data
- editor pages pass in draft data

This is the most important design choice, because it guarantees the preview is honest.

### 2. Structured editing first, raw JSON always available

The editor should not force users to hand-edit nested JSON for routine work.

Recommended model:

- **structured mode** for most editing
- **raw JSON mode** as an escape hatch

Structured mode should cover the common workflow:

- title
- subtitle
- summary
- tags
- hero image
- meta
- sections
- blocks inside sections

Raw JSON mode is still necessary for:

- advanced edits
- debugging malformed content
- pasting content from external tools
- future unsupported fields

### 3. Editing should feel article-like, not schema-like

The editor should speak in content language:

- “Add section”
- “Add paragraph”
- “Add image”
- “Add gallery”
- “Move section up”

not:

- “Insert object into blocks array”
- “Edit JSON node”

This is especially important because the data model is expressive but still structured.

### 4. Saving must be honest about environment

We should not blur together:

- “saved to draft in browser”
- “written to file on disk”

Recommended UX labels:

- `Save draft`
- `Write to file`
- `Export JSON`
- `Copy JSON`

That prevents a static-site deployment from implying capabilities it does not have.

## Recommended scope

### Phase 1: content editor only

The first version should focus on **node content JSON**, not the entire graph model.

Editable in phase 1:

- `title`
- `subtitle`
- `summary`
- `tags`
- `hero`
- `meta`
- `sections`
- `blocks`

Out of scope for phase 1:

- editing `graph.json` relations visually
- chronology / graph placement tuning
- graph-edge authoring UI
- collaboration / multi-user editing

Reason:

The article content editing problem is already large enough, and it gives the highest payoff fastest.

Important clarification:

- `New node from template` should be in phase 1
- `New domain` can be a very small scoped utility in phase 1.5 or phase 2 if needed

I would not block the editor MVP on a fully polished “new domain” workflow, but the architecture should leave room for it from day one.

## Proposed UX

### Layout

Recommended desktop layout:

- **left panel**: editor controls
- **right panel**: live preview

Recommended top bar:

- node title / id
- current file path
- preview theme picker
- save/export actions
- validation state

Recommended left-panel tabs:

1. `Content`
2. `Structure`
3. `JSON`
4. `New node`
5. `New domain`
6. `Assets` (later)

### Content tab

This should feel closest to writing.

Sections:

- basic info
- hero
- meta
- section list

Each section card should show:

- section label
- reorder controls
- delete
- add block

Each block should render as a typed editor card:

- `text`
  - multiline textarea
  - inline markdown helper hint
- `quote`
  - quote textarea
- `list`
  - one item per row
- `image`
  - src, alt, optional caption
- `gallery`
  - item list, columns, align
- `link`
  - label, href, optional description
- `callout`
  - tone, optional title, text

### Structure tab

This is for people who want to think about the shape of the article.

Show:

- section order
- block order
- add/remove/reorder actions

This tab should be optimized for composition, not for long-form text entry.

### JSON tab

This should show the current normalized JSON draft in a large editor.

Capabilities:

- edit raw JSON
- validate on change
- sync back into structured UI if valid

This is the right “escape hatch,” and it makes the editor feel trustworthy rather than restrictive.

### New node tab

This should be a lightweight scaffold flow.

Recommended fields:

- domain
- node id / filename slug
- kind
- chronology
- title
- optional template choice

Recommended template presets:

- blank article
- research note
- experience entry
- travel story
- writing entry
- project page

On creation, the editor should:

- generate initial node JSON content
- generate a suggested `graph.json` node entry
- optionally insert both through the dev-only write path

### New domain tab

This should be intentionally narrow in scope.

Recommended fields:

- domain id
- display label
- card tag
- layout seed angle

On creation, the editor should:

- generate a new entry for [`domains.ts`](../src/configs/domains.ts)
- create the matching `public/data/nodes/<domain>/` folder in dev mode
- optionally offer to scaffold one starter node

This should not try to become a full graph-admin UI in version 1.

### Preview pane

The preview should use the production rendering pipeline with a draft node object.

It should support:

- live updates as fields change
- theme switching
- internal link behavior that does not navigate away destructively
- realistic section spacing and gallery layout

Optional preview modes:

- `Detail page`
- `Node card preview`
- `Connected-button preview`

That would help authors see both article rendering and graph-card rendering in one workspace.

## Recommended architecture

### 1. Extract render-only components

Today, too much rendering is embedded directly in route components.

Recommended extractions:

- `NodeArticleView`
  - presentational renderer for a node detail article
- `NodeCardPreview`
  - presentational renderer for a graph card

The editor should compose these, not duplicate them.

### 2. Add a draft state layer

Introduce an editor-local draft model:

```ts
type NodeEditorDraft = {
  nodeId: string;
  contentPath: string;
  original: GraphNodeContent;
  draft: GraphNodeContent;
  dirty: boolean;
  validation: EditorValidationState;
};
```

This gives us:

- diffing
- reset/discard
- autosave-to-browser
- clear separation between original and draft

### 3. Validation should reuse the current schema

The validator should not be invented separately from the runtime content model.

Reuse the existing normalization rules in:

- [`Nodes.ts`](../src/features/graph_home/content/Nodes.ts)

Ideally:

- parse draft JSON through the same normalizer
- surface field-level editor errors where possible
- surface raw schema errors in JSON mode

That keeps preview and persistence aligned with production behavior.

### 4. Persistence should have two layers

#### Draft persistence

Always available in browser:

- localStorage or sessionStorage
- recovers unsaved work
- safe in both dev and static deployments

#### File persistence

Available only in local development:

- a tiny Vite dev-server endpoint or middleware
- reads/writes files under `public/data/nodes/*`

This should be explicitly dev-only.

Recommended endpoint family:

- `GET /__editor/node?nodeId=...`
- `POST /__editor/node`
- `POST /__editor/node/new`
- `POST /__editor/domain/new`
- `POST /__editor/graph/register-node`

The server would:

- resolve node id to file path
- validate write location
- write JSON back to disk
- update `graph.json` when requested
- update `domains.ts` when requested

For sanity, writes should remain narrowly scoped:

- node JSON files under `public/data/nodes/*`
- `public/data/graph.json`
- `src/configs/domains.ts`

This is much safer and simpler than trying to make the browser access arbitrary local files directly.

## Expressiveness recommendations

To make the editor feel expressive and pleasant:

### 1. Block palette instead of block dropdowns

When adding content, offer a clear visual palette:

- Paragraph
- Quote
- List
- Image
- Gallery
- Link
- Callout

This is more editorial and less technical.

### 2. Lightweight markdown hints, not a WYSIWYG

The current inline model already supports a useful mini-markdown subset.

Lean into that.

Good support:

- helper text near textareas
- one-click insertion helpers for:
  - `[label](href)`
  - `*italic*`
  - `**bold**`
  - `` `code` ``

Do not build a full rich-text editor in phase 1.

That would explode scope quickly and fight the current JSON-centered model.

### 3. Gallery editing should feel visual

A gallery block editor should show:

- reorderable thumbnails
- image source
- alt text
- optional caption
- layout controls:
  - columns
  - align mode

This is one of the biggest wins over raw JSON editing.

### 4. Preview should show validation inline

Examples:

- missing `alt` on image
- invalid internal link target
- empty section label
- malformed markdown link

Warnings should be visible without blocking editing.

## Separation from production pages

The editor should be semi-separated in three ways:

### 1. Separate routes

Keep production routes clean:

- `/`
- `/nodes/:nodeId`
- `/nodes/bio`

Editor routes should be clearly separate:

- `/editor/nodes/:nodeId`

### 2. Separate shell

The editor page should have:

- split layout
- toolbars
- save/export controls
- validation UI

The production pages should not gain editing controls.

### 3. Shared renderer, separate workflow

The production page and the editor should share rendering components, but not page chrome or interaction flow.

That is the right balance between reuse and separation.

## Recommended rollout plan

### Phase 1

- create `NodeArticleView`
- create `NodeEditorPage`
- support load by node id
- gate editor route to dev mode only
- structured editing for:
  - basic info
  - sections
  - `text`, `quote`, `list`, `image`, `gallery`, `link`, `callout`
- live preview
- browser draft persistence
- JSON tab
- new node from template
- export/copy JSON

### Phase 2

- dev-only file write endpoint
- file save from browser to local workspace
- graph node registration helper
- minimal new-domain scaffolding helper
- card preview mode
- link validation
- image preview improvements

### Phase 3

- editing of `graph.json` node metadata
- relation editing
- domain-aware templates
- slash-command insertions
- reusable section templates

## Suggested user flow

1. Open `/editor/nodes/verily-intern`
2. Editor loads node JSON and current normalized content
3. Left side shows editable structured fields
4. Right side shows the real detail-page rendering live
5. User edits sections and galleries
6. Validation status updates continuously
7. User either:
   - saves a browser draft
   - exports JSON
   - writes to file locally in dev mode

That feels much closer to authoring than manipulating nested JSON by hand.

## Recommendation summary

The best path is:

- **separate editor shell**
- **shared production renderer**
- **structured content editing first**
- **raw JSON as escape hatch**
- **dev-only local file writing**

This keeps the project honest, expressive, and scoped.

It also matches the current architecture well: the app already has a strong article renderer and a structured block model, so the editor should build on those instead of replacing them.

## Open questions for later

- Should the editor support creating a brand-new node from a template?
- Should graph metadata like `chronology`, `kind`, and `domain` live in the same editor or a separate registry editor?
- Should image source selection stay text-based or eventually include an asset browser?
- Should the editor be dev-only forever, or eventually become a CMS-like private tool?
