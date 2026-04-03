import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const graphPath = path.join(publicDir, 'data', 'graph.json');
const nodesDir = path.join(publicDir, 'data', 'nodes');

// One entry per supported locale: { suffix } where suffix is the file locale suffix.
const LOCALES = [
  { lang: 'en', suffix: 'en' },
  { lang: 'zh-CN', suffix: 'zh_cn' },
];

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

function getLocaleContentPath(nodeRef, suffix) {
  if (typeof nodeRef.contentPath === 'string' && nodeRef.contentPath.length > 0) {
    return path.join(publicDir, nodeRef.contentPath.replace(/^\//, ''));
  }

  if (typeof nodeRef.domain !== 'string' || nodeRef.domain.length === 0) {
    throw new Error(`Graph node ref "${String(nodeRef.id)}" must include a "domain" to resolve its content path.`);
  }

  const baseName = nodeRef.id.replace(/-/g, '_');
  return path.join(nodesDir, nodeRef.domain, `${baseName}.${suffix}.json`);
}

function getLegacyContentPath(nodeRef) {
  if (typeof nodeRef.contentPath === 'string' && nodeRef.contentPath.length > 0) {
    return path.join(publicDir, nodeRef.contentPath.replace(/^\//, ''));
  }

  if (typeof nodeRef.domain !== 'string' || nodeRef.domain.length === 0) {
    throw new Error(`Graph node ref "${String(nodeRef.id)}" must include a "domain" to resolve its content path.`);
  }

  return path.join(nodesDir, nodeRef.domain, `${nodeRef.id.replace(/-/g, '_')}.json`);
}

// Tries locale file → English fallback → other supported locale files → legacy pre-migration file.
async function readContentWithFallback(nodeRef, suffix) {
  for (const fallbackSuffix of getLocaleFallbackSuffixes(suffix)) {
    try {
      return JSON.parse(await fs.readFile(getLocaleContentPath(nodeRef, fallbackSuffix), 'utf8'));
    } catch {
      // fall through
    }
  }

  // Try pre-migration legacy file.
  return JSON.parse(await fs.readFile(getLegacyContentPath(nodeRef), 'utf8'));
}

async function main() {
  const graphRaw = await fs.readFile(graphPath, 'utf8');
  const graph = JSON.parse(graphRaw);
  const nodeRefs = Array.isArray(graph.nodes) ? graph.nodes : [];

  await fs.mkdir(nodesDir, { recursive: true });

  for (const locale of LOCALES) {
    const index = {};

    for (const nodeRef of nodeRefs) {
      if (!nodeRef || typeof nodeRef !== 'object' || typeof nodeRef.id !== 'string') {
        throw new Error('Graph node refs must include an "id" field.');
      }

      index[nodeRef.id] = await readContentWithFallback(nodeRef, locale.suffix);
    }

    const indexPath = path.join(nodesDir, `index.${locale.suffix}.json`);
    await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    console.log(`Generated ${path.relative(rootDir, indexPath)} with ${Object.keys(index).length} node entries.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
