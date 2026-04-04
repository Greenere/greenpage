import { useEffect, useMemo, useState } from 'react';

import { DOMAIN_ORDER, type DomainId } from '../../configs/content/domains';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { getDisplayDomain } from '../graph/content/Nodes';
import type { EditorNodeOption } from './editorApi';
import { getEditorNodeSearchText, getEditorNodeTitle, sortNodeRefs } from './editorNodeUtils';

function inputStyle() {
  return {
    width: '100%',
    padding: '0.6rem 0.72rem',
    borderRadius: '10px',
    border: '1px solid color-mix(in srgb, var(--color-secondary) 34%, transparent)',
    background: 'transparent',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  };
}

type BrowseNodesDialogProps = {
  open: boolean;
  nodes: EditorNodeOption[];
  currentNodeId: string;
  currentDomain?: DomainId;
  onClose: () => void;
  onSelect: (nodeId: string) => void;
};

export default function BrowseNodesDialog({
  open,
  nodes,
  currentNodeId,
  currentDomain,
  onClose,
  onSelect,
}: BrowseNodesDialogProps) {
  const [query, setQuery] = useState('');
  const [closeHovered, setCloseHovered] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const domainOrder = useMemo(() => {
    if (!currentDomain) return DOMAIN_ORDER;
    return [currentDomain, ...DOMAIN_ORDER.filter((domain) => domain !== currentDomain)];
  }, [currentDomain]);

  const filteredNodeIds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return null;

    return new Set(
      nodes
        .filter((node) => getEditorNodeSearchText(node).includes(normalizedQuery))
        .map((node) => node.id),
    );
  }, [nodes, query]);

  const nodesByDomain = useMemo(
    () =>
      new Map(
        domainOrder.map((domain) => [
          domain,
          nodes
            .filter((node) => node.domain === domain && (!filteredNodeIds || filteredNodeIds.has(node.id)))
            .sort(sortNodeRefs),
        ]),
      ),
    [domainOrder, filteredNodeIds, nodes],
  );

  const firstMatch = useMemo(() => {
    for (const domain of domainOrder) {
      const match = nodesByDomain.get(domain)?.[0];
      if (match) return match;
    }
    return null;
  }, [domainOrder, nodesByDomain]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: 'max(1.2rem, 6vh) 1.2rem 1.2rem',
        background: 'color-mix(in srgb, black 30%, transparent)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={UI_COPY.nodeEditor.common.openNode}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(52rem, 100%)',
          maxHeight: 'min(80vh, 52rem)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem',
          overflow: 'hidden',
          borderRadius: '22px',
          background: 'color-mix(in srgb, var(--color-background) 94%, white 6%)',
          border: '1px solid color-mix(in srgb, var(--color-secondary) 26%, transparent)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{UI_COPY.nodeEditor.common.openNode}</div>
            <div style={{ marginTop: '0.22rem', fontSize: '0.82rem', opacity: 0.65 }}>
              {UI_COPY.nodeEditor.common.browseNodesHint}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            onFocus={() => setCloseHovered(true)}
            onBlur={() => setCloseHovered(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'color-mix(in srgb, crimson 72%, var(--color-text))',
              padding: 0,
              width: '1.45rem',
              height: '1.45rem',
              lineHeight: 1,
              fontSize: closeHovered ? '0.92rem' : '0.72rem',
              fontFamily: 'inherit',
              transform: closeHovered ? 'scale(1.14)' : 'scale(1)',
              transition: 'transform 0.14s ease, font-size 0.14s ease, color 0.14s ease',
            }}
          >
            ✕
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
            if (event.key === 'Enter' && firstMatch) {
              event.preventDefault();
              onSelect(firstMatch.id);
              onClose();
            }
          }}
          placeholder={UI_COPY.nodeEditor.common.searchNodes}
          style={inputStyle()}
        />

        <div
          style={{
            marginTop: '0.9rem',
            overflowY: 'auto',
            paddingRight: '0.25rem',
            display: 'grid',
            gap: '1rem',
            paddingBottom: '0.5rem',
          }}
        >
          {domainOrder.map((domain) => {
            const domainNodes = nodesByDomain.get(domain) ?? [];
            if (domainNodes.length === 0) return null;

            return (
              <section key={domain}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.55rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      opacity: 0.72,
                    }}
                  >
                    {getDisplayDomain(domain)}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: '1px',
                      background: 'color-mix(in srgb, var(--color-secondary) 24%, transparent)',
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem', paddingRight: '0.35rem', paddingLeft: '0.35rem' }}>
                  {domainNodes.map((node) => {
                    const isCurrent = node.id === currentNodeId;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          onSelect(node.id);
                          onClose();
                        }}
                        style={{
                          width: 'calc(100% - 0.1rem)',
                          justifySelf: 'start',
                          padding: '0.7rem 0.8rem',
                          borderRadius: '12px',
                          border: '1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)',
                          background: isCurrent
                            ? 'color-mix(in srgb, var(--color-background) 82%, white 18%)'
                            : 'transparent',
                          color: 'var(--color-text)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            gap: '0.8rem',
                          }}
                        >
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.35 }}>
                            {getEditorNodeTitle(node, node.id)}
                          </div>
                          {isCurrent ? (
                            <div
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                opacity: 0.6,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {UI_COPY.nodeEditor.common.currentNode}
                            </div>
                          ) : null}
                        </div>
                        <div style={{ marginTop: '0.18rem', fontSize: '0.74rem', opacity: 0.68, lineHeight: 1.45 }}>
                          {node.domain} / {node.id}
                          {node.subtitle ? ` · ${node.subtitle}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {firstMatch === null ? (
            <div
              style={{
                padding: '1rem 0.2rem',
                fontSize: '0.84rem',
                opacity: 0.62,
              }}
            >
              {UI_COPY.nodeEditor.common.noMatchingNodes}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
