import type { AppLanguage } from '../../i18n';
import type { DomainId } from '../../configs/domains';
import type { GraphNodeContent, GraphNodeRef, NodeKind } from '../graph/content/Nodes';
import { normalizeNodeContent } from '../graph/content/Nodes';
import type { EditorExplicitRelation, EditorNodeOption, NewNodeDraft } from './editorApi';

export type ValidationState = {
  error: string | null;
};

export type EditorTab = 'content' | 'json' | 'new-node' | 'new-domain';

export type NewDomainDraft = {
  domainId: string;
  display: string;
  cardTag: string;
  seedAngle: number;
};

type TemplateDefaults = {
  untitledNodeTitle: string;
  summary: string;
};

export type NodeEditorWorkspaceState = {
  tab: EditorTab;
  bootstrapNodes: EditorNodeOption[];
  bootstrapError: string | null;
  currentNodeRef: GraphNodeRef | null;
  originalContent: GraphNodeContent | null;
  draftContent: GraphNodeContent | null;
  tagInput: string;
  explicitRelations: EditorExplicitRelation[];
  jsonDraft: string;
  jsonError: string | null;
  validation: ValidationState;
  statusMessage: string | null;
  loadingNode: boolean;
  actionPending: boolean;
  selectedExplicitRelationIndex: number | null;
  editingSectionIndex: number | null;
  showHeaderFields: boolean;
  showMeta: boolean;
  isFallbackContent: boolean;
  resolvedContentLanguage: AppLanguage;
  newNodeDraft: NewNodeDraft;
  newDomainDraft: NewDomainDraft;
};

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function serializeTags(tags?: string[]) {
  return tags?.join(', ') ?? '';
}

export function validateContent(content: GraphNodeContent, nodeId: string): ValidationState {
  try {
    normalizeNodeContent(JSON.parse(prettyJson(content)), nodeId);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid node content.' };
  }
}

export function createInitialNewNodeDraft({
  templateDefaults,
  domain,
  kind,
  chronology,
  template,
}: {
  templateDefaults: TemplateDefaults;
  domain: DomainId;
  kind: NodeKind;
  chronology: string;
  template: string;
}): NewNodeDraft {
  return {
    nodeId: '',
    domain,
    kind,
    chronology,
    title: templateDefaults.untitledNodeTitle,
    subtitle: '',
    summary: templateDefaults.summary,
    template,
  };
}

export function createInitialNewDomainDraft(): NewDomainDraft {
  return {
    domainId: '',
    display: '',
    cardTag: '',
    seedAngle: 180,
  };
}

export function createInitialNodeEditorWorkspaceState({
  decodedNodeId,
  language,
  newNodeDraft,
  newDomainDraft = createInitialNewDomainDraft(),
}: {
  decodedNodeId: string;
  language: AppLanguage;
  newNodeDraft: NewNodeDraft;
  newDomainDraft?: NewDomainDraft;
}): NodeEditorWorkspaceState {
  return {
    tab: decodedNodeId ? 'content' : 'new-node',
    bootstrapNodes: [],
    bootstrapError: null,
    currentNodeRef: null,
    originalContent: null,
    draftContent: null,
    tagInput: '',
    explicitRelations: [],
    jsonDraft: '',
    jsonError: null,
    validation: { error: null },
    statusMessage: null,
    loadingNode: false,
    actionPending: false,
    selectedExplicitRelationIndex: null,
    editingSectionIndex: null,
    showHeaderFields: true,
    showMeta: false,
    isFallbackContent: false,
    resolvedContentLanguage: language,
    newNodeDraft,
    newDomainDraft,
  };
}

type NodeLoadSuccessAction = {
  type: 'load_node_success';
  nodeChanged: boolean;
  nodeId: string;
  node: GraphNodeRef;
  originalContent: GraphNodeContent;
  draftContent: GraphNodeContent;
  explicitRelations: EditorExplicitRelation[];
  isFallbackContent: boolean;
  resolvedContentLanguage: AppLanguage;
  statusMessage: string | null;
};

type NodeEditorWorkspaceAction =
  | { type: 'set_tab'; tab: EditorTab }
  | { type: 'set_bootstrap_nodes'; nodes: EditorNodeOption[] }
  | { type: 'upsert_bootstrap_node'; node: EditorNodeOption }
  | { type: 'set_bootstrap_error'; error: string | null }
  | { type: 'set_status_message'; message: string | null }
  | { type: 'set_loading_node'; value: boolean }
  | { type: 'set_action_pending'; value: boolean }
  | { type: 'set_current_node_ref'; value: GraphNodeRef | null }
  | { type: 'merge_current_node_ref'; patch: Partial<GraphNodeRef> }
  | {
      type: 'sync_template_defaults';
      previousTemplateDefaults: TemplateDefaults;
      nextTemplateDefaults: TemplateDefaults;
    }
  | { type: 'apply_pending_new_domain'; domain: DomainId; kind: NodeKind }
  | { type: 'reset_for_empty_node'; language: AppLanguage }
  | NodeLoadSuccessAction
  | { type: 'set_tag_input'; value: string }
  | { type: 'apply_form_content'; content: GraphNodeContent; nodeId: string }
  | { type: 'apply_json_content'; content: GraphNodeContent; nodeId: string }
  | { type: 'reset_draft_to_original'; nodeId: string }
  | {
      type: 'commit_saved_node';
      node: GraphNodeRef;
      content: GraphNodeContent;
      resolvedContentLanguage: AppLanguage;
    }
  | { type: 'set_json_draft'; value: string }
  | { type: 'set_json_error'; error: string | null }
  | { type: 'replace_explicit_relations'; relations: EditorExplicitRelation[] }
  | { type: 'append_explicit_relation'; relation: EditorExplicitRelation; select?: boolean }
  | { type: 'remove_explicit_relation'; index: number }
  | { type: 'set_selected_explicit_relation_index'; index: number | null }
  | { type: 'set_editing_section_index'; index: number | null }
  | { type: 'set_show_header_fields'; value: boolean }
  | { type: 'set_show_meta'; value: boolean }
  | { type: 'merge_new_node_draft'; patch: Partial<NewNodeDraft> }
  | { type: 'merge_new_domain_draft'; patch: Partial<NewDomainDraft> };

function clampSelectedExplicitRelationIndex(index: number | null, relations: EditorExplicitRelation[]) {
  if (index === null) return null;
  return index < relations.length ? index : relations.length > 0 ? relations.length - 1 : null;
}

function clampEditingSectionIndex(index: number | null, content: GraphNodeContent) {
  if (index === null) return null;
  const sectionCount = content.sections?.length ?? 0;
  return index < sectionCount ? index : sectionCount > 0 ? sectionCount - 1 : null;
}

export function nodeEditorWorkspaceReducer(
  state: NodeEditorWorkspaceState,
  action: NodeEditorWorkspaceAction,
): NodeEditorWorkspaceState {
  switch (action.type) {
    case 'set_tab':
      return { ...state, tab: action.tab };
    case 'set_bootstrap_nodes':
      return { ...state, bootstrapNodes: action.nodes, bootstrapError: null };
    case 'upsert_bootstrap_node': {
      const existingIndex = state.bootstrapNodes.findIndex((node) => node.id === action.node.id);
      if (existingIndex === -1) {
        return {
          ...state,
          bootstrapNodes: [...state.bootstrapNodes, action.node],
          bootstrapError: null,
        };
      }

      return {
        ...state,
        bootstrapNodes: state.bootstrapNodes.map((node, index) =>
          index === existingIndex
            ? {
                ...node,
                ...action.node,
              }
            : node
        ),
        bootstrapError: null,
      };
    }
    case 'set_bootstrap_error':
      return { ...state, bootstrapError: action.error };
    case 'set_status_message':
      return { ...state, statusMessage: action.message };
    case 'set_loading_node':
      return { ...state, loadingNode: action.value };
    case 'set_action_pending':
      return { ...state, actionPending: action.value };
    case 'set_current_node_ref':
      return { ...state, currentNodeRef: action.value };
    case 'merge_current_node_ref':
      return state.currentNodeRef
        ? {
            ...state,
            currentNodeRef: {
              ...state.currentNodeRef,
              ...action.patch,
            },
          }
        : state;
    case 'sync_template_defaults': {
      const nextTitle =
        state.newNodeDraft.title === action.previousTemplateDefaults.untitledNodeTitle
          ? action.nextTemplateDefaults.untitledNodeTitle
          : state.newNodeDraft.title;
      const nextSummary =
        state.newNodeDraft.summary === action.previousTemplateDefaults.summary
          ? action.nextTemplateDefaults.summary
          : state.newNodeDraft.summary;

      if (nextTitle === state.newNodeDraft.title && nextSummary === state.newNodeDraft.summary) {
        return state;
      }

      return {
        ...state,
        newNodeDraft: {
          ...state.newNodeDraft,
          title: nextTitle,
          summary: nextSummary,
        },
      };
    }
    case 'apply_pending_new_domain':
      return {
        ...state,
        tab: 'new-node',
        newNodeDraft: {
          ...state.newNodeDraft,
          domain: action.domain,
          kind: action.kind,
        },
      };
    case 'reset_for_empty_node':
      return {
        ...state,
        currentNodeRef: null,
        originalContent: null,
        draftContent: null,
        tagInput: '',
        explicitRelations: [],
        jsonDraft: '',
        jsonError: null,
        validation: { error: null },
        selectedExplicitRelationIndex: null,
        editingSectionIndex: null,
        isFallbackContent: false,
        resolvedContentLanguage: action.language,
        loadingNode: false,
      };
    case 'load_node_success':
      return {
        ...state,
        currentNodeRef: action.node,
        originalContent: action.originalContent,
        draftContent: action.draftContent,
        tagInput: serializeTags(action.draftContent.tags),
        explicitRelations: action.explicitRelations,
        selectedExplicitRelationIndex: action.nodeChanged
          ? null
          : clampSelectedExplicitRelationIndex(state.selectedExplicitRelationIndex, action.explicitRelations),
        jsonDraft: prettyJson(action.draftContent),
        jsonError: null,
        validation: validateContent(action.draftContent, action.nodeId),
        isFallbackContent: action.isFallbackContent,
        resolvedContentLanguage: action.resolvedContentLanguage,
        statusMessage: action.statusMessage,
        tab: action.nodeChanged ? 'content' : state.tab,
        editingSectionIndex: action.nodeChanged
          ? null
          : clampEditingSectionIndex(state.editingSectionIndex, action.draftContent),
        bootstrapError: null,
        loadingNode: false,
      };
    case 'set_tag_input':
      return { ...state, tagInput: action.value };
    case 'apply_form_content':
      return {
        ...state,
        draftContent: action.content,
        jsonDraft: prettyJson(action.content),
        validation: validateContent(action.content, action.nodeId),
        jsonError: null,
      };
    case 'apply_json_content':
      return {
        ...state,
        draftContent: action.content,
        validation: validateContent(action.content, action.nodeId),
        jsonError: null,
      };
    case 'reset_draft_to_original':
      return state.originalContent
        ? {
            ...state,
            draftContent: state.originalContent,
            tagInput: serializeTags(state.originalContent.tags),
            jsonDraft: prettyJson(state.originalContent),
            validation: validateContent(state.originalContent, action.nodeId),
            jsonError: null,
            editingSectionIndex: clampEditingSectionIndex(state.editingSectionIndex, state.originalContent),
          }
        : state;
    case 'commit_saved_node':
      return {
        ...state,
        currentNodeRef: action.node,
        originalContent: action.content,
        isFallbackContent: false,
        resolvedContentLanguage: action.resolvedContentLanguage,
      };
    case 'set_json_draft':
      return { ...state, jsonDraft: action.value };
    case 'set_json_error':
      return { ...state, jsonError: action.error };
    case 'replace_explicit_relations':
      return {
        ...state,
        explicitRelations: action.relations,
        selectedExplicitRelationIndex: clampSelectedExplicitRelationIndex(
          state.selectedExplicitRelationIndex,
          action.relations,
        ),
      };
    case 'append_explicit_relation': {
      const relations = [...state.explicitRelations, action.relation];
      return {
        ...state,
        explicitRelations: relations,
        selectedExplicitRelationIndex: action.select ? relations.length - 1 : state.selectedExplicitRelationIndex,
      };
    }
    case 'remove_explicit_relation':
      return {
        ...state,
        explicitRelations: state.explicitRelations.filter((_, index) => index !== action.index),
        selectedExplicitRelationIndex:
          state.selectedExplicitRelationIndex === null
            ? null
            : state.selectedExplicitRelationIndex === action.index
              ? null
              : state.selectedExplicitRelationIndex > action.index
                ? state.selectedExplicitRelationIndex - 1
                : state.selectedExplicitRelationIndex,
      };
    case 'set_selected_explicit_relation_index':
      return { ...state, selectedExplicitRelationIndex: action.index };
    case 'set_editing_section_index':
      return { ...state, editingSectionIndex: action.index };
    case 'set_show_header_fields':
      return { ...state, showHeaderFields: action.value };
    case 'set_show_meta':
      return { ...state, showMeta: action.value };
    case 'merge_new_node_draft':
      return {
        ...state,
        newNodeDraft: {
          ...state.newNodeDraft,
          ...action.patch,
        },
      };
    case 'merge_new_domain_draft':
      return {
        ...state,
        newDomainDraft: {
          ...state.newDomainDraft,
          ...action.patch,
        },
      };
    default:
      return state;
  }
}
