import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graph/highlight';
import { PAGE_BACK_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { LANGUAGE_OPTIONS, type AppLanguage } from '../../i18n';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import { applyThemeVars } from '../../shared/styles/colors';
import { navigateWithViewTransition } from '../../shared/ui/viewTransitions';
import ThemePicker from '../graph/ThemePicker';
import { clearBioPageContentCache, normalizeBioPageContent, type BioPageContent, type BioPageSection } from '../graph/content/BioPage';
import { clearGraphNodeContentCache } from '../graph/content/Nodes';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from '../graph/content/BioTheme';
import BrowseNodesDialog from './BrowseNodesDialog';
import BioPagePreview from './BioPagePreview';
import {
  EDITOR_CAN_MUTATE_PROJECT,
  fetchEditorBio,
  fetchEditorBootstrap,
  saveEditorBio,
  type EditorNodeOption,
} from './editorApi';
import { prettyJson } from './nodeEditorState';
import SectionListEditor from './section_editor/SectionListEditor';
import { createEmptySection } from './section_editor/sectionMarkdown';

const EDITOR_DRAFT_STORAGE_PREFIX = 'greenpage-node-editor-draft:';
const EDITOR_DRAFT_AUTOSAVE_DELAY_MS = 250;

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

type StoredBioEditorDraft = {
  version: 1;
  content: BioPageContent;
  jsonDraft: string;
};

type RestoredBioEditorDraft = StoredBioEditorDraft & {
  jsonError: string | null;
};

function getDraftStorageKey(lang: AppLanguage) {
  return `${EDITOR_DRAFT_STORAGE_PREFIX}${lang}:bio`;
}

function clearStoredBioDraft(lang: AppLanguage) {
  window.localStorage.removeItem(getDraftStorageKey(lang));
}

function storeBioDraft(lang: AppLanguage, draft: StoredBioEditorDraft) {
  window.localStorage.setItem(getDraftStorageKey(lang), JSON.stringify(draft));
}

function parseStoredBioDraft(raw: string | null): RestoredBioEditorDraft | null {
  if (!raw) return null;

  try {
    const candidate = JSON.parse(raw) as Record<string, unknown>;
    const content = normalizeBioPageContent(candidate.content);
    if (!content || typeof candidate.jsonDraft !== 'string') return null;

    let jsonError: string | null = null;
    try {
      const parsed = normalizeBioPageContent(lenientParseJsonText(candidate.jsonDraft));
      if (!parsed) {
        throw new Error(UI_COPY.nodeEditor.bioJsonTab.invalidJson);
      }
    } catch (error) {
      jsonError = error instanceof Error ? error.message : UI_COPY.nodeEditor.bioJsonTab.invalidJson;
    }

    return {
      version: 1,
      content,
      jsonDraft: candidate.jsonDraft,
      jsonError,
    };
  } catch {
    return null;
  }
}

function lenientParseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'));
  }
}

function inputStyle(multiline = false) {
  return {
    width: '100%',
    padding: '0.6rem 0.72rem',
    borderRadius: '10px',
    border: '1px solid color-mix(in srgb, var(--color-secondary) 34%, transparent)',
    background: 'transparent',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    resize: multiline ? ('vertical' as const) : undefined,
  };
}

const btnPrimary: CSSProperties = {
  padding: '0.48rem 0.9rem',
  borderRadius: '10px',
  fontSize: '0.83rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid transparent',
  background: 'var(--color-text)',
  color: 'var(--color-background)',
};

const btnDanger: CSSProperties = {
  padding: '0.48rem 0.9rem',
  borderRadius: '10px',
  fontSize: '0.83rem',
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid color-mix(in srgb, crimson 28%, transparent)',
  background: 'transparent',
  color: 'color-mix(in srgb, crimson 70%, var(--color-text))',
};

const btnSecondary: CSSProperties = {
  padding: '0.48rem 0.9rem',
  borderRadius: '10px',
  fontSize: '0.83rem',
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid color-mix(in srgb, var(--color-secondary) 34%, transparent)',
  background: 'transparent',
  color: 'var(--color-text)',
};

const btnDisabled: CSSProperties = { opacity: 0.38, cursor: 'not-allowed' };

function ControlLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.73rem',
        fontWeight: 600,
        marginBottom: '0.25rem',
        opacity: 0.78,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </div>
  );
}

function FieldShell({ children }: { children: ReactNode }) {
  return <div style={{ marginTop: '0.85rem' }}>{children}</div>;
}

const textActionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '0.76rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  letterSpacing: '0.03em',
  opacity: 0.78,
};

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

function normalizeOptionalList<T>(items: T[]) {
  return items.length > 0 ? items : undefined;
}

function sanitizeBioContentForSave(content: BioPageContent): BioPageContent {
  return {
    eyebrow: content.eyebrow?.trim() ? content.eyebrow.trim() : undefined,
    name: content.name,
    subtitle: content.subtitle,
    summary: content.summary,
    portraitHref: content.portraitHref?.trim() ? content.portraitHref.trim() : undefined,
    themeFactLabel: content.themeFactLabel?.trim() ? content.themeFactLabel.trim() : undefined,
    pathsSectionLabel: content.pathsSectionLabel?.trim() ? content.pathsSectionLabel.trim() : undefined,
    linksSectionLabel: content.linksSectionLabel?.trim() ? content.linksSectionLabel.trim() : undefined,
    facts: normalizeOptionalList(
      (content.facts ?? [])
        .map((fact) => ({
          label: fact.label.trim(),
          value: fact.value.trim(),
          href: fact.href?.trim() ? fact.href.trim() : undefined,
        }))
        .filter((fact) => fact.label || fact.value || fact.href),
    ),
    sections: normalizeOptionalList(
      (content.sections ?? [])
        .map((section) => ({
          id: section.id,
          label: section.label.trim(),
          blocks: section.blocks,
        }))
        .filter((section) => section.label || section.blocks.length > 0),
    ),
    links: normalizeOptionalList(
      (content.links ?? [])
        .map((link) => ({
          label: link.label.trim(),
          href: link.href.trim(),
        }))
        .filter((link) => link.label || link.href),
    ),
  };
}

export default function BioEditorWorkspace() {
  const navigate = useNavigate();
  const { language, messages } = useAppLanguage();
  const editorCanMutateProject = EDITOR_CAN_MUTATE_PROJECT;
  const handleBackToGraph = () => {
    navigateWithViewTransition(
      () => {
        navigate('/');
      },
      { transitionConfig: PAGE_BACK_TRANSITION_CONFIG }
    );
  };
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [tab, setTab] = useState<'content' | 'json'>('content');
  const [bootstrapNodes, setBootstrapNodes] = useState<EditorNodeOption[]>([]);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loadingBio, setLoadingBio] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showOpenNodeDialog, setShowOpenNodeDialog] = useState(false);
  const [dangerDialog, setDangerDialog] = useState<DangerDialogState | null>(null);
  const [originalContent, setOriginalContent] = useState<BioPageContent | null>(null);
  const [draftContent, setDraftContent] = useState<BioPageContent | null>(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isFallbackContent, setIsFallbackContent] = useState(false);
  const [resolvedContentLanguage, setResolvedContentLanguage] = useState<AppLanguage>(language);
  const [showJsonContent, setShowJsonContent] = useState(true);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const bootstrapRequestIdRef = useRef(0);
  const bioLoadRequestIdRef = useRef(0);
  const draftStorageLanguageRef = useRef<AppLanguage>(language);
  const originalContentRef = useRef<BioPageContent | null>(null);
  const draftContentRef = useRef<BioPageContent | null>(null);
  const jsonDraftRef = useRef('');

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    applyThemeVars(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  originalContentRef.current = originalContent;
  draftContentRef.current = draftContent;
  jsonDraftRef.current = jsonDraft;

  useEffect(() => {
    const requestId = ++bootstrapRequestIdRef.current;

    fetchEditorBootstrap(language)
      .then((payload) => {
        if (requestId !== bootstrapRequestIdRef.current) return;
        setBootstrapNodes(payload.nodes);
        setBootstrapError(null);
      })
      .catch((error: unknown) => {
        if (requestId !== bootstrapRequestIdRef.current) return;
        setBootstrapError(error instanceof Error ? error.message : 'Failed to load editor bootstrap.');
      });
  }, [language]);

  useEffect(() => {
    const previousDraftLanguage = draftStorageLanguageRef.current;
    const snapshotOriginalContent = originalContentRef.current;
    const snapshotDraftContent = draftContentRef.current;
    const snapshotJsonDraft = jsonDraftRef.current;

    if (
      previousDraftLanguage !== language &&
      snapshotOriginalContent &&
      snapshotDraftContent &&
      (
        prettyJson(snapshotOriginalContent) !== prettyJson(snapshotDraftContent) ||
        snapshotJsonDraft !== prettyJson(snapshotDraftContent)
      )
    ) {
      storeBioDraft(previousDraftLanguage, {
        version: 1,
        content: snapshotDraftContent,
        jsonDraft: snapshotJsonDraft,
      });
    }

    const requestId = ++bioLoadRequestIdRef.current;
    setLoadingBio(true);

    fetchEditorBio(language)
      .then((payload) => {
        if (requestId !== bioLoadRequestIdRef.current) return;

        const storedDraft = parseStoredBioDraft(window.localStorage.getItem(getDraftStorageKey(language)));
        const nextContent = storedDraft?.content ?? payload.content;
        setOriginalContent(payload.content);
        setDraftContent(nextContent);
        setJsonDraft(storedDraft?.jsonDraft ?? prettyJson(nextContent));
        setJsonError(storedDraft?.jsonError ?? null);
        setIsFallbackContent(payload.isFallbackContent);
        setResolvedContentLanguage(payload.resolvedLanguage);
        setContentError(null);
        draftStorageLanguageRef.current = language;
      })
      .catch((error: unknown) => {
        if (requestId !== bioLoadRequestIdRef.current) return;
        setContentError(error instanceof Error ? error.message : UI_COPY.bioDetailPage.errorLoading);
      })
      .finally(() => {
        if (requestId !== bioLoadRequestIdRef.current) return;
        setLoadingBio(false);
      });
  }, [language]);

  const hasUnsavedLocalDraft = useMemo(() => {
    if (!originalContent || !draftContent) return false;
    return prettyJson(originalContent) !== prettyJson(draftContent) || jsonDraft !== prettyJson(draftContent);
  }, [draftContent, jsonDraft, originalContent]);

  useEffect(() => {
    const draftStorageLanguage = draftStorageLanguageRef.current;
    if (!draftContent) return;

    if (!hasUnsavedLocalDraft) {
      clearStoredBioDraft(draftStorageLanguage);
      return;
    }

    const timer = window.setTimeout(() => {
      storeBioDraft(draftStorageLanguage, {
        version: 1,
        content: draftContent,
        jsonDraft,
      });
    }, EDITOR_DRAFT_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [draftContent, hasUnsavedLocalDraft, jsonDraft]);

  const bioOpenNodeLabel = draftContent?.name?.trim() || UI_COPY.nodeDetailPage.bioEntry.title;
  const bioOpenNodeSubtitle = draftContent?.subtitle?.trim() || UI_COPY.nodeDetailPage.bioEntry.fallbackSubtitle;
  const editorSubtitle = editorCanMutateProject ? UI_COPY.nodeEditor.subtitle : UI_COPY.nodeEditor.productionSubtitle;
  const previewLabel = tab === 'content' ? UI_COPY.nodeEditor.rightPanel.bioEditor : UI_COPY.nodeEditor.rightPanel.livePreview;

  const updateDraftContent = (nextContent: BioPageContent) => {
    setDraftContent(nextContent);
    setJsonDraft(prettyJson(nextContent));
    setJsonError(null);
  };

  const updateBioSections = (nextSections: BioPageSection[] | undefined) => {
    if (!draftContent) return;
    updateDraftContent({
      ...draftContent,
      sections: nextSections && nextSections.length > 0 ? nextSections : undefined,
    });
  };

  const handleJsonDraftChange = (nextText: string) => {
    setJsonDraft(nextText);

    try {
      const parsed = normalizeBioPageContent(lenientParseJsonText(nextText));
      if (!parsed) {
        throw new Error(UI_COPY.nodeEditor.bioJsonTab.invalidJson);
      }
      setDraftContent(parsed);
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : UI_COPY.nodeEditor.bioJsonTab.invalidJson);
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

  const handleDiscardDraft = () => {
    if (!originalContent) return;
    clearStoredBioDraft(language);
    setDraftContent(originalContent);
    setJsonDraft(prettyJson(originalContent));
    setJsonError(null);
    setStatusMessage(UI_COPY.nodeEditor.status.discardedDraft);
  };

  const handleWriteToFile = async () => {
    if (!draftContent) return;

    setActionPending(true);
    try {
      const normalizedContent = sanitizeBioContentForSave(draftContent);
      await saveEditorBio(normalizedContent, language);
      clearStoredBioDraft(language);
      clearBioPageContentCache();
      clearGraphNodeContentCache();
      setOriginalContent(normalizedContent);
      setDraftContent(normalizedContent);
      setJsonDraft(prettyJson(normalizedContent));
      setJsonError(null);
      setIsFallbackContent(false);
      setResolvedContentLanguage(language);
      setStatusMessage(UI_COPY.nodeEditor.status.wroteBioFile);
      return UI_COPY.nodeEditor.status.wroteBioFile;
    } catch (error) {
      const message = error instanceof Error ? error.message : UI_COPY.nodeEditor.status.failedWriteBioFile;
      setStatusMessage(message);
      throw new Error(message);
    } finally {
      setActionPending(false);
    }
  };

  const handleOpenNode = (nextNodeId: string) => {
    if (nextNodeId === 'bio') {
      navigate('/editor/nodes/bio');
      return;
    }

    if (!nextNodeId) {
      navigate('/editor');
      return;
    }

    navigate(`/editor/nodes/${encodeURIComponent(nextNodeId)}`);
  };

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
            <div style={{ marginTop: '0.3rem', opacity: 0.62, fontSize: '0.88rem' }}>{editorSubtitle}</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.4rem',
            }}
          >
            <PreviewPanelLanguageToggle />
            <ThemePicker theme={theme} setTheme={setTheme} variant="inline" />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(20rem, 28rem) minmax(0, 1fr)',
            gap: '0.9rem',
            alignItems: 'start',
          }}
        >
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
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {(['content', 'json'] as const).map((tabId) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setTab(tabId)}
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
                  {tab === tabId ? UI_COPY.nodeEditor.tabs[tabId] : UI_COPY.nodeEditor.tabs[tabId]}
                </button>
              ))}
              {editorCanMutateProject
                ? (
                    [
                      { key: 'new-node', label: UI_COPY.nodeEditor.tabs.newNode, href: '/editor?tab=new-node' },
                      { key: 'new-domain', label: UI_COPY.nodeEditor.tabs.newDomain, href: '/editor?tab=new-domain' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => navigate(tab.href)}
                      style={{
                        padding: '0.38rem 0.75rem',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: 400,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        border: '1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent)',
                        background: 'transparent',
                        color: 'var(--color-text)',
                        transition: 'background 0.12s, color 0.12s',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))
                : null}
            </div>

            <FieldShell>
              <ControlLabel>{UI_COPY.nodeEditor.common.openNode}</ControlLabel>
              <button
                type="button"
                onClick={() => setShowOpenNodeDialog(true)}
                style={{
                  ...inputStyle(),
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.8rem',
                }}
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
                    {bioOpenNodeLabel}
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
                    {`${UI_COPY.nodeDetailPage.bioEntry.kind} / bio${bioOpenNodeSubtitle ? ` · ${bioOpenNodeSubtitle}` : ''}`}
                  </span>
                </span>
                <span style={{ opacity: 0.45, fontSize: '0.86rem', flexShrink: 0 }}>▾</span>
              </button>
            </FieldShell>

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
                  onClick={() => setStatusMessage(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    opacity: 0.5,
                    padding: 0,
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {(contentError ?? bootstrapError) && (
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
                {contentError ?? bootstrapError}
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

            {tab === 'content' ? (
              !draftContent ? (
                <div style={{ marginTop: '1rem', opacity: 0.65, fontSize: '0.88rem' }}>
                  {loadingBio ? UI_COPY.nodeEditor.common.loading : UI_COPY.nodeEditor.bioContentTab.emptyState}
                </div>
              ) : (
                <>
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
                    <span style={{ fontWeight: 600 }}>{UI_COPY.nodeDetailPage.bioEntry.kind}</span>
                    <span style={{ opacity: 0.55 }}> / </span>
                    bio
                  </div>

                  <FieldShell>
                    <ControlLabel>{UI_COPY.nodeEditor.bioContentTab.header}</ControlLabel>
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      <input
                        value={draftContent.eyebrow ?? ''}
                        onChange={(event) => updateDraftContent({ ...draftContent, eyebrow: event.target.value || undefined })}
                        placeholder={UI_COPY.bioDetailPage.fallbackEyebrow}
                        style={inputStyle()}
                      />
                      <input
                        value={draftContent.name}
                        onChange={(event) => updateDraftContent({ ...draftContent, name: event.target.value })}
                        placeholder={UI_COPY.nodeEditor.bioContentTab.name}
                        style={inputStyle()}
                      />
                      <input
                        value={draftContent.subtitle}
                        onChange={(event) => updateDraftContent({ ...draftContent, subtitle: event.target.value })}
                        placeholder={UI_COPY.nodeEditor.bioContentTab.subtitle}
                        style={inputStyle()}
                      />
                      <textarea
                        value={draftContent.summary}
                        onChange={(event) => updateDraftContent({ ...draftContent, summary: event.target.value })}
                        rows={4}
                        placeholder={UI_COPY.nodeEditor.bioContentTab.summary}
                        style={inputStyle(true)}
                      />
                      <input
                        value={draftContent.portraitHref ?? ''}
                        onChange={(event) => updateDraftContent({ ...draftContent, portraitHref: event.target.value || undefined })}
                        placeholder={UI_COPY.nodeEditor.bioContentTab.portraitHref}
                        style={inputStyle()}
                      />
                    </div>
                  </FieldShell>

                  <FieldShell>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                      <ControlLabel>{UI_COPY.nodeEditor.bioContentTab.facts}</ControlLabel>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraftContent({
                            ...draftContent,
                            facts: [...(draftContent.facts ?? []), { label: '', value: '', href: '' }],
                          })
                        }
                        className="greenpage-editor-text-toggle"
                        style={textActionButtonStyle}
                      >
                        {UI_COPY.nodeEditor.bioContentTab.addFact}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {(draftContent.facts ?? []).map((fact, index) => (
                        <div
                          key={`fact-${index}`}
                          style={{
                            padding: '0.7rem',
                            borderRadius: '12px',
                            background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
                          }}
                        >
                          <div style={{ display: 'grid', gap: '0.55rem' }}>
                            <input
                              value={fact.label}
                              onChange={(event) =>
                                updateDraftContent({
                                  ...draftContent,
                                  facts: (draftContent.facts ?? []).map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, label: event.target.value } : entry
                                  ),
                                })
                              }
                              placeholder={UI_COPY.nodeEditor.bioContentTab.factLabel}
                              style={inputStyle()}
                            />
                            <input
                              value={fact.value}
                              onChange={(event) =>
                                updateDraftContent({
                                  ...draftContent,
                                  facts: (draftContent.facts ?? []).map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, value: event.target.value } : entry
                                  ),
                                })
                              }
                              placeholder={UI_COPY.nodeEditor.bioContentTab.factValue}
                              style={inputStyle()}
                            />
                            <input
                              value={fact.href ?? ''}
                              onChange={(event) =>
                                updateDraftContent({
                                  ...draftContent,
                                  facts: (draftContent.facts ?? []).map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, href: event.target.value } : entry
                                  ),
                                })
                              }
                              placeholder={UI_COPY.nodeEditor.bioContentTab.factHref}
                              style={inputStyle()}
                            />
                          </div>
                          <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() =>
                                updateDraftContent({
                                  ...draftContent,
                                  facts: normalizeOptionalList((draftContent.facts ?? []).filter((_, entryIndex) => entryIndex !== index)),
                                })
                              }
                              style={{ ...btnDanger, padding: '0.24rem 0.62rem', fontSize: '0.76rem' }}
                            >
                              {UI_COPY.nodeEditor.common.delete}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </FieldShell>

                  <FieldShell>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                      <ControlLabel>{UI_COPY.nodeEditor.bioContentTab.links}</ControlLabel>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraftContent({
                            ...draftContent,
                            links: [...(draftContent.links ?? []), { label: '', href: '' }],
                          })
                        }
                        className="greenpage-editor-text-toggle"
                        style={textActionButtonStyle}
                      >
                        {UI_COPY.nodeEditor.bioContentTab.addLink}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {(draftContent.links ?? []).map((link, index) => (
                        <div
                          key={`link-${index}`}
                          style={{
                            padding: '0.7rem',
                            borderRadius: '12px',
                            background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
                          }}
                        >
                          <div style={{ display: 'grid', gap: '0.55rem' }}>
                            <input
                              value={link.label}
                              onChange={(event) =>
                                updateDraftContent({
                                  ...draftContent,
                                  links: (draftContent.links ?? []).map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, label: event.target.value } : entry
                                  ),
                                })
                              }
                              placeholder={UI_COPY.nodeEditor.bioContentTab.linkLabel}
                              style={inputStyle()}
                            />
                            <input
                              value={link.href}
                              onChange={(event) =>
                                updateDraftContent({
                                  ...draftContent,
                                  links: (draftContent.links ?? []).map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, href: event.target.value } : entry
                                  ),
                                })
                              }
                              placeholder={UI_COPY.nodeEditor.bioContentTab.linkHref}
                              style={inputStyle()}
                            />
                          </div>
                          <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() =>
                                updateDraftContent({
                                  ...draftContent,
                                  links: normalizeOptionalList((draftContent.links ?? []).filter((_, entryIndex) => entryIndex !== index)),
                                })
                              }
                              style={{ ...btnDanger, padding: '0.24rem 0.62rem', fontSize: '0.76rem' }}
                            >
                              {UI_COPY.nodeEditor.common.delete}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </FieldShell>

                  <div style={{ marginTop: '0.9rem', fontSize: '0.8rem', opacity: 0.6, lineHeight: 1.55 }}>
                    {UI_COPY.nodeEditor.bioContentTab.sidebarHint}
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {editorCanMutateProject ? (
                      <button
                        type="button"
                        onClick={() =>
                          openDangerDialog({
                            actionDescription: UI_COPY.nodeEditor.confirmations.writeBioChanges,
                            proceedLabel: UI_COPY.nodeEditor.common.proceed,
                            tone: 'primary',
                            showResult: true,
                            pendingMessage: UI_COPY.nodeEditor.confirmations.writingToFile,
                            onProceed: handleWriteToFile,
                          })
                        }
                        disabled={actionPending || !draftContent}
                        style={actionPending || !draftContent ? { ...btnPrimary, ...btnDisabled } : btnPrimary}
                      >
                        {UI_COPY.nodeEditor.bioContentTab.writeToFile}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        openDangerDialog({
                          actionDescription: UI_COPY.nodeEditor.confirmations.resetDraft,
                          proceedLabel: UI_COPY.nodeEditor.bioContentTab.reset,
                          tone: 'danger',
                          onProceed: handleDiscardDraft,
                        })
                      }
                      disabled={!originalContent}
                      style={!originalContent ? { ...btnDanger, ...btnDisabled } : btnDanger}
                    >
                      {UI_COPY.nodeEditor.bioContentTab.reset}
                    </button>
                  </div>
                </>
              )
            ) : (
              <div style={{ marginTop: '0.85rem' }}>
                {!draftContent ? (
                  <div style={{ opacity: 0.65, fontSize: '0.88rem' }}>
                    {loadingBio ? UI_COPY.nodeEditor.common.loading : UI_COPY.nodeEditor.bioJsonTab.emptyState}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowJsonContent((current) => !current)}
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
                      {UI_COPY.nodeEditor.bioJsonTab.contentJson}
                    </button>
                    {showJsonContent ? (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', opacity: 0.62, lineHeight: 1.55 }}>
                          {UI_COPY.nodeEditor.bioJsonTab.contentJsonHint}
                        </div>
                        <textarea
                          value={jsonDraft}
                          rows={16}
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
                          onChange={(event) => handleJsonDraftChange(event.target.value)}
                        />
                        {jsonError ? (
                          <div style={{ marginTop: '0.55rem', color: 'crimson', fontSize: '0.82rem' }}>{jsonError}</div>
                        ) : null}
                      </div>
                    ) : null}

                    <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {editorCanMutateProject ? (
                        <button
                          type="button"
                          onClick={() =>
                            openDangerDialog({
                              actionDescription: UI_COPY.nodeEditor.confirmations.writeBioChanges,
                              proceedLabel: UI_COPY.nodeEditor.common.proceed,
                              tone: 'primary',
                              showResult: true,
                              pendingMessage: UI_COPY.nodeEditor.confirmations.writingToFile,
                              onProceed: handleWriteToFile,
                            })
                          }
                          disabled={Boolean(jsonError) || actionPending || !draftContent}
                          style={Boolean(jsonError) || actionPending || !draftContent ? { ...btnPrimary, ...btnDisabled } : btnPrimary}
                        >
                          {UI_COPY.nodeEditor.bioJsonTab.writeToFile}
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              minHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1rem',
              borderRadius: '20px',
              background: 'color-mix(in srgb, var(--color-background) 94%, white 6%)',
            }}
          >
            <div
              style={{
                marginBottom: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{previewLabel}</div>
                <div style={{ marginTop: '0.2rem', opacity: 0.6, fontSize: '0.82rem' }}>
                  {draftContent ? `${UI_COPY.nodeDetailPage.bioEntry.kind} / bio` : UI_COPY.nodeEditor.rightPanel.previewSelectionHintExistingOnly}
                </div>
              </div>
              <Link
                to="/"
                className="node-card-detail-link node-page-back-link"
                onClick={(event) => {
                  event.preventDefault();
                  handleBackToGraph();
                }}
              >
                <span>{UI_COPY.nodeDetailPage.backToGraph}</span>
              </Link>
            </div>

            {draftContent ? (
              tab === 'content' ? (
                <div style={{ minHeight: '100%', color: 'var(--color-text)' }}>
                  <BioPagePreview
                    content={draftContent}
                    theme={theme}
                    hideSections
                    onOpenPathEntry={(nodeId) => navigate(`/editor/nodes/${encodeURIComponent(nodeId)}`)}
                    customSections={
                      <SectionListEditor
                        sections={draftContent.sections ?? []}
                        editingSectionIndex={editingSectionIndex}
                        onStartEditing={(sectionIndex) => setEditingSectionIndex(sectionIndex)}
                        onStopEditing={(sectionIndex) =>
                          setEditingSectionIndex((current) => (current === sectionIndex ? null : current))
                        }
                        onChangeSection={(sectionIndex, nextSection) =>
                          updateBioSections((draftContent.sections ?? []).map((entry, index) =>
                            index === sectionIndex ? nextSection : entry
                          ))
                        }
                        onDeleteSection={(sectionIndex, section) => {
                          const nextSections = (draftContent.sections ?? []).filter((_, index) => index !== sectionIndex);
                          openDangerDialog({
                            actionDescription: UI_COPY.nodeEditor.confirmations.deleteSection(section.label),
                            proceedLabel: UI_COPY.nodeEditor.common.delete,
                            tone: 'danger',
                            onProceed: () => {
                              updateBioSections(nextSections);
                              setEditingSectionIndex((current) =>
                                current === null ? null : current === sectionIndex ? null : current > sectionIndex ? current - 1 : current
                              );
                            },
                          });
                        }}
                        onAddSectionAfter={(sectionIndex) => {
                          const nextSections = [...(draftContent.sections ?? [])];
                          nextSections.splice(sectionIndex + 1, 0, createEmptySection());
                          updateBioSections(nextSections);
                          setEditingSectionIndex(sectionIndex + 1);
                        }}
                      />
                    }
                  />
                </div>
              ) : (
                <BioPagePreview
                  content={draftContent}
                  theme={theme}
                  onOpenPathEntry={(nodeId) => navigate(`/editor/nodes/${encodeURIComponent(nodeId)}`)}
                />
              )
            ) : (
              <div style={{ padding: '2.5rem 1.5rem', opacity: 0.55, fontSize: '0.9rem' }}>
                {UI_COPY.nodeEditor.rightPanel.previewEmptyStateExistingOnly}
              </div>
            )}
          </div>
        </div>
      </div>

      <BrowseNodesDialog
        open={showOpenNodeDialog}
        nodes={bootstrapNodes}
        currentNodeId="bio"
        includeBioEntry
        bioLabel={bioOpenNodeLabel}
        bioSubtitle={bioOpenNodeSubtitle}
        onClose={() => setShowOpenNodeDialog(false)}
        onSelect={handleOpenNode}
      />

      {dangerDialog ? (
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
            <div style={{ marginTop: '0.6rem', fontSize: '0.86rem', lineHeight: 1.6, opacity: 0.85 }}>
              {dangerDialog.status === 'confirm'
                ? UI_COPY.nodeEditor.confirmations.prompt(dangerDialog.actionDescription)
                : dangerDialog.resultMessage}
            </div>
            <div style={{ marginTop: '0.95rem', display: 'flex', justifyContent: 'flex-end', gap: '0.55rem' }}>
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
      ) : null}
    </div>
  );
}
