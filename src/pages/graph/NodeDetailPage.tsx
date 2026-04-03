import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graphHighlight';
import { UI_COPY } from '../../configs/uiCopy';
import ArticleGalleryBlock from '../../shared/ui/ArticleGalleryBlock';
import { applyThemeVars } from '../../shared/styles/colors';
import { Footnote, Paragraph } from '../../shared/ui/StyledTextBlocks';
import {
  captureSharedElementTransition,
  navigateWithViewTransition,
  playSharedElementEnterTransition,
} from '../../shared/ui/viewTransitions';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from './content/BioTheme';
import { loadBioPageContent, readCachedBioPageContent } from './content/BioPage';
import ThemePicker from './ThemePicker';
import { useAppLanguage } from '../../i18n/LanguageProvider';
import {
  getDisplayDomain,
  getGraphRelations,
  getNodeDetailPath,
  getNodeTransitionName,
  loadGraphModel,
  loadGraphNodeContent,
  readCachedGraphModel,
  readCachedGraphNodeContent,
  resolveAssetUrl,
  type GraphCardNode,
  type ArticleBlock,
  type ContentBlock,
  type GraphContentNode,
  type GraphNodeContent,
  type GraphModel,
  type GraphRelation,
  type NodeArticleMeta,
    type NodeArticleSection,
  } from './content/Nodes';

const GRAPH_RETURN_FOCUS_NODE_KEY = 'greenpage-graph-return-focus-node';
const INLINE_PATTERN = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
const DETAIL_READING_WIDTH = '46rem';
const DETAIL_SECTION_WIDTH = '48rem';
function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

function isInternalHref(href: string) {
  return href.startsWith('/') && !isExternalHref(href);
}

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

type ArticleLinkProps = {
  href: string;
  children: ReactNode;
  onNavigate?: (href: string) => void;
  style?: React.CSSProperties;
};

function ArticleLink({ href, children, onNavigate, style }: ArticleLinkProps) {
  const linkStyle: React.CSSProperties = {
    color: 'var(--color-text)',
    textDecoration: 'underline',
    textUnderlineOffset: '0.2em',
    textDecorationThickness: '1px',
    textDecorationColor: 'color-mix(in srgb, var(--color-secondary) 62%, transparent)',
    ...style,
  };

  if (isInternalHref(href)) {
    return (
      <Link
        to={href}
        onClick={(event) => {
          if (!onNavigate) return;
          event.preventDefault();
          onNavigate(href);
        }}
        style={linkStyle}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target={isExternalHref(href) ? '_blank' : undefined}
      rel={isExternalHref(href) ? 'noreferrer' : undefined}
      style={linkStyle}
    >
      {children}
    </a>
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string, onNavigate?: (href: string) => void): ReactNode[] {
  const matches = [...text.matchAll(INLINE_PATTERN)];
  if (matches.length === 0) {
    return [text];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > cursor) {
      nodes.push(<Fragment key={`${keyPrefix}-text-${cursor}`}>{text.slice(cursor, matchIndex)}</Fragment>);
    }

    if (match[2] && match[3]) {
      nodes.push(
        <ArticleLink key={`${keyPrefix}-link-${matchIndex}`} href={match[3]} onNavigate={onNavigate}>
          {match[2]}
        </ArticleLink>
      );
    } else if (match[4]) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${matchIndex}`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
            fontSize: '0.92em',
            padding: '0.08rem 0.34rem',
            borderRadius: '0.45rem',
            background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
          }}
        >
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-em-${matchIndex}`} style={{ fontWeight: 700, fontStyle: 'italic' }}>
          {renderInlineMarkdown(match[5], `${keyPrefix}-strong-em-${matchIndex}`, onNavigate)}
        </strong>
      );
    } else if (match[6]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${matchIndex}`} style={{ fontWeight: 700 }}>
          {renderInlineMarkdown(match[6], `${keyPrefix}-strong-${matchIndex}`, onNavigate)}
        </strong>
      );
    } else if (match[7]) {
      nodes.push(
        <em key={`${keyPrefix}-em-${matchIndex}`} style={{ fontStyle: 'italic' }}>
          {renderInlineMarkdown(match[7], `${keyPrefix}-em-${matchIndex}`, onNavigate)}
        </em>
      );
    }

    cursor = matchIndex + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-text-${cursor}`}>{text.slice(cursor)}</Fragment>);
  }

  return nodes;
}

function renderSectionHeading(label: string, maxWidth = DETAIL_SECTION_WIDTH) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        marginBottom: '1.1rem',
        maxWidth,
      }}
    >
      <Footnote
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontSize: '0.68rem',
          opacity: 0.74,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Footnote>
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'color-mix(in srgb, var(--color-secondary) 28%, transparent)',
        }}
      />
    </div>
  );
}

function renderMeta(meta: NodeArticleMeta | undefined, onNavigate?: (href: string) => void) {
  if (!meta) return null;

  const metaItems: Array<{ label: string; value: string }> = [];

  if (meta.dateLabel) {
    metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.date, value: meta.dateLabel });
  }

  if (meta.location) {
    metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.place, value: meta.location });
  }

  if (meta.readingTime) {
    metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.read, value: meta.readingTime });
  }

  if (meta.status) {
    metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.status, value: meta.status });
  }

  if (metaItems.length === 0 && !meta.links?.length) {
    return null;
  }

  return (
    <div style={{ marginTop: '1.2rem' }}>
      {metaItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.95rem 1.4rem',
          }}
        >
          {metaItems.map((item) => (
            <div key={item.label}>
              <Footnote
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.11em',
                  fontSize: '0.64rem',
                  opacity: 0.64,
                }}
              >
                {item.label}
              </Footnote>
              <div style={{ marginTop: '0.22rem', fontSize: '0.93rem', lineHeight: 1.45 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta.links && meta.links.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.55rem 1rem',
            marginTop: metaItems.length > 0 ? '1rem' : 0,
          }}
        >
          {meta.links.map((link) => (
            <ArticleLink
              key={`${link.label}-${link.href}`}
              href={link.href}
              onNavigate={onNavigate}
              style={{ fontSize: '0.92rem', fontWeight: 600 }}
            >
              {link.label}
            </ArticleLink>
          ))}
        </div>
      )}
    </div>
  );
}

function renderContentBlock(block: ContentBlock | ArticleBlock, index: number, onNavigate?: (href: string) => void) {
  if (block.type === 'text') {
    return (
      <Paragraph
        key={`text-${index}`}
        style={{
          maxWidth: DETAIL_READING_WIDTH,
          fontSize: '0.92rem',
          lineHeight: 1.78,
          paddingLeft: 0,
          paddingRight: 0,
          marginTop: 0,
          marginBottom: '1rem',
        }}
      >
        {renderInlineMarkdown(block.text, `text-${index}`, onNavigate)}
      </Paragraph>
    );
  }

  if (block.type === 'quote') {
    return (
      <blockquote
        key={`quote-${index}`}
        style={{
          maxWidth: DETAIL_READING_WIDTH,
          margin: '0 0 1.35rem',
          padding: '0.15rem 0 0.15rem 1rem',
          color: 'var(--color-text)',
          fontStyle: 'italic',
          lineHeight: 1.72,
          borderLeft: '2px solid color-mix(in srgb, var(--color-secondary) 48%, transparent)',
          opacity: 0.9,
        }}
      >
        {renderInlineMarkdown(block.text, `quote-${index}`, onNavigate)}
      </blockquote>
    );
  }

  if (block.type === 'list') {
    return (
      <ul
        key={`list-${index}`}
        style={{
          maxWidth: DETAIL_READING_WIDTH,
          margin: '0 0 1.2rem',
          paddingLeft: '1.15rem',
          color: 'var(--color-text)',
          lineHeight: 1.72,
        }}
      >
        {block.items.map((item, itemIndex) => (
          <li key={`${item}-${itemIndex}`} style={{ marginBottom: '0.38rem' }}>
            {renderInlineMarkdown(item, `list-${index}-${itemIndex}`, onNavigate)}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'image') {
    return (
      <figure
        key={`image-${index}`}
        style={{
          maxWidth: DETAIL_READING_WIDTH,
          margin: '0 0 1.35rem',
        }}
      >
        <img
          src={resolveAssetUrl(block.src)}
          alt={block.alt}
          style={{
            display: 'block',
            width: '100%',
            borderRadius: '16px',
            objectFit: 'contain',
            background: 'color-mix(in srgb, var(--color-background) 94%, white 6%)',
          }}
        />
        {block.caption && (
          <figcaption
            style={{
              marginTop: '0.58rem',
              color: 'var(--color-text)',
              opacity: 0.78,
              fontSize: '0.78rem',
              lineHeight: 1.58,
              textAlign: 'center',
            }}
          >
            {renderInlineMarkdown(block.caption, `image-caption-${index}`, onNavigate)}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === 'link') {
    return (
      <div key={`link-${index}`} style={{ maxWidth: DETAIL_READING_WIDTH, marginBottom: '1rem' }}>
        <ArticleLink href={block.href} onNavigate={onNavigate} style={{ fontWeight: 600 }}>
          {block.label}
        </ArticleLink>
        {block.description && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', lineHeight: 1.65, opacity: 0.84 }}>
            {renderInlineMarkdown(block.description, `link-description-${index}`, onNavigate)}
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'gallery') {
    return (
      <ArticleGalleryBlock
        key={`gallery-${index}`}
        items={block.items}
        columns={block.columns}
        align={block.align}
        keyPrefix={`gallery-${index}`}
        maxWidth={DETAIL_SECTION_WIDTH}
        renderCaption={(caption, captionKeyPrefix) => renderInlineMarkdown(caption, captionKeyPrefix, onNavigate)}
      />
    );
  }

  if (block.type === 'callout') {
    return (
      <div
        key={`callout-${index}`}
        style={{
          maxWidth: DETAIL_READING_WIDTH,
          marginBottom: '1.3rem',
          padding: '1rem 1.05rem',
          borderRadius: '18px',
          background:
            block.tone === 'highlight'
              ? 'color-mix(in srgb, var(--color-secondary) 12%, var(--color-background))'
              : 'color-mix(in srgb, var(--color-background) 88%, white 12%)',
        }}
      >
        {block.title && (
          <Footnote
            style={{
              display: 'block',
              marginBottom: '0.45rem',
              textTransform: 'uppercase',
              letterSpacing: '0.11em',
              fontSize: '0.64rem',
              opacity: 0.7,
            }}
          >
            {block.title}
          </Footnote>
        )}
        <div style={{ fontSize: '0.92rem', lineHeight: 1.72 }}>
          {renderInlineMarkdown(block.text, `callout-${index}`, onNavigate)}
        </div>
      </div>
    );
  }

  return null;
}

function renderSection(section: NodeArticleSection, index: number, onNavigate?: (href: string) => void) {
  return (
    <section
      key={section.id ?? `${section.label}-${index}`}
      style={{
        marginTop: index === 0 ? '2.2rem' : '2.5rem',
        maxWidth: DETAIL_SECTION_WIDTH,
        marginInline: 'auto',
      }}
    >
      {renderSectionHeading(section.label)}
      <div>{section.blocks.map((block, blockIndex) => renderContentBlock(block, blockIndex, onNavigate))}</div>
    </section>
  );
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
  const transitionName = decodedNodeId ? getNodeTransitionName(decodedNodeId) : undefined;
  const heroSectionRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!transitionName) return;
    playSharedElementEnterTransition(heroSectionRef.current, transitionName);
  }, [transitionName]);

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

    handleNavigateWithTransition('/');
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
  }, [graphModel]);

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
          <ThemePicker theme={theme} setTheme={handleThemeChange} variant="inline" />
        </div>

        <section
          ref={heroSectionRef}
          style={{
            marginTop: '1.15rem',
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
            padding: '2.3rem 2rem 2.35rem',
            borderRadius: '34px',
            background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
            viewTransitionName: transitionName,
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

          {renderMeta(node.meta, handleNavigateWithTransition)}

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
                  {renderInlineMarkdown(node.hero.image.caption, 'hero-caption', handleNavigateWithTransition)}
                </figcaption>
              )}
            </figure>
          )}
        </section>

        {node.gallery && node.gallery.length > 0 && (
          <section style={{ marginTop: '2.2rem', maxWidth: DETAIL_SECTION_WIDTH, marginInline: 'auto' }}>
            {renderSectionHeading(UI_COPY.nodeDetailPage.sections.gallery)}
            <ArticleGalleryBlock
              items={node.gallery}
              columns={Math.min(3, Math.max(1, node.gallery.length))}
              align="height"
              keyPrefix="top-gallery"
              maxWidth={DETAIL_SECTION_WIDTH}
              marginBottom="0"
              renderCaption={(caption, captionKeyPrefix) => renderInlineMarkdown(caption, captionKeyPrefix, handleNavigateWithTransition)}
            />
          </section>
        )}

        {articleSections && articleSections.length > 0 && articleSections.map((section, index) => renderSection(section, index, handleNavigateWithTransition))}

        {(!articleSections || articleSections.length === 0) && node.detail && node.detail.length > 0 && (
          <section
            style={{
              marginTop: '2.2rem',
              maxWidth: DETAIL_SECTION_WIDTH,
              marginInline: 'auto',
            }}
          >
            {renderSectionHeading(UI_COPY.nodeDetailPage.sections.story)}
            <div>{node.detail.map((block, index) => renderContentBlock(block, index, handleNavigateWithTransition))}</div>
          </section>
        )}

        {relatedEntries.length > 0 && (
          <section
            style={{
              marginTop: '2.4rem',
              maxWidth: DETAIL_SECTION_WIDTH,
              marginInline: 'auto',
            }}
          >
            {renderSectionHeading(UI_COPY.nodeDetailPage.sections.connectedNodes)}
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
                    captureSharedElementTransition(event.currentTarget, getNodeTransitionName(relatedNodeId));
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
                    viewTransitionName: getNodeTransitionName(relatedNodeId),
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
