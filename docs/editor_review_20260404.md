# Editor Code Review — 2026-04-04

## Status after follow-up pass

Completed in code:

- Extracted editor-only UI components into `src/pages/editor/components/`
  - `DomainTreemap.tsx`
  - `ConnectedNodeCard.tsx`
  - `SearchableNodePicker.tsx`
  - `AddConnectedNodeCard.tsx`
- Extracted create-flow tabs into `src/pages/editor/workspace/`
  - `NewNodeTab.tsx`
  - `NewDomainTab.tsx`
- Wired those extracted tabs back into `NodeEditorPage.tsx`
- Fixed the partial-refactor lint regression from `ConnectedNodeCard.tsx`

Not completed yet:

- `content` tab extraction
- `json` tab extraction
- Standard workspace effect/action hook split
- Bio workspace split

One recommendation below is intentionally **not** being applied as-written:

- The earlier suggestion to remove `jsonDraft` from reducer state is no longer a clean win.
  The current editor explicitly preserves invalid in-progress JSON text, keeps form mode and JSON mode in sync, and autosaves that local workspace state. Pulling `jsonDraft` fully out of the reducer would reintroduce split ownership unless the entire JSON editing model is redesigned at the same time.

## What's working well

- **`nodeEditorState.ts`** is clean and correctly isolated — the reducer pattern is sound, action types are explicit, and the state shape is easy to follow.
- **`editorApi.ts`** has a clean dual-mode pattern (`EDITOR_CAN_MUTATE_PROJECT`), consistent `parseResponse`, and types that match the wire format.
- **`editorRelations.ts`**, **`editorNodeUtils.ts`** — small, pure, well-named. Good extraction.
- **`section_editor/`** subdirectory is a correct structural move.

---

## Issues

### 1. `NodeEditorPage.tsx` is 3,321 lines — the dominant problem

It contains four logically distinct workspaces (`content`, `json`, `new-node`, `new-domain`), each ~300–600 lines of JSX, all inside `StandardNodeEditorWorkspace`. The file currently holds:
- All business logic handlers (`handleWriteToFile`, `handleCreateNode`, `handleDeleteNode`, `handleCreateDomain`, etc.)
- All derived/memoized data (`editorNodeById`, `selectableOtherNodeOptions`, `connectedNodeEntries`, `duplicateRelationIndexes`, …)
- All UI sub-components that belong to specific tabs (`DomainTreemap`, `ConnectedNodeCard`, `SearchableNodePicker`, `AddConnectedNodeCard`, `renderConnectedNodesSection`)
- Four full tab bodies inlined in JSX

### 2. `jsonDraft` ownership should only change if the JSON editing model changes too

At first glance, `jsonDraft` and `jsonError` look like they belong outside reducer state. In practice, the current editor now depends on three behaviors at once:

- form mode and JSON mode stay in sync
- invalid in-progress JSON text is preserved while typing
- autosave stores the whole local workspace, including temporarily invalid JSON

Because of that, removing `jsonDraft` from reducer state is no longer a safe standalone cleanup. If we want to revisit it later, it should happen together with a broader rethink of JSON workspace ownership rather than as an isolated reducer simplification.

### 3. `BioEditorWorkspace.tsx` at 1,254 lines has the same pattern

It contains the full bio form, preview, section editor, and save logic inlined.

### 4. Inline UI components in `NodeEditorPage.tsx` that should be extracted

`DomainTreemap` (~180 lines), `ConnectedNodeCard` (~170 lines), `SearchableNodePicker` (~170 lines) are full components defined inside the module but used nowhere else — they just add scroll distance and hurt navigability.

### 5. `BioPagePreview.tsx` duplicates `BioDetailPage.tsx`

`renderSectionHeading`, `BioLink`, `getBioPathEntries`, `BioPathEntryCard` are all re-implemented. The card hover interaction logic is ~50 lines of duplicated style object construction.

---

## Proposed restructure

```
src/pages/editor/
├── editorApi.ts              (keep as-is)
├── editorNodeUtils.ts        (keep as-is)
├── editorRelations.ts        (keep as-is)
├── nodeEditorState.ts        (keep, clean up jsonDraft ownership)
├── templates.ts              (keep as-is)
├── inlineMarkdown.tsx        (keep as-is)
├── articlePreviewShared.tsx  (keep as-is)
│
├── NodeEditorPage.tsx        (routing shell only, ~50 lines)
│
├── workspace/
│   ├── StandardNodeEditorWorkspace.tsx   (~200 lines — state wiring, effects, handlers)
│   ├── useNodeEditorEffects.ts           (extract the 12 useEffect calls)
│   ├── useNodeEditorActions.ts           (extract handle* callbacks)
│   ├── ContentTab.tsx                    (tab === 'content' JSX, ~600 lines)
│   ├── JsonTab.tsx                       (tab === 'json' JSX + renderConnectedNodesSection, ~250 lines)
│   ├── NewNodeTab.tsx                    (tab === 'new-node' JSX, ~200 lines)
│   ├── NewDomainTab.tsx                  (tab === 'new-domain' JSX, ~200 lines)
│   └── RightPanel.tsx                   (preview/stats right column, ~200 lines)
│
├── components/
│   ├── ConnectedNodeCard.tsx
│   ├── SearchableNodePicker.tsx
│   ├── AddConnectedNodeCard.tsx
│   └── DomainTreemap.tsx
│
├── section_editor/           (keep as-is)
│
└── bio/
    ├── BioEditorWorkspace.tsx  (state wiring only, ~150 lines)
    ├── BioPagePreview.tsx      (thin wrapper — delegates to shared BioDetailView)
    └── BioFormSection.tsx      (form fields, extracted from BioEditorWorkspace)
```

## Execution order

1. **`components/` extraction** — completed.
2. **Tab split** — partially completed. `NewNodeTab.tsx` and `NewDomainTab.tsx` are extracted and wired. `ContentTab.tsx` and `JsonTab.tsx` are still pending.
3. **Hook extraction** — still pending. Move `useEffect` blocks into `useNodeEditorEffects` and handlers into `useNodeEditorActions`, leaving `StandardNodeEditorWorkspace` as pure wiring.
4. **JSON workspace cleanup** — revise before changing. Do not remove `jsonDraft` from reducer state unless the invalid-JSON preservation/autosave model is redesigned at the same time.
5. **Bio workspace** — still pending. Split `BioEditorWorkspace.tsx` similarly.
