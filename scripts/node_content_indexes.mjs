import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildGraphLayoutHash, buildGraphLayoutHashModuleSource } from './graph_layout_hash.mjs';

export const LOCALES = [
  { lang: 'en', suffix: 'en' },
  { lang: 'zh-CN', suffix: 'zh_cn' },
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getLocaleFallbackSuffixes(suffix) {
  const ordered = [suffix];

  if (suffix !== 'en') {
    ordered.push('en');
  }

  for (const locale of LOCALES) {
    if (!ordered.includes(locale.suffix)) {
      ordered.push(locale.suffix);
    }
  }

  return ordered;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item) => typeof item === 'string');
  return items.length > 0 ? items : undefined;
}

function toPreviewContentBlock(block) {
  if (!isRecord(block) || typeof block.type !== 'string') {
    return null;
  }

  if ((block.type === 'text' || block.type === 'quote') && typeof block.text === 'string') {
    return { type: block.type, text: block.text };
  }

  if (block.type === 'list') {
    const items = normalizeStringArray(block.items);
    return items ? { type: 'list', items } : null;
  }

  if (block.type === 'image' && typeof block.src === 'string' && typeof block.alt === 'string') {
    return {
      type: 'image',
      src: block.src,
      alt: block.alt,
      caption: typeof block.caption === 'string' ? block.caption : undefined,
    };
  }

  if (block.type === 'link' && typeof block.label === 'string' && typeof block.href === 'string') {
    return {
      type: 'link',
      label: block.label,
      href: block.href,
      description: typeof block.description === 'string' ? block.description : undefined,
    };
  }

  if (block.type === 'callout' && typeof block.text === 'string') {
    return { type: 'text', text: block.text };
  }

  return null;
}

function derivePreviewBlocksFromSections(sections) {
  if (!Array.isArray(sections)) return undefined;

  const validSections = sections.filter(
    (section) =>
      isRecord(section) &&
      typeof section.label === 'string' &&
      Array.isArray(section.blocks)
  );

  if (validSections.length === 0) {
    return undefined;
  }

  const orderedSections = [
    ...validSections.filter(
      (section) =>
        typeof section.id === 'string'
          ? section.id.trim().toLowerCase() === 'overview'
          : section.label.trim().toLowerCase() === 'overview'
    ),
    ...validSections.filter(
      (section) =>
        typeof section.id === 'string'
          ? section.id.trim().toLowerCase() !== 'overview'
          : section.label.trim().toLowerCase() !== 'overview'
    ),
  ];

  const previewBlocks = [];

  for (const section of orderedSections) {
    for (const block of section.blocks) {
      const previewBlock = toPreviewContentBlock(block);
      if (previewBlock) {
        previewBlocks.push(previewBlock);
      }
      if (previewBlocks.length >= 3) {
        return previewBlocks;
      }
    }
  }

  return previewBlocks.length > 0 ? previewBlocks : undefined;
}

function normalizePreviewContentBlocks(value) {
  if (!Array.isArray(value)) return undefined;
  const blocks = value
    .map((block) => toPreviewContentBlock(block))
    .filter((block) => block !== null);

  return blocks.length > 0 ? blocks : undefined;
}

function toNodeCardContent(raw, nodeId) {
  if (!isRecord(raw)) {
    throw new Error(`Node content for "${nodeId}" must be an object.`);
  }

  if (typeof raw.title !== 'string' || typeof raw.summary !== 'string') {
    throw new Error(`Node content for "${nodeId}" is missing title or summary.`);
  }

  return {
    title: raw.title,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
    summary: raw.summary,
    tags: normalizeStringArray(raw.tags),
    preview:
      derivePreviewBlocksFromSections(raw.sections) ??
      normalizePreviewContentBlocks(raw.preview) ??
      normalizePreviewContentBlocks(raw.detail),
  };
}

function getLocaleContentPath(rootDir, nodeRef, suffix) {
  const publicDir = path.join(rootDir, 'public');
  const nodesDir = path.join(publicDir, 'data', 'nodes');

  if (typeof nodeRef.contentPath === 'string' && nodeRef.contentPath.length > 0) {
    return path.join(
      publicDir,
      nodeRef.contentPath.replace(/\.json$/i, `.${suffix}.json`).replace(/^\//, ''),
    );
  }

  if (typeof nodeRef.domain !== 'string' || nodeRef.domain.length === 0) {
    throw new Error(`Graph node ref "${String(nodeRef.id)}" must include a "domain" to resolve its content path.`);
  }

  const baseName = nodeRef.id.replace(/-/g, '_');
  return path.join(nodesDir, nodeRef.domain, `${baseName}.${suffix}.json`);
}

function getLegacyContentPath(rootDir, nodeRef) {
  const publicDir = path.join(rootDir, 'public');
  const nodesDir = path.join(publicDir, 'data', 'nodes');

  if (typeof nodeRef.contentPath === 'string' && nodeRef.contentPath.length > 0) {
    return path.join(publicDir, nodeRef.contentPath.replace(/^\//, ''));
  }

  if (typeof nodeRef.domain !== 'string' || nodeRef.domain.length === 0) {
    throw new Error(`Graph node ref "${String(nodeRef.id)}" must include a "domain" to resolve its content path.`);
  }

  return path.join(nodesDir, nodeRef.domain, `${nodeRef.id.replace(/-/g, '_')}.json`);
}

async function readContentWithFallback(rootDir, nodeRef, suffix) {
  for (const fallbackSuffix of getLocaleFallbackSuffixes(suffix)) {
    try {
      return JSON.parse(await fs.readFile(getLocaleContentPath(rootDir, nodeRef, fallbackSuffix), 'utf8'));
    } catch {
      // fall through
    }
  }

  return JSON.parse(await fs.readFile(getLegacyContentPath(rootDir, nodeRef), 'utf8'));
}

export async function generateNodeContentIndexes({
  rootDir = process.cwd(),
  log = console.log,
} = {}) {
  const publicDir = path.join(rootDir, 'public');
  const srcDir = path.join(rootDir, 'src');
  const graphPath = path.join(publicDir, 'data', 'graph.json');
  const nodesDir = path.join(publicDir, 'data', 'nodes');
  const generatedGraphHashPath = path.join(srcDir, 'configs', 'graph', 'generatedGraphLayoutHash.ts');
  const graphRaw = await fs.readFile(graphPath, 'utf8');
  const graph = JSON.parse(graphRaw);
  const graphHash = buildGraphLayoutHash(graph);
  const nodeRefs = Array.isArray(graph.nodes) ? graph.nodes : [];

  await fs.mkdir(nodesDir, { recursive: true });
  await fs.mkdir(path.dirname(generatedGraphHashPath), { recursive: true });

  for (const locale of LOCALES) {
    const cardIndex = {};

    for (const nodeRef of nodeRefs) {
      if (!nodeRef || typeof nodeRef !== 'object' || typeof nodeRef.id !== 'string') {
        throw new Error('Graph node refs must include an "id" field.');
      }

      const content = await readContentWithFallback(rootDir, nodeRef, locale.suffix);
      cardIndex[nodeRef.id] = toNodeCardContent(content, nodeRef.id);
    }

    const cardIndexPath = path.join(nodesDir, `node_cards.${locale.suffix}.json`);
    await fs.writeFile(cardIndexPath, `${JSON.stringify(cardIndex, null, 2)}\n`);

    if (typeof log === 'function') {
      log(`Generated ${path.relative(rootDir, cardIndexPath)} with ${Object.keys(cardIndex).length} node entries.`);
    }
  }

  await fs.writeFile(generatedGraphHashPath, buildGraphLayoutHashModuleSource(graphHash));

  if (typeof log === 'function') {
    log(`Generated ${path.relative(rootDir, generatedGraphHashPath)} with graph hash ${graphHash}.`);
  }
}
