import { Fragment, type ReactNode } from 'react';

const INLINE_PATTERN = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

export function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
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
        <a
          key={`${keyPrefix}-link-${matchIndex}`}
          href={match[3]}
          style={{
            color: 'var(--color-text)',
            textDecoration: 'underline',
            textUnderlineOffset: '0.2em',
            textDecorationThickness: '1px',
            textDecorationColor: 'color-mix(in srgb, var(--color-secondary) 62%, transparent)',
          }}
        >
          {match[2]}
        </a>
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
          {renderInlineMarkdown(match[5], `${keyPrefix}-strong-em-${matchIndex}`)}
        </strong>
      );
    } else if (match[6]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${matchIndex}`} style={{ fontWeight: 700 }}>
          {renderInlineMarkdown(match[6], `${keyPrefix}-strong-${matchIndex}`)}
        </strong>
      );
    } else if (match[7]) {
      nodes.push(
        <em key={`${keyPrefix}-em-${matchIndex}`} style={{ fontStyle: 'italic' }}>
          {renderInlineMarkdown(match[7], `${keyPrefix}-em-${matchIndex}`)}
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
