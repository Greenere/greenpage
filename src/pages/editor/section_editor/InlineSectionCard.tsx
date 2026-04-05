import { useState } from 'react';

import { UI_COPY } from '../../../configs/ui/uiCopy';
import { type NodeArticleSection } from '../../graph/content/Nodes';
import {
  DETAIL_SECTION_WIDTH,
  renderContentBlock,
  renderSectionHeading,
} from '../articlePreviewShared';
import { parseSectionMarkdown, serializeSectionMarkdown } from './sectionMarkdown';

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
      <strong>{UI_COPY.nodeEditor.sectionEditor.syntaxHintInlineLabel}</strong> {UI_COPY.nodeEditor.sectionEditor.syntaxHintInlineBody} &nbsp;·&nbsp; <code>{'> quote'}</code> &nbsp;·&nbsp; <code>- item</code> for lists
      <br />
      <strong>{UI_COPY.nodeEditor.sectionEditor.syntaxHintMediaLabel}</strong> <code>![alt](src "caption")</code> &nbsp;·&nbsp; <code>[label](href)</code> {UI_COPY.nodeEditor.sectionEditor.syntaxHintMediaBody}
      <br />
      <strong>{UI_COPY.nodeEditor.sectionEditor.syntaxHintBlocksLabel}</strong> <code>:::gallery columns=2 align=height:1</code>…<code>:::</code>
      &nbsp;·&nbsp; <code>:::note</code> or <code>:::highlight</code>…<code>:::</code>
    </div>
  );
}

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
          onClick={() => setShowHint((value) => !value)}
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
          {showHint ? UI_COPY.nodeEditor.sectionEditor.syntaxGuideHide : UI_COPY.nodeEditor.sectionEditor.syntaxGuideShow}
        </button>
        {markdownError && <div style={{ fontSize: '0.8rem', color: 'crimson' }}>{markdownError}</div>}
      </div>
      {showHint && <SectionSyntaxHint />}
    </div>
  );
}

type InlineSectionCardProps = {
  section: NodeArticleSection;
  sectionIndex: number;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onChange: (next: NodeArticleSection) => void;
  onDelete: () => void;
  onAddAfter: () => void;
};

export default function InlineSectionCard({
  section,
  sectionIndex,
  isEditing,
  onStartEditing,
  onStopEditing,
  onChange,
  onDelete,
  onAddAfter,
}: InlineSectionCardProps) {
  return (
    <section
      onBlur={
        isEditing
          ? (event) => {
              const nextFocused = event.relatedTarget;
              if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) return;
              onStopEditing();
            }
          : undefined
      }
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
              {UI_COPY.nodeEditor.common.edit}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title={UI_COPY.nodeEditor.sectionEditor.deleteSectionTitle}
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

      {isEditing ? (
        <div>
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
              {UI_COPY.nodeEditor.common.done}
            </button>
          </div>
        </div>
      ) : (
        <div onClick={onStartEditing} style={{ cursor: 'text' }}>
          {section.blocks.map((block, blockIndex) => renderContentBlock(block, blockIndex))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: isEditing ? '0.85rem' : '1rem',
        }}
      >
        <button
          type="button"
          onClick={onAddAfter}
          style={{
            padding: '0.3rem 0.85rem',
            borderRadius: '999px',
            border: '1px solid color-mix(in srgb, var(--color-secondary) 28%, transparent)',
            background: 'transparent',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontSize: '0.77rem',
            fontFamily: 'inherit',
            opacity: 0.72,
          }}
          title={UI_COPY.nodeEditor.sectionEditor.addSectionAfterTitle}
        >
          {UI_COPY.nodeEditor.sectionEditor.addSection}
        </button>
      </div>
    </section>
  );
}
