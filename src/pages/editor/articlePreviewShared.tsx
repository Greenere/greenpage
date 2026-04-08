import { UI_COPY } from '../../configs/ui/uiCopy';
import ArticleGalleryBlock from '../../shared/ui/ArticleGalleryBlock';
import CodeBlock from '../../shared/ui/CodeBlock';
import { Footnote, Paragraph } from '../../shared/ui/StyledTextBlocks';
import { resolveAssetUrl, type ArticleBlock, type ContentBlock, type NodeArticleMeta } from '../graph/content/Nodes';
import { renderInlineMarkdown } from './inlineMarkdown';
export const DETAIL_READING_WIDTH = '46rem';
export const DETAIL_SECTION_WIDTH = '48rem';


export function renderSectionHeading(label: string, maxWidth = DETAIL_SECTION_WIDTH) {
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

export function renderMeta(meta: NodeArticleMeta | undefined) {
  if (!meta) return null;

  const metaItems: Array<{ label: string; value: string }> = [];
  if (meta.dateLabel) metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.date, value: meta.dateLabel });
  if (meta.location) metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.place, value: meta.location });
  if (meta.readingTime) metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.read, value: meta.readingTime });
  if (meta.status) metaItems.push({ label: UI_COPY.nodeDetailPage.metaLabels.status, value: meta.status });

  if (metaItems.length === 0 && !meta.links?.length) {
    return null;
  }

  return (
    <div style={{ marginTop: '1.2rem' }}>
      {metaItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.95rem 1.4rem' }}>
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
              <div style={{ marginTop: '0.22rem', fontSize: '0.93rem', lineHeight: 1.45 }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {meta.links && meta.links.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem 1rem', marginTop: metaItems.length > 0 ? '1rem' : 0 }}>
          {meta.links.map((link) => (
            <a
              key={`${link.label}-${link.href}`}
              href={link.href}
              style={{
                color: 'var(--color-text)',
                textDecoration: 'underline',
                textUnderlineOffset: '0.2em',
                textDecorationThickness: '1px',
                textDecorationColor: 'color-mix(in srgb, var(--color-secondary) 62%, transparent)',
                fontSize: '0.92rem',
                fontWeight: 600,
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function renderContentBlock(block: ContentBlock | ArticleBlock, index: number) {
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
        {renderInlineMarkdown(block.text, `text-${index}`)}
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
        {renderInlineMarkdown(block.text, `quote-${index}`)}
      </blockquote>
    );
  }

  if (block.type === 'code') {
    return (
      <CodeBlock
        key={`code-${index}`}
        code={block.code}
        language={block.language}
        maxWidth={DETAIL_READING_WIDTH}
        margin="0 0 1.35rem"
      />
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
            {renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'image') {
    return (
      <figure key={`image-${index}`} style={{ maxWidth: DETAIL_READING_WIDTH, margin: '0 0 1.35rem' }}>
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
            {renderInlineMarkdown(block.caption, `image-caption-${index}`)}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === 'link') {
    return (
      <div key={`link-${index}`} style={{ maxWidth: DETAIL_READING_WIDTH, marginBottom: '1rem' }}>
        <a
          href={block.href}
          style={{
            color: 'var(--color-text)',
            textDecoration: 'underline',
            textUnderlineOffset: '0.2em',
            textDecorationThickness: '1px',
            textDecorationColor: 'color-mix(in srgb, var(--color-secondary) 62%, transparent)',
            fontWeight: 600,
          }}
        >
          {block.label}
        </a>
        {block.description && <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', lineHeight: 1.65, opacity: 0.84 }}>{renderInlineMarkdown(block.description, `link-description-${index}`)}</div>}
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
        mode={block.mode}
        keyPrefix={`gallery-${index}`}
        maxWidth={DETAIL_SECTION_WIDTH}
        renderCaption={(caption, captionKeyPrefix) => renderInlineMarkdown(caption, captionKeyPrefix)}
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
          <Footnote style={{ display: 'block', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.11em', fontSize: '0.64rem', opacity: 0.7 }}>
            {block.title}
          </Footnote>
        )}
        <div style={{ fontSize: '0.92rem', lineHeight: 1.72 }}>{renderInlineMarkdown(block.text, `callout-${index}`)}</div>
      </div>
    );
  }

  return null;
}
