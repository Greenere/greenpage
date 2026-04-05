# `src/pages/editor`

This folder contains the editor workspace for authoring localized node and bio content.

It covers:

- the main editor route and tab shell
- live previews for nodes and bio content
- the JSON editor
- connected-node / relation editing
- templates and new-node/new-domain flows
- the shared section editor used by both nodes and bio content

## Mental model

The editor is split into four layers:

1. Page shell
   [`NodeEditorPage.tsx`](./NodeEditorPage.tsx) is the main route-level container for node editing and create flows.

2. Specialized workspaces
   [`BioEditorWorkspace.tsx`](./BioEditorWorkspace.tsx) handles the bio editor, which is close to the node editor but has its own form structure and read-only graph-path connections.

3. State + persistence
   [`nodeEditorState.ts`](./nodeEditorState.ts), [`editorApi.ts`](./editorApi.ts), and the local draft/autosave logic manage editor state, loading, saving, and fallback behavior.

4. Shared editor UI pieces
   Components, previews, and the section editor provide the actual authoring UX.

## Top-level files

- [`NodeEditorPage.tsx`](./NodeEditorPage.tsx)
  Main editor route. Owns tab switching, node loading, autosave, JSON editing, relation editing, and create flows for standard content nodes.

- [`BioEditorWorkspace.tsx`](./BioEditorWorkspace.tsx)
  Dedicated bio editor workspace. Uses the same section editor UX as content nodes, but keeps bio-specific fields and restrictions.

- [`editorApi.ts`](./editorApi.ts)
  Editor-side API wrapper. In dev it talks to Vite endpoints for read/write/delete; in production it behaves as a preview/local-draft workspace with write actions disabled.

- [`nodeEditorState.ts`](./nodeEditorState.ts)
  Reducer and helper logic for the main node editor workspace state.

- [`templates.ts`](./templates.ts)
  New-node template definitions and locale-aware defaults.

## Preview/rendering files

- [`NodeArticlePreview.tsx`](./NodeArticlePreview.tsx)
  Preview renderer for standard content nodes inside the editor.

- [`BioPagePreview.tsx`](./BioPagePreview.tsx)
  Preview renderer for the bio workspace.

- [`articlePreviewShared.tsx`](./articlePreviewShared.tsx)
  Shared preview-only block rendering used inside the editor.

- [`inlineMarkdown.tsx`](./inlineMarkdown.tsx)
  The editor preview’s lightweight inline markdown renderer.

- [`ArticleGallery.tsx`](./ArticleGallery.tsx)
  Editor-facing gallery adapter. The shared gallery layout itself lives under `src/shared/ui`.

## JSON editing

- [`JsonEditorPanel.tsx`](./JsonEditorPanel.tsx)
  Controlled JSON textarea panel used in the `JSON` tab.

The editor keeps one canonical draft state:

- form edits update the draft
- valid JSON edits update the same draft
- invalid JSON text is preserved as raw text until fixed

That is why `jsonDraft` is still important even though the editor now autosaves by default.

## `components/`

These are reusable editor UI pieces.

- [`BrowseNodesDialog.tsx`](./BrowseNodesDialog.tsx)
  Dialog for opening nodes by browsing grouped domains with search.

- [`components/SearchableNodePicker.tsx`](./components/SearchableNodePicker.tsx)
  Search-first picker used for relation editing.

- [`components/ConnectedNodeCard.tsx`](./components/ConnectedNodeCard.tsx)
  Existing explicit/inferred connection card.

- [`components/AddConnectedNodeCard.tsx`](./components/AddConnectedNodeCard.tsx)
  Add-connection entry card.

- [`../shared/ui/StatisticsPanel.tsx`](../shared/ui/StatisticsPanel.tsx)
  Shared statistics surface used in the new-domain flow today and ready to be reused from graph routes later.

- [`components/ControlLabel.tsx`](./components/ControlLabel.tsx)
  Small shared label component for editor controls.

- [`components/editorStyles.ts`](./components/editorStyles.ts)
  Centralized inline-style helpers/constants for editor UI pieces.

## `section_editor/`

This is the shared section editor used by:

- standard content nodes
- bio sections

Files:

- [`SectionListEditor.tsx`](./section_editor/SectionListEditor.tsx)
  Section list + add-section wrapper.

- [`InlineSectionCard.tsx`](./section_editor/InlineSectionCard.tsx)
  The actual inline section editing card UI.

- [`sectionMarkdown.ts`](./section_editor/sectionMarkdown.ts)
  Parse/serialize helpers for the project’s supported markdown subset and block syntax.

If section authoring behavior changes, this folder is usually the first place to look.

## `workspace/`

- [`NewNodeTab.tsx`](./workspace/NewNodeTab.tsx)
  Extracted UI for the new-node flow.

- [`NewDomainTab.tsx`](./workspace/NewDomainTab.tsx)
  Extracted UI for the new-domain flow.

These keep `NodeEditorPage.tsx` smaller by pulling out the create-only tab bodies.

## Supporting helpers

- [`editorNodeUtils.ts`](./editorNodeUtils.ts)
  Search/sort/group helpers for editor node lists and browsing.

- [`editorRelations.ts`](./editorRelations.ts)
  Explicit relation helpers, duplicate detection, and connected-node calculations.

## Data flow

Standard node editing:

1. `NodeEditorPage.tsx` loads bootstrap graph/card data.
2. It loads the selected node content through [`editorApi.ts`](./editorApi.ts).
3. The reducer in [`nodeEditorState.ts`](./nodeEditorState.ts) owns the current draft state.
4. Form edits and valid JSON edits both update that same draft.
5. Autosave persists the local workspace draft.
6. In development, write/delete/create actions go through Vite dev endpoints.

Bio editing:

1. `BioEditorWorkspace.tsx` loads localized bio content.
2. It uses the same section editor for `sections`.
3. Graph-path cards are shown as clickable but read-only generated connections.

## Important behavior

- `/editor` defaults to the bio workspace.
- Local drafts autosave by default.
- In production, the editor remains available for preview/local editing, but write/create/delete actions are disabled.
- Language switches preserve the current editing context instead of forcing a tab reset.
- The `JSON` tab and the normal form editor stay in sync through the same canonical draft state.

## When changing things

If you want to change...

- overall editor flow or tabs:
  Start in [`NodeEditorPage.tsx`](./NodeEditorPage.tsx)

- bio-only editing behavior:
  Start in [`BioEditorWorkspace.tsx`](./BioEditorWorkspace.tsx)

- saves, deletes, or environment-specific behavior:
  Start in [`editorApi.ts`](./editorApi.ts)

- reducer/state transitions:
  Start in [`nodeEditorState.ts`](./nodeEditorState.ts)

- connected-node behavior:
  Look at [`editorRelations.ts`](./editorRelations.ts) and [`components/ConnectedNodeCard.tsx`](./components/ConnectedNodeCard.tsx)

- section authoring / markdown subset:
  Look at [`section_editor/`](./section_editor) and especially [`sectionMarkdown.ts`](./section_editor/sectionMarkdown.ts)

- preview rendering:
  Start in [`NodeArticlePreview.tsx`](./NodeArticlePreview.tsx), [`BioPagePreview.tsx`](./BioPagePreview.tsx), and [`articlePreviewShared.tsx`](./articlePreviewShared.tsx)
