/* eslint-disable react-refresh/only-export-components */
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UI_COPY } from '../../configs/ui/uiCopy';
import ArticleGalleryBlock from '../../shared/ui/ArticleGalleryBlock';
import CodeBlock from '../../shared/ui/CodeBlock';
import { Footnote, Paragraph } from '../../shared/ui/StyledTextBlocks';
import {
  resolveAssetUrl,
  type ArticleBlock,
  type ContentBlock,
  type NodeArticleMeta,
  type NodeArticleSection,
} from './content/Nodes';

const INLINE_PATTERN = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

export const DETAIL_READING_WIDTH = '46rem';
export const DETAIL_SECTION_WIDTH = '48rem';

export function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

export function isInternalHref(href: string) {
  return href.startsWith('/') && !isExternalHref(href);
}

type DetailTextLinkProps = {
  href: string;
  children: ReactNode;
  onNavigate?: (href: string) => void;
  style?: CSSProperties;
};

export function DetailTextLink({ href, children, onNavigate, style }: DetailTextLinkProps) {
  const linkStyle: CSSProperties = {
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

export function renderDetailInlineMarkdown(text: string, keyPrefix: string, onNavigate?: (href: string) => void): ReactNode[] {
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
        <DetailTextLink key={`${keyPrefix}-link-${matchIndex}`} href={match[3]} onNavigate={onNavigate}>
          {match[2]}
        </DetailTextLink>,
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
        </code>,
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-em-${matchIndex}`} style={{ fontWeight: 700, fontStyle: 'italic' }}>
          {renderDetailInlineMarkdown(match[5], `${keyPrefix}-strong-em-${matchIndex}`, onNavigate)}
        </strong>,
      );
    } else if (match[6]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${matchIndex}`} style={{ fontWeight: 700 }}>
          {renderDetailInlineMarkdown(match[6], `${keyPrefix}-strong-${matchIndex}`, onNavigate)}
        </strong>,
      );
    } else if (match[7]) {
      nodes.push(
        <em key={`${keyPrefix}-em-${matchIndex}`} style={{ fontStyle: 'italic' }}>
          {renderDetailInlineMarkdown(match[7], `${keyPrefix}-em-${matchIndex}`, onNavigate)}
        </em>,
      );
    }

    cursor = matchIndex + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-text-${cursor}`}>{text.slice(cursor)}</Fragment>);
  }

  return nodes;
}

export function renderDetailSectionHeading(label: string, maxWidth = DETAIL_SECTION_WIDTH) {
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

export function renderDetailMeta(meta: NodeArticleMeta | undefined, onNavigate?: (href: string) => void) {
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
              <div style={{ marginTop: '0.22rem', fontSize: '0.93rem', lineHeight: 1.45 }}>{item.value}</div>
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
            <DetailTextLink
              key={`${link.label}-${link.href}`}
              href={link.href}
              onNavigate={onNavigate}
              style={{ fontSize: '0.92rem', fontWeight: 600 }}
            >
              {link.label}
            </DetailTextLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function renderDetailContentBlock(
  block: ContentBlock | ArticleBlock,
  index: number,
  onNavigate?: (href: string) => void,
) {
  if (block.type === 'text') {
    return (
      <Paragraph
        key={`text-${index}`}
        style={{
          maxWidth: DETAIL_SECTION_WIDTH,
          fontSize: '0.92rem',
          lineHeight: 1.78,
          paddingLeft: 0,
          paddingRight: 0,
          marginTop: 0,
          marginBottom: '1rem',
        }}
      >
        {renderDetailInlineMarkdown(block.text, `text-${index}`, onNavigate)}
      </Paragraph>
    );
  }

  if (block.type === 'quote') {
    return (
      <blockquote
        key={`quote-${index}`}
        style={{
          maxWidth: DETAIL_SECTION_WIDTH,
          margin: '0 0 1.2rem',
          padding: '0.15rem 0 0.15rem 1rem',
          color: 'var(--color-text)',
          fontStyle: 'italic',
          lineHeight: 1.72,
          borderLeft: '2px solid color-mix(in srgb, var(--color-secondary) 48%, transparent)',
          opacity: 0.9,
        }}
      >
        {renderDetailInlineMarkdown(block.text, `quote-${index}`, onNavigate)}
      </blockquote>
    );
  }

  if (block.type === 'code') {
    return (
      <CodeBlock
        key={`code-${index}`}
        code={block.code}
        language={block.language}
        maxWidth={DETAIL_SECTION_WIDTH}
      />
    );
  }

  if (block.type === 'list') {
    return (
      <ul
        key={`list-${index}`}
        style={{
          maxWidth: DETAIL_SECTION_WIDTH,
          margin: '0 0 1.2rem',
          paddingLeft: '1.15rem',
          color: 'var(--color-text)',
          lineHeight: 1.72,
        }}
      >
        {block.items.map((item, itemIndex) => (
          <li key={`${item}-${itemIndex}`} style={{ marginBottom: '0.38rem' }}>
            {renderDetailInlineMarkdown(item, `list-${index}-${itemIndex}`, onNavigate)}
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
          maxWidth: DETAIL_SECTION_WIDTH,
          margin: '0 0 1.2rem',
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
            {renderDetailInlineMarkdown(block.caption, `image-caption-${index}`, onNavigate)}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === 'link') {
    return (
      <div key={`link-${index}`} style={{ maxWidth: DETAIL_SECTION_WIDTH, marginBottom: '1.2rem' }}>
        <DetailTextLink href={block.href} onNavigate={onNavigate} style={{ fontWeight: 600 }}>
          {block.label}
        </DetailTextLink>
        {block.description && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', lineHeight: 1.65, opacity: 0.84 }}>
            {renderDetailInlineMarkdown(block.description, `link-description-${index}`, onNavigate)}
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
        renderCaption={(caption, captionKeyPrefix) => renderDetailInlineMarkdown(caption, captionKeyPrefix, onNavigate)}
      />
    );
  }

  if (block.type === 'callout') {
    return (
      <div
        key={`callout-${index}`}
        style={{
          maxWidth: DETAIL_SECTION_WIDTH,
          marginBottom: '1.2rem',
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
          {renderDetailInlineMarkdown(block.text, `callout-${index}`, onNavigate)}
        </div>
      </div>
    );
  }

  return null;
}

export function renderDetailSection(section: NodeArticleSection, index: number, onNavigate?: (href: string) => void) {
  return (
    <section
      key={section.id ?? `${section.label}-${index}`}
      style={{
        marginTop: index === 0 ? '2.2rem' : '2.5rem',
        maxWidth: DETAIL_SECTION_WIDTH,
        marginInline: 'auto',
      }}
    >
      {renderDetailSectionHeading(section.label)}
      <div>{section.blocks.map((block, blockIndex) => renderDetailContentBlock(block, blockIndex, onNavigate))}</div>
    </section>
  );
}
