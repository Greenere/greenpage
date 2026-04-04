import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graph/highlight';
import { UI_COPY } from '../../configs/ui/uiCopy';
import ArticleGalleryBlock from '../../shared/ui/ArticleGalleryBlock';
import { applyThemeVars } from '../../shared/styles/colors';
import { Footnote } from '../../shared/ui/StyledTextBlocks';
import { getStableImageViewTransitionName, navigateWithViewTransition } from '../../shared/ui/viewTransitions';
import { PAGE_BACK_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from './content/BioTheme';
import { loadBioPageContent, readCachedBioPageContent } from './content/BioPage';
import DetailPageLanguageToggle from './DetailPageLanguageToggle';
import ThemePicker from './ThemePicker';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import {
  DETAIL_READING_WIDTH,
  DETAIL_SECTION_WIDTH,
  renderDetailInlineMarkdown,
  renderDetailMeta,
  renderDetailSection,
  renderDetailSectionHeading,
} from './DetailContent';
import {
  getDisplayDomain,
  getGraphRelations,
  getNodeDetailPath,
  loadGraphModel,
  loadGraphNodeContent,
  readCachedGraphModel,
  readCachedGraphNodeContent,
  resolveAssetUrl,
  type GraphCardNode,
  type GraphContentNode,
  type GraphNodeContent,
  type GraphModel,
  type GraphRelation,
} from './content/Nodes';

const GRAPH_RETURN_FOCUS_NODE_KEY = 'greenpage-graph-return-focus-node';

type RelatedEntry = {
  relation: GraphRelation;
  relatedNodeId: string;
  relatedNodeTitle: string;
  relatedNodeSubtitle: string;
  displayKind: string;
  displayLabel: string;
  isBio: boolean;
};

function getRelatedEntries(model: GraphModel, node: Pick<GraphCardNode, 'id'>, bioSubtitle: string | null) {
  const nodeById = new Map(model.nodes.map((entry) => [entry.id, entry]));

  return getGraphRelations(model)
    .filter((relation) => relation.from === node.id || relation.to === node.id)
    .map<RelatedEntry | null>((relation) => {
      const relatedId = relation.from === node.id ? relation.to : relation.from;
      if (relatedId === 'bio') {
        return {
          relation,
          relatedNodeId: 'bio',
          relatedNodeTitle: UI_COPY.nodeDetailPage.bioEntry.title,
          relatedNodeSubtitle: bioSubtitle ?? UI_COPY.nodeDetailPage.bioEntry.fallbackSubtitle,
          displayKind: UI_COPY.nodeDetailPage.bioEntry.kind,
          displayLabel: bioSubtitle ?? UI_COPY.nodeDetailPage.bioEntry.fallbackSubtitle,
          isBio: true,
        };
      }

      const relatedNode = nodeById.get(relatedId);
      if (!relatedNode) {
        return null;
      }

      return {
        relation,
        relatedNodeId: relatedNode.id,
        relatedNodeTitle: relatedNode.title,
        relatedNodeSubtitle: relatedNode.subtitle ?? relation.label,
        displayKind: relation.kind,
        displayLabel: relation.label,
        isBio: false,
      };
    })
    .filter((entry): entry is RelatedEntry => entry !== null)
    .sort((left, right) => {
      if (left.isBio !== right.isBio) {
        return left.isBio ? -1 : 1;
      }

      return right.relation.strength - left.relation.strength || left.relatedNodeTitle.localeCompare(right.relatedNodeTitle);
    })
    .slice(0, 8);
}

const NodeDetailPage: React.FC = () => {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const { language } = useAppLanguage();
  const decodedNodeId = nodeId ? decodeURIComponent(nodeId) : '';
  const [graphModel, setGraphModel] = useState<GraphModel | null>(() => readCachedGraphModel(language));
  const [graphError, setGraphError] = useState<string | null>(null);
  const [nodeContentState, setNodeContentState] = useState<{ nodeId: string; content: GraphNodeContent } | null>(() => {
    if (!decodedNodeId) {
      return null;
    }

    const cachedContent = readCachedGraphNodeContent(decodedNodeId, language);
    return cachedContent ? { nodeId: decodedNodeId, content: cachedContent } : null;
  });
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [bioSubtitle, setBioSubtitle] = useState<string | null>(() => readCachedBioPageContent(language)?.subtitle ?? null);
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const handleThemeChange = (nextTheme: Theme) => {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const handleNavigateWithTransition = (href: string) => {
    navigateWithViewTransition(() => {
      navigate(href);
    }, { resetScrollTop: href.startsWith('/nodes/') });
  };

  const handleBackToGraph = () => {
    if (decodedNodeId) {
      window.sessionStorage.setItem(GRAPH_RETURN_FOCUS_NODE_KEY, decodedNodeId);
    }

    navigateWithViewTransition(() => {
      navigate('/');
    }, { transitionConfig: PAGE_BACK_TRANSITION_CONFIG });
  };

  const handleOpenRelatedNode = (relatedNodeId: string) => {
    handleNavigateWithTransition(getNodeDetailPath(relatedNodeId));
  };

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setTheme(readStoredTheme());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    setBioSubtitle(readCachedBioPageContent(language)?.subtitle ?? null);
    setGraphModel(readCachedGraphModel(language));
    setGraphError(null);
    if (!decodedNodeId) {
      setNodeContentState(null);
    } else {
      const cachedContent = readCachedGraphNodeContent(decodedNodeId, language);
      setNodeContentState(cachedContent ? { nodeId: decodedNodeId, content: cachedContent } : null);
    }
    setNodeError(null);
  }, [decodedNodeId, language]);

  useEffect(() => {
    let cancelled = false;

    if (bioSubtitle) {
      return () => {
        cancelled = true;
      };
    }

    loadBioPageContent(language)
      .then((content) => {
        if (cancelled) return;
        setBioSubtitle(content.subtitle);
      })
      .catch(() => {
        if (cancelled) return;
      });

    return () => {
      cancelled = true;
    };
  }, [bioSubtitle, language]);

  useEffect(() => {
    let cancelled = false;

    if (graphModel) {
      return () => {
        cancelled = true;
      };
    }

    loadGraphModel(undefined, language)
      .then((model) => {
        if (cancelled) return;
        setGraphModel(model);
        setGraphError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGraphError(error instanceof Error ? error.message : UI_COPY.graphHome.errorLoading);
      });

    return () => {
      cancelled = true;
    };
  }, [graphModel, language]);

  const graphNode = graphModel?.nodes.find((entry) => entry.id === decodedNodeId) ?? null;

  useEffect(() => {
    let cancelled = false;

    if (!graphNode) {
      setNodeContentState(null);
      return () => {
        cancelled = true;
      };
    }

    if (nodeContentState?.nodeId === graphNode.id) {
      return () => {
        cancelled = true;
      };
    }

    loadGraphNodeContent(graphNode, language)
      .then((content) => {
        if (cancelled) return;
        setNodeContentState({ nodeId: graphNode.id, content });
        setNodeError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setNodeError(error instanceof Error ? error.message : UI_COPY.nodeDetailPage.errorLoading);
      });

    return () => {
      cancelled = true;
    };
  }, [graphNode, language, nodeContentState]);

  const node = graphNode && nodeContentState?.nodeId === graphNode.id
    ? ({
        ...graphNode,
        ...nodeContentState.content,
      } satisfies GraphContentNode)
    : null;
  const relatedEntries = graphModel && graphNode ? getRelatedEntries(graphModel, graphNode, bioSubtitle) : [];

  if (graphError || nodeError) {
    return (
        <div style={{ minHeight: '100vh', padding: '2rem', color: 'crimson' }}>
        {UI_COPY.nodeDetailPage.errorLoading}: {graphError ?? nodeError}
      </div>
    );
  }

  if (!graphModel || (graphNode && !node)) {
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', color: 'var(--color-text)' }}>
        {UI_COPY.nodeDetailPage.loading}
      </div>
    );
  }

  if (!graphNode || !node) {
    return (
      <div
        style={{
          minHeight: '100vh',
          padding: '2rem',
          color: 'var(--color-text)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '0.75rem' }}>{UI_COPY.nodeDetailPage.notFoundTitle}</h1>
          <p style={{ lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {UI_COPY.nodeDetailPage.notFoundDescription(decodedNodeId)}
          </p>
          <Link
            to="/"
            style={{
              color: 'var(--color-text)',
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: '0.2em',
            }}
          >
            {UI_COPY.nodeDetailPage.returnToGraph}
          </Link>
        </div>
      </div>
    );
  }

  const articleSections = node.sections;
  const heroImageTransitionName = getStableImageViewTransitionName(`node-hero-${node.id}`);
  const detailPageStyle = {
    minHeight: '100vh',
    color: 'var(--color-text)',
    ['--greenpage-detail-action-border-width-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleWidth,
    ['--greenpage-detail-action-border-opacity-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleOpacity,
    ['--greenpage-detail-action-border-width-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeWidth,
    ['--greenpage-detail-action-border-opacity-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeOpacity,
    ['--greenpage-detail-action-ring-shadow-prefix' as const]: getHighlightBorderShadowPrefix(DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION),
  } as CSSProperties;

  return (
    <div style={detailPageStyle}>
      <div
        style={{
          maxWidth: '72rem',
          margin: '0 auto',
          padding: '2rem 1.4rem 4.5rem',
        }}
      >
        <div
          style={{
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.4rem',
            }}
          >
            <DetailPageLanguageToggle />
            <ThemePicker theme={theme} setTheme={handleThemeChange} variant="inline" />
          </div>
        </div>

        <section
          style={{
            marginTop: '1.15rem',
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
            padding: '2.3rem 2rem 2.35rem',
            borderRadius: '34px',
            background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
          }}
        >
          <Footnote
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              opacity: 0.74,
              fontSize: '0.68rem',
            }}
          >
            {getDisplayDomain(node.domain)}
          </Footnote>
          <h1
            style={{
              margin: '0.45rem 0 0',
              fontSize: 'clamp(2.35rem, 5vw, 4rem)',
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
            }}
          >
            {node.title}
          </h1>
          {node.subtitle && (
            <div style={{ marginTop: '0.9rem', fontSize: '1.08rem', opacity: 0.8 }}>
              {node.subtitle}
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
            {node.summary}
          </p>

          {renderDetailMeta(node.meta, handleNavigateWithTransition)}

          {node.tags && node.tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '1.15rem',
              }}
            >
              {node.tags.map((tag) => (
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

          {node.hero?.image && (
            <figure
              style={{
                margin: '1.5rem 0 0',
                maxWidth: DETAIL_SECTION_WIDTH,
              }}
            >
              <img
                src={resolveAssetUrl(node.hero.image.src)}
                alt={node.hero.image.alt}
                style={{
                  display: 'block',
                  width: '100%',
                  borderRadius: '22px',
                  objectFit: 'cover',
                  aspectRatio: '16 / 9',
                  background: 'color-mix(in srgb, var(--color-background) 94%, white 6%)',
                  viewTransitionName: heroImageTransitionName,
                }}
              />
              {node.hero.image.caption && (
                <figcaption
                  style={{
                    marginTop: '0.65rem',
                    fontSize: '0.78rem',
                    lineHeight: 1.58,
                    opacity: 0.8,
                    textAlign: 'center',
                  }}
                >
                  {renderDetailInlineMarkdown(node.hero.image.caption, 'hero-caption', handleNavigateWithTransition)}
                </figcaption>
              )}
            </figure>
          )}
        </section>

        {node.gallery && node.gallery.length > 0 && (
          <section style={{ marginTop: '2.2rem', maxWidth: DETAIL_SECTION_WIDTH, marginInline: 'auto' }}>
            {renderDetailSectionHeading(UI_COPY.nodeDetailPage.sections.gallery)}
            <ArticleGalleryBlock
              items={node.gallery}
              columns={Math.min(3, Math.max(1, node.gallery.length))}
              align="height"
              keyPrefix="top-gallery"
              maxWidth={DETAIL_SECTION_WIDTH}
              marginBottom="0"
              renderCaption={(caption, captionKeyPrefix) =>
                renderDetailInlineMarkdown(caption, captionKeyPrefix, handleNavigateWithTransition)
              }
            />
          </section>
        )}

        {articleSections &&
          articleSections.length > 0 &&
          articleSections.map((section, index) => renderDetailSection(section, index, handleNavigateWithTransition))}

        {relatedEntries.length > 0 && (
          <section
            style={{
              marginTop: '2.4rem',
              maxWidth: DETAIL_SECTION_WIDTH,
              marginInline: 'auto',
            }}
          >
            {renderDetailSectionHeading(UI_COPY.nodeDetailPage.sections.connectedNodes)}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.85rem',
              }}
            >
              {relatedEntries.map(({ relation, relatedNodeId, relatedNodeTitle, displayKind, displayLabel }) => (
                <Link
                  key={relation.id}
                  to={getNodeDetailPath(relatedNodeId)}
                  className="node-detail-related-link"
                  onClick={(event) => {
                    event.preventDefault();
                    handleOpenRelatedNode(relatedNodeId);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.8rem 0.85rem',
                    borderRadius: '16px',
                    border: '1px solid transparent',
                    color: 'var(--color-text)',
                    background: 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
                    textDecoration: 'none',
                  }}
                >
                  <Footnote
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      opacity: 0.7,
                      fontSize: '0.58rem',
                    }}
                  >
                    {displayKind}
                  </Footnote>
                  <div style={{ marginTop: '0.3rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
                    {relatedNodeTitle}
                  </div>
                  <div style={{ marginTop: '0.38rem', fontSize: '0.76rem', lineHeight: 1.45, opacity: 0.8 }}>
                    {displayLabel}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default NodeDetailPage;
