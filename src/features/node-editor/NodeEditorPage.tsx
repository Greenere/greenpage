import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DOMAIN_CONFIG, DOMAIN_ORDER, isDomainId, type DomainId } from '../../configs/domains';
import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graphHighlight';
import { EDIT_RELATION_ICON, type ConfigurableIcon } from '../../configs/icons';
import { UI_COPY } from '../../configs/uiCopy';
import {
  CHRONOLOGY_FORMAT_HINT,
  getChronologySortKeySafe,
  getChronologyValidationError,
  getCurrentMonthChronologyValue,
  normalizeChronologyValue,
} from '../../shared/chronology';
import { applyThemeVars } from '../../shared/styles/colors';
import ThemePicker from '../graph-home/ThemePicker';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from '../graph-home/content/BioTheme';
import {
  getDisplayDomain,
  normalizeNodeContent,
  resolveAssetUrl,
  type ArticleBlock,
  type GraphContentNode,
  type GraphNodeContent,
  type GraphNodeRef,
  type NodeArticleSection,
} from '../graph-home/content/Nodes';
import NodeArticlePreview from './NodeArticlePreview';
import {
  DETAIL_READING_WIDTH,
  DETAIL_SECTION_WIDTH,
  renderContentBlock,
  renderMeta,
  renderSectionHeading,
} from './articlePreviewShared';
import {
  createEditorDomain,
  deleteEditorDomain,
  createEditorNode,
  type EditorExplicitRelation,
  type EditorNodeOption,
  fetchEditorBootstrap,
  fetchEditorNode,
  saveEditorNode,
  type NewNodeDraft,
} from './editorApi';
import { createTemplateContent, getDefaultKindForDomain, NODE_TEMPLATE_OPTIONS } from './templates';

const EDITOR_DRAFT_STORAGE_PREFIX = 'greenpage-node-editor-draft:';
const EDITOR_PENDING_NEW_DOMAIN_KEY = 'greenpage-node-editor-pending-new-domain';

type EditorTab = 'content' | 'json' | 'new-node' | 'new-domain';

const TAB_LABELS: Record<EditorTab, string> = {
  content: 'Edit',
  json: 'JSON',
  'new-node': 'New Node',
  'new-domain': 'New Domain',
};

type ValidationState = {
  error: string | null;
};

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

type NewDomainDraft = {
  domainId: string;
  display: string;
  cardTag: string;
  seedAngle: number;
};

type DomainTreemapEntry = {
  domain: DomainId;
  display: string;
  cardTag: string;
  count: number;
  removable: boolean;
};

const RELATION_KIND_OPTIONS: EditorExplicitRelation['kind'][] = [
  'time',
  'location',
  'topic',
  'reason',
  'outcome',
  'tool',
];

function getDraftStorageKey(nodeId: string) {
  return `${EDITOR_DRAFT_STORAGE_PREFIX}${nodeId}`;
}

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseCommaSeparatedTags(value: string) {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function serializeTags(tags?: string[]) {
  return tags?.join(', ') ?? '';
}

function validateContent(content: GraphNodeContent, nodeId: string): ValidationState {
  try {
    normalizeNodeContent(JSON.parse(prettyJson(content)), nodeId);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid node content.' };
  }
}

function createEmptySection(): NodeArticleSection {
  return {
    label: 'New section',
    blocks: [
      {
        type: 'text',
        text: 'Start writing here.',
      },
    ],
  };
}

const IMAGE_LINE_PATTERN = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/;
const LINK_LINE_PATTERN = /^\[([^\]]+)\]\((\S+?)\)$/;

function trimBlockText(value: string) {
  return value.trim().replace(/\n{3,}/g, '\n\n');
}

function serializeImageLine(src: string, alt: string, caption?: string) {
  return `![${alt}](${src}${caption ? ` "${caption}"` : ''})`;
}

function serializeSectionMarkdown(section: NodeArticleSection) {
  return section.blocks
    .map((block) => {
      if (block.type === 'text') return block.text.trim();
      if (block.type === 'quote') return block.text.split('\n').map((line) => `> ${line}`).join('\n');
      if (block.type === 'list') return block.items.map((item) => `- ${item}`).join('\n');
      if (block.type === 'image') return serializeImageLine(block.src, block.alt, block.caption);
      if (block.type === 'link') {
        if (block.description) {
          return `::link [${block.label}](${block.href})\n${block.description}\n:::`;
        }
        return `[${block.label}](${block.href})`;
      }
      if (block.type === 'gallery') {
        const header = `:::gallery columns=${block.columns ?? 2} align=${block.align ?? 'height'}`;
        const body = block.items.map((item) => serializeImageLine(item.src, item.alt, item.caption)).join('\n');
        return `${header}\n${body}\n:::`;
      }
      if (block.type === 'callout') {
        const titleSuffix = block.title ? ` ${block.title}` : '';
        return `:::${block.tone ?? 'note'}${titleSuffix}\n${block.text}\n:::`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function parseSectionMarkdown(markdown: string): ArticleBlock[] {
  const source = markdown.replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const blocks: ArticleBlock[] = [];
  let index = 0;

  const flushParagraph = (paragraphLines: string[]) => {
    const text = trimBlockText(paragraphLines.join('\n'));
    if (!text) return;

    const imageMatch = text.match(IMAGE_LINE_PATTERN);
    if (imageMatch) {
      blocks.push({ type: 'image', alt: imageMatch[1], src: imageMatch[2], caption: imageMatch[3] || undefined });
      return;
    }

    const linkMatch = text.match(LINK_LINE_PATTERN);
    if (linkMatch) {
      blocks.push({ type: 'link', label: linkMatch[1], href: linkMatch[2] });
      return;
    }

    blocks.push({ type: 'text', text });
  };

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith(':::gallery')) {
      const columnsMatch = line.match(/columns=(1|2|3)/);
      const alignMatch = line.match(/align=(height|natural)/);
      const items: NonNullable<Extract<ArticleBlock, { type: 'gallery' }>['items']> = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== ':::') {
        const imageLine = lines[index].trim();
        if (imageLine) {
          const imageMatch = imageLine.match(IMAGE_LINE_PATTERN);
          if (!imageMatch) throw new Error('Gallery blocks only support markdown image lines.');
          items.push({ alt: imageMatch[1], src: imageMatch[2], caption: imageMatch[3] || undefined });
        }
        index += 1;
      }

      if (lines[index]?.trim() !== ':::') throw new Error('Gallery block is missing closing :::.');
      if (items.length === 0) throw new Error('Gallery block needs at least one image.');

      blocks.push({
        type: 'gallery',
        items,
        columns: columnsMatch ? (Number(columnsMatch[1]) as 1 | 2 | 3) : 2,
        align: alignMatch ? (alignMatch[1] as 'height' | 'natural') : 'height',
      });
      index += 1;
      continue;
    }

    if (line.startsWith(':::note') || line.startsWith(':::highlight')) {
      const tone = line.startsWith(':::highlight') ? 'highlight' : 'note';
      const title = line.replace(/^:::(?:note|highlight)\s*/, '').trim() || undefined;
      const bodyLines: string[] = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== ':::') {
        bodyLines.push(lines[index]);
        index += 1;
      }

      if (lines[index]?.trim() !== ':::') throw new Error('Callout block is missing closing :::.');
      blocks.push({ type: 'callout', tone, title, text: trimBlockText(bodyLines.join('\n')) });
      index += 1;
      continue;
    }

    if (line.startsWith('::link ')) {
      const linkMatch = line.slice('::link '.length).trim().match(LINK_LINE_PATTERN);
      if (!linkMatch) throw new Error('Custom link blocks should start with ::link [label](href).');

      const bodyLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ':::') {
        bodyLines.push(lines[index]);
        index += 1;
      }

      if (lines[index]?.trim() !== ':::') throw new Error('Custom link block is missing closing :::.');
      blocks.push({
        type: 'link',
        label: linkMatch[1],
        href: linkMatch[2],
        description: trimBlockText(bodyLines.join('\n')) || undefined,
      });
      index += 1;
      continue;
    }

    if (line.startsWith(':::')) {
      blocks.push({ type: 'text', text: line });
      index += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quoteLines.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push({ type: 'quote', text: trimBlockText(quoteLines.join('\n')) });
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith(':::') &&
      !lines[index].trim().startsWith('> ') &&
      !lines[index].trim().startsWith('- ')
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    flushParagraph(paragraphLines);
  }

  return blocks.length > 0 ? blocks : createEmptySection().blocks;
}

function SectionSyntaxHint() {
  return (
    <div
      style={{
        marginTop: '0.5rem',
        fontSize: '0.75rem',
        opacity: 0.75,
        lineHeight: 1.7,
        padding: '0.65rem 0.8rem',
        borderRadius: '10px',
        background: 'color-mix(in srgb, var(--color-background) 82%, white 18%)',
      }}
    >
      <strong>Inline:</strong> plain text paragraphs &nbsp;·&nbsp; <code>{'> quote'}</code> &nbsp;·&nbsp; <code>- item</code> for lists
      <br />
      <strong>Media:</strong> <code>![alt](src "caption")</code> &nbsp;·&nbsp; <code>[label](href)</code> for links
      <br />
      <strong>Blocks:</strong> <code>:::gallery columns=2 align=height</code>…<code>:::</code>
      &nbsp;·&nbsp; <code>:::note</code> or <code>:::highlight</code>…<code>:::</code>
    </div>
  );
}

// SectionEditor — markdown textarea only; label and controls live in InlineSectionCard
function SectionEditor({
  section,
  onChange,
}: {
  section: NodeArticleSection;
  onChange: (next: NodeArticleSection) => void;
}) {
  const [markdown, setMarkdown] = useState(() => serializeSectionMarkdown(section));
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const handleMarkdownChange = (value: string) => {
    setMarkdown(value);
    try {
      onChange({ ...section, blocks: parseSectionMarkdown(value) });
      setMarkdownError(null);
    } catch (error) {
      setMarkdownError(error instanceof Error ? error.message : 'Invalid section syntax.');
    }
  };

  return (
    <div style={{ marginTop: '0.65rem' }}>
      <textarea
        autoFocus
        value={markdown}
        onChange={(event) => handleMarkdownChange(event.target.value)}
        rows={12}
        style={{
          width: '100%',
          padding: '0.85rem',
          borderRadius: '12px',
          border: '1px solid color-mix(in srgb, var(--color-secondary) 35%, transparent)',
          background: 'color-mix(in srgb, var(--color-background) 88%, white 12%)',
          color: 'var(--color-text)',
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          fontSize: '0.83rem',
          lineHeight: 1.65,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          style={{
            fontSize: '0.73rem',
            opacity: 0.6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text)',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          {showHint ? '↑ Hide syntax guide' : '? Syntax guide'}
        </button>
        {markdownError && <div style={{ fontSize: '0.8rem', color: 'crimson' }}>{markdownError}</div>}
      </div>
      {showHint && <SectionSyntaxHint />}
    </div>
  );
}

function InlineSectionCard({
  section,
  sectionIndex,
  isEditing,
  onStartEditing,
  onStopEditing,
  onChange,
  onDelete,
}: {
  section: NodeArticleSection;
  sectionIndex: number;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onChange: (next: NodeArticleSection) => void;
  onDelete: () => void;
}) {
  return (
    <section
      style={{
        marginTop: sectionIndex === 0 ? '2.2rem' : '1.8rem',
        maxWidth: DETAIL_SECTION_WIDTH,
        marginInline: 'auto',
        borderRadius: '18px',
        padding: isEditing ? '0.85rem 1rem 0.9rem' : '0',
        border: isEditing
          ? '1px solid color-mix(in srgb, var(--color-secondary) 32%, transparent)'
          : '1px solid transparent',
        transition: 'border-color 0.15s, padding 0.15s, background 0.15s',
      }}
    >
      {/* Header row: grip + label + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: isEditing ? '0' : '0.15rem' }}>
        {isEditing ? (
          <input
            value={section.label}
            onChange={(event) => onChange({ ...section, label: event.target.value })}
            style={{
              flex: 1,
              padding: '0.28rem 0.5rem',
              borderRadius: '7px',
              border: '1px solid color-mix(in srgb, var(--color-secondary) 35%, transparent)',
              background: 'transparent',
              color: 'var(--color-text)',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div style={{ flex: 1 }}>{renderSectionHeading(section.label)}</div>
        )}
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
          {!isEditing && (
            <button
              type="button"
              onClick={onStartEditing}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '7px',
                fontSize: '0.76rem',
                border: '1px solid color-mix(in srgb, var(--color-secondary) 32%, transparent)',
                background: 'transparent',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: 0.8,
              }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title="Delete section"
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '7px',
              fontSize: '0.76rem',
              border: '1px solid color-mix(in srgb, crimson 22%, transparent)',
              background: 'transparent',
              color: 'color-mix(in srgb, crimson 65%, var(--color-text))',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content: editor or preview */}
      {isEditing ? (
        <div
          tabIndex={-1}
          onBlur={(event) => {
            const nextFocused = event.relatedTarget;
            if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) return;
            onStopEditing();
          }}
        >
          <SectionEditor section={section} onChange={onChange} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.65rem' }}>
            <button
              type="button"
              onClick={onStopEditing}
              style={{
                padding: '0.38rem 0.85rem',
                borderRadius: '9px',
                fontSize: '0.82rem',
                border: '1px solid transparent',
                background: 'var(--color-text)',
                color: 'var(--color-background)',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={onStartEditing}
          style={{ cursor: 'text' }}
        >
          {section.blocks.map((block, blockIndex) => renderContentBlock(block, blockIndex))}
        </div>
      )}

    </section>
  );
}

function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.73rem', fontWeight: 600, marginBottom: '0.25rem', opacity: 0.78, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </div>
  );
}

function FieldShell({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: '0.85rem' }}>{children}</div>;
}

function buildTreemapLayout(
  entries: DomainTreemapEntry[],
  x: number,
  y: number,
  width: number,
  height: number,
): Array<DomainTreemapEntry & { x: number; y: number; width: number; height: number }> {
  if (entries.length === 0 || width <= 0 || height <= 0) return [];
  if (entries.length === 1) {
    return [{ ...entries[0], x, y, width, height }];
  }

  const getWeight = (entry: DomainTreemapEntry) => Math.max(entry.count, 1);
  const total = entries.reduce((sum, entry) => sum + getWeight(entry), 0);
  let bestIndex = 1;
  let bestDelta = Number.POSITIVE_INFINITY;
  let runningTotal = 0;

  for (let index = 1; index < entries.length; index += 1) {
    runningTotal += getWeight(entries[index - 1]);
    const delta = Math.abs(total / 2 - runningTotal);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  const firstGroup = entries.slice(0, bestIndex);
  const secondGroup = entries.slice(bestIndex);
  const firstTotal = firstGroup.reduce((sum, entry) => sum + getWeight(entry), 0);
  const splitByWidth = width >= height;
  const firstFraction = firstTotal / total;

  if (splitByWidth) {
    const firstWidth = width * firstFraction;
    return [
      ...buildTreemapLayout(firstGroup, x, y, firstWidth, height),
      ...buildTreemapLayout(secondGroup, x + firstWidth, y, width - firstWidth, height),
    ];
  }

  const firstHeight = height * firstFraction;
  return [
    ...buildTreemapLayout(firstGroup, x, y, width, firstHeight),
    ...buildTreemapLayout(secondGroup, x, y + firstHeight, width, height - firstHeight),
  ];
}

function DomainTreemap({
  entries,
  onDeleteDomain,
}: {
  entries: DomainTreemapEntry[];
  onDeleteDomain: (entry: DomainTreemapEntry) => void;
}) {
  const sortedEntries = [...entries].sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain));
  const layout = buildTreemapLayout(sortedEntries, 0, 0, 100, 100);
  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  const totalNodes = entries.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '0.9rem 1rem',
          borderRadius: '14px',
          background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
          fontSize: '0.84rem',
          lineHeight: 1.6,
          opacity: 0.82,
        }}
      >
        Current graph size: <strong>{totalNodes}</strong> nodes across <strong>{entries.length}</strong> domains.
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: '0.9rem',
          width: '100%',
          flex: 1,
          minHeight: '20rem',
          borderRadius: '22px',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-background) 92%, white 8%), color-mix(in srgb, var(--color-background) 84%, white 16%))',
          border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
        }}
      >
        {layout.map((entry) => {
          const intensity = 0.18 + (entry.count / maxCount) * 0.34;
          return (
            <div
              key={entry.domain}
              style={{
                position: 'absolute',
                left: `${entry.x}%`,
                top: `${entry.y}%`,
                width: `${entry.width}%`,
                height: `${entry.height}%`,
                padding: '0.9rem',
                border: '1px solid color-mix(in srgb, var(--color-secondary) 18%, transparent)',
                background: `color-mix(in srgb, var(--color-text) ${Math.round(intensity * 100)}%, var(--color-background))`,
                color: intensity > 0.34 ? 'var(--color-background)' : 'var(--color-text)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.72 }}>
                  {entry.cardTag}
                </div>
                {entry.removable ? (
                  <button
                    type="button"
                    onClick={() => onDeleteDomain(entry)}
                    style={{
                      padding: '0.22rem 0.55rem',
                      borderRadius: '999px',
                      border: '1px solid color-mix(in srgb, crimson 22%, transparent)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '0.72rem',
                      fontFamily: 'inherit',
                      opacity: 0.88,
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div>
                <div style={{ fontSize: entry.width < 22 || entry.height < 18 ? '0.95rem' : '1.18rem', fontWeight: 700, lineHeight: 1.05 }}>
                  {entry.display}
                </div>
                <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', opacity: 0.78 }}>
                  {entry.count} node{entry.count === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function createEmptyExplicitRelation(nodeId: string): EditorExplicitRelation {
  return {
    from: nodeId,
    to: '',
    kind: 'topic',
    label: '',
    strength: 2,
  };
}

type EditorConnectedNodeEntry = {
  key: string;
  relatedNodeId: string;
  relatedNodeTitle: string;
  displayKind: string;
  displayLabel: string;
  removable: boolean;
  explicitRelationIndex?: number;
};

function sortNodeRefs(left: GraphNodeRef, right: GraphNodeRef) {
  if (left.domain !== right.domain) {
    return left.domain.localeCompare(right.domain);
  }

  const chronologyDelta = getChronologySortKeySafe(left.chronology) - getChronologySortKeySafe(right.chronology);
  if (chronologyDelta !== 0) {
    return chronologyDelta;
  }

  return left.id.localeCompare(right.id);
}

function getEditorNodeTitle(node: EditorNodeOption | undefined, fallbackId: string) {
  return node?.title?.trim() || fallbackId || node?.id || 'Choose node';
}

function formatEditorNodeOptionLabel(node: GraphNodeRef & { title?: string; subtitle?: string }) {
  if (node.title?.trim() && node.title !== node.id) {
    return `${node.title} — ${node.domain} / ${node.id}`;
  }

  return `${node.domain} / ${node.id}`;
}

function getEditorNodeSearchText(node: EditorNodeOption) {
  return [
    node.title,
    node.subtitle,
    node.id,
    node.domain,
    getDisplayDomain(node.domain),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function renderConfiguredIcon(icon: ConfigurableIcon, size = icon.size.idle) {
  if (icon.kind === 'unicode') {
    return (
      <span
        style={{
          fontSize: `${size}px`,
          lineHeight: 1,
          fontFamily: icon.fontFamily ?? 'inherit',
          fontWeight: icon.fontWeight ?? 600,
        }}
        aria-hidden="true"
      >
        {icon.glyph}
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill={icon.fill ?? 'none'}
      stroke={icon.stroke ?? 'currentColor'}
      strokeWidth={icon.strokeWidth ?? 2}
      fillRule={icon.fillRule}
      strokeLinecap={icon.strokeLinecap ?? 'round'}
      strokeLinejoin={icon.strokeLinejoin ?? 'round'}
      aria-hidden="true"
    >
      {icon.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function getExplicitRelationPeerId(relation: EditorExplicitRelation, currentNodeId: string) {
  if (relation.from === currentNodeId) {
    return relation.to;
  }

  if (relation.to === currentNodeId) {
    return relation.from;
  }

  return relation.to || relation.from;
}

function anchorExplicitRelationToNode(relation: EditorExplicitRelation, currentNodeId: string): EditorExplicitRelation {
  if (relation.from === currentNodeId || relation.to === currentNodeId) {
    return relation;
  }

  return {
    ...relation,
    from: currentNodeId,
  };
}

function isCompleteExplicitRelation(relation: EditorExplicitRelation) {
  return relation.from.trim().length > 0 && relation.to.trim().length > 0;
}

function buildTimelineConnectionEntries(currentNode: GraphNodeRef, nodes: EditorNodeOption[]): EditorConnectedNodeEntry[] {
  const domainNodes = nodes
    .map((node) => (node.id === currentNode.id ? { ...node, chronology: currentNode.chronology } : node))
    .filter((node) => node.domain === currentNode.domain)
    .sort(sortNodeRefs);
  const currentIndex = domainNodes.findIndex((node) => node.id === currentNode.id);

  if (currentIndex === -1) {
    return [];
  }

  const neighbors = [domainNodes[currentIndex - 1], domainNodes[currentIndex + 1]].filter(
    (node): node is EditorNodeOption => Boolean(node)
  );

  return neighbors.map((node, index) => ({
    key: `timeline-${node.id}-${index}`,
    relatedNodeId: node.id,
    relatedNodeTitle: getEditorNodeTitle(node, node.id),
    displayKind: 'sequence',
    displayLabel: UI_COPY.graphRelations.nextInTimeline,
    removable: false,
  }));
}

function buildBioConnectionEntry(currentNode: GraphNodeRef, nodes: EditorNodeOption[]): EditorConnectedNodeEntry | null {
  if (currentNode.id === 'bio') {
    return null;
  }

  const domainNodes = nodes
    .map((node) => (node.id === currentNode.id ? { ...node, chronology: currentNode.chronology } : node))
    .filter((node) => node.domain === currentNode.domain)
    .sort(sortNodeRefs);
  const latestNode = domainNodes[domainNodes.length - 1];

  if (!latestNode || latestNode.id !== currentNode.id) {
    return null;
  }

  return {
    key: 'bio-derived-connection',
    relatedNodeId: 'bio',
    relatedNodeTitle: UI_COPY.nodeDetailPage.bioEntry.title,
    displayKind: UI_COPY.nodeDetailPage.bioEntry.kind,
    displayLabel: UI_COPY.graphRelations.latestNodeInDomain,
    removable: false,
  };
}

function buildExplicitConnectionEntry(
  relation: EditorExplicitRelation,
  relationIndex: number,
  currentNodeId: string,
  nodeById: Map<string, EditorNodeOption>
): EditorConnectedNodeEntry {
  const relatedNodeId = getExplicitRelationPeerId(relation, currentNodeId);
  const relatedNode = nodeById.get(relatedNodeId);
  const hasChosenPeer = Boolean(relatedNodeId);

  return {
    key: `explicit-${relationIndex}-${relation.from}-${relation.to}-${relation.kind}`,
    relatedNodeId,
    relatedNodeTitle: hasChosenPeer ? getEditorNodeTitle(relatedNode, relatedNodeId) : 'Choose node',
    displayKind: relation.kind,
    displayLabel:
      relation.label.trim() ||
      (hasChosenPeer ? 'Add a short label for this connection.' : 'Select the other node to complete this connection.'),
    removable: true,
    explicitRelationIndex: relationIndex,
  };
}

function ConnectedNodeCard({
  entry,
  selected = false,
  onNavigate,
  onInspect,
  onRemove,
}: {
  entry: EditorConnectedNodeEntry;
  selected?: boolean;
  onNavigate?: () => void;
  onInspect?: () => void;
  onRemove?: () => void;
}) {
  const [removeHovered, setRemoveHovered] = useState(false);
  const [cardHovered, setCardHovered] = useState(false);
  const interactive = Boolean(onNavigate);
  const cardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
    padding: '0.8rem 0.85rem',
    paddingRight: onInspect || onRemove ? '2.35rem' : '0.85rem',
    borderRadius: '16px',
    border: selected
      ? '1px solid color-mix(in srgb, var(--color-secondary) 46%, transparent)'
      : '1px solid transparent',
    background: selected || cardHovered
      ? 'color-mix(in srgb, var(--color-background) 80%, white 20%)'
      : 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
    color: 'var(--color-text)',
    textDecoration: 'none',
    textAlign: 'left',
    fontFamily: 'inherit',
    cursor: interactive ? 'pointer' : 'default',
    boxShadow:
      selected || cardHovered
        ? 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-active, 3) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-active, 0.9) * 100%), transparent)'
        : 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-idle, 0) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-idle, 0.8) * 100%), transparent)',
    transform: interactive && cardHovered ? 'translateY(-1px)' : 'translateY(0)',
    transition: 'box-shadow 180ms ease, background-color 180ms ease, transform 180ms ease',
  };

  const content = (
    <>
      <div>
        <div
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            opacity: 0.7,
            fontSize: '0.58rem',
          }}
        >
          {entry.displayKind}
        </div>
        <div style={{ marginTop: '0.3rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
          {entry.relatedNodeTitle}
        </div>
        <div style={{ marginTop: '0.38rem', fontSize: '0.76rem', lineHeight: 1.45, opacity: 0.8 }}>
          {entry.displayLabel}
        </div>
      </div>
    </>
  );

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {onNavigate ? (
        <button
          type="button"
          onClick={onNavigate}
          onMouseEnter={() => setCardHovered(true)}
          onMouseLeave={() => setCardHovered(false)}
          onFocus={() => setCardHovered(true)}
          onBlur={() => setCardHovered(false)}
          style={cardStyle}
          aria-label={`Open ${entry.relatedNodeTitle} in the editor`}
        >
          {content}
        </button>
      ) : (
        <div style={cardStyle}>{content}</div>
      )}
      {onInspect && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onInspect();
          }}
          onMouseEnter={() => setRemoveHovered(true)}
          onMouseLeave={() => setRemoveHovered(false)}
          onFocus={() => setRemoveHovered(true)}
          onBlur={() => setRemoveHovered(false)}
          style={{
            position: 'absolute',
            top: '0.45rem',
            right: onRemove ? '2rem' : '0.45rem',
            width: '1.45rem',
            height: '1.45rem',
            borderRadius: '999px',
            border: 'none',
            background: 'transparent',
            color: 'color-mix(in srgb, var(--color-secondary) 70%, var(--color-text))',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            transition: 'color 0.14s ease',
            opacity: selected ? 0 : 1,
            pointerEvents: selected ? 'none' : 'auto',
          }}
          aria-label={`Edit relation to ${entry.relatedNodeTitle}`}
          title={`Edit relation to ${entry.relatedNodeTitle}`}
        >
          <span
            style={{
              width: `${EDIT_RELATION_ICON.size.active}px`,
              height: `${EDIT_RELATION_ICON.size.active}px`,
              display: 'grid',
              placeItems: 'center',
              transform: `scale(${removeHovered ? 1 : EDIT_RELATION_ICON.size.idle / EDIT_RELATION_ICON.size.active})`,
              transformOrigin: 'center center',
              transition: 'transform 0.14s ease',
            }}
          >
            {renderConfiguredIcon(EDIT_RELATION_ICON, EDIT_RELATION_ICON.size.active)}
          </span>
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onMouseEnter={() => setRemoveHovered(true)}
          onMouseLeave={() => setRemoveHovered(false)}
          onFocus={() => setRemoveHovered(true)}
          onBlur={() => setRemoveHovered(false)}
          style={{
            position: 'absolute',
            top: '0.45rem',
            right: '0.45rem',
            width: '1.45rem',
            height: '1.45rem',
            borderRadius: '999px',
            border: 'none',
            background: 'transparent',
            color: 'color-mix(in srgb, crimson 72%, var(--color-text))',
            cursor: 'pointer',
            fontSize: removeHovered ? '0.92rem' : '0.72rem',
            fontFamily: 'inherit',
            lineHeight: 1,
            transform: removeHovered ? 'scale(1.14)' : 'scale(1)',
            transition: 'transform 0.14s ease, font-size 0.14s ease, color 0.14s ease',
          }}
          aria-label={`Remove connection to ${entry.relatedNodeTitle}`}
          title={`Remove connection to ${entry.relatedNodeTitle}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function AddConnectedNodeCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '0.8rem 0.85rem',
        borderRadius: '16px',
        border: '1px dashed color-mix(in srgb, var(--color-secondary) 38%, transparent)',
        background: hovered ? 'color-mix(in srgb, var(--color-background) 80%, white 20%)' : 'transparent',
        color: 'var(--color-text)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: hovered
          ? 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-active, 3) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-active, 0.9) * 100%), transparent)'
          : 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-idle, 0) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-idle, 0.8) * 100%), transparent)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'box-shadow 180ms ease, background-color 180ms ease, transform 180ms ease',
      }}
      title="Add explicit connection"
    >
      <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>+</div>
      <div style={{ marginTop: '0.5rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
        Add explicit connection
      </div>
      <div style={{ marginTop: '0.38rem', fontSize: '0.76rem', lineHeight: 1.45, opacity: 0.8 }}>
        Link this node to an existing node.
      </div>
    </button>
  );
}

function SearchableNodePicker({
  options,
  value,
  currentDomain,
  onSelect,
  placeholder = 'Search node…',
}: {
  options: EditorNodeOption[];
  value: string;
  currentDomain?: DomainId;
  onSelect: (nodeId: string) => void;
  placeholder?: string;
}) {
  const selectedOption = options.find((node) => node.id === value);
  const [query, setQuery] = useState(() => (selectedOption ? formatEditorNodeOptionLabel(selectedOption) : ''));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption ? formatEditorNodeOptionLabel(selectedOption) : '');
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return options
      .filter((node) => !normalizedQuery || getEditorNodeSearchText(node).includes(normalizedQuery))
      .sort((left, right) => {
        const leftQueryText = getEditorNodeSearchText(left);
        const rightQueryText = getEditorNodeSearchText(right);
        const leftStartsWith = normalizedQuery ? (left.id.toLowerCase().startsWith(normalizedQuery) || (left.title?.toLowerCase().startsWith(normalizedQuery) ?? false)) : false;
        const rightStartsWith = normalizedQuery ? (right.id.toLowerCase().startsWith(normalizedQuery) || (right.title?.toLowerCase().startsWith(normalizedQuery) ?? false)) : false;

        if (leftStartsWith !== rightStartsWith) {
          return leftStartsWith ? -1 : 1;
        }

        const leftInCurrentDomain = currentDomain ? left.domain === currentDomain : false;
        const rightInCurrentDomain = currentDomain ? right.domain === currentDomain : false;
        if (leftInCurrentDomain !== rightInCurrentDomain) {
          return leftInCurrentDomain ? -1 : 1;
        }

        if (leftQueryText !== rightQueryText && normalizedQuery) {
          const leftTitleMatch = leftQueryText.indexOf(normalizedQuery);
          const rightTitleMatch = rightQueryText.indexOf(normalizedQuery);
          if (leftTitleMatch !== rightTitleMatch) {
            return leftTitleMatch - rightTitleMatch;
          }
        }

        return sortNodeRefs(left, right);
      })
      .slice(0, 8);
  }, [currentDomain, options, query]);

  const resetQuery = () => {
    setQuery(selectedOption ? formatEditorNodeOptionLabel(selectedOption) : '');
  };

  const handleSelect = (nodeId: string) => {
    onSelect(nodeId);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            resetQuery();
          }, 0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && filteredOptions.length > 0) {
            event.preventDefault();
            handleSelect(filteredOptions[0].id);
          }
          if (event.key === 'Escape') {
            setOpen(false);
            resetQuery();
          }
        }}
        placeholder={placeholder}
        style={inputStyle()}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.35rem)',
            left: 0,
            right: 0,
            zIndex: 5,
            padding: '0.35rem',
            borderRadius: '12px',
            border: '1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent)',
            background: 'color-mix(in srgb, var(--color-background) 96%, white 4%)',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.08)',
            display: 'grid',
            gap: '0.2rem',
            maxHeight: '16rem',
            overflowY: 'auto',
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((node) => (
              <button
                key={node.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(node.id);
                }}
                style={{
                  padding: '0.55rem 0.6rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: value === node.id ? 'color-mix(in srgb, var(--color-background) 84%, white 16%)' : 'transparent',
                  color: 'var(--color-text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.35 }}>
                  {getEditorNodeTitle(node, node.id)}
                </div>
                <div style={{ marginTop: '0.18rem', fontSize: '0.72rem', opacity: 0.72, lineHeight: 1.45 }}>
                  {node.domain} / {node.id}
                  {node.subtitle ? ` · ${node.subtitle}` : ''}
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: '0.55rem 0.6rem', fontSize: '0.76rem', opacity: 0.68, lineHeight: 1.45 }}>
              No matching nodes.
            </div>
          )}
        </div>
      )}
    </div>
  );
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

const NodeEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { nodeId } = useParams();
  const decodedNodeId = nodeId ? decodeURIComponent(nodeId) : '';
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [tab, setTab] = useState<EditorTab>(decodedNodeId ? 'content' : 'new-node');
  const [bootstrapNodes, setBootstrapNodes] = useState<EditorNodeOption[]>([]);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [currentNodeRef, setCurrentNodeRef] = useState<GraphNodeRef | null>(null);
  const [originalContent, setOriginalContent] = useState<GraphNodeContent | null>(null);
  const [draftContent, setDraftContent] = useState<GraphNodeContent | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [explicitRelations, setExplicitRelations] = useState<EditorExplicitRelation[]>([]);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationState>({ error: null });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingNode, setLoadingNode] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [dangerDialog, setDangerDialog] = useState<DangerDialogState | null>(null);
  const [selectedExplicitRelationIndex, setSelectedExplicitRelationIndex] = useState<number | null>(null);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [showHeaderFields, setShowHeaderFields] = useState(true);
  const [showMeta, setShowMeta] = useState(false);
  const [newNodeDraft, setNewNodeDraft] = useState<NewNodeDraft>({
    nodeId: '',
    domain: DOMAIN_ORDER[0],
    kind: getDefaultKindForDomain(DOMAIN_ORDER[0]),
    chronology: getCurrentMonthChronologyValue(),
    title: 'Untitled node',
    subtitle: '',
    summary: 'Short summary goes here.',
    template: NODE_TEMPLATE_OPTIONS[0].id,
  });
  const [newDomainDraft, setNewDomainDraft] = useState<NewDomainDraft>({
    domainId: '',
    display: '',
    cardTag: '',
    seedAngle: 180,
  });

  // Auto-dismiss status messages after 4 s
  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    applyThemeVars(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    fetchEditorBootstrap()
      .then((payload) => {
        setBootstrapNodes(payload.nodes);
        setBootstrapError(null);
      })
      .catch((error: unknown) => {
        setBootstrapError(error instanceof Error ? error.message : 'Failed to load editor bootstrap.');
      });
  }, []);

  useEffect(() => {
    if (decodedNodeId) return;

    const pendingDomainId = window.sessionStorage.getItem(EDITOR_PENDING_NEW_DOMAIN_KEY);
    if (!pendingDomainId || !isDomainId(pendingDomainId)) return;
    const nextDomainId: DomainId = pendingDomainId;

    setTab('new-node');
    setNewNodeDraft((current) => ({
      ...current,
      domain: nextDomainId,
      kind: getDefaultKindForDomain(nextDomainId),
    }));
    window.sessionStorage.removeItem(EDITOR_PENDING_NEW_DOMAIN_KEY);
  }, [decodedNodeId]);

  useEffect(() => {
    if (!decodedNodeId) {
      setCurrentNodeRef(null);
      setOriginalContent(null);
      setDraftContent(null);
      setTagInput('');
      setExplicitRelations([]);
      setSelectedExplicitRelationIndex(null);
      setJsonDraft('');
      setJsonError(null);
      setValidation({ error: null });
      setEditingSectionIndex(null);
      return;
    }

    setSelectedExplicitRelationIndex(null);
    setLoadingNode(true);
    fetchEditorNode(decodedNodeId)
      .then((payload) => {
        const storedDraft = window.localStorage.getItem(getDraftStorageKey(decodedNodeId));
        const nextContent =
          storedDraft
            ? normalizeNodeContent(JSON.parse(storedDraft), decodedNodeId)
            : normalizeNodeContent(payload.content, decodedNodeId);
        const anchoredRelations = payload.explicitRelations.map((relation) =>
          anchorExplicitRelationToNode(relation, payload.node.id)
        );

        setCurrentNodeRef(payload.node);
        setOriginalContent(payload.content);
        setDraftContent(nextContent);
        setTagInput(serializeTags(nextContent.tags));
        setExplicitRelations(anchoredRelations);
        setSelectedExplicitRelationIndex(null);
        setJsonDraft(prettyJson(nextContent));
        setJsonError(null);
        setValidation(validateContent(nextContent, decodedNodeId));
        setStatusMessage(storedDraft ? 'Recovered browser draft.' : null);
        setTab('content');
        setEditingSectionIndex(null);
      })
      .catch((error: unknown) => {
        setBootstrapError(error instanceof Error ? error.message : 'Failed to load node content.');
      })
      .finally(() => {
        setLoadingNode(false);
      });
  }, [decodedNodeId]);

  useEffect(() => {
    setSelectedExplicitRelationIndex((current) => {
      if (current === null) return current;
      return current < explicitRelations.length ? current : explicitRelations.length > 0 ? explicitRelations.length - 1 : null;
    });
  }, [explicitRelations.length]);

  useEffect(() => {
    setTagInput((current) => {
      const normalized = serializeTags(draftContent?.tags);
      const parsedCurrent = parseCommaSeparatedTags(current);
      const normalizedCurrent = serializeTags(parsedCurrent);
      return normalizedCurrent === normalized ? current : normalized;
    });
  }, [draftContent?.tags]);

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

  const timelineConnectionEntries = useMemo(
    () => (currentNodeRef ? buildTimelineConnectionEntries(currentNodeRef, bootstrapNodes) : []),
    [bootstrapNodes, currentNodeRef]
  );

  const bioConnectionEntry = useMemo(
    () => (currentNodeRef ? buildBioConnectionEntry(currentNodeRef, bootstrapNodes) : null),
    [bootstrapNodes, currentNodeRef]
  );

  const explicitConnectionEntries = useMemo(
    () =>
      currentNodeRef
        ? explicitRelations.map((relation, relationIndex) =>
            buildExplicitConnectionEntry(relation, relationIndex, currentNodeRef.id, editorNodeById)
          )
        : [],
    [currentNodeRef, editorNodeById, explicitRelations]
  );

  const domainTreemapEntries = useMemo<DomainTreemapEntry[]>(
    () =>
      DOMAIN_ORDER.map((domain) => ({
        domain,
        display: DOMAIN_CONFIG[domain].display,
        cardTag: DOMAIN_CONFIG[domain].cardTag,
        count: bootstrapNodes.filter((node) => node.domain === domain).length,
        removable: bootstrapNodes.every((node) => node.domain !== domain),
      })),
    [bootstrapNodes]
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

  const updateDraftContent = (nextContent: GraphNodeContent) => {
    setDraftContent(nextContent);
    setJsonDraft(prettyJson(nextContent));
    setValidation(validateContent(nextContent, decodedNodeId || 'preview-node'));
    setJsonError(null);
  };

  const updateSelectedExplicitRelation = (
    updater: (relation: EditorExplicitRelation) => EditorExplicitRelation
  ) => {
    if (selectedExplicitRelationIndex === null || !currentNodeRef) return;

    setExplicitRelations((current) =>
      current.map((entry, index) =>
        index === selectedExplicitRelationIndex
          ? anchorExplicitRelationToNode(updater(entry), currentNodeRef.id)
          : entry
      )
    );
  };

  const handleJsonDraftChange = (value: string) => {
    setJsonDraft(value);
    try {
      const parsed = JSON.parse(value);
      const normalized = normalizeNodeContent(parsed, decodedNodeId || 'preview-node');
      setDraftContent(normalized);
      setValidation(validateContent(normalized, decodedNodeId || 'preview-node'));
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON.');
    }
  };

  const handleOpenNode = (nextNodeId: string) => {
    if (!nextNodeId) {
      navigate('/editor');
      return;
    }
    navigate(`/editor/nodes/${encodeURIComponent(nextNodeId)}`);
  };

  const handleSaveDraft = () => {
    if (!decodedNodeId || !draftContent) return;
    window.localStorage.setItem(getDraftStorageKey(decodedNodeId), prettyJson(draftContent));
    setStatusMessage('Saved browser draft.');
  };

  const handleDiscardDraft = () => {
    if (!decodedNodeId || !originalContent) return;
    window.localStorage.removeItem(getDraftStorageKey(decodedNodeId));
    setDraftContent(originalContent);
    setTagInput(serializeTags(originalContent.tags));
    setJsonDraft(prettyJson(originalContent));
    setValidation(validateContent(originalContent, decodedNodeId));
    setJsonError(null);
    setStatusMessage('Discarded browser draft.');
  };

  const handleWriteToFile = async () => {
    if (!decodedNodeId || !draftContent || !currentNodeRef || validation.error || currentChronologyError) return;
    setActionPending(true);
    try {
      const normalizedCurrentNode = {
        ...currentNodeRef,
        chronology: normalizeChronologyValue(currentNodeRef.chronology),
      };
      const completeRelations = explicitRelations
        .map((relation) => anchorExplicitRelationToNode(relation, normalizedCurrentNode.id))
        .filter(isCompleteExplicitRelation);

      await saveEditorNode(
        decodedNodeId,
        draftContent,
        normalizedCurrentNode,
        completeRelations
      );
      setOriginalContent(draftContent);
      const successMessage =
        incompleteExplicitRelationCount > 0
          ? `Wrote node JSON to file. Skipped ${incompleteExplicitRelationCount} incomplete connection${incompleteExplicitRelationCount === 1 ? '' : 's'}.`
          : 'Wrote node JSON to file.';
      setStatusMessage(successMessage);
      setBootstrapError(null);
      setBootstrapNodes((current) =>
        current.map((node) =>
          node.id === normalizedCurrentNode.id
            ? {
                ...node,
                ...normalizedCurrentNode,
                title: draftContent.title,
                subtitle: draftContent.subtitle,
              }
            : node
        )
      );
      window.localStorage.removeItem(getDraftStorageKey(decodedNodeId));
      return successMessage;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to write node file.';
      setStatusMessage(message);
      throw new Error(message);
    } finally {
      setActionPending(false);
    }
  };

  const handleCreateNode = async () => {
    const nodeId = newNodeDraft.nodeId.trim();
    if (!nodeId || newNodeIdAlreadyExists || newNodeIdInvalid || newNodeChronologyError) return;

    setActionPending(true);
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
      setBootstrapNodes((current) => {
        if (current.some((entry) => entry.id === payload.node.id)) return current;
        return [
          ...current,
          {
            ...payload.node,
            title: content.title,
            subtitle: content.subtitle,
          },
        ];
      });
      setBootstrapError(null);
      setStatusMessage(`Created node "${nodeId}".`);
      navigate(`/editor/nodes/${encodeURIComponent(nodeId)}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create node.');
    } finally {
      setActionPending(false);
    }
  };

  const handleSelectExplicitRelation = (relationIndex: number) => {
    setSelectedExplicitRelationIndex((current) => (current === relationIndex ? null : relationIndex));
  };

  const handleRemoveExplicitRelation = (relationIndex: number) => {
    setExplicitRelations((current) => current.filter((_, index) => index !== relationIndex));
    setSelectedExplicitRelationIndex((current) => {
      if (current === null) return current;
      if (current === relationIndex) return null;
      return current > relationIndex ? current - 1 : current;
    });
  };

  const handleAddExplicitRelation = () => {
    if (!currentNodeRef) return;
    const nextIndex = explicitRelations.length;
    setExplicitRelations((current) => [...current, createEmptyExplicitRelation(currentNodeRef.id)]);
    setSelectedExplicitRelationIndex(nextIndex);
  };

  const handleCreateDomain = async () => {
    if (newDomainCreateDisabled) return;
    setActionPending(true);
    try {
      const domainId = newDomainDraft.domainId.trim();
      await createEditorDomain(newDomainDraft);
      window.sessionStorage.setItem(EDITOR_PENDING_NEW_DOMAIN_KEY, domainId);
      setStatusMessage(`Created domain "${domainId}". Opening new node editor...`);
      setBootstrapError(null);
      window.setTimeout(() => {
        const editorUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/editor`;
        window.location.assign(editorUrl);
      }, 200);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create domain.');
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteDomain = async (entry: DomainTreemapEntry) => {
    if (!entry.removable) return;

    setActionPending(true);
    try {
      await deleteEditorDomain({ domainId: entry.domain });
      setStatusMessage(`Deleted domain "${entry.domain}". Reloading editor...`);
      setBootstrapError(null);
      window.setTimeout(() => {
        const editorUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/editor`;
        window.location.assign(editorUrl);
      }, 200);
      return `Deleted domain "${entry.domain}". Reloading editor...`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete domain.';
      setStatusMessage(message);
      throw new Error(message);
    } finally {
      setActionPending(false);
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
                resultMessage: error instanceof Error ? error.message : 'Action failed.',
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
            resultMessage: current.pendingMessage ?? 'Working…',
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
              resultMessage: resultMessage ?? 'Action completed successfully.',
            }
          : current
      );
    } catch (error) {
      setDangerDialog((current) =>
        current
          ? {
              ...current,
              status: 'error',
              resultMessage: error instanceof Error ? error.message : 'Action failed.',
            }
          : current
      );
    }
  };

  // Shared button style variants
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
  const btnDanger: CSSProperties = {
    ...btnSecondary,
    border: '1px solid color-mix(in srgb, crimson 28%, transparent)',
    color: 'color-mix(in srgb, crimson 70%, var(--color-text))',
  };
  const btnDisabled: CSSProperties = { opacity: 0.38, cursor: 'not-allowed' };
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
            <div style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Node editor</div>
            <div style={{ marginTop: '0.3rem', opacity: 0.62, fontSize: '0.88rem' }}>
              Dev workspace · edit content, preview the article, and write to JSON files.
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
              {(['content', 'json', 'new-node', 'new-domain'] as const).map((tabId) => (
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
                  {TAB_LABELS[tabId]}
                </button>
              ))}
            </div>

            {/* Node selector */}
            {tab !== 'new-domain' && (
              <FieldShell>
                <ControlLabel>Open node</ControlLabel>
                <select
                  value={tab === 'new-node' ? '' : decodedNodeId}
                  onChange={(event) => handleOpenNode(event.target.value)}
                  disabled={tab === 'new-node'}
                  style={tab === 'new-node' ? { ...inputStyle(), ...btnDisabled } : inputStyle()}
                >
                  <option value="">Choose a node…</option>
                  {bootstrapNodes
                    .slice()
                    .sort(sortNodeRefs)
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {formatEditorNodeOptionLabel(node)}
                      </option>
                    ))}
                </select>
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
                  onClick={() => setStatusMessage(null)}
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

            {/* ── Edit tab ── */}
            {tab === 'content' && (
              <div>
                {!draftContent || !currentNodeRef ? (
                  <div style={{ marginTop: '1rem', opacity: 0.65, fontSize: '0.88rem' }}>
                    {loadingNode ? 'Loading…' : 'Choose a node above to edit its content.'}
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
                      <ControlLabel>Chronology</ControlLabel>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={currentNodeRef.chronology}
                        onChange={(event) =>
                          setCurrentNodeRef((current) =>
                            current ? { ...current, chronology: event.target.value } : current
                          )
                        }
                        placeholder="YYYY, YYYYMM, or YYYYMMDD"
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
                      <ControlLabel>Tags</ControlLabel>
                      <input
                        value={tagInput}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setTagInput(nextValue);
                          updateDraftContent({ ...draftContent, tags: parseCommaSeparatedTags(nextValue) });
                        }}
                        onBlur={() => {
                          const normalized = serializeTags(parseCommaSeparatedTags(tagInput));
                          setTagInput(normalized);
                        }}
                        placeholder="tag1, tag2, …"
                        style={inputStyle()}
                      />
                    </FieldShell>

                    <div style={{ marginTop: '0.85rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowHeaderFields((v) => !v)}
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
                        Header
                      </button>

                      {showHeaderFields && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <FieldShell>
                            <ControlLabel>Title</ControlLabel>
                            <input
                              value={draftContent.title}
                              onChange={(event) => updateDraftContent({ ...draftContent, title: event.target.value })}
                              style={inputStyle()}
                            />
                          </FieldShell>
                          <FieldShell>
                            <ControlLabel>Subtitle</ControlLabel>
                            <input
                              value={draftContent.subtitle ?? ''}
                              onChange={(event) =>
                                updateDraftContent({ ...draftContent, subtitle: event.target.value || undefined })
                              }
                              style={inputStyle()}
                            />
                          </FieldShell>
                          <FieldShell>
                            <ControlLabel>Summary</ControlLabel>
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
                        onClick={() => setShowMeta((v) => !v)}
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
                        Metadata &amp; hero
                      </button>

                      {showMeta && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <FieldShell>
                            <ControlLabel>Hero image src</ControlLabel>
                            <input
                              value={draftContent.hero?.image?.src ?? ''}
                              onChange={(event) =>
                                updateDraftContent({
                                  ...draftContent,
                                  hero: event.target.value
                                    ? {
                                        image: {
                                          src: event.target.value,
                                          alt: draftContent.hero?.image?.alt ?? 'Describe the image',
                                          caption: draftContent.hero?.image?.caption,
                                        },
                                      }
                                    : undefined,
                                })
                              }
                              placeholder="assets/hero.jpg"
                              style={inputStyle()}
                            />
                          </FieldShell>

                          {draftContent.hero?.image && (
                            <>
                              <FieldShell>
                                <ControlLabel>Hero alt</ControlLabel>
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
                                <ControlLabel>Hero caption</ControlLabel>
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
                                { key: 'dateLabel', label: 'Date' },
                                { key: 'location', label: 'Place' },
                                { key: 'readingTime', label: 'Read time' },
                                { key: 'status', label: 'Status' },
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
                        Connection details
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.62, lineHeight: 1.55 }}>
                        Timeline links within the same domain are inferred automatically from chronology. Use the connected-node cards on the right to add, remove, and select explicit relations.
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
                          Incomplete connection drafts stay in the editor, but they will not be saved until both ends are chosen.
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
                                Editing
                              </div>
                              <div style={{ marginTop: '0.22rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
                                {selectedExplicitConnection?.relatedNodeTitle ?? 'Untitled connection'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginLeft: 'auto' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedExplicitRelationIndex(null)}
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
                                Done
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedExplicitRelationIndex === null) return;
                                  openDangerDialog({
                                    actionDescription: 'delete this explicit connection',
                                    proceedLabel: 'Delete',
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
                                Delete
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.65rem' }}>
                            <div>
                              <ControlLabel>Current node</ControlLabel>
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
                                Anchored on the <strong>{selectedRelationAnchoredSide}</strong> side for this connection.
                              </div>
                            </div>
                            <div>
                              <ControlLabel>Other node</ControlLabel>
                              <SearchableNodePicker
                                options={otherNodeOptions}
                                value={selectedOtherNodeId}
                                currentDomain={currentNodeRef?.domain}
                                onSelect={(nodeId) =>
                                  updateSelectedExplicitRelation((entry) =>
                                    selectedRelationAnchoredSide === 'from'
                                      ? { ...entry, to: nodeId }
                                      : { ...entry, from: nodeId }
                                  )
                                }
                                placeholder="Search by title, id, subtitle, or domain…"
                              />
                              <div style={{ marginTop: '0.3rem', fontSize: '0.74rem', opacity: 0.62, lineHeight: 1.45 }}>
                                {selectedRelationAnchoredSide === 'from'
                                  ? 'This connection points from the current node to the selected node.'
                                  : 'This connection points from the selected node to the current node.'}
                              </div>
                            </div>
                            <div>
                              <ControlLabel>Kind</ControlLabel>
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
                              <ControlLabel>Strength</ControlLabel>
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
                            <ControlLabel>Label</ControlLabel>
                            <input
                              value={selectedExplicitRelation.label}
                              onChange={(event) => updateSelectedExplicitRelation((entry) => ({ ...entry, label: event.target.value }))}
                              style={inputStyle()}
                            />
                          </FieldShell>
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
                          Select an explicit connection card on the right to edit its direction, kind, strength, and label.
                        </div>
                      )}
                    </div>

                    {/* Hint */}
                    <div style={{ marginTop: '0.9rem', fontSize: '0.8rem', opacity: 0.6, lineHeight: 1.55 }}>
                      Edit header, metadata, and hero from this panel. Click any section on the right to edit it.
                    </div>

                    {/* Action buttons */}
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          openDangerDialog({
                            actionDescription: 'write these editor changes to file',
                            proceedLabel: 'Proceed',
                            tone: 'primary',
                            showResult: true,
                            pendingMessage: 'Writing to file…',
                            onProceed: handleWriteToFile,
                          })
                        }
                        disabled={Boolean(validation.error) || Boolean(currentChronologyError) || actionPending}
                        style={
                          Boolean(validation.error) || Boolean(currentChronologyError) || actionPending
                            ? { ...btnPrimary, ...btnDisabled }
                            : btnPrimary
                        }
                      >
                        Write to file
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={!draftContent}
                        style={!draftContent ? { ...btnSecondary, ...btnDisabled } : btnSecondary}
                      >
                        Save draft
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openDangerDialog({
                            actionDescription: 'reset this draft back to the last saved file version',
                            proceedLabel: 'Reset',
                            tone: 'danger',
                            onProceed: () => {
                              handleDiscardDraft();
                            },
                          })
                        }
                        disabled={!originalContent}
                        style={!originalContent ? { ...btnDanger, ...btnDisabled } : btnDanger}
                      >
                        Reset
                      </button>
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
                {!decodedNodeId ? (
                  <div style={{ opacity: 0.65, fontSize: '0.88rem' }}>Choose a node above to edit raw JSON.</div>
                ) : (
                  <>
                    <textarea
                      value={jsonDraft}
                      onChange={(event) => handleJsonDraftChange(event.target.value)}
                      rows={30}
                      style={{
                        ...inputStyle(true),
                        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                        fontSize: '0.8rem',
                        lineHeight: 1.6,
                      }}
                    />
                    {jsonError && (
                      <div style={{ marginTop: '0.55rem', color: 'crimson', fontSize: '0.82rem' }}>{jsonError}</div>
                    )}
                    {validation.error && !jsonError && (
                      <div style={{ marginTop: '0.55rem', color: 'crimson', fontSize: '0.82rem' }}>
                        {validation.error}
                      </div>
                    )}
                    <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          openDangerDialog({
                            actionDescription: 'write these JSON edits to file',
                            proceedLabel: 'Proceed',
                            tone: 'primary',
                            showResult: true,
                            pendingMessage: 'Writing to file…',
                            onProceed: handleWriteToFile,
                          })
                        }
                        disabled={Boolean(jsonError || validation.error) || actionPending}
                        style={
                          Boolean(jsonError || validation.error) || actionPending
                            ? { ...btnPrimary, ...btnDisabled }
                            : btnPrimary
                        }
                      >
                        Write to file
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={!draftContent}
                        style={!draftContent ? { ...btnSecondary, ...btnDisabled } : btnSecondary}
                      >
                        Save draft
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── New Node tab ── */}
            {tab === 'new-node' && (
              <div style={{ marginTop: '0.85rem' }}>
                <FieldShell>
                  <ControlLabel>Domain</ControlLabel>
                  <select
                    value={newNodeDraft.domain}
                    onChange={(event) => {
                      const domain = event.target.value as DomainId;
                      setNewNodeDraft((current) => ({
                        ...current,
                        domain,
                        kind: getDefaultKindForDomain(domain),
                      }));
                    }}
                    style={inputStyle()}
                  >
                    {DOMAIN_ORDER.map((domain) => (
                      <option key={domain} value={domain}>
                        {DOMAIN_CONFIG[domain].display}
                      </option>
                    ))}
                  </select>
                </FieldShell>
                <FieldShell>
                  <div style={{ position: 'relative' }}>
                    <ControlLabel>Node id / filename</ControlLabel>
                    {newNodeIdAlreadyExists ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          color: 'crimson',
                          fontSize: '0.8rem',
                          lineHeight: 1,
                          textTransform: 'none',
                          letterSpacing: 'normal',
                        }}
                      >
                        This node id already exists.
                      </div>
                    ) : null}
                  </div>
                  <input
                    value={newNodeDraft.nodeId}
                    onChange={(event) => setNewNodeDraft((current) => ({ ...current, nodeId: event.target.value }))}
                    placeholder="my-node-id"
                    style={inputStyle()}
                  />
                  {!newNodeIdAlreadyExists && newNodeIdInvalid ? (
                    <div style={{ marginTop: '0.45rem', color: 'crimson', fontSize: '0.8rem' }}>
                      Use lowercase letters, numbers, and single hyphens only.
                    </div>
                  ) : null}
                </FieldShell>
                <FieldShell>
                  <ControlLabel>Template</ControlLabel>
                  <select
                    value={newNodeDraft.template}
                    onChange={(event) => setNewNodeDraft((current) => ({ ...current, template: event.target.value }))}
                    style={inputStyle()}
                  >
                    {NODE_TEMPLATE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: '0.45rem', color: 'var(--color-text-subtle)', fontSize: '0.8rem' }}>
                    The right panel updates live so you can preview the template before creating the node.
                  </div>
                </FieldShell>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.85rem' }}>
                  <div>
                    <ControlLabel>Kind</ControlLabel>
                    <input
                      value={newNodeDraft.kind}
                      onChange={(event) =>
                        setNewNodeDraft((current) => ({
                          ...current,
                          kind: event.target.value as GraphNodeRef['kind'],
                        }))
                      }
                      style={{ ...inputStyle(), padding: '0.48rem 0.58rem', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <ControlLabel>Chronology</ControlLabel>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newNodeDraft.chronology}
                      onChange={(event) =>
                        setNewNodeDraft((current) => ({ ...current, chronology: event.target.value }))
                      }
                      placeholder="YYYY, YYYYMM, or YYYYMMDD"
                      style={{ ...inputStyle(), padding: '0.48rem 0.58rem', fontSize: '0.82rem' }}
                    />
                    <div
                      style={{
                        marginTop: '0.35rem',
                        fontSize: '0.74rem',
                        color: newNodeChronologyError ? 'crimson' : 'var(--color-text-subtle)',
                        lineHeight: 1.45,
                      }}
                    >
                      {newNodeChronologyError ?? CHRONOLOGY_FORMAT_HINT}
                    </div>
                  </div>
                </div>
                <FieldShell>
                  <ControlLabel>Title</ControlLabel>
                  <input
                    value={newNodeDraft.title}
                    onChange={(event) => setNewNodeDraft((current) => ({ ...current, title: event.target.value }))}
                    style={inputStyle()}
                  />
                </FieldShell>
                <FieldShell>
                  <ControlLabel>Subtitle</ControlLabel>
                  <input
                    value={newNodeDraft.subtitle}
                    onChange={(event) => setNewNodeDraft((current) => ({ ...current, subtitle: event.target.value }))}
                    style={inputStyle()}
                  />
                </FieldShell>
                <FieldShell>
                  <ControlLabel>Summary</ControlLabel>
                  <textarea
                    value={newNodeDraft.summary}
                    onChange={(event) => setNewNodeDraft((current) => ({ ...current, summary: event.target.value }))}
                    rows={3}
                    style={inputStyle(true)}
                  />
                </FieldShell>
                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleCreateNode}
                    disabled={newNodeCreateDisabled}
                    style={newNodeCreateDisabled ? { ...btnPrimary, ...btnDisabled } : btnPrimary}
                  >
                    Create node
                  </button>
                </div>
              </div>
            )}

            {/* ── New Domain tab ── */}
            {tab === 'new-domain' && (
              <div style={{ marginTop: '0.85rem' }}>
                <div
                  style={{
                    padding: '0.8rem 0.9rem',
                    borderRadius: '12px',
                    background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                    opacity: 0.82,
                  }}
                >
                  <div><strong>Domain id:</strong> internal key, folder name, and URL-safe identifier.</div>
                  <div><strong>Display label:</strong> human-readable name shown in the UI.</div>
                  <div><strong>Card tag:</strong> short badge text shown on graph cards, usually uppercase.</div>
                  <div><strong>Seed angle:</strong> default angle that places this domain around the graph.</div>
                </div>
                <FieldShell>
                  <div style={{ position: 'relative' }}>
                    <ControlLabel>Domain id</ControlLabel>
                    {newDomainIdAlreadyExists ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          color: 'crimson',
                          fontSize: '0.8rem',
                          lineHeight: 1,
                          textTransform: 'none',
                          letterSpacing: 'normal',
                        }}
                      >
                        This domain id already exists.
                      </div>
                    ) : null}
                  </div>
                  <input
                    value={newDomainDraft.domainId}
                    onChange={(event) => setNewDomainDraft((current) => ({ ...current, domainId: event.target.value }))}
                    style={inputStyle()}
                  />
                  {!newDomainIdAlreadyExists && newDomainIdInvalid ? (
                    <div style={{ marginTop: '0.45rem', color: 'crimson', fontSize: '0.8rem' }}>
                      Use lowercase letters, numbers, and single hyphens only.
                    </div>
                  ) : null}
                </FieldShell>
                <FieldShell>
                  <ControlLabel>Display label</ControlLabel>
                  <input
                    value={newDomainDraft.display}
                    onChange={(event) => setNewDomainDraft((current) => ({ ...current, display: event.target.value }))}
                    style={inputStyle()}
                  />
                </FieldShell>
                <FieldShell>
                  <ControlLabel>Card tag</ControlLabel>
                  <input
                    value={newDomainDraft.cardTag}
                    onChange={(event) => setNewDomainDraft((current) => ({ ...current, cardTag: event.target.value }))}
                    style={inputStyle()}
                  />
                  {newDomainCardTagAlreadyExists ? (
                    <div style={{ marginTop: '0.45rem', color: 'crimson', fontSize: '0.8rem' }}>
                      This card tag already exists.
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.45rem', color: 'var(--color-text-subtle)', fontSize: '0.8rem' }}>
                      Keep this short and distinct so graph cards stay easy to scan.
                    </div>
                  )}
                </FieldShell>
                <FieldShell>
                  <ControlLabel>Seed angle</ControlLabel>
                  <input
                    type="number"
                    value={newDomainDraft.seedAngle}
                    onChange={(event) =>
                      setNewDomainDraft((current) => ({ ...current, seedAngle: Number(event.target.value) }))
                    }
                    style={inputStyle()}
                  />
                </FieldShell>
                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleCreateDomain}
                    disabled={newDomainCreateDisabled}
                    style={newDomainCreateDisabled ? { ...btnPrimary, ...btnDisabled } : btnPrimary}
                  >
                    Create domain
                  </button>
                </div>
              </div>
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
                  {tab === 'content' ? 'Article editor' : tab === 'new-domain' ? 'Domain statistics' : 'Live preview'}
                </div>
                <div style={{ marginTop: '0.2rem', opacity: 0.6, fontSize: '0.82rem' }}>
                  {tab === 'new-domain'
                    ? `${bootstrapNodes.length} nodes across ${domainTreemapEntries.length} configured domains`
                    : previewNode
                      ? `${previewNode.domain} / ${previewNode.id}`
                      : 'Select a node or template draft to preview.'}
                </div>
              </div>
            </div>

            {/* Content editor (inline editing mode) */}
            {tab === 'new-domain' ? (
              <DomainTreemap
                entries={domainTreemapEntries}
                onDeleteDomain={(entry) =>
                  openDangerDialog({
                    actionDescription: `delete the "${entry.domain}" domain`,
                    proceedLabel: 'Delete',
                    tone: 'danger',
                    showResult: true,
                    pendingMessage: 'Deleting domain…',
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
                {(draftContent.sections ?? []).map((section, sectionIndex, sections) => (
                  <InlineSectionCard
                    key={`${section.id ?? section.label}-${sectionIndex}`}
                    section={section}
                    sectionIndex={sectionIndex}
                    isEditing={editingSectionIndex === sectionIndex}
                    onStartEditing={() => setEditingSectionIndex(sectionIndex)}
                    onStopEditing={() =>
                      setEditingSectionIndex((current) => (current === sectionIndex ? null : current))
                    }
                    onChange={(nextSection) =>
                      updateDraftContent({
                        ...draftContent,
                        sections: sections.map((entry, index) => (index === sectionIndex ? nextSection : entry)),
                      })
                    }
                    onDelete={() =>
                      openDangerDialog({
                        actionDescription: `delete the "${section.label}" section`,
                        proceedLabel: 'Delete',
                        tone: 'danger',
                        onProceed: () => {
                          updateDraftContent({
                            ...draftContent,
                            sections: sections.filter((_, index) => index !== sectionIndex),
                          });
                        },
                      })
                    }
                  />
                ))}

                {/* Add section at end */}
                <div
                  style={{
                    maxWidth: DETAIL_SECTION_WIDTH,
                    marginInline: 'auto',
                    display: 'flex',
                    justifyContent: 'center',
                    paddingTop: '0.5rem',
                    paddingBottom: '2rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const nextSections = [...(draftContent.sections ?? []), createEmptySection()];
                      updateDraftContent({ ...draftContent, sections: nextSections });
                      setEditingSectionIndex(nextSections.length - 1);
                    }}
                    style={{
                      padding: '0.38rem 1rem',
                      borderRadius: '999px',
                      border: '1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent)',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontFamily: 'inherit',
                      opacity: 0.7,
                    }}
                    title="Add section at end"
                  >
                    + Add section
                  </button>
                </div>

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
                      <ConnectedNodeCard key={bioConnectionEntry.key} entry={bioConnectionEntry} />
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
                          onInspect={relationIndex === undefined ? undefined : () => handleSelectExplicitRelation(relationIndex)}
                        />
                      );
                    })}
                    <AddConnectedNodeCard onClick={handleAddExplicitRelation} />
                  </div>
                </section>
              </div>
            ) : previewNode ? (
              <NodeArticlePreview node={previewNode} />
            ) : (
              <div style={{ padding: '2.5rem 1.5rem', opacity: 0.55, fontSize: '0.9rem' }}>
                Choose an existing node or start a new template to see the rendered article here.
              </div>
            )}
          </div>
        </div>
      </div>
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
                ? 'Action completed'
                : dangerDialog.status === 'error'
                  ? 'Action failed'
                  : 'Please confirm'}
            </div>
            <div style={{ marginTop: '0.55rem', fontSize: '0.88rem', lineHeight: 1.6, opacity: 0.82 }}>
              {dangerDialog.status === 'confirm'
                ? `Are you sure you want to ${dangerDialog.actionDescription}?`
                : dangerDialog.resultMessage}
            </div>
            <div style={{ marginTop: '0.95rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {dangerDialog.status === 'confirm' ? (
                <>
                  <button type="button" onClick={closeDangerDialog} style={btnSecondary}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDangerDialogProceed}
                    style={dangerDialog.tone === 'danger' ? btnDanger : btnPrimary}
                  >
                    {dangerDialog.proceedLabel ?? 'Proceed'}
                  </button>
                </>
              ) : dangerDialog.status === 'pending' ? (
                <button type="button" disabled style={{ ...btnPrimary, ...btnDisabled }}>
                  Working…
                </button>
              ) : (
                <button type="button" onClick={() => setDangerDialog(null)} style={btnPrimary}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeEditorPage;
