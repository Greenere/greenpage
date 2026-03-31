import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { applyThemeVars } from '../../shared/styles/colors';
import { Footnote, ImageBlock, Paragraph } from '../../shared/ui/StyledTextBlocks';
import { navigateWithViewTransition } from '../../shared/ui/viewTransitions';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from './content/BioTheme';
import {
  getDisplayDomain,
  getGraphRelations,
  getNodeDetailPath,
  getNodeTransitionName,
  loadGraphModel,
  readCachedGraphModel,
  resolveAssetUrl,
  type ContentBlock,
  type GraphContentNode,
  type GraphModel,
  type GraphRelation,
  type NodeGalleryImage,
} from './content/Nodes';

const GRAPH_RETURN_FOCUS_NODE_KEY = 'greenpage-graph-return-focus-node';

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

function getRelatedEntries(model: GraphModel, node: GraphContentNode) {
  const nodeById = new Map(model.nodes.map((entry) => [entry.id, entry]));

  return getGraphRelations(model)
    .filter((relation) => relation.from === node.id || relation.to === node.id)
    .filter((relation) => relation.from !== 'bio' && relation.to !== 'bio')
    .map((relation) => {
      const relatedId = relation.from === node.id ? relation.to : relation.from;
      return {
        relation,
        relatedNode: nodeById.get(relatedId) ?? null,
      };
    })
    .filter((entry): entry is { relation: GraphRelation; relatedNode: GraphContentNode } => entry.relatedNode !== null)
    .sort((left, right) => right.relation.strength - left.relation.strength || left.relatedNode.title.localeCompare(right.relatedNode.title))
    .slice(0, 8);
}

function renderGalleryImage(image: NodeGalleryImage, index: number) {
  return (
    <figure
      key={`${image.src}-${index}`}
      style={{
        margin: 0,
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1.5px solid color-mix(in srgb, var(--color-secondary) 52%, transparent)',
        background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
        boxShadow: '0 18px 34px rgba(0, 0, 0, 0.08)',
      }}
    >
      <img
        src={resolveAssetUrl(image.src)}
        alt={image.alt}
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '4 / 3',
          objectFit: 'cover',
        }}
      />
      {image.caption && (
        <figcaption
          style={{
            padding: '0.8rem 0.95rem 0.95rem',
            color: 'var(--color-text)',
            fontSize: '0.85rem',
            lineHeight: 1.45,
          }}
        >
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function renderContentBlock(block: ContentBlock, index: number) {
  if (block.type === 'text') {
    return (
      <Paragraph
        key={`text-${index}`}
        style={{
          fontSize: '0.9rem',
          lineHeight: 1.72,
          paddingLeft: 0,
          paddingRight: 0,
          marginTop: 0,
          marginBottom: '1rem',
        }}
      >
        {block.text}
      </Paragraph>
    );
  }

  if (block.type === 'quote') {
    return (
      <blockquote
        key={`quote-${index}`}
        style={{
          margin: '0 0 1.2rem',
          padding: '1rem 1.1rem',
          borderLeft: '4px solid var(--color-secondary)',
          background: 'color-mix(in srgb, var(--color-background) 88%, white 12%)',
          color: 'var(--color-text)',
          fontStyle: 'italic',
          lineHeight: 1.65,
          borderRadius: '0 16px 16px 0',
        }}
      >
        "{block.text}"
      </blockquote>
    );
  }

  if (block.type === 'list') {
    return (
      <ul
        key={`list-${index}`}
        style={{
          margin: '0 0 1.2rem',
          paddingLeft: '1.15rem',
          color: 'var(--color-text)',
          lineHeight: 1.7,
        }}
      >
        {block.items.map((item) => (
          <li key={item} style={{ marginBottom: '0.35rem' }}>
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'image') {
    return (
      <div key={`image-${index}`} style={{ marginBottom: '1.3rem' }}>
        <ImageBlock src={resolveAssetUrl(block.src)} alt={block.alt} caption={block.caption} />
      </div>
    );
  }

  if (block.type === 'link') {
    return (
      <div key={`link-${index}`} style={{ marginBottom: '1rem' }}>
        <a
          href={block.href}
          target={isExternalHref(block.href) ? '_blank' : undefined}
          rel={isExternalHref(block.href) ? 'noreferrer' : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: 'var(--color-text)',
            fontWeight: 600,
            textDecoration: 'underline',
            textUnderlineOffset: '0.2em',
          }}
        >
          {block.label}
        </a>
      </div>
    );
  }

  return null;
}

const NodeDetailPage: React.FC = () => {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const decodedNodeId = nodeId ? decodeURIComponent(nodeId) : '';
  const [graphModel, setGraphModel] = useState<GraphModel | null>(() => readCachedGraphModel());
  const [graphError, setGraphError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const transitionName = decodedNodeId ? getNodeTransitionName(decodedNodeId) : undefined;

  const handleBackToGraph = () => {
    if (decodedNodeId) {
      window.sessionStorage.setItem(GRAPH_RETURN_FOCUS_NODE_KEY, decodedNodeId);
    }

    navigateWithViewTransition(() => {
      navigate('/');
    });
  };

  const handleOpenRelatedNode = (relatedNodeId: string) => {
    navigateWithViewTransition(() => {
      navigate(getNodeDetailPath(relatedNodeId));
    });
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
    let cancelled = false;

    if (graphModel) {
      return () => {
        cancelled = true;
      };
    }

    loadGraphModel()
      .then((model) => {
        if (cancelled) return;
        setGraphModel(model);
        setGraphError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGraphError(error instanceof Error ? error.message : 'Failed to load graph content.');
      });

    return () => {
      cancelled = true;
    };
  }, [graphModel]);

  const node = graphModel?.nodes.find((entry) => entry.id === decodedNodeId) ?? null;
  const relatedEntries = graphModel && node ? getRelatedEntries(graphModel, node) : [];

  if (graphError) {
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', color: 'crimson' }}>
        Error loading node content: {graphError}
      </div>
    );
  }

  if (!graphModel) {
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', color: 'var(--color-text)' }}>
        Loading node content...
      </div>
    );
  }

  if (!node) {
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
          <h1 style={{ marginBottom: '0.75rem' }}>Node not found</h1>
          <p style={{ lineHeight: 1.6, marginBottom: '1.25rem' }}>
            The node &quot;{decodedNodeId}&quot; does not exist in the current graph dataset.
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
            Return to the graph
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', color: 'var(--color-text)' }}>
      <div
        style={{
          maxWidth: '70rem',
          margin: '0 auto',
          padding: '2rem 1.25rem 4rem',
        }}
      >
        <Link
          to="/"
          onClick={(event) => {
            event.preventDefault();
            handleBackToGraph();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: 'var(--color-text)',
            fontWeight: 600,
            textDecoration: 'underline',
            textUnderlineOffset: '0.18em',
          }}
        >
          Back to graph
        </Link>

        <section
          style={{
            marginTop: '1rem',
            padding: '1.4rem 1.3rem 1.6rem',
            borderRadius: '28px',
            border: '1.5px solid color-mix(in srgb, var(--color-secondary) 52%, transparent)',
            background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
            boxShadow: '0 28px 54px rgba(0, 0, 0, 0.08)',
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
              margin: '0.4rem 0 0',
              fontSize: 'clamp(2rem, 5vw, 3.4rem)',
              lineHeight: 0.98,
            }}
          >
            {node.title}
          </h1>
          {node.subtitle && (
            <div style={{ marginTop: '0.75rem', fontSize: '1.05rem', opacity: 0.82 }}>
              {node.subtitle}
            </div>
          )}
          <p
            style={{
              margin: '1rem 0 0',
              maxWidth: '54rem',
              fontSize: '1rem',
              lineHeight: 1.75,
            }}
          >
            {node.summary}
          </p>
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
                    padding: '0.32rem 0.72rem',
                    borderRadius: '999px',
                    border: '1px solid color-mix(in srgb, var(--color-secondary) 48%, transparent)',
                    background: 'color-mix(in srgb, var(--color-background) 82%, white 18%)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </section>

        {node.gallery && node.gallery.length > 0 && (
          <section style={{ marginTop: '1.5rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              {node.gallery.map(renderGalleryImage)}
            </div>
          </section>
        )}

        {node.detail && node.detail.length > 0 && (
          <section
            style={{
              marginTop: '1.5rem',
              padding: '1.4rem 1.3rem 1.2rem',
              borderRadius: '24px',
              border: '1.5px solid color-mix(in srgb, var(--color-secondary) 42%, transparent)',
              background: 'color-mix(in srgb, var(--color-background) 92%, white 8%)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem' }}>Story</h2>
            {node.detail.map(renderContentBlock)}
          </section>
        )}

        {relatedEntries.length > 0 && (
          <section
            style={{
              marginTop: '1.5rem',
              padding: '1.4rem 1.3rem',
              borderRadius: '24px',
              border: '1.5px solid color-mix(in srgb, var(--color-secondary) 42%, transparent)',
              background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.15rem' }}>Connected nodes</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.85rem',
              }}
            >
              {relatedEntries.map(({ relation, relatedNode }) => (
                <Link
                  key={relation.id}
                  to={getNodeDetailPath(relatedNode.id)}
                  onClick={(event) => {
                    event.preventDefault();
                    handleOpenRelatedNode(relatedNode.id);
                  }}
                  style={{
                    display: 'block',
                    padding: '0.95rem 1rem',
                    borderRadius: '18px',
                    border: '1px solid color-mix(in srgb, var(--color-secondary) 45%, transparent)',
                    color: 'var(--color-text)',
                    background: 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
                    textDecoration: 'none',
                    boxShadow: '0 14px 26px rgba(0, 0, 0, 0.06)',
                    viewTransitionName: getNodeTransitionName(relatedNode.id),
                  }}
                >
                  <Footnote
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      opacity: 0.7,
                      fontSize: '0.62rem',
                    }}
                  >
                    {relation.kind}
                  </Footnote>
                  <div style={{ marginTop: '0.35rem', fontWeight: 700, fontSize: '0.95rem' }}>
                    {relatedNode.title}
                  </div>
                  <div style={{ marginTop: '0.45rem', fontSize: '0.82rem', lineHeight: 1.5, opacity: 0.82 }}>
                    {relation.label}
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
