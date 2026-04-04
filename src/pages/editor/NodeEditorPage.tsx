import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { DOMAIN_CONFIG, DOMAIN_ORDER, isDomainId, type DomainId } from '../../configs/content/domains';
import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graph/highlight';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { LANGUAGE_OPTIONS, getLocaleMessages, type AppLanguage } from '../../i18n';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import {
  CHRONOLOGY_FORMAT_HINT,
  getChronologyValidationError,
  getCurrentMonthChronologyValue,
  normalizeChronologyValue,
} from '../../shared/chronology';
import { applyThemeVars } from '../../shared/styles/colors';
import ThemePicker from '../graph/ThemePicker';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from '../graph/content/BioTheme';
import {
  getDisplayDomain,
  clearGraphModelCache,
  clearGraphNodeContentCache,
  normalizeNodeContent,
  resolveAssetUrl,
  type GraphContentNode,
  type GraphNodeContent,
  type GraphNodeRef,
} from '../graph/content/Nodes';
import JsonEditorPanel from './JsonEditorPanel';
import NodeArticlePreview from './NodeArticlePreview';
import BioEditorWorkspace from './BioEditorWorkspace';
import BrowseNodesDialog from './BrowseNodesDialog';
import {
  anchorExplicitRelationToNode,
  areExplicitRelationsEquivalent,
  buildBioConnectionEntry,
  buildExplicitConnectionEntry,
  buildTimelineConnectionEntries,
  createEmptyExplicitRelation,
  findDuplicateExplicitRelationIndexes,
  getOccupiedConnectionPeerIds,
  isCompleteExplicitRelation,
  wouldCreateDuplicateExplicitRelation,
} from './editorRelations';
import {
  DETAIL_READING_WIDTH,
  DETAIL_SECTION_WIDTH,
  renderMeta,
  renderSectionHeading,
} from './articlePreviewShared';
import {
  createEditorDomain,
  deleteEditorNode,
  deleteEditorDomain,
  createEditorNode,
  EDITOR_CAN_MUTATE_PROJECT,
  type EditorExplicitRelation,
  fetchEditorBootstrap,
  fetchEditorNode,
  saveEditorNode,
} from './editorApi';
import {
  createInitialNewNodeDraft,
  createInitialNodeEditorWorkspaceState,
  nodeEditorWorkspaceReducer,
  prettyJson,
  serializeTags,
  type EditorTab,
} from './nodeEditorState';
import { formatEditorNodeOptionLabel, getEditorNodeTitle, sortNodeRefs } from './editorNodeUtils';
import { AddConnectedNodeCard } from './components/AddConnectedNodeCard';
import { ConnectedNodeCard } from './components/ConnectedNodeCard';
import { DomainTreemap, type DomainTreemapEntry } from './components/DomainTreemap';
import { SearchableNodePicker } from './components/SearchableNodePicker';
import { ControlLabel, FieldShell } from './components/ControlLabel';
import { btnPrimary, btnSecondary, btnDanger, btnDisabled, inputStyle } from './components/editorStyles';
import SectionListEditor from './section_editor/SectionListEditor';
import { createEmptySection } from './section_editor/sectionMarkdown';
import { createTemplateContent, getDefaultKindForDomain, getNodeTemplateOptions, NODE_TEMPLATE_IDS } from './templates';
import { NewDomainTab } from './workspace/NewDomainTab';
import { NewNodeTab } from './workspace/NewNodeTab';

const EDITOR_DRAFT_STORAGE_PREFIX = 'greenpage-node-editor-draft:';
const EDITOR_PENDING_NEW_DOMAIN_KEY = 'greenpage-node-editor-pending-new-domain';
const EDITOR_DRAFT_AUTOSAVE_DELAY_MS = 250;

function getTabLabel(tab: EditorTab) {
  if (tab === 'content') return UI_COPY.nodeEditor.tabs.content;
  if (tab === 'json') return UI_COPY.nodeEditor.tabs.json;
  if (tab === 'new-node') return UI_COPY.nodeEditor.tabs.newNode;
  return UI_COPY.nodeEditor.tabs.newDomain;
}

function PreviewPanelLanguageToggle() {
  const { language, setLanguage, messages } = useAppLanguage();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.2rem',
      }}
      aria-label={messages.appShell.languageLabel}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const selected = option.id === language;
        const label = messages.appShell.languageOptions[option.id];

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLanguage(option.id)}
            aria-pressed={selected}
            aria-label={messages.appShell.languageMenuLabel(label)}
            title={label}
            style={{
              padding: '0.12rem 0.25rem',
              border: 'none',
              background: 'transparent',
              color: selected ? 'var(--color-text)' : 'color-mix(in srgb, var(--color-text) 58%, transparent)',
              fontSize: '0.75rem',
              fontWeight: selected ? 700 : 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1.2,
            }}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

type DangerDialogConfig = {
  actionDescription: string;
  proceedLabel?: string;
  tone?: 'danger' | 'primary';
  showResult?: boolean;
  pendingMessage?: string;
  onProceed: () => void | Promise<string | void>;
};

type DangerDialogState = DangerDialogConfig & {
  status: 'confirm' | 'pending' | 'success' | 'error';
  resultMessage?: string;
};

const RELATION_KIND_OPTIONS: EditorExplicitRelation['kind'][] = [
  'time',
  'location',
  'topic',
  'reason',
  'outcome',
  'tool',
];

function getDraftStorageKey(nodeId: string, lang: AppLanguage) {
  return `${EDITOR_DRAFT_STORAGE_PREFIX}${lang}:${nodeId}`;
}

type StoredNodeEditorDraft = {
  version: 2;
  content: GraphNodeContent;
  jsonDraft: string;
  explicitRelationsJsonDraft?: string;
  currentNodeRef?: GraphNodeRef;
  explicitRelations?: EditorExplicitRelation[];
};

type RestoredNodeEditorDraft = {
  content: GraphNodeContent;
  jsonDraft: string;
  jsonError: string | null;
  explicitRelationsJsonDraft: string;
  explicitRelationsJsonError: string | null;
  currentNodeRef?: GraphNodeRef;
  explicitRelations?: EditorExplicitRelation[];
};

function lenientParseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'));
  }
}

function normalizeExplicitRelationsInput(raw: unknown, currentNodeId: string): EditorExplicitRelation[] {
  if (!Array.isArray(raw)) {
    throw new Error('Explicit connections JSON must be an array.');
  }

  return raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Explicit connection at index ${index} must be an object.`);
    }

    const candidate = entry as Record<string, unknown>;
    const kind = candidate.kind;
    const strength = candidate.strength;

    if (
      typeof candidate.from !== 'string' ||
      typeof candidate.to !== 'string' ||
      typeof candidate.label !== 'string' ||
      !RELATION_KIND_OPTIONS.includes(kind as EditorExplicitRelation['kind']) ||
      (strength !== 1 && strength !== 2 && strength !== 3)
    ) {
      throw new Error(`Explicit connection at index ${index} is missing required fields.`);
    }

    return anchorExplicitRelationToNode(
      {
        id: typeof candidate.id === 'string' ? candidate.id : undefined,
        from: candidate.from,
        to: candidate.to,
        kind: kind as EditorExplicitRelation['kind'],
        label: candidate.label,
        strength: strength as 1 | 2 | 3,
      },
      currentNodeId,
    );
  });
}

function isStoredNodeRef(value: unknown): value is GraphNodeRef {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.kind === 'string' &&
    typeof candidate.domain === 'string' &&
    typeof candidate.chronology === 'string'
  );
}

function isStoredExplicitRelation(value: unknown): value is EditorExplicitRelation {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.from === 'string' &&
    typeof candidate.to === 'string' &&
    typeof candidate.kind === 'string' &&
    typeof candidate.label === 'string' &&
    (candidate.strength === 1 || candidate.strength === 2 || candidate.strength === 3) &&
    (candidate.id === undefined || typeof candidate.id === 'string')
  );
}

function parseStoredNodeDraft(rawValue: string | null, nodeId: string): RestoredNodeEditorDraft | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).title === 'string') {
      const content = normalizeNodeContent(parsed, nodeId);
      return {
        content,
        jsonDraft: prettyJson(content),
        jsonError: null,
        explicitRelationsJsonDraft: '[]',
        explicitRelationsJsonError: null,
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    const content = normalizeNodeContent(candidate.content, nodeId);
    const jsonDraft = typeof candidate.jsonDraft === 'string' ? candidate.jsonDraft : prettyJson(content);
    const explicitRelations = Array.isArray(candidate.explicitRelations)
      ? candidate.explicitRelations.filter(isStoredExplicitRelation)
      : undefined;
    const explicitRelationsJsonDraft =
      typeof candidate.explicitRelationsJsonDraft === 'string'
        ? candidate.explicitRelationsJsonDraft
        : prettyJson(explicitRelations ?? []);

    let jsonError: string | null = null;
    try {
      normalizeNodeContent(lenientParseJsonText(jsonDraft), nodeId);
    } catch (error) {
      jsonError = error instanceof Error ? error.message : 'Invalid JSON.';
    }

    let explicitRelationsJsonError: string | null = null;
    try {
      normalizeExplicitRelationsInput(lenientParseJsonText(explicitRelationsJsonDraft), nodeId);
    } catch (error) {
      explicitRelationsJsonError = error instanceof Error ? error.message : 'Invalid explicit connections JSON.';
    }

    return {
      content,
      jsonDraft,
      jsonError,
      explicitRelationsJsonDraft,
      explicitRelationsJsonError,
      currentNodeRef: isStoredNodeRef(candidate.currentNodeRef) ? candidate.currentNodeRef : undefined,
      explicitRelations,
    };
  } catch {
    return null;
  }
}

function clearStoredNodeDraft(nodeId: string, lang: AppLanguage) {
  window.localStorage.removeItem(getDraftStorageKey(nodeId, lang));
}

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function parseCommaSeparatedTags(value: string) {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

type StandardNodeEditorWorkspaceProps = {
  decodedNodeId: string;
  initialTab?: EditorTab;
};

const StandardNodeEditorWorkspace = ({ decodedNodeId, initialTab }: StandardNodeEditorWorkspaceProps) => {
  const { language, messages } = useAppLanguage();
  const nodeTemplateOptions = getNodeTemplateOptions();
  const templateDefaults = getLocaleMessages().nodeTemplates.defaults;
  const editorCanMutateProject = EDITOR_CAN_MUTATE_PROJECT;
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [editorState, dispatch] = useReducer(
    nodeEditorWorkspaceReducer,
    undefined,
    () =>
      createInitialNodeEditorWorkspaceState({
        decodedNodeId,
        language,
        initialTab,
        newNodeDraft: createInitialNewNodeDraft({
          templateDefaults,
          domain: DOMAIN_ORDER[0],
          kind: getDefaultKindForDomain(DOMAIN_ORDER[0]),
          chronology: getCurrentMonthChronologyValue(),
          template: NODE_TEMPLATE_IDS[0],
        }),
      }),
  );
  const [dangerDialog, setDangerDialog] = useState<DangerDialogState | null>(null);
  const [showOpenNodeDialog, setShowOpenNodeDialog] = useState(false);
  const {
    tab,
    bootstrapNodes,
    bootstrapError,
    currentNodeRef,
    originalContent,
    draftContent,
    jsonDraft,
    jsonError,
    explicitRelationsJsonDraft,
    explicitRelationsJsonError,
    tagInput,
    explicitRelations,
    validation,
    statusMessage,
    loadingNode,
    actionPending,
    selectedExplicitRelationIndex,
    editingSectionIndex,
    showHeaderFields,
    showMeta,
    showJsonContent,
    showJsonConnections,
    isFallbackContent,
    resolvedContentLanguage,
    newNodeDraft,
    newDomainDraft,
  } = editorState;
  const lastLoadedNodeIdRef = useRef(decodedNodeId);
  const previousTemplateDefaultsRef = useRef(templateDefaults);
  const explicitRelationsRef = useRef<EditorExplicitRelation[]>([]);
  const loadedExplicitRelationsRef = useRef<EditorExplicitRelation[]>([]);
  const loadedNodeRefRef = useRef<GraphNodeRef | null>(null);
  const availableTabs = (editorCanMutateProject
    ? (['content', 'json', 'new-node', 'new-domain'] as const)
    : (['content', 'json'] as const));
  const editorSubtitle = editorCanMutateProject ? UI_COPY.nodeEditor.subtitle : UI_COPY.nodeEditor.productionSubtitle;
  const previewSelectionHint = editorCanMutateProject
    ? UI_COPY.nodeEditor.rightPanel.previewSelectionHint
    : UI_COPY.nodeEditor.rightPanel.previewSelectionHintExistingOnly;
  const previewEmptyState = editorCanMutateProject
    ? UI_COPY.nodeEditor.rightPanel.previewEmptyState
    : UI_COPY.nodeEditor.rightPanel.previewEmptyStateExistingOnly;

  // Auto-dismiss status messages after 4 s
  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => dispatch({ type: 'set_status_message', message: null }), 4000);
    return () => window.clearTimeout(timer);
  }, [dispatch, statusMessage]);

  useEffect(() => {
    explicitRelationsRef.current = explicitRelations;
  }, [explicitRelations]);

  useEffect(() => {
    applyThemeVars(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (editorCanMutateProject) return;
    if (tab === 'new-node' || tab === 'new-domain') {
      dispatch({ type: 'set_tab', tab: 'content' });
    }
  }, [dispatch, editorCanMutateProject, tab]);

  useEffect(() => {
    fetchEditorBootstrap(language)
      .then((payload) => {
        dispatch({ type: 'set_bootstrap_nodes', nodes: payload.nodes });
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'set_bootstrap_error',
          error: error instanceof Error ? error.message : 'Failed to load editor bootstrap.',
        });
      });
  }, [dispatch, language]);

  useEffect(() => {
    const previousTemplateDefaults = previousTemplateDefaultsRef.current;

    dispatch({
      type: 'sync_template_defaults',
      previousTemplateDefaults,
      nextTemplateDefaults: templateDefaults,
    });

    previousTemplateDefaultsRef.current = templateDefaults;
  }, [dispatch, templateDefaults]);

  useEffect(() => {
    if (decodedNodeId) return;

    const pendingDomainId = window.sessionStorage.getItem(EDITOR_PENDING_NEW_DOMAIN_KEY);
    if (!pendingDomainId || !isDomainId(pendingDomainId)) return;
    const nextDomainId: DomainId = pendingDomainId;

    dispatch({
      type: 'apply_pending_new_domain',
      domain: nextDomainId,
      kind: getDefaultKindForDomain(nextDomainId),
    });
    window.sessionStorage.removeItem(EDITOR_PENDING_NEW_DOMAIN_KEY);
  }, [decodedNodeId, dispatch]);

  useEffect(() => {
    if (!decodedNodeId) {
      lastLoadedNodeIdRef.current = '';
      explicitRelationsRef.current = [];
      loadedExplicitRelationsRef.current = [];
      loadedNodeRefRef.current = null;
      dispatch({ type: 'reset_for_empty_node', language });
      return;
    }

    const nodeChanged = lastLoadedNodeIdRef.current !== decodedNodeId;
    dispatch({ type: 'set_loading_node', value: true });
    fetchEditorNode(decodedNodeId, language)
      .then((payload) => {
        const storedDraft = parseStoredNodeDraft(
          window.localStorage.getItem(getDraftStorageKey(decodedNodeId, language)),
          decodedNodeId,
        );
        const nextContent =
          storedDraft
            ? storedDraft.content
            : normalizeNodeContent(payload.content, decodedNodeId);
        const nextNodeRef =
          storedDraft?.currentNodeRef?.id === payload.node.id
            ? {
                ...payload.node,
                chronology: storedDraft.currentNodeRef.chronology,
              }
            : payload.node;
        const anchoredRelations = payload.explicitRelations.map((relation) =>
          anchorExplicitRelationToNode(relation, payload.node.id)
        );
        const storedExplicitRelations = storedDraft?.explicitRelations?.map((relation) =>
          anchorExplicitRelationToNode(relation, payload.node.id)
        );
        const hasUnsavedExplicitRelationChanges =
          !nodeChanged &&
          !areExplicitRelationsEquivalent(explicitRelationsRef.current, loadedExplicitRelationsRef.current);
        const nextExplicitRelations = hasUnsavedExplicitRelationChanges
          ? explicitRelationsRef.current
          : storedExplicitRelations ?? anchoredRelations;

        dispatch({
          type: 'load_node_success',
          nodeChanged,
          nodeId: decodedNodeId,
          node: nextNodeRef,
          originalContent: payload.content,
          draftContent: nextContent,
          jsonDraft: storedDraft?.jsonDraft ?? prettyJson(nextContent),
          jsonError: storedDraft?.jsonError ?? null,
          explicitRelations: nextExplicitRelations,
          explicitRelationsJsonDraft: storedDraft?.explicitRelationsJsonDraft ?? prettyJson(nextExplicitRelations),
          explicitRelationsJsonError: storedDraft?.explicitRelationsJsonError ?? null,
          isFallbackContent: payload.isFallbackContent ?? false,
          resolvedContentLanguage: payload.resolvedLanguage ?? language,
          statusMessage: null,
        });
        lastLoadedNodeIdRef.current = decodedNodeId;
        loadedNodeRefRef.current = payload.node;
        loadedExplicitRelationsRef.current = anchoredRelations;
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'set_bootstrap_error',
          error: error instanceof Error ? error.message : 'Failed to load node content.',
        });
      })
      .finally(() => {
        dispatch({ type: 'set_loading_node', value: false });
      });
  }, [decodedNodeId, dispatch, language]);

  useEffect(() => {
    const normalized = serializeTags(draftContent?.tags);
    const parsedCurrent = parseCommaSeparatedTags(tagInput);
    const normalizedCurrent = serializeTags(parsedCurrent);
    if (normalizedCurrent === normalized) return;
    dispatch({ type: 'set_tag_input', value: normalized });
  }, [dispatch, draftContent?.tags, tagInput]);

  const hasUnsavedLocalDraft =
    Boolean(decodedNodeId) &&
    Boolean(draftContent) &&
    Boolean(currentNodeRef) &&
    Boolean(loadedNodeRefRef.current) &&
    (
      prettyJson(draftContent) !== prettyJson(originalContent) ||
      currentNodeRef?.chronology !== loadedNodeRefRef.current?.chronology ||
      !areExplicitRelationsEquivalent(explicitRelations, loadedExplicitRelationsRef.current) ||
      jsonDraft !== prettyJson(draftContent) ||
      explicitRelationsJsonDraft !== prettyJson(explicitRelations)
    );

  useEffect(() => {
    if (!decodedNodeId || !draftContent || !currentNodeRef) return;

    if (!hasUnsavedLocalDraft) {
      clearStoredNodeDraft(decodedNodeId, language);
      return;
    }

    const timer = window.setTimeout(() => {
      const payload: StoredNodeEditorDraft = {
        version: 2,
        content: draftContent,
        jsonDraft,
        explicitRelationsJsonDraft,
        currentNodeRef,
        explicitRelations,
      };

      window.localStorage.setItem(getDraftStorageKey(decodedNodeId, language), JSON.stringify(payload));
    }, EDITOR_DRAFT_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [currentNodeRef, decodedNodeId, draftContent, explicitRelations, explicitRelationsJsonDraft, hasUnsavedLocalDraft, jsonDraft, language]);

  const trimmedNewNodeId = newNodeDraft.nodeId.trim();
  const newNodeIdAlreadyExists = trimmedNewNodeId.length > 0 && bootstrapNodes.some((node) => node.id === trimmedNewNodeId);
  const newNodeIdInvalid = trimmedNewNodeId.length > 0 && !isSafeSlug(trimmedNewNodeId);
  const currentChronologyError = currentNodeRef ? getChronologyValidationError(currentNodeRef.chronology) : null;
  const newNodeChronologyError = getChronologyValidationError(newNodeDraft.chronology);
  const newNodeCreateDisabled =
    !trimmedNewNodeId || newNodeIdAlreadyExists || newNodeIdInvalid || Boolean(newNodeChronologyError) || actionPending;
  const trimmedNewDomainId = newDomainDraft.domainId.trim();
  const trimmedNewDomainCardTag = newDomainDraft.cardTag.trim();
  const newDomainIdAlreadyExists = trimmedNewDomainId.length > 0 && trimmedNewDomainId in DOMAIN_CONFIG;
  const newDomainIdInvalid = trimmedNewDomainId.length > 0 && !isSafeSlug(trimmedNewDomainId);
  const newDomainCardTagAlreadyExists =
    trimmedNewDomainCardTag.length > 0 &&
    Object.values(DOMAIN_CONFIG).some((config) => config.cardTag.toLowerCase() === trimmedNewDomainCardTag.toLowerCase());
  const newDomainCreateDisabled =
    !trimmedNewDomainId ||
    !newDomainDraft.display.trim() ||
    !trimmedNewDomainCardTag ||
    newDomainIdAlreadyExists ||
    newDomainIdInvalid ||
    newDomainCardTagAlreadyExists ||
    actionPending;

  const previewNode = useMemo<GraphContentNode | null>(() => {
    if (tab === 'new-node') {
      const scaffoldContent = createTemplateContent(newNodeDraft);
      return {
        id: trimmedNewNodeId || 'preview-node',
        kind: newNodeDraft.kind,
        domain: newNodeDraft.domain,
        chronology: newNodeDraft.chronology,
        ...scaffoldContent,
      };
    }

    if (currentNodeRef && draftContent) {
      return {
        ...currentNodeRef,
        ...draftContent,
      };
    }

    return null;
  }, [currentNodeRef, draftContent, newNodeDraft, tab, trimmedNewNodeId]);

  const editorNodeById = useMemo(
    () => new Map(bootstrapNodes.map((node) => [node.id, node])),
    [bootstrapNodes]
  );
  const selectedOpenNodeOption = useMemo(
    () => bootstrapNodes.find((node) => node.id === decodedNodeId) ?? null,
    [bootstrapNodes, decodedNodeId],
  );

  const otherNodeOptions = useMemo(() => {
    if (!currentNodeRef) return [];

    return bootstrapNodes
      .filter((node) => node.id !== currentNodeRef.id)
      .sort((left, right) => {
        const leftInCurrentDomain = left.domain === currentNodeRef.domain;
        const rightInCurrentDomain = right.domain === currentNodeRef.domain;

        if (leftInCurrentDomain !== rightInCurrentDomain) {
          return leftInCurrentDomain ? -1 : 1;
        }

        return sortNodeRefs(left, right);
      });
  }, [bootstrapNodes, currentNodeRef]);

  const timelineConnectionEntries = useMemo(() => {
    void language;
    return currentNodeRef ? buildTimelineConnectionEntries(currentNodeRef, bootstrapNodes) : [];
  }, [bootstrapNodes, currentNodeRef, language]);

  const bioConnectionEntry = useMemo(() => {
    void language;
    return currentNodeRef ? buildBioConnectionEntry(currentNodeRef, bootstrapNodes) : null;
  }, [bootstrapNodes, currentNodeRef, language]);

  const blockedExplicitRelationPeerIds = useMemo(
    () =>
      currentNodeRef
        ? getOccupiedConnectionPeerIds(currentNodeRef, bootstrapNodes, explicitRelations, selectedExplicitRelationIndex)
        : new Set<string>(),
    [bootstrapNodes, currentNodeRef, explicitRelations, selectedExplicitRelationIndex]
  );

  const explicitConnectionEntries = useMemo(() => {
    void language;
    return currentNodeRef
      ? explicitRelations.map((relation, relationIndex) =>
          buildExplicitConnectionEntry(relation, relationIndex, currentNodeRef.id, editorNodeById)
        )
      : [];
  }, [currentNodeRef, editorNodeById, explicitRelations, language]);

  const domainTreemapEntries = useMemo<DomainTreemapEntry[]>(
    () => {
      void language;
      return DOMAIN_ORDER.map((domain) => ({
        domain,
        display: getDisplayDomain(domain),
        cardTag: DOMAIN_CONFIG[domain].cardTag,
        count: bootstrapNodes.filter((node) => node.domain === domain).length,
        removable: bootstrapNodes.every((node) => node.domain !== domain),
      }));
    },
    [bootstrapNodes, language]
  );

  const selectedExplicitRelation =
    selectedExplicitRelationIndex === null ? null : explicitRelations[selectedExplicitRelationIndex] ?? null;
  const selectedExplicitConnection =
    selectedExplicitRelationIndex === null
      ? null
      : explicitConnectionEntries.find((entry) => entry.explicitRelationIndex === selectedExplicitRelationIndex) ?? null;
  const selectedRelationAnchoredSide =
    currentNodeRef && selectedExplicitRelation
      ? selectedExplicitRelation.to === currentNodeRef.id
        ? 'to'
        : 'from'
      : null;
  const selectedOtherNodeId =
    currentNodeRef && selectedExplicitRelation
      ? selectedRelationAnchoredSide === 'from'
        ? selectedExplicitRelation.to
        : selectedExplicitRelation.from
      : '';
  const incompleteExplicitRelationCount = explicitRelations.filter((relation) => !isCompleteExplicitRelation(relation)).length;
  const duplicateExplicitRelationIndexes = useMemo(
    () => findDuplicateExplicitRelationIndexes(currentNodeRef, bootstrapNodes, explicitRelations),
    [bootstrapNodes, currentNodeRef, explicitRelations]
  );
  const duplicateExplicitRelationCount = duplicateExplicitRelationIndexes.size;
  const selectedExplicitRelationIsDuplicate =
    selectedExplicitRelationIndex !== null && duplicateExplicitRelationIndexes.has(selectedExplicitRelationIndex);
  const jsonWriteDisabled =
    Boolean(validation.error) ||
    Boolean(jsonError) ||
    Boolean(explicitRelationsJsonError) ||
    Boolean(currentChronologyError) ||
    actionPending ||
    duplicateExplicitRelationCount > 0;
  const selectableOtherNodeOptions = useMemo(
    () =>
      otherNodeOptions.filter((node) => {
        if (node.id === selectedOtherNodeId) {
          return true;
        }

        return !blockedExplicitRelationPeerIds.has(node.id);
      }),
    [blockedExplicitRelationPeerIds, otherNodeOptions, selectedOtherNodeId]
  );

  const updateDraftContent = (nextContent: GraphNodeContent) => {
    dispatch({
      type: 'apply_draft_content',
      content: nextContent,
      nodeId: decodedNodeId || 'preview-node',
    });
  };

  const handleJsonDraftChange = (
    nextText: string,
    parsedContent: GraphNodeContent | null,
    error: string | null,
  ) => {
    dispatch({
      type: 'edit_json_draft',
      value: nextText,
      nodeId: decodedNodeId || 'preview-node',
      parsedContent: parsedContent ?? undefined,
      error,
    });
  };

  const handleExplicitRelationsJsonDraftChange = (nextText: string) => {
    if (!currentNodeRef) return;

    try {
      const parsed = normalizeExplicitRelationsInput(lenientParseJsonText(nextText), currentNodeRef.id);
      dispatch({
        type: 'edit_explicit_relations_json_draft',
        value: nextText,
        parsedRelations: parsed,
        error: null,
      });
    } catch (error) {
      dispatch({
        type: 'edit_explicit_relations_json_draft',
        value: nextText,
        error: error instanceof Error ? error.message : 'Invalid explicit connections JSON.',
      });
    }
  };

  const updateSelectedExplicitRelation = (
    updater: (relation: EditorExplicitRelation) => EditorExplicitRelation
  ) => {
    if (selectedExplicitRelationIndex === null || !currentNodeRef) return;

    const currentRelation = explicitRelations[selectedExplicitRelationIndex];
    if (!currentRelation) {
      return;
    }

    const nextRelation = anchorExplicitRelationToNode(updater(currentRelation), currentNodeRef.id);
    if (
      wouldCreateDuplicateExplicitRelation(
        currentNodeRef,
        bootstrapNodes,
        explicitRelations,
        nextRelation,
        selectedExplicitRelationIndex,
      )
    ) {
      dispatch({
        type: 'set_status_message',
        message: UI_COPY.nodeEditor.status.duplicateExplicitConnection,
      });
      return;
    }

    dispatch({
      type: 'replace_explicit_relations',
      relations: explicitRelations.map((entry, index) =>
        index === selectedExplicitRelationIndex ? nextRelation : entry
      ),
    });
  };

  const handleOpenNode = (nextNodeId: string) => {
    if (!nextNodeId) {
      navigate('/editor');
      return;
    }
    navigate(`/editor/nodes/${encodeURIComponent(nextNodeId)}`);
  };

  useEffect(() => {
    if (tab === 'new-node') {
      setShowOpenNodeDialog(false);
    }
  }, [tab]);

  const handleDiscardDraft = () => {
    if (!decodedNodeId || !originalContent) return;
    clearStoredNodeDraft(decodedNodeId, language);
    dispatch({ type: 'set_current_node_ref', value: loadedNodeRefRef.current });
    dispatch({ type: 'replace_explicit_relations', relations: loadedExplicitRelationsRef.current });
    dispatch({ type: 'reset_draft_to_original', nodeId: decodedNodeId });
    dispatch({ type: 'set_status_message', message: UI_COPY.nodeEditor.status.discardedDraft });
  };

  const handleWriteToFile = async () => {
    if (!decodedNodeId || !draftContent || !currentNodeRef || validation.error || currentChronologyError) return;
    dispatch({ type: 'set_action_pending', value: true });
    try {
      const normalizedCurrentNode = {
        ...currentNodeRef,
        chronology: normalizeChronologyValue(currentNodeRef.chronology),
      };
      const completeRelations = explicitRelations
        .map((relation) => anchorExplicitRelationToNode(relation, normalizedCurrentNode.id))
        .filter(isCompleteExplicitRelation);

      if (findDuplicateExplicitRelationIndexes(currentNodeRef, bootstrapNodes, completeRelations).size > 0) {
        throw new Error(UI_COPY.nodeEditor.status.duplicateExplicitConnection);
      }

      await saveEditorNode(
        decodedNodeId,
        draftContent,
        normalizedCurrentNode,
        completeRelations,
        language
      );
      dispatch({ type: 'set_current_node_ref', value: normalizedCurrentNode });
      loadedNodeRefRef.current = normalizedCurrentNode;
      loadedExplicitRelationsRef.current = completeRelations;
      clearStoredNodeDraft(decodedNodeId, language);
      clearGraphModelCache();
      clearGraphNodeContentCache();
      dispatch({
        type: 'commit_saved_node',
        node: normalizedCurrentNode,
        content: draftContent,
        resolvedContentLanguage: language,
      });
      const successMessage =
        incompleteExplicitRelationCount > 0
          ? UI_COPY.nodeEditor.status.wroteNodeFileSkipped(incompleteExplicitRelationCount)
          : UI_COPY.nodeEditor.status.wroteNodeFile;
      dispatch({ type: 'set_status_message', message: successMessage });
      dispatch({ type: 'set_bootstrap_error', error: null });
      dispatch({
        type: 'upsert_bootstrap_node',
        node: {
          ...normalizedCurrentNode,
          title: draftContent.title,
          subtitle: draftContent.subtitle,
        },
      });
      return successMessage;
    } catch (error) {
      const message = error instanceof Error ? error.message : UI_COPY.nodeEditor.status.failedWriteNodeFile;
      dispatch({ type: 'set_status_message', message });
      throw new Error(message);
    } finally {
      dispatch({ type: 'set_action_pending', value: false });
    }
  };

  const handleCreateNode = async () => {
    const nodeId = newNodeDraft.nodeId.trim();
    if (!nodeId || newNodeIdAlreadyExists || newNodeIdInvalid || newNodeChronologyError) return;

    dispatch({ type: 'set_action_pending', value: true });
    try {
      const chronology = normalizeChronologyValue(newNodeDraft.chronology);
      const content = createTemplateContent(newNodeDraft);
      const payload = await createEditorNode({
        node: {
          id: nodeId,
          domain: newNodeDraft.domain,
          kind: newNodeDraft.kind,
          chronology,
        },
        content,
      });
      clearGraphModelCache();
      clearGraphNodeContentCache();
      dispatch({
        type: 'upsert_bootstrap_node',
        node: {
          ...payload.node,
          title: content.title,
          subtitle: content.subtitle,
        },
      });
      dispatch({ type: 'set_bootstrap_error', error: null });
      dispatch({ type: 'set_status_message', message: UI_COPY.nodeEditor.status.createdNode(nodeId) });
      navigate(`/editor/nodes/${encodeURIComponent(nodeId)}`);
    } catch (error) {
      dispatch({
        type: 'set_status_message',
        message: error instanceof Error ? error.message : UI_COPY.nodeEditor.status.failedCreateNode,
      });
    } finally {
      dispatch({ type: 'set_action_pending', value: false });
    }
  };

  const handleSelectExplicitRelation = (relationIndex: number) => {
    dispatch({
      type: 'set_selected_explicit_relation_index',
      index: selectedExplicitRelationIndex === relationIndex ? null : relationIndex,
    });
  };

  const handleRemoveExplicitRelation = (relationIndex: number) => {
    dispatch({ type: 'remove_explicit_relation', index: relationIndex });
  };

  const handleAddExplicitRelation = () => {
    if (!currentNodeRef) return;
    dispatch({
      type: 'append_explicit_relation',
      relation: createEmptyExplicitRelation(currentNodeRef.id),
      select: true,
    });
  };

  const renderConnectedNodesSection = (allowInspect: boolean) => {
    if (!currentNodeRef) {
      return null;
    }

    return (
      <section
        style={{
          marginTop: '0.35rem',
          maxWidth: DETAIL_SECTION_WIDTH,
          marginInline: 'auto',
          paddingBottom: '2rem',
        }}
      >
        {renderSectionHeading(UI_COPY.nodeDetailPage.sections.connectedNodes)}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
            gap: '0.85rem',
          }}
        >
          {bioConnectionEntry && (
            <ConnectedNodeCard
              key={bioConnectionEntry.key}
              entry={bioConnectionEntry}
              onNavigate={() => handleOpenNode(bioConnectionEntry.relatedNodeId)}
            />
          )}
          {timelineConnectionEntries.map((entry) => (
            <ConnectedNodeCard
              key={entry.key}
              entry={entry}
              onNavigate={() => handleOpenNode(entry.relatedNodeId)}
            />
          ))}
          {explicitConnectionEntries.map((entry) => {
            const relationIndex = entry.explicitRelationIndex;
            const canNavigate = Boolean(entry.relatedNodeId) && editorNodeById.has(entry.relatedNodeId);

            return (
              <ConnectedNodeCard
                key={entry.key}
                entry={entry}
                selected={relationIndex === selectedExplicitRelationIndex}
                onNavigate={canNavigate ? () => handleOpenNode(entry.relatedNodeId) : undefined}
                onInspect={
                  allowInspect && relationIndex !== undefined
                    ? () => handleSelectExplicitRelation(relationIndex)
                    : undefined
                }
              />
            );
          })}
          <AddConnectedNodeCard onClick={handleAddExplicitRelation} />
        </div>
      </section>
    );
  };

  const handleCreateDomain = async () => {
    if (newDomainCreateDisabled) return;
    dispatch({ type: 'set_action_pending', value: true });
    try {
      const domainId = newDomainDraft.domainId.trim();
      await createEditorDomain(newDomainDraft);
      window.sessionStorage.setItem(EDITOR_PENDING_NEW_DOMAIN_KEY, domainId);
      dispatch({ type: 'set_status_message', message: UI_COPY.nodeEditor.status.createdDomainOpening(domainId) });
      dispatch({ type: 'set_bootstrap_error', error: null });
      window.setTimeout(() => {
        const editorUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/editor`;
        window.location.assign(editorUrl);
      }, 200);
    } catch (error) {
      dispatch({
        type: 'set_status_message',
        message: error instanceof Error ? error.message : UI_COPY.nodeEditor.status.failedCreateDomain,
      });
    } finally {
      dispatch({ type: 'set_action_pending', value: false });
    }
  };

  const handleDeleteDomain = async (entry: DomainTreemapEntry) => {
    if (!entry.removable) return;

    dispatch({ type: 'set_action_pending', value: true });
    try {
      await deleteEditorDomain({ domainId: entry.domain });
      dispatch({ type: 'set_status_message', message: UI_COPY.nodeEditor.status.deletedDomainReloading(entry.domain) });
      dispatch({ type: 'set_bootstrap_error', error: null });
      window.setTimeout(() => {
        const editorUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/editor`;
        window.location.assign(editorUrl);
      }, 200);
      return UI_COPY.nodeEditor.status.deletedDomainReloading(entry.domain);
    } catch (error) {
      const message = error instanceof Error ? error.message : UI_COPY.nodeEditor.status.failedDeleteDomain;
      dispatch({ type: 'set_status_message', message });
      throw new Error(message);
    } finally {
      dispatch({ type: 'set_action_pending', value: false });
    }
  };

  const handleDeleteNode = async () => {
    if (!decodedNodeId) return;

    dispatch({ type: 'set_action_pending', value: true });
    try {
      await deleteEditorNode({ nodeId: decodedNodeId });
      clearGraphModelCache();
      clearGraphNodeContentCache();
      for (const option of LANGUAGE_OPTIONS) {
        clearStoredNodeDraft(decodedNodeId, option.id);
      }
      dispatch({
        type: 'set_bootstrap_nodes',
        nodes: bootstrapNodes.filter((node) => node.id !== decodedNodeId),
      });
      dispatch({
        type: 'set_status_message',
        message: UI_COPY.nodeEditor.status.deletedNodeReturning(decodedNodeId),
      });
      navigate('/editor');
      return UI_COPY.nodeEditor.status.deletedNodeReturning(decodedNodeId);
    } catch (error) {
      const message = error instanceof Error ? error.message : UI_COPY.nodeEditor.status.failedDeleteNode;
      dispatch({ type: 'set_status_message', message });
      throw new Error(message);
    } finally {
      dispatch({ type: 'set_action_pending', value: false });
    }
  };

  const openDangerDialog = (config: DangerDialogConfig) => {
    setDangerDialog({
      ...config,
      status: 'confirm',
      resultMessage: undefined,
    });
  };

  const closeDangerDialog = () => {
    setDangerDialog((current) => (current?.status === 'pending' ? current : null));
  };

  const handleDangerDialogProceed = async () => {
    if (!dangerDialog || dangerDialog.status === 'pending') return;

    if (!dangerDialog.showResult) {
      try {
        await dangerDialog.onProceed();
        setDangerDialog(null);
      } catch (error) {
        setDangerDialog((current) =>
          current
            ? {
                ...current,
                status: 'error',
                resultMessage: error instanceof Error ? error.message : UI_COPY.nodeEditor.confirmations.actionFailed,
              }
            : current
        );
      }
      return;
    }

    setDangerDialog((current) =>
      current
        ? {
            ...current,
            status: 'pending',
            resultMessage: current.pendingMessage ?? UI_COPY.nodeEditor.common.working,
          }
        : current
    );

    try {
      const resultMessage = await dangerDialog.onProceed();
      setDangerDialog((current) =>
        current
          ? {
              ...current,
              status: 'success',
              resultMessage: resultMessage ?? UI_COPY.nodeEditor.confirmations.actionCompleted,
            }
          : current
      );
    } catch (error) {
      setDangerDialog((current) =>
        current
          ? {
              ...current,
              status: 'error',
              resultMessage: error instanceof Error ? error.message : UI_COPY.nodeEditor.confirmations.actionFailed,
            }
          : current
      );
    }
  };

  // Shared button style variants
  const editorPageStyle = {
    minHeight: '100vh',
    color: 'var(--color-text)',
    ['--greenpage-detail-action-border-width-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleWidth,
    ['--greenpage-detail-action-border-opacity-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleOpacity,
    ['--greenpage-detail-action-border-width-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeWidth,
    ['--greenpage-detail-action-border-opacity-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeOpacity,
    ['--greenpage-detail-action-ring-shadow-prefix' as const]: getHighlightBorderShadowPrefix(
      DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION
    ),
  } as CSSProperties;

  return (
    <div className="greenpage-node-editor" style={editorPageStyle}>
      <div style={{ maxWidth: '100rem', margin: '0 auto', padding: '1.5rem 1.2rem 3rem' }}>
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{UI_COPY.nodeEditor.title}</div>
            <div style={{ marginTop: '0.3rem', opacity: 0.62, fontSize: '0.88rem' }}>
              {editorSubtitle}
            </div>
          </div>
          <ThemePicker theme={theme} setTheme={setTheme} variant="inline" />
        </div>

        {/* Main two-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(20rem, 28rem) minmax(0, 1fr)',
            gap: '0.9rem',
            alignItems: 'start',
          }}
        >
          {/* ── Left sidebar ── */}
          <div
            style={{
              position: 'sticky',
              top: '1rem',
              alignSelf: 'start',
              padding: '1rem',
              borderRadius: '20px',
              background: 'color-mix(in srgb, var(--color-background) 92%, white 8%)',
            }}
          >
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {availableTabs.map((tabId) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => dispatch({ type: 'set_tab', tab: tabId })}
                  style={{
                    padding: '0.38rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: tab === tabId ? 600 : 400,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    border: '1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent)',
                    background: tab === tabId ? 'var(--color-text)' : 'transparent',
                    color: tab === tabId ? 'var(--color-background)' : 'var(--color-text)',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  {getTabLabel(tabId)}
                </button>
              ))}
            </div>

            {/* Node selector */}
            {tab !== 'new-domain' && (
              <FieldShell>
                <ControlLabel>{UI_COPY.nodeEditor.common.openNode}</ControlLabel>
                <button
                  type="button"
                  onClick={() => setShowOpenNodeDialog(true)}
                  disabled={tab === 'new-node'}
                  style={
                    tab === 'new-node'
                      ? { ...inputStyle(), ...btnDisabled, textAlign: 'left' }
                      : {
                          ...inputStyle(),
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.8rem',
                        }
                  }
                >
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        lineHeight: 1.35,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {selectedOpenNodeOption
                        ? getEditorNodeTitle(selectedOpenNodeOption, selectedOpenNodeOption.id)
                        : UI_COPY.nodeEditor.common.chooseNode}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.16rem',
                        fontSize: '0.74rem',
                        opacity: 0.62,
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {selectedOpenNodeOption
                        ? `${selectedOpenNodeOption.domain} / ${selectedOpenNodeOption.id}${selectedOpenNodeOption.subtitle ? ` · ${selectedOpenNodeOption.subtitle}` : ''}`
                        : UI_COPY.nodeEditor.common.browseNodes}
                    </span>
                  </span>
                  <span style={{ opacity: 0.45, fontSize: '0.86rem', flexShrink: 0 }}>▾</span>
                </button>
              </FieldShell>
            )}

            {/* Status / error banners */}
            {statusMessage && (
              <div
                style={{
                  marginTop: '0.8rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  background: 'color-mix(in srgb, var(--color-background) 82%, white 18%)',
                  fontSize: '0.83rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>{statusMessage}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'set_status_message', message: null })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', opacity: 0.5, padding: 0, fontSize: '0.85rem', fontFamily: 'inherit' }}
                >
                  ✕
                </button>
              </div>
            )}
            {bootstrapError && (
              <div
                style={{
                  marginTop: '0.8rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  background: 'rgba(220,20,60,0.08)',
                  color: 'crimson',
                  fontSize: '0.83rem',
                }}
              >
                {bootstrapError}
              </div>
            )}
            {isFallbackContent && (
              <div
                style={{
                  marginTop: '0.8rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  background: 'rgba(180,120,0,0.08)',
                  color: 'goldenrod',
                  fontSize: '0.83rem',
                }}
              >
                {editorCanMutateProject
                  ? UI_COPY.nodeEditor.fallbackContentWriteNotice(
                      messages.appShell.languageOptions[language],
                      messages.appShell.languageOptions[resolvedContentLanguage],
                    )
                  : UI_COPY.nodeEditor.fallbackContentReadOnlyNotice(
                      messages.appShell.languageOptions[language],
                      messages.appShell.languageOptions[resolvedContentLanguage],
                    )}
              </div>
            )}

            {/* ── Edit tab ── */}
            {tab === 'content' && (
              <div>
                {!draftContent || !currentNodeRef ? (
                  <div style={{ marginTop: '1rem', opacity: 0.65, fontSize: '0.88rem' }}>
                    {loadingNode ? UI_COPY.nodeEditor.common.loading : UI_COPY.nodeEditor.contentTab.emptyState}
                  </div>
                ) : (
                  <>
                    {/* Read-only node info */}
                    <div
                      style={{
                        marginTop: '0.9rem',
                        padding: '0.55rem 0.7rem',
                        borderRadius: '10px',
                        background: 'color-mix(in srgb, var(--color-background) 85%, white 15%)',
                        fontSize: '0.82rem',
                        opacity: 0.8,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{currentNodeRef.domain}</span>
                      <span style={{ opacity: 0.55 }}> / </span>
                      {currentNodeRef.id}
                    </div>

                    <FieldShell>
                      <ControlLabel>{UI_COPY.nodeEditor.contentTab.chronology}</ControlLabel>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={currentNodeRef.chronology}
                        onChange={(event) =>
                          dispatch({
                            type: 'merge_current_node_ref',
                            patch: { chronology: event.target.value },
                          })
                        }
                        placeholder={CHRONOLOGY_FORMAT_HINT}
                        style={inputStyle()}
                      />
                      <div
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.74rem',
                          color: currentChronologyError ? 'crimson' : 'var(--color-text-subtle)',
                          lineHeight: 1.45,
                        }}
                      >
                        {currentChronologyError ?? CHRONOLOGY_FORMAT_HINT}
                      </div>
                    </FieldShell>

                    <FieldShell>
                      <ControlLabel>{UI_COPY.nodeEditor.contentTab.tags}</ControlLabel>
                      <input
                        value={tagInput}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          dispatch({ type: 'set_tag_input', value: nextValue });
                          updateDraftContent({ ...draftContent, tags: parseCommaSeparatedTags(nextValue) });
                        }}
                        onBlur={() => {
                          const normalized = serializeTags(parseCommaSeparatedTags(tagInput));
                          dispatch({ type: 'set_tag_input', value: normalized });
                        }}
                        placeholder={UI_COPY.nodeEditor.contentTab.tagsPlaceholder}
                        style={inputStyle()}
                      />
                    </FieldShell>

                    <div style={{ marginTop: '0.85rem' }}>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'set_show_header_fields', value: !showHeaderFields })}
                        className="greenpage-editor-text-toggle"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          opacity: 0.78,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          padding: 0,
                          fontFamily: 'inherit',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <span style={{ opacity: 0.55, fontSize: '0.7rem' }}>{showHeaderFields ? '▾' : '▸'}</span>
                        {UI_COPY.nodeEditor.contentTab.header}
                      </button>

                      {showHeaderFields && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <FieldShell>
                            <ControlLabel>{UI_COPY.nodeEditor.contentTab.title}</ControlLabel>
                            <input
                              value={draftContent.title}
                              onChange={(event) => updateDraftContent({ ...draftContent, title: event.target.value })}
                              style={inputStyle()}
                            />
                          </FieldShell>
                          <FieldShell>
                            <ControlLabel>{UI_COPY.nodeEditor.contentTab.subtitle}</ControlLabel>
                            <input
                              value={draftContent.subtitle ?? ''}
                              onChange={(event) =>
                                updateDraftContent({ ...draftContent, subtitle: event.target.value || undefined })
                              }
                              style={inputStyle()}
                            />
                          </FieldShell>
                          <FieldShell>
                            <ControlLabel>{UI_COPY.nodeEditor.contentTab.summary}</ControlLabel>
                            <textarea
                              value={draftContent.summary}
                              onChange={(event) => updateDraftContent({ ...draftContent, summary: event.target.value })}
                              rows={4}
                              style={inputStyle(true)}
                            />
                          </FieldShell>
                        </div>
                      )}
                    </div>

                    {/* Collapsible metadata & hero */}
                    <div style={{ marginTop: '0.85rem' }}>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'set_show_meta', value: !showMeta })}
                        className="greenpage-editor-text-toggle"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          opacity: 0.78,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          padding: 0,
                          fontFamily: 'inherit',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <span style={{ opacity: 0.55, fontSize: '0.7rem' }}>{showMeta ? '▾' : '▸'}</span>
                        {UI_COPY.nodeEditor.contentTab.metadataHero}
                      </button>

                      {showMeta && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <FieldShell>
                            <ControlLabel>{UI_COPY.nodeEditor.contentTab.heroImageSrc}</ControlLabel>
                            <input
                              value={draftContent.hero?.image?.src ?? ''}
                              onChange={(event) =>
                                updateDraftContent({
                                  ...draftContent,
                                  hero: event.target.value
                                    ? {
                                        image: {
                                          src: event.target.value,
                                          alt: draftContent.hero?.image?.alt ?? UI_COPY.nodeEditor.contentTab.fallbackHeroAlt,
                                          caption: draftContent.hero?.image?.caption,
                                        },
                                      }
                                    : undefined,
                                })
                              }
                              placeholder={UI_COPY.nodeEditor.contentTab.heroPlaceholder}
                              style={inputStyle()}
                            />
                          </FieldShell>

                          {draftContent.hero?.image && (
                            <>
                              <FieldShell>
                                <ControlLabel>{UI_COPY.nodeEditor.contentTab.heroAlt}</ControlLabel>
                                <input
                                  value={draftContent.hero.image.alt}
                                  onChange={(event) =>
                                    updateDraftContent({
                                      ...draftContent,
                                      hero: { image: { ...draftContent.hero!.image!, alt: event.target.value } },
                                    })
                                  }
                                  style={inputStyle()}
                                />
                              </FieldShell>
                              <FieldShell>
                                <ControlLabel>{UI_COPY.nodeEditor.contentTab.heroCaption}</ControlLabel>
                                <input
                                  value={draftContent.hero.image.caption ?? ''}
                                  onChange={(event) =>
                                    updateDraftContent({
                                      ...draftContent,
                                      hero: {
                                        image: {
                                          ...draftContent.hero!.image!,
                                          caption: event.target.value || undefined,
                                        },
                                      },
                                    })
                                  }
                                  style={inputStyle()}
                                />
                              </FieldShell>
                            </>
                          )}

                          {/* Meta grid */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '0.5rem',
                              marginTop: '0.85rem',
                            }}
                          >
                            {(
                              [
                                { key: 'dateLabel', label: UI_COPY.nodeEditor.contentTab.metadataFields.date },
                                { key: 'location', label: UI_COPY.nodeEditor.contentTab.metadataFields.place },
                                { key: 'readingTime', label: UI_COPY.nodeEditor.contentTab.metadataFields.readTime },
                                { key: 'status', label: UI_COPY.nodeEditor.contentTab.metadataFields.status },
                              ] as const
                            ).map(({ key, label }) => (
                              <div key={key}>
                                <ControlLabel>{label}</ControlLabel>
                                <input
                                  value={(draftContent.meta as Record<string, string | undefined> | undefined)?.[key] ?? ''}
                                  onChange={(event) =>
                                    updateDraftContent({
                                      ...draftContent,
                                      meta: { ...draftContent.meta, [key]: event.target.value || undefined },
                                    })
                                  }
                                  style={{ ...inputStyle(), padding: '0.48rem 0.58rem', fontSize: '0.82rem' }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '0.95rem' }}>
                      <div
                        style={{
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          marginBottom: '0.35rem',
                          opacity: 0.78,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {UI_COPY.nodeEditor.contentTab.connectionDetails}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.62, lineHeight: 1.55 }}>
                        {UI_COPY.nodeEditor.contentTab.connectionDetailsHint}
                      </div>
                      {incompleteExplicitRelationCount > 0 && (
                        <div
                          style={{
                            marginTop: '0.45rem',
                            fontSize: '0.76rem',
                            opacity: 0.68,
                            lineHeight: 1.5,
                          }}
                        >
                          {UI_COPY.nodeEditor.contentTab.incompleteConnectionsHint}
                        </div>
                      )}
                      {duplicateExplicitRelationCount > 0 && (
                        <div
                          style={{
                            marginTop: '0.45rem',
                            fontSize: '0.76rem',
                            color: 'crimson',
                            lineHeight: 1.5,
                          }}
                        >
                          {UI_COPY.nodeEditor.contentTab.duplicateConnectionsHint}
                        </div>
                      )}
                      {selectedExplicitRelationIndex !== null && selectedExplicitRelation ? (
                        <div
                          style={{
                            marginTop: '0.65rem',
                            padding: '0.7rem',
                            borderRadius: '12px',
                            background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: '0.6rem',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  opacity: 0.72,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                {UI_COPY.nodeEditor.contentTab.connectionEditing}
                              </div>
                              <div style={{ marginTop: '0.22rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
                                {selectedExplicitConnection?.relatedNodeTitle ?? UI_COPY.nodeEditor.contentTab.untitledConnection}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginLeft: 'auto' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  dispatch({ type: 'set_selected_explicit_relation_index', index: null })
                                }
                                style={{
                                  padding: '0.28rem 0.7rem',
                                  borderRadius: '999px',
                                  border: '1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent)',
                                  background: 'transparent',
                                  color: 'var(--color-text)',
                                  cursor: 'pointer',
                                  fontSize: '0.76rem',
                                  fontFamily: 'inherit',
                                  fontWeight: 600,
                                  opacity: 0.82,
                                }}
                              >
                                {UI_COPY.nodeEditor.common.done}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedExplicitRelationIndex === null) return;
                                  openDangerDialog({
                                    actionDescription: UI_COPY.nodeEditor.confirmations.deleteExplicitConnection,
                                    proceedLabel: UI_COPY.nodeEditor.common.delete,
                                    tone: 'danger',
                                    onProceed: () => {
                                      handleRemoveExplicitRelation(selectedExplicitRelationIndex);
                                    },
                                  });
                                }}
                                style={{
                                  padding: '0.28rem 0.7rem',
                                  borderRadius: '999px',
                                  border: '1px solid color-mix(in srgb, crimson 24%, transparent)',
                                  background: 'transparent',
                                  color: 'color-mix(in srgb, crimson 72%, var(--color-text))',
                                  cursor: 'pointer',
                                  fontSize: '0.76rem',
                                  fontFamily: 'inherit',
                                  fontWeight: 600,
                                  opacity: 0.82,
                                }}
                              >
                                {UI_COPY.nodeEditor.common.delete}
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.65rem' }}>
                            <div>
                              <ControlLabel>{UI_COPY.nodeEditor.contentTab.currentNode}</ControlLabel>
                              <div
                                style={{
                                  ...inputStyle(),
                                  display: 'flex',
                                  alignItems: 'center',
                                  minHeight: '2.55rem',
                                  opacity: 0.8,
                                }}
                              >
                                {currentNodeRef ? formatEditorNodeOptionLabel(editorNodeById.get(currentNodeRef.id) ?? currentNodeRef) : ''}
                              </div>
                              <div style={{ marginTop: '0.3rem', fontSize: '0.74rem', opacity: 0.62, lineHeight: 1.45 }}>
                                {selectedRelationAnchoredSide ? UI_COPY.nodeEditor.contentTab.currentNodeAnchorHint(selectedRelationAnchoredSide) : null}
                              </div>
                            </div>
                            <div>
                              <ControlLabel>{UI_COPY.nodeEditor.contentTab.otherNode}</ControlLabel>
                              <SearchableNodePicker
                                options={selectableOtherNodeOptions}
                                value={selectedOtherNodeId}
                                currentDomain={currentNodeRef?.domain}
                                onSelect={(nodeId) =>
                                  updateSelectedExplicitRelation((entry) =>
                                    selectedRelationAnchoredSide === 'from'
                                      ? { ...entry, to: nodeId }
                                      : { ...entry, from: nodeId }
                                  )
                                }
                                placeholder={UI_COPY.nodeEditor.contentTab.otherNodePlaceholder}
                              />
                              <div style={{ marginTop: '0.3rem', fontSize: '0.74rem', opacity: 0.62, lineHeight: 1.45 }}>
                                {selectedRelationAnchoredSide === 'from'
                                  ? UI_COPY.nodeEditor.contentTab.otherNodeDirectionFrom
                                  : UI_COPY.nodeEditor.contentTab.otherNodeDirectionTo}
                              </div>
                            </div>
                            <div>
                              <ControlLabel>{UI_COPY.nodeEditor.contentTab.kind}</ControlLabel>
                              <select
                                value={selectedExplicitRelation.kind}
                                onChange={(event) =>
                                  updateSelectedExplicitRelation((entry) => ({
                                    ...entry,
                                    kind: event.target.value as EditorExplicitRelation['kind'],
                                  }))
                                }
                                style={inputStyle()}
                              >
                                {RELATION_KIND_OPTIONS.map((kind) => (
                                  <option key={kind} value={kind}>
                                    {kind}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <ControlLabel>{UI_COPY.nodeEditor.contentTab.strength}</ControlLabel>
                              <select
                                value={selectedExplicitRelation.strength}
                                onChange={(event) =>
                                  updateSelectedExplicitRelation((entry) => ({
                                    ...entry,
                                    strength: Number(event.target.value) as 1 | 2 | 3,
                                  }))
                                }
                                style={inputStyle()}
                              >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                              </select>
                            </div>
                          </div>

                          <FieldShell>
                            <ControlLabel>{UI_COPY.nodeEditor.contentTab.label}</ControlLabel>
                            <input
                              value={selectedExplicitRelation.label}
                              onChange={(event) => updateSelectedExplicitRelation((entry) => ({ ...entry, label: event.target.value }))}
                              style={inputStyle()}
                            />
                          </FieldShell>
                          {selectedExplicitRelationIsDuplicate && (
                            <div
                              style={{
                                marginTop: '0.45rem',
                                fontSize: '0.76rem',
                                color: 'crimson',
                                lineHeight: 1.5,
                              }}
                            >
                              {UI_COPY.nodeEditor.contentTab.duplicateConnectionSelected}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: '0.65rem',
                            padding: '0.7rem',
                            borderRadius: '12px',
                            background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
                            fontSize: '0.8rem',
                            opacity: 0.72,
                            lineHeight: 1.55,
                          }}
                        >
                          {UI_COPY.nodeEditor.contentTab.explicitConnectionEmpty}
                        </div>
                      )}
                    </div>

                    {/* Hint */}
                    <div style={{ marginTop: '0.9rem', fontSize: '0.8rem', opacity: 0.6, lineHeight: 1.55 }}>
                      {UI_COPY.nodeEditor.contentTab.sidebarHint}
                    </div>

                    {/* Action buttons */}
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {editorCanMutateProject ? (
                        <button
                          type="button"
                          onClick={() =>
                            openDangerDialog({
                              actionDescription: UI_COPY.nodeEditor.confirmations.writeChanges,
                              proceedLabel: UI_COPY.nodeEditor.common.proceed,
                              tone: 'primary',
                              showResult: true,
                              pendingMessage: UI_COPY.nodeEditor.confirmations.writingToFile,
                              onProceed: handleWriteToFile,
                            })
                          }
                          disabled={Boolean(validation.error) || Boolean(currentChronologyError) || actionPending || duplicateExplicitRelationCount > 0}
                          style={
                            Boolean(validation.error) || Boolean(currentChronologyError) || actionPending || duplicateExplicitRelationCount > 0
                              ? { ...btnPrimary, ...btnDisabled }
                              : btnPrimary
                          }
                        >
                          {UI_COPY.nodeEditor.contentTab.writeToFile}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          openDangerDialog({
                            actionDescription: UI_COPY.nodeEditor.confirmations.resetDraft,
                            proceedLabel: UI_COPY.nodeEditor.contentTab.reset,
                            tone: 'danger',
                            onProceed: () => {
                              handleDiscardDraft();
                            },
                          })
                        }
                        disabled={!originalContent}
                        style={!originalContent ? { ...btnDanger, ...btnDisabled } : btnDanger}
                      >
                        {UI_COPY.nodeEditor.contentTab.reset}
                      </button>
                      {editorCanMutateProject ? (
                        <button
                          type="button"
                          onClick={() =>
                            openDangerDialog({
                              actionDescription: UI_COPY.nodeEditor.confirmations.deleteNode(decodedNodeId),
                              proceedLabel: UI_COPY.nodeEditor.contentTab.deleteNode,
                              tone: 'danger',
                              showResult: true,
                              pendingMessage: UI_COPY.nodeEditor.confirmations.deletingNode,
                              onProceed: handleDeleteNode,
                            })
                          }
                          disabled={!decodedNodeId || actionPending}
                          style={!decodedNodeId || actionPending ? { ...btnDanger, ...btnDisabled } : btnDanger}
                        >
                          {UI_COPY.nodeEditor.contentTab.deleteNode}
                        </button>
                      ) : null}
                    </div>
                    {validation.error && (
                      <div style={{ marginTop: '0.6rem', color: 'crimson', fontSize: '0.82rem' }}>
                        {validation.error}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── JSON tab ── */}
            {tab === 'json' && (
              <div style={{ marginTop: '0.85rem' }}>
                {!decodedNodeId || !draftContent ? (
                  <div style={{ opacity: 0.65, fontSize: '0.88rem' }}>{UI_COPY.nodeEditor.jsonTab.emptyState}</div>
                ) : (
                  <>
                    <div style={{ marginTop: '0.1rem' }}>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'set_show_json_content', value: !showJsonContent })}
                        className="greenpage-editor-text-toggle"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          opacity: 0.78,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          padding: 0,
                          fontFamily: 'inherit',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <span style={{ opacity: 0.55, fontSize: '0.7rem' }}>{showJsonContent ? '▾' : '▸'}</span>
                        {UI_COPY.nodeEditor.jsonTab.contentJson}
                      </button>
                      {showJsonContent && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <JsonEditorPanel
                            hint={UI_COPY.nodeEditor.jsonTab.contentJsonHint}
                            text={jsonDraft}
                            nodeId={decodedNodeId}
                            jsonError={jsonError}
                            onChangeText={handleJsonDraftChange}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'set_show_json_connections', value: !showJsonConnections })}
                        className="greenpage-editor-text-toggle"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          opacity: 0.78,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          padding: 0,
                          fontFamily: 'inherit',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <span style={{ opacity: 0.55, fontSize: '0.7rem' }}>{showJsonConnections ? '▾' : '▸'}</span>
                        {UI_COPY.nodeEditor.jsonTab.explicitConnectionsJson}
                      </button>
                      {showJsonConnections && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', opacity: 0.62, lineHeight: 1.55 }}>
                            {UI_COPY.nodeEditor.jsonTab.explicitConnectionsJsonHint}
                          </div>
                          <textarea
                            value={explicitRelationsJsonDraft}
                            rows={12}
                            style={{
                              width: '100%',
                              padding: '0.6rem 0.72rem',
                              borderRadius: '10px',
                              border: '1px solid color-mix(in srgb, var(--color-secondary) 34%, transparent)',
                              background: 'transparent',
                              color: 'var(--color-text)',
                              fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                              fontSize: '0.8rem',
                              lineHeight: 1.6,
                              resize: 'vertical',
                            }}
                            onChange={(event) => handleExplicitRelationsJsonDraftChange(event.target.value)}
                          />
                          {explicitRelationsJsonError && (
                            <div style={{ marginTop: '0.55rem', color: 'crimson', fontSize: '0.82rem' }}>
                              {explicitRelationsJsonError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {editorCanMutateProject ? (
                        <button
                          type="button"
                          onClick={() =>
                            openDangerDialog({
                              actionDescription: UI_COPY.nodeEditor.confirmations.writeJsonChanges,
                              proceedLabel: UI_COPY.nodeEditor.common.proceed,
                              tone: 'primary',
                              showResult: true,
                              pendingMessage: UI_COPY.nodeEditor.confirmations.writingToFile,
                              onProceed: handleWriteToFile,
                            })
                          }
                          disabled={jsonWriteDisabled}
                          style={jsonWriteDisabled ? { ...btnPrimary, ...btnDisabled } : btnPrimary}
                        >
                          {UI_COPY.nodeEditor.jsonTab.writeToFile}
                        </button>
                      ) : null}
                    </div>
                    {(validation.error || currentChronologyError || duplicateExplicitRelationCount > 0) && (
                      <div style={{ marginTop: '0.6rem', color: 'crimson', fontSize: '0.82rem', lineHeight: 1.55 }}>
                        {validation.error ??
                          currentChronologyError ??
                          (duplicateExplicitRelationCount > 0 ? UI_COPY.nodeEditor.contentTab.duplicateConnectionsHint : null)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── New Node tab ── */}
            {tab === 'new-node' && (
              <NewNodeTab
                newNodeDraft={newNodeDraft}
                newNodeIdAlreadyExists={newNodeIdAlreadyExists}
                newNodeIdInvalid={newNodeIdInvalid}
                newNodeChronologyError={newNodeChronologyError}
                newNodeCreateDisabled={newNodeCreateDisabled}
                nodeTemplateOptions={nodeTemplateOptions}
                dispatch={dispatch}
                onCreateNode={handleCreateNode}
              />
            )}

            {/* ── New Domain tab ── */}
            {tab === 'new-domain' && (
              <NewDomainTab
                newDomainDraft={newDomainDraft}
                newDomainIdAlreadyExists={newDomainIdAlreadyExists}
                newDomainIdInvalid={newDomainIdInvalid}
                newDomainCardTagAlreadyExists={newDomainCardTagAlreadyExists}
                newDomainCreateDisabled={newDomainCreateDisabled}
                dispatch={dispatch}
                onCreateDomain={handleCreateDomain}
              />
            )}
          </div>

          {/* ── Right preview / editor panel ── */}
          <div
            style={{
              minHeight: tab === 'new-domain' ? 'auto' : '80vh',
              height: tab === 'new-domain' ? '100%' : 'auto',
              alignSelf: tab === 'new-domain' ? 'stretch' : 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: '1rem',
              borderRadius: '20px',
              background: 'color-mix(in srgb, var(--color-background) 94%, white 6%)',
            }}
          >
            {/* Panel header */}
            <div
              style={{
                marginBottom: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                  {tab === 'content' ? UI_COPY.nodeEditor.rightPanel.articleEditor : tab === 'new-domain' ? UI_COPY.nodeEditor.domainStats.title : UI_COPY.nodeEditor.rightPanel.livePreview}
                </div>
                <div style={{ marginTop: '0.2rem', opacity: 0.6, fontSize: '0.82rem' }}>
                  {tab === 'new-domain'
                    ? UI_COPY.nodeEditor.domainStats.subtitle(bootstrapNodes.length, domainTreemapEntries.length)
                    : previewNode
                      ? `${previewNode.domain} / ${previewNode.id}`
                      : previewSelectionHint}
                </div>
              </div>
              <PreviewPanelLanguageToggle />
            </div>

            {/* Content editor (inline editing mode) */}
            {tab === 'new-domain' ? (
              <DomainTreemap
                entries={domainTreemapEntries}
                onDeleteDomain={(entry) =>
                  openDangerDialog({
                    actionDescription: UI_COPY.nodeEditor.confirmations.deleteDomain(entry.domain),
                    proceedLabel: UI_COPY.nodeEditor.common.delete,
                    tone: 'danger',
                    showResult: true,
                    pendingMessage: UI_COPY.nodeEditor.confirmations.deletingDomain,
                    onProceed: () => handleDeleteDomain(entry),
                  })
                }
              />
            ) : previewNode && tab === 'content' && draftContent ? (
              <div style={{ minHeight: '100%', color: 'var(--color-text)' }}>
                {/* Header card */}
                <section
                  style={{
                    maxWidth: DETAIL_SECTION_WIDTH,
                    marginInline: 'auto',
                    padding: '2.3rem 2rem 2.35rem',
                    borderRadius: '34px',
                    background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
                  }}
                >
                  <div
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      opacity: 0.74,
                      fontSize: '0.68rem',
                    }}
                  >
                    {getDisplayDomain(previewNode.domain)}
                  </div>
                  <h1
                    style={{
                      margin: '0.45rem 0 0',
                      fontSize: 'clamp(2.35rem, 5vw, 4rem)',
                      lineHeight: 0.96,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {draftContent.title}
                  </h1>
                  {draftContent.subtitle && (
                    <div
                      style={{
                        marginTop: '0.9rem',
                        fontSize: '1.08rem',
                        opacity: 0.8,
                      }}
                    >
                      {draftContent.subtitle}
                    </div>
                  )}
                  <p
                    style={{
                      margin: '1.2rem 0 0',
                      maxWidth: DETAIL_READING_WIDTH,
                      fontSize: '1.02rem',
                      lineHeight: 1.8,
                    }}
                  >
                    {draftContent.summary}
                  </p>
                  {renderMeta(draftContent.meta)}
                  {draftContent.tags && draftContent.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.15rem' }}>
                      {draftContent.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '0.34rem 0.74rem',
                            borderRadius: '999px',
                            background: 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            border: '1px solid color-mix(in srgb, var(--color-secondary) 44%, transparent)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {draftContent.hero?.image && (
                    <figure style={{ margin: '1.5rem 0 0', maxWidth: DETAIL_SECTION_WIDTH }}>
                      <img
                        src={resolveAssetUrl(draftContent.hero.image.src)}
                        alt={draftContent.hero.image.alt}
                        style={{
                          display: 'block',
                          width: '100%',
                          borderRadius: '22px',
                          objectFit: 'cover',
                          aspectRatio: '16 / 9',
                          background: 'color-mix(in srgb, var(--color-background) 94%, white 6%)',
                        }}
                      />
                      {draftContent.hero.image.caption && (
                        <figcaption
                          style={{
                            marginTop: '0.65rem',
                            fontSize: '0.78rem',
                            lineHeight: 1.58,
                            opacity: 0.8,
                            textAlign: 'center',
                          }}
                        >
                          {draftContent.hero.image.caption}
                        </figcaption>
                      )}
                    </figure>
                  )}
                </section>

                {/* Section cards */}
                <SectionListEditor
                  sections={draftContent.sections ?? []}
                  editingSectionIndex={editingSectionIndex}
                  onStartEditing={(sectionIndex) =>
                    dispatch({ type: 'set_editing_section_index', index: sectionIndex })
                  }
                  onStopEditing={(sectionIndex) =>
                    dispatch({
                      type: 'set_editing_section_index',
                      index: editingSectionIndex === sectionIndex ? null : sectionIndex,
                    })
                  }
                  onChangeSection={(sectionIndex, nextSection) =>
                    updateDraftContent({
                      ...draftContent,
                      sections: (draftContent.sections ?? []).map((entry, index) =>
                        index === sectionIndex ? nextSection : entry,
                      ),
                    })
                  }
                  onDeleteSection={(sectionIndex, section) =>
                    openDangerDialog({
                      actionDescription: UI_COPY.nodeEditor.confirmations.deleteSection(section.label),
                      proceedLabel: UI_COPY.nodeEditor.common.delete,
                      tone: 'danger',
                      onProceed: () => {
                        updateDraftContent({
                          ...draftContent,
                          sections: (draftContent.sections ?? []).filter((_, index) => index !== sectionIndex),
                        });
                      },
                    })
                  }
                  onAddSection={() => {
                    const nextSections = [...(draftContent.sections ?? []), createEmptySection()];
                    updateDraftContent({ ...draftContent, sections: nextSections });
                    dispatch({ type: 'set_editing_section_index', index: nextSections.length - 1 });
                  }}
                />

                {renderConnectedNodesSection(true)}
              </div>
            ) : previewNode ? (
              <div style={{ minHeight: '100%', color: 'var(--color-text)' }}>
                <NodeArticlePreview node={previewNode} />
                {tab === 'json' && decodedNodeId ? renderConnectedNodesSection(false) : null}
              </div>
            ) : (
              <div style={{ padding: '2.5rem 1.5rem', opacity: 0.55, fontSize: '0.9rem' }}>
                {previewEmptyState}
              </div>
            )}
          </div>
        </div>
      </div>
      <BrowseNodesDialog
        open={showOpenNodeDialog}
        nodes={bootstrapNodes}
        currentNodeId={decodedNodeId}
        currentDomain={currentNodeRef?.domain}
        includeBioEntry
        bioLabel={UI_COPY.nodeDetailPage.bioEntry.title}
        bioSubtitle={UI_COPY.nodeDetailPage.bioEntry.fallbackSubtitle}
        onClose={() => setShowOpenNodeDialog(false)}
        onSelect={handleOpenNode}
      />
      {dangerDialog && (
        <div
          onClick={closeDangerDialog}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'grid',
            placeItems: 'center',
            padding: '1.2rem',
            background: 'color-mix(in srgb, black 34%, transparent)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(28rem, 100%)',
              padding: '1rem 1rem 0.95rem',
              borderRadius: '18px',
              background: 'color-mix(in srgb, var(--color-background) 92%, white 8%)',
              border: '1px solid color-mix(in srgb, var(--color-secondary) 26%, transparent)',
              boxShadow: '0 18px 70px rgba(0, 0, 0, 0.22)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
              {dangerDialog.status === 'success'
                ? UI_COPY.nodeEditor.confirmations.titleSuccess
                : dangerDialog.status === 'error'
                  ? UI_COPY.nodeEditor.confirmations.titleError
                  : UI_COPY.nodeEditor.confirmations.titleConfirm}
            </div>
            <div style={{ marginTop: '0.55rem', fontSize: '0.88rem', lineHeight: 1.6, opacity: 0.82 }}>
              {dangerDialog.status === 'confirm'
                ? UI_COPY.nodeEditor.confirmations.prompt(dangerDialog.actionDescription)
                : dangerDialog.resultMessage}
            </div>
            <div style={{ marginTop: '0.95rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {dangerDialog.status === 'confirm' ? (
                <>
                  <button type="button" onClick={closeDangerDialog} style={btnSecondary}>
                    {UI_COPY.nodeEditor.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleDangerDialogProceed}
                    style={dangerDialog.tone === 'danger' ? btnDanger : btnPrimary}
                  >
                    {dangerDialog.proceedLabel ?? UI_COPY.nodeEditor.common.proceed}
                  </button>
                </>
              ) : dangerDialog.status === 'pending' ? (
                <button type="button" disabled style={{ ...btnPrimary, ...btnDisabled }}>
                  {UI_COPY.nodeEditor.common.working}
                </button>
              ) : (
                <button type="button" onClick={() => setDangerDialog(null)} style={btnPrimary}>
                  {UI_COPY.nodeEditor.common.close}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NodeEditorPage: React.FC = () => {
  const { nodeId } = useParams();
  const location = useLocation();
  const decodedNodeId = nodeId ? decodeURIComponent(nodeId) : '';
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const initialTab: EditorTab | undefined =
    requestedTab === 'new-node' || requestedTab === 'new-domain' ? requestedTab : undefined;

  if (decodedNodeId === 'bio') {
    return <BioEditorWorkspace />;
  }

  return <StandardNodeEditorWorkspace decodedNodeId={decodedNodeId} initialTab={initialTab} />;
};

export default NodeEditorPage;
