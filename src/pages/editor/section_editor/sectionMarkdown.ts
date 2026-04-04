import { UI_COPY } from '../../../configs/uiCopy';
import { type ArticleBlock, type NodeArticleSection } from '../../graph/content/Nodes';

const IMAGE_LINE_PATTERN = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/;
const LINK_LINE_PATTERN = /^\[([^\]]+)\]\((\S+?)\)$/;

function trimBlockText(value: string) {
  return value.trim().replace(/\n{3,}/g, '\n\n');
}

function serializeImageLine(src: string, alt: string, caption?: string) {
  return `![${alt}](${src}${caption ? ` "${caption}"` : ''})`;
}

export function createEmptySection(): NodeArticleSection {
  return {
    label: UI_COPY.nodeEditor.sectionEditor.newSectionLabel,
    blocks: [
      {
        type: 'text',
        text: UI_COPY.nodeEditor.sectionEditor.newSectionText,
      },
    ],
  };
}

export function serializeSectionMarkdown(section: NodeArticleSection) {
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
        const header = `:::gallery columns=${block.columns ?? 2} align=${block.align ?? 'height:1'}`;
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

export function parseSectionMarkdown(markdown: string): ArticleBlock[] {
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
      const alignMatch = line.match(/align=(natural|height(?::\d+)?)/);
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
        align: alignMatch ? (alignMatch[1] as Extract<ArticleBlock, { type: 'gallery' }>['align']) : 'height:1',
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
