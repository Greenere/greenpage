# Content Localization Spec

## Goal

Add multilingual support for JSON-backed content without changing the runtime shape that the graph page, detail page, and editor already consume today.

This spec covers:

- node content in `public/data/nodes/...`
- bio content in `public/data/bio.json`
- explicit relation labels in `public/data/graph.json`

This spec does not require nested translation objects inside node or bio payloads.

## Design Choice

Use separate locale files for node and bio content.

Why:

- the current loaders already normalize plain string fields
- the editor already edits one content document at a time
- markdown-based section editing stays simple
- adding a language should not force every renderer to understand `{ en, zh-CN }` leaf values

## Locale Model

There are two related but different identifiers:

- app locale id: used in React state, UI logic, and JSON locale maps (e.g. `labels` keys in `graph.json`)
- file locale suffix: used in file paths only

Current mapping:

| App locale id | File locale suffix |
| --- | --- |
| `en` | `en` |
| `zh-CN` | `zh_cn` |

Rules:

- use app locale ids in code and JSON locale maps
- use file locale suffixes in file paths only
- never mix the two — a `labels["zh_cn"]` key in `graph.json` would silently fail lookup

The locale selection mechanism is already implemented in `src/i18n/index.ts`. `getInitialLanguage()` reads from `localStorage` (key `greenpage-language`) then falls back to `navigator.language`. Content locale should wire into this — do not design a parallel detection mechanism.

## File Naming

### Nodes

Each node keeps the same domain folder and same base slug, but gets a locale suffix.

Examples:

- `public/data/nodes/experience/verily_intern.en.json`
- `public/data/nodes/experience/verily_intern.zh_cn.json`
- `public/data/nodes/project/data_visualizations_2021.en.json`
- `public/data/nodes/project/data_visualizations_2021.zh_cn.json`

### Bio

- `public/data/bio.en.json`
- `public/data/bio.zh_cn.json`

### Generated indexes

Generate one index per locale:

- `public/data/nodes/node_cards.en.json`
- `public/data/nodes/node_cards.zh_cn.json`

### Graph structure

Keep one structural graph file:

- `public/data/graph.json`

Node ids, domains, chronology, and edge wiring stay locale-independent.

## JSON Schemas

### Node content files

Each localized node file uses the exact same shape as the current `GraphNodeContent` payload.

Example:

```json
{
  "title": "Software Engineer Intern at Verily",
  "subtitle": "Summer 2022, from Cornell to California",
  "summary": "The internship that turned graduate school into a clearer engineering path.",
  "tags": ["internship", "engineering"],
  "hero": {
    "image": {
      "src": "assets/portrait_haoyang_sfbay.jpg",
      "alt": "Haoyang in the Bay Area during the Verily internship summer",
      "caption": "Work, relocation, and weekend travel started to blur into one California chapter."
    }
  },
  "meta": {
    "dateLabel": "Summer 2022",
    "location": "South San Francisco",
    "readingTime": "3 min",
    "status": "milestone"
  },
  "sections": [
    {
      "id": "shift",
      "label": "Shift",
      "blocks": [
        { "type": "text", "text": "..." }
      ]
    }
  ]
}
```

Important rules:

- each locale file must be a complete content document
- do not do field-level merging between locale files
- if a translation is missing, fall back to the English file as a whole

Note on locale-independent fields: `meta.readingTime` and `hero.image.src` are not locale-specific, but they live inside the content file. Since there is no field-level merging, authors must duplicate these values in every locale file. This is intentional — keep the loader simple.

### Bio content files

Each localized bio file uses the exact same shape as the current `BioPageContent` payload.

Example:

```json
{
  "eyebrow": "Bio node",
  "name": "Haoyang Li",
  "subtitle": "Software engineer in San Francisco Bay Area",
  "summary": "This page is the narrative front door to the graph.",
  "themeFactLabel": "Current frame",
  "facts": [
    {
      "label": "Base",
      "value": "San Francisco Bay Area"
    }
  ],
  "sections": [
    {
      "label": "About",
      "paragraphs": ["...", "..."]
    }
  ],
  "pathsSectionLabel": "Paths through the graph",
  "linksSectionLabel": "Elsewhere",
  "links": [
    {
      "label": "LinkedIn",
      "href": "https://www.linkedin.com/in/haoyanghowyoung/"
    }
  ]
}
```

### Graph relation labels

`graph.json` remains the structural source of truth, but explicit relation labels should move to a locale map.

Preferred shape:

```json
{
  "id": "research-signature-naec",
  "from": "signature-attack",
  "to": "naec",
  "kind": "reason",
  "labels": {
    "en": "internship work became a publication",
    "zh-CN": "实习工作最终变成了一篇论文"
  },
  "strength": 3
}
```

Backward-compatible legacy shape:

```json
{
  "id": "research-signature-naec",
  "from": "signature-attack",
  "to": "naec",
  "kind": "reason",
  "label": "internship work became a publication",
  "strength": 3
}
```

Resolution rule (applied at normalize time in `normalizeGraphStructure`):

- if `labels[currentLocale]` exists, use it
- else if `labels.en` exists, use it
- else if legacy `label` exists, use it
- else skip the relation and log a console warning — do not throw, a missing label must not abort the entire graph load

Note: `labels` keys use app locale ids (`en`, `zh-CN`), not file locale suffixes. Do not write `labels["zh_cn"]`.

## Runtime Resolution Rules

### Node content

For a node with id `verily-intern`, domain `experience`, and locale `zh-CN`:

1. try `public/data/nodes/experience/verily_intern.zh_cn.json`
2. if missing, try `public/data/nodes/experience/verily_intern.en.json`
3. if missing, throw

### Bio content

For locale `zh-CN`:

1. try `public/data/bio.zh_cn.json`
2. if missing, try `public/data/bio.en.json`
3. if missing, throw

### Production index files

Each generated locale index should already include fallback-resolved content.

Example:

- `node_cards.zh_cn.json` should contain Chinese card content where available
- if a node does not yet have `*.zh_cn.json`, its entry in `node_cards.zh_cn.json` should fall back to the English payload

This keeps the frontend fast and simple because it still fetches one index per locale.

The index shape is `Record<nodeId, GraphNodeContent>`, matching what `normalizeNodeContentIndex` in `Nodes.ts` already expects.

## Cache Invalidation

`graphModelCache` and `graphModelPromise` in `src/pages/graph/content/Nodes.ts` are global singletons. They do not currently account for locale. Without intervention, switching locale returns stale cached content.

Required behavior when locale changes:

- clear `graphModelCache` and `graphModelPromise`
- trigger a fresh load with the new locale's index URL

Implement this as part of Phase 2. The locale change event is the right place to invalidate — not the loader itself, which should remain stateless with respect to locale.

## Editor Model

Keep these concepts separate:

- `uiLanguage`: labels, buttons, menus
- `contentLocale`: which content file is being viewed or edited

Recommendation:

- public site can default `contentLocale` to `uiLanguage`
- editor should store both independently, even if both start with the same value

### Editor read behavior

`GET /__editor/bootstrap?lang=<app-locale>`

- returns node titles/subtitles for the requested content locale
- falls back to English if the locale file is missing

`GET /__editor/node?nodeId=<id>&lang=<app-locale>`

- returns the localized node content for that locale
- returns the resolved `contentPath`
- includes `isFallbackContent: true` if English was served because the locale file does not exist
- returns explicit relations with the label resolved for that locale

### Editor save behavior

`POST /__editor/node/save`

Payload adds:

```json
{
  "nodeId": "verily-intern",
  "lang": "zh-CN",
  "content": {},
  "node": {},
  "explicitRelations": []
}
```

Rules:

- save only the current locale file
- do not overwrite other locale files
- for explicit relation labels, update only `labels[lang]`
- preserve any existing labels for other locales

### Editor create behavior

When creating a new node:

- create the English file first
- do not create all locale variants automatically
- non-English variants can be created later on first save

This keeps authoring low-friction and avoids empty duplicate files.

### Editor fallback UX

If the editor opens `zh-CN` content and the localized file does not exist:

- load the English fallback content
- show a clear "using English fallback" state (banner or field indicator, not just a toast)
- on save, write a new `*.zh_cn.json` file

That makes missing translations visible without blocking editing.

## Implementation Phases

### Phase 1: file helpers and loaders

- add locale-to-file-suffix conversion helpers
- make bio loader locale-aware with English fallback
- make node content URL resolution locale-aware with English fallback
- keep current runtime content types unchanged

### Phase 2: locale indexes and cache

- update `scripts/generate_node_index.mjs` to output `node_cards.en.json` and `node_cards.zh_cn.json`
- each locale index should fall back to English when a localized node file is missing
- update the graph loader to use localized node card indexes
- clear `graphModelCache` and `graphModelPromise` when locale changes so the correct index is loaded

### Phase 3: editor API

- add `lang` query param support to bootstrap and node endpoints
- make save/create paths locale-aware
- expose `isFallbackContent` to the editor UI

### Phase 4: explicit relation labels

- update `normalizeGraphStructure` in `Nodes.ts` to accept the `labels` shape; the current normalizer requires `label: string` and throws if absent — this must be updated before any relation is migrated
- update `EditorExplicitRelation` in `editorApi.ts` to support locale-aware label resolution
- keep legacy `label` support during migration
- update editor relation save logic to read/write locale-specific labels
- use console warning (not throw) for relations with no resolvable label

## Migration Rules

Start with English as the source baseline.

Migration order:

1. rename current node files from `*.json` to `*.en.json`
2. rename `bio.json` to `bio.en.json`
3. generate locale-specific indexes
4. update loaders and editor API

Steps 1–4 must be deployed atomically. The file renames and loader updates are not independently safe — old loaders will fail to find `*.en.json` files, and new loaders will fail to find `*.json` files.

5. add `*.zh_cn.json` files incrementally as translations are written
6. migrate explicit relation labels from `label` to `labels` (requires Phase 4 normalizer update first)

Important:

- do not require all Chinese files to exist before shipping the locale system
- English fallback is part of the design, not an error state

## Out of Scope For First Pass

- field-level translation status inside a single node file
- translating `home.json` for the legacy home page
- translating asset paths or image files per locale
- machine translation workflow
- external CMS integration

## Recommended Next Step

Implement Phase 1 and Phase 2 first.

That gives the public site real content locale support with minimal risk, while keeping the editor migration small and predictable.
