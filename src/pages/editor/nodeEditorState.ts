import type { AppLanguage } from '../../i18n';
import type { DomainId } from '../../configs/content/domains';
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
  jsonDraft: string;
  jsonError: string | null;
  explicitRelationsJsonDraft: string;
  explicitRelationsJsonError: string | null;
  tagInput: string;
  explicitRelations: EditorExplicitRelation[];
  validation: ValidationState;
  statusMessage: string | null;
  loadingNode: boolean;
  actionPending: boolean;
  selectedExplicitRelationIndex: number | null;
  editingSectionIndex: number | null;
  showHeaderFields: boolean;
  showMeta: boolean;
  showJsonContent: boolean;
  showJsonConnections: boolean;
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
    jsonDraft: '',
    jsonError: null,
    explicitRelationsJsonDraft: '[]',
    explicitRelationsJsonError: null,
    tagInput: '',
    explicitRelations: [],
    validation: { error: null },
    statusMessage: null,
    loadingNode: false,
    actionPending: false,
    selectedExplicitRelationIndex: null,
    editingSectionIndex: null,
    showHeaderFields: true,
    showMeta: false,
    showJsonContent: true,
    showJsonConnections: false,
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
  jsonDraft: string;
  jsonError: string | null;
  explicitRelations: EditorExplicitRelation[];
  explicitRelationsJsonDraft: string;
  explicitRelationsJsonError: string | null;
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
  | { type: 'apply_draft_content'; content: GraphNodeContent; nodeId: string }
  | {
      type: 'edit_json_draft';
      value: string;
      nodeId: string;
      parsedContent?: GraphNodeContent;
      error: string | null;
    }
  | {
      type: 'edit_explicit_relations_json_draft';
      value: string;
      parsedRelations?: EditorExplicitRelation[];
      error: string | null;
    }
  | { type: 'reset_draft_to_original'; nodeId: string }
  | {
      type: 'commit_saved_node';
      node: GraphNodeRef;
      content: GraphNodeContent;
      resolvedContentLanguage: AppLanguage;
    }
  | { type: 'replace_explicit_relations'; relations: EditorExplicitRelation[] }
  | { type: 'append_explicit_relation'; relation: EditorExplicitRelation; select?: boolean }
  | { type: 'remove_explicit_relation'; index: number }
  | { type: 'set_selected_explicit_relation_index'; index: number | null }
  | { type: 'set_editing_section_index'; index: number | null }
  | { type: 'set_show_header_fields'; value: boolean }
  | { type: 'set_show_meta'; value: boolean }
  | { type: 'set_show_json_content'; value: boolean }
  | { type: 'set_show_json_connections'; value: boolean }
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
        explicitRelationsJsonDraft: '[]',
        explicitRelationsJsonError: null,
        validation: { error: null },
        selectedExplicitRelationIndex: null,
        editingSectionIndex: null,
        showJsonContent: true,
        showJsonConnections: false,
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
        jsonDraft: action.jsonDraft,
        jsonError: action.jsonError,
        explicitRelationsJsonDraft: action.explicitRelationsJsonDraft,
        explicitRelationsJsonError: action.explicitRelationsJsonError,
        tagInput: serializeTags(action.draftContent.tags),
        explicitRelations: action.explicitRelations,
        selectedExplicitRelationIndex: action.nodeChanged
          ? null
          : clampSelectedExplicitRelationIndex(state.selectedExplicitRelationIndex, action.explicitRelations),
        validation: validateContent(action.draftContent, action.nodeId),
        isFallbackContent: action.isFallbackContent,
        resolvedContentLanguage: action.resolvedContentLanguage,
        statusMessage: action.statusMessage,
        tab: action.nodeChanged ? 'content' : state.tab,
        editingSectionIndex: action.nodeChanged
          ? null
          : clampEditingSectionIndex(state.editingSectionIndex, action.draftContent),
        showJsonContent: action.nodeChanged ? true : state.showJsonContent,
        showJsonConnections: action.nodeChanged ? false : state.showJsonConnections,
        bootstrapError: null,
        loadingNode: false,
      };
    case 'set_tag_input':
      return { ...state, tagInput: action.value };
    case 'apply_draft_content':
      return {
        ...state,
        draftContent: action.content,
        jsonDraft: prettyJson(action.content),
        jsonError: null,
        validation: validateContent(action.content, action.nodeId),
      };
    case 'edit_json_draft':
      return {
        ...state,
        jsonDraft: action.value,
        jsonError: action.error,
        draftContent: action.parsedContent ?? state.draftContent,
        validation:
          action.parsedContent && !action.error
            ? validateContent(action.parsedContent, action.nodeId)
            : state.validation,
      };
    case 'edit_explicit_relations_json_draft':
      return {
        ...state,
        explicitRelationsJsonDraft: action.value,
        explicitRelationsJsonError: action.error,
        explicitRelations: action.parsedRelations ?? state.explicitRelations,
        selectedExplicitRelationIndex:
          action.parsedRelations === undefined
            ? state.selectedExplicitRelationIndex
            : clampSelectedExplicitRelationIndex(state.selectedExplicitRelationIndex, action.parsedRelations),
      };
    case 'reset_draft_to_original':
      return state.originalContent
        ? {
            ...state,
            draftContent: state.originalContent,
            jsonDraft: prettyJson(state.originalContent),
            jsonError: null,
            explicitRelationsJsonError: null,
            tagInput: serializeTags(state.originalContent.tags),
            validation: validateContent(state.originalContent, action.nodeId),
            editingSectionIndex: clampEditingSectionIndex(state.editingSectionIndex, state.originalContent),
          }
        : state;
    case 'commit_saved_node':
      return {
        ...state,
        currentNodeRef: action.node,
        originalContent: action.content,
        draftContent: action.content,
        jsonDraft: prettyJson(action.content),
        jsonError: null,
        explicitRelationsJsonDraft: prettyJson(state.explicitRelations),
        explicitRelationsJsonError: null,
        isFallbackContent: false,
        resolvedContentLanguage: action.resolvedContentLanguage,
      };
    case 'replace_explicit_relations':
      return {
        ...state,
        explicitRelations: action.relations,
        explicitRelationsJsonDraft: prettyJson(action.relations),
        explicitRelationsJsonError: null,
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
        explicitRelationsJsonDraft: prettyJson(relations),
        explicitRelationsJsonError: null,
        selectedExplicitRelationIndex: action.select ? relations.length - 1 : state.selectedExplicitRelationIndex,
      };
    }
    case 'remove_explicit_relation':
      return {
        ...state,
        explicitRelations: state.explicitRelations.filter((_, index) => index !== action.index),
        explicitRelationsJsonDraft: prettyJson(state.explicitRelations.filter((_, index) => index !== action.index)),
        explicitRelationsJsonError: null,
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
    case 'set_show_json_content':
      return { ...state, showJsonContent: action.value };
    case 'set_show_json_connections':
      return { ...state, showJsonConnections: action.value };
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
