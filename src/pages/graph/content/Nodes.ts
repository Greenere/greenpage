import { DOMAIN_CONFIG, isDomainId, type DomainId } from '../../../configs/content/domains';
import { UI_COPY } from '../../../configs/ui/uiCopy';
import { getActiveLanguage, getLocaleMessages, type AppLanguage } from '../../../i18n';
import { getLocaleFallbackOrder, localeToFileSuffix } from '../../../i18n/localeFiles';
import {
  getChronologySortKey,
  normalizeChronologyValue,
  type ChronologyValue,
} from '../../../shared/chronology';

export type { DomainId } from '../../../configs/content/domains';
export type AnchorId = DomainId;

export type NodeKind = DomainId | 'writing';

export type RelationKind =
  | 'time'
  | 'location'
  | 'topic'
  | 'reason'
  | 'outcome'
  | 'tool'
  | 'sequence';

export type NodeGalleryImage = {
  src: string;
  alt: string;
  caption?: string;
};

export type NodeGalleryAlignment = 'height' | `height:${number}` | 'natural';

export type NodeArticleLink = {
  label: string;
  href: string;
};

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'link'; label: string; href: string; description?: string };

export type ArticleBlock =
  | ContentBlock
  | { type: 'gallery'; items: NodeGalleryImage[]; columns?: 1 | 2 | 3; align?: NodeGalleryAlignment }
  | { type: 'callout'; text: string; title?: string; tone?: 'note' | 'highlight' };

export type NodeArticleHero = {
  image?: NodeGalleryImage;
};

export type NodeArticleMeta = {
  dateLabel?: string;
  location?: string;
  readingTime?: string;
  status?: string;
  links?: NodeArticleLink[];
};

export type NodeArticleSection = {
  id?: string;
  label: string;
  blocks: ArticleBlock[];
};

export type GraphContentNode = {
  id: string;
  kind: NodeKind;
  domain: DomainId;
  title: string;
  subtitle?: string;
  summary: string;
  chronology: ChronologyValue;
  tags?: string[];
  hero?: NodeArticleHero;
  meta?: NodeArticleMeta;
  sections?: NodeArticleSection[];
  gallery?: NodeGalleryImage[];
};

export type GraphNodeRef = {
  id: string;
  kind: NodeKind;
  domain: DomainId;
  chronology: ChronologyValue;
  contentPath?: string;
};

export type GraphNodeContent = {
  title: string;
  subtitle?: string;
  summary: string;
  tags?: string[];
  hero?: NodeArticleHero;
  meta?: NodeArticleMeta;
  sections?: NodeArticleSection[];
  gallery?: NodeGalleryImage[];
};

export type GraphNodeCardContent = Pick<GraphNodeContent, 'title' | 'subtitle' | 'summary' | 'tags'> & {
  preview?: ContentBlock[];
};

export type GraphCardNode = GraphNodeRef & GraphNodeCardContent;

export type GraphNodeContentIndex = Record<string, GraphNodeContent>;
export type GraphNodeCardIndex = Record<string, GraphNodeCardContent>;

export type GraphRelation = {
  id: string;
  from: string;
  to: string;
  kind: RelationKind;
  label: string;
  strength: 1 | 2 | 3;
};

export type GraphModelSettings = {
  deriveTemporalRelationsByDomain?: boolean;
  deriveLatestBioLinksByDomain?: boolean;
};

export type GraphModel = {
  nodes: GraphCardNode[];
  relations: GraphRelation[];
  settings?: GraphModelSettings;
};

export type GraphStructure = {
  nodes: GraphNodeRef[];
  relations: GraphRelation[];
  settings?: GraphModelSettings;
};

export type DomainLayout = {
  seedAngle: number;
};

export const GRAPH_MODEL_URL = `${import.meta.env.BASE_URL}data/graph.json`;
export const GRAPH_NODE_CONTENT_DIR = 'data/nodes/';

// Legacy index URL — used as a fallback during migration before locale-specific indexes exist.
const LEGACY_NODE_CONTENT_INDEX_URL = `${import.meta.env.BASE_URL}data/nodes/index.json`;

function getNodeCardIndexUrl(locale: AppLanguage): string {
  return withBaseUrl(`${GRAPH_NODE_CONTENT_DIR}node_cards.${localeToFileSuffix(locale)}.json`);
}

export const DOMAIN_LAYOUTS: Record<DomainId, DomainLayout> = Object.fromEntries(
  Object.entries(DOMAIN_CONFIG).map(([domain, config]) => [domain, { seedAngle: config.seedAngle }])
) as Record<DomainId, DomainLayout>;

function withBaseUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\.\//, '').replace(/^\//, '')}`;
}

function getNodeContentIndexUrl(locale: AppLanguage): string {
  return withBaseUrl(`${GRAPH_NODE_CONTENT_DIR}index.${localeToFileSuffix(locale)}.json`);
}

function localizeContentPath(contentPath: string, locale: AppLanguage): string {
  return contentPath.replace(/\.json$/i, `.${localeToFileSuffix(locale)}.json`);
}

function getNodeContentUrl(node: GraphNodeRef, locale: AppLanguage): string {
  if (node.contentPath) {
    return withBaseUrl(localizeContentPath(node.contentPath, locale));
  }
  const baseName = node.id.replace(/-/g, '_');
  return withBaseUrl(`${GRAPH_NODE_CONTENT_DIR}${node.domain}/${baseName}.${localeToFileSuffix(locale)}.json`);
}

function getNodeContentLegacyUrl(node: GraphNodeRef): string {
  if (node.contentPath) return withBaseUrl(node.contentPath);
  return withBaseUrl(`${GRAPH_NODE_CONTENT_DIR}${node.domain}/${node.id.replace(/-/g, '_')}.json`);
}

export function resolveAssetUrl(path: string) {
  return withBaseUrl(path);
}

export function getNodeDetailPath(nodeId: string) {
  return `/nodes/${encodeURIComponent(nodeId)}`;
}


function isNodeKind(value: unknown): value is NodeKind {
  return value === 'writing' || isDomainId(value);
}

function isRelationKind(value: unknown): value is RelationKind {
  return value === 'time' || value === 'location' || value === 'topic' || value === 'reason' || value === 'outcome' || value === 'tool' || value === 'sequence';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// In the Vite dev server, requests for missing static files are served as index.html (200, text/html)
// rather than a real 404. Guard against this by checking the Content-Type before treating a
// successful response as JSON.
function isJsonResponse(response: Response): boolean {
  const ct = response.headers.get('content-type');
  return ct !== null && ct.includes('application/json');
}

// Resolves a relation label from the `labels` map (Phase 4 shape) or legacy `label` field.
// Returns null if no label is resolvable — the caller should skip the relation with a warning.
function resolveRelationLabel(item: Record<string, unknown>, locale: AppLanguage): string | null {
  if (isRecord(item.labels)) {
    for (const fallbackLocale of getLocaleFallbackOrder(locale)) {
      const localizedLabel = item.labels[fallbackLocale];
      if (typeof localizedLabel === 'string') return localizedLabel;
    }
  }
  if (typeof item.label === 'string') return item.label;
  return null;
}

function normalizeContentBlocks(value: unknown): ContentBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const blocks = value.filter((block): block is ContentBlock => {
    if (!block || typeof block !== 'object') return false;
    const candidate = block as Record<string, unknown>;
    if (candidate.type === 'text' || candidate.type === 'quote') {
      return typeof candidate.text === 'string';
    }
    if (candidate.type === 'list') {
      return Array.isArray(candidate.items) && candidate.items.every((item) => typeof item === 'string');
    }
    if (candidate.type === 'image') {
      return (
        typeof candidate.src === 'string' &&
        typeof candidate.alt === 'string' &&
        (candidate.caption === undefined || typeof candidate.caption === 'string')
      );
    }
    if (candidate.type === 'link') {
      return typeof candidate.label === 'string' && typeof candidate.href === 'string';
    }
    return false;
  });

  return blocks;
}

function normalizeGalleryImages(value: unknown): NodeGalleryImage[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const images = value.filter((image): image is NodeGalleryImage => {
    if (!image || typeof image !== 'object') return false;
    const candidate = image as Record<string, unknown>;

    return (
      typeof candidate.src === 'string' &&
      typeof candidate.alt === 'string' &&
      (candidate.caption === undefined || typeof candidate.caption === 'string')
    );
  });

  return images.length > 0 ? images : undefined;
}

function normalizeArticleLinks(value: unknown): NodeArticleLink[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const links = value.filter((link): link is NodeArticleLink => {
    if (!isRecord(link)) return false;
    return typeof link.label === 'string' && typeof link.href === 'string';
  });

  return links.length > 0 ? links : undefined;
}

function normalizeArticleHero(value: unknown): NodeArticleHero | undefined {
  if (!isRecord(value)) return undefined;

  const image = normalizeGalleryImages(value.image ? [value.image] : undefined)?.[0];
  if (!image) return undefined;

  return { image };
}

function normalizeArticleMeta(value: unknown): NodeArticleMeta | undefined {
  if (!isRecord(value)) return undefined;

  const meta = {
    dateLabel: typeof value.dateLabel === 'string' ? value.dateLabel : undefined,
    location: typeof value.location === 'string' ? value.location : undefined,
    readingTime: typeof value.readingTime === 'string' ? value.readingTime : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    links: normalizeArticleLinks(value.links),
  } satisfies NodeArticleMeta;

  return meta.dateLabel || meta.location || meta.readingTime || meta.status || meta.links ? meta : undefined;
}

function normalizeArticleBlocks(value: unknown): ArticleBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const blocks = value.filter((block): block is ArticleBlock => {
    if (!isRecord(block)) return false;

    if (block.type === 'text' || block.type === 'quote') {
      return typeof block.text === 'string';
    }

    if (block.type === 'list') {
      return Array.isArray(block.items) && block.items.every((item) => typeof item === 'string');
    }

    if (block.type === 'image') {
      return typeof block.src === 'string' && typeof block.alt === 'string' && (block.caption === undefined || typeof block.caption === 'string');
    }

    if (block.type === 'link') {
      return (
        typeof block.label === 'string' &&
        typeof block.href === 'string' &&
        (block.description === undefined || typeof block.description === 'string')
      );
    }

    if (block.type === 'gallery') {
      const items = normalizeGalleryImages(block.items);
      const align =
        typeof block.align === 'string' ? block.align : undefined;
      return (
        Boolean(items?.length) &&
        (block.columns === undefined || block.columns === 1 || block.columns === 2 || block.columns === 3) &&
        (align === undefined || align === 'natural' || align === 'height' || /^height:\d+$/.test(align))
      );
    }

    if (block.type === 'callout') {
      return (
        typeof block.text === 'string' &&
        (block.title === undefined || typeof block.title === 'string') &&
        (block.tone === undefined || block.tone === 'note' || block.tone === 'highlight')
      );
    }

    return false;
  });

  return blocks.length > 0 ? blocks : undefined;
}

function normalizeArticleSections(value: unknown): NodeArticleSection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sections = value
    .map((section) => {
      if (!isRecord(section) || typeof section.label !== 'string') {
        return null;
      }

      const blocks = normalizeArticleBlocks(section.blocks);
      if (!blocks?.length) {
        return null;
      }

      const normalizedSection: NodeArticleSection = {
        label: section.label,
        blocks,
      };

      if (typeof section.id === 'string') {
        normalizedSection.id = section.id;
      }

      return normalizedSection;
    })
    .filter((section): section is NodeArticleSection => section !== null);

  return sections.length > 0 ? sections : undefined;
}

function derivePreviewBlocks(sections: NodeArticleSection[] | undefined): ContentBlock[] | undefined {
  if (!sections?.length) return undefined;

  const orderedSections = [
    ...sections.filter(
      (section) =>
        section.id?.toLowerCase() === 'overview' || section.label.trim().toLowerCase() === 'overview'
    ),
    ...sections.filter(
      (section) =>
        section.id?.toLowerCase() !== 'overview' && section.label.trim().toLowerCase() !== 'overview'
    ),
  ];

  const previewBlocks = orderedSections
    .flatMap((section) => section.blocks)
    .flatMap((block): ContentBlock[] => {
      if (
        block.type === 'text' ||
        block.type === 'quote' ||
        block.type === 'list' ||
        block.type === 'image' ||
        block.type === 'link'
      ) {
        return [block];
      }

      if (block.type === 'callout') {
        return [{ type: 'text', text: block.text }];
      }

      return [];
    })
    .slice(0, 3);

  return previewBlocks.length > 0 ? previewBlocks : undefined;
}

export function normalizeGraphStructure(raw: unknown, locale: AppLanguage = getActiveLanguage()): GraphStructure {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Graph model must be an object.');
  }

  const candidate = raw as Record<string, unknown>;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.relations)) {
    throw new Error('Graph model must include nodes and relations arrays.');
  }

  const nodes = candidate.nodes.map((node, index) => {
    if (!node || typeof node !== 'object') {
      throw new Error(`Node at index ${index} is invalid.`);
    }
    const item = node as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      !isNodeKind(item.kind) ||
      !isDomainId(item.domain)
    ) {
      throw new Error(`Node "${String(item.id ?? index)}" is missing required fields.`);
    }

    return {
      id: item.id,
      kind: item.kind,
      domain: item.domain,
      chronology: normalizeChronologyValue(item.chronology),
      contentPath: typeof item.contentPath === 'string' ? item.contentPath : undefined,
    } satisfies GraphNodeRef;
  });

  const relations = candidate.relations
    .map((relation, index) => {
      if (!relation || typeof relation !== 'object') {
        throw new Error(`Relation at index ${index} is invalid.`);
      }
      const item = relation as Record<string, unknown>;

      if (
        typeof item.id !== 'string' ||
        typeof item.from !== 'string' ||
        typeof item.to !== 'string' ||
        !isRelationKind(item.kind) ||
        (item.strength !== 1 && item.strength !== 2 && item.strength !== 3)
      ) {
        throw new Error(`Relation "${String(item.id ?? index)}" is missing required fields.`);
      }

      const label = resolveRelationLabel(item, locale);
      if (label === null) {
        console.warn(`Relation "${item.id}" has no resolvable label for locale "${locale}" — skipping.`);
        return null;
      }

      return {
        id: item.id,
        from: item.from,
        to: item.to,
        kind: item.kind,
        label,
        strength: item.strength,
      } satisfies GraphRelation;
    })
    .filter((r): r is GraphRelation => r !== null);

  const settings =
    candidate.settings && typeof candidate.settings === 'object'
      ? {
          deriveTemporalRelationsByDomain:
            typeof (candidate.settings as Record<string, unknown>).deriveTemporalRelationsByDomain === 'boolean'
              ? (candidate.settings as Record<string, boolean>).deriveTemporalRelationsByDomain
              : true,
          deriveLatestBioLinksByDomain:
            typeof (candidate.settings as Record<string, unknown>).deriveLatestBioLinksByDomain === 'boolean'
              ? (candidate.settings as Record<string, boolean>).deriveLatestBioLinksByDomain
              : true,
        }
      : undefined;

  return { nodes, relations, settings };
}

export function normalizeNodeContent(raw: unknown, nodeId = 'unknown'): GraphNodeContent {
  if (!isRecord(raw)) {
    throw new Error(`Node content for "${nodeId}" must be an object.`);
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.title !== 'string' || typeof candidate.summary !== 'string') {
    throw new Error(`Node content for "${nodeId}" is missing title or summary.`);
  }

  const sections = normalizeArticleSections(candidate.sections);

  return {
    title: candidate.title,
    subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle : undefined,
    summary: candidate.summary,
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    hero: normalizeArticleHero(candidate.hero),
    meta: normalizeArticleMeta(candidate.meta),
    sections,
    gallery: normalizeGalleryImages(candidate.gallery),
  } satisfies GraphNodeContent;
}

function toGraphNodeCardContent(content: GraphNodeContent): GraphNodeCardContent {
  return {
    title: content.title,
    subtitle: content.subtitle,
    summary: content.summary,
    tags: content.tags,
    preview: derivePreviewBlocks(content.sections),
  } satisfies GraphNodeCardContent;
}

export function normalizeNodeCardContent(raw: unknown, nodeId = 'unknown'): GraphNodeCardContent {
  const content = normalizeNodeContent(raw, nodeId);
  const candidate = isRecord(raw) ? raw : {};

  return {
    ...toGraphNodeCardContent(content),
    preview:
      normalizeContentBlocks(candidate.preview) ??
      normalizeContentBlocks(candidate.detail) ??
      derivePreviewBlocks(content.sections),
  } satisfies GraphNodeCardContent;
}

async function loadNodeContent(node: GraphNodeRef, locale: AppLanguage): Promise<GraphNodeContent> {
  const isUsable = (r: Response) => r.ok && isJsonResponse(r);
  let response: Response | null = null;

  for (const fallbackLocale of getLocaleFallbackOrder(locale)) {
    response = await fetch(getNodeContentUrl(node, fallbackLocale));
    if (isUsable(response)) {
      break;
    }
  }

  if (!response || !isUsable(response)) {
    response = await fetch(getNodeContentLegacyUrl(node));
  }

  if (!response || !isUsable(response)) {
    throw new Error(UI_COPY.contentLoaders.failedToLoadContentFor(node.id, response?.status ?? 404));
  }

  const raw = await response.json();
  return normalizeNodeContent(raw, node.id);
}

function normalizeNodeCardIndex(raw: unknown): GraphNodeCardIndex {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Node card index must be an object.');
  }

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([nodeId, content]) => [nodeId, normalizeNodeCardContent(content, nodeId)])
  );
}

async function loadNodeCardIndex(locale: AppLanguage): Promise<GraphNodeCardIndex | null> {
  const indexUrls = getLocaleFallbackOrder(locale).flatMap((fallbackLocale) => [
    getNodeCardIndexUrl(fallbackLocale),
    getNodeContentIndexUrl(fallbackLocale),
  ]);

  for (const url of [...new Set(indexUrls)]) {
    const response = await fetch(url);
    if (response.ok && isJsonResponse(response)) {
      const raw = await response.json();
      return normalizeNodeCardIndex(raw);
    }
  }

  const legacyResponse = await fetch(LEGACY_NODE_CONTENT_INDEX_URL);
  if (!legacyResponse.ok || !isJsonResponse(legacyResponse)) {
    return null;
  }

  const raw = await legacyResponse.json();
  return normalizeNodeCardIndex(raw);
}

async function loadGraphModelUncached(url: string, locale: AppLanguage): Promise<GraphModel> {
  const [response, cardIndex] = await Promise.all([fetch(url), loadNodeCardIndex(locale)]);
  if (!response.ok) {
    throw new Error(UI_COPY.contentLoaders.failedToLoadGraphModel(response.status));
  }

  const raw = await response.json();
  const structure = normalizeGraphStructure(raw, locale);
  const resolvedNodes = await Promise.all(
    structure.nodes.map(async (node) => {
      const content = cardIndex?.[node.id] ?? toGraphNodeCardContent(await loadNodeContent(node, locale));
      return {
        ...node,
        ...content,
      } satisfies GraphCardNode;
    })
  );

  const model = {
    nodes: resolvedNodes,
    relations: structure.relations,
    settings: structure.settings,
  };

  if (url === GRAPH_MODEL_URL) {
    graphModelCacheMap.set(locale, model);
  }

  return model;
}

const graphModelPromiseMap = new Map<AppLanguage, Promise<GraphModel>>();
const graphModelCacheMap = new Map<AppLanguage, GraphModel>();
const graphNodeContentPromiseMap = new Map<string, Promise<GraphNodeContent>>();
const graphNodeContentCacheMap = new Map<string, GraphNodeContent>();

function getGraphNodeContentCacheKey(nodeId: string, locale: AppLanguage) {
  return `${locale}:${nodeId}`;
}

export function clearGraphModelCache() {
  graphModelPromiseMap.clear();
  graphModelCacheMap.clear();
}

export function clearGraphNodeContentCache() {
  graphNodeContentPromiseMap.clear();
  graphNodeContentCacheMap.clear();
}

export function readCachedGraphModel(locale: AppLanguage = getActiveLanguage()) {
  return graphModelCacheMap.get(locale) ?? null;
}

export function readCachedGraphNodeContent(nodeId: string, locale: AppLanguage = getActiveLanguage()) {
  return graphNodeContentCacheMap.get(getGraphNodeContentCacheKey(nodeId, locale)) ?? null;
}

export async function loadGraphModel(url = GRAPH_MODEL_URL, locale: AppLanguage = getActiveLanguage()): Promise<GraphModel> {
  if (url !== GRAPH_MODEL_URL) {
    return loadGraphModelUncached(url, locale);
  }

  const existing = graphModelPromiseMap.get(locale);
  if (existing) return existing;

  const promise = loadGraphModelUncached(url, locale).catch((error) => {
    graphModelPromiseMap.delete(locale);
    throw error;
  });

  graphModelPromiseMap.set(locale, promise);
  return promise;
}

export async function loadGraphNodeContent(
  node: GraphNodeRef | GraphCardNode,
  locale: AppLanguage = getActiveLanguage(),
): Promise<GraphNodeContent> {
  const cacheKey = getGraphNodeContentCacheKey(node.id, locale);
  const cached = graphNodeContentCacheMap.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existing = graphNodeContentPromiseMap.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = loadNodeContent(node, locale)
    .then((content) => {
      graphNodeContentCacheMap.set(cacheKey, content);
      graphNodeContentPromiseMap.delete(cacheKey);
      return content;
    })
    .catch((error) => {
      graphNodeContentPromiseMap.delete(cacheKey);
      throw error;
    });

  graphNodeContentPromiseMap.set(cacheKey, promise);
  return promise;
}

export function getContentNodes(model: GraphModel) {
  return model.nodes;
}

export function getLatestNodesByDomain(model: GraphModel) {
  const latestByDomain = new Map<DomainId, GraphCardNode>();

  for (const node of model.nodes) {
    const current = latestByDomain.get(node.domain);
    if (!current || getChronologySortKey(node.chronology) > getChronologySortKey(current.chronology)) {
      latestByDomain.set(node.domain, node);
    }
  }

  return [...latestByDomain.values()];
}

export function getDomainLayout(domain: DomainId) {
  return DOMAIN_LAYOUTS[domain];
}

export function getDisplayDomain(domain: DomainId) {
  return getLocaleMessages().domainLabels[domain] ?? DOMAIN_CONFIG[domain].display;
}

export function getTemporalDomainRelations(model: GraphModel) {
  const byDomain = new Map<DomainId, GraphCardNode[]>();

  for (const node of model.nodes) {
    const existing = byDomain.get(node.domain) ?? [];
    existing.push(node);
    byDomain.set(node.domain, existing);
  }

  return [...byDomain.entries()].flatMap(([domain, nodes]) => {
    const sorted = [...nodes].sort((a, b) => getChronologySortKey(a.chronology) - getChronologySortKey(b.chronology));
    return sorted.slice(1).map((node, index) => ({
      id: `seq-${domain}-${sorted[index].id}-${node.id}`,
      from: sorted[index].id,
      to: node.id,
      kind: 'sequence' as const,
      label: UI_COPY.graphRelations.nextInTimeline,
      strength: 2 as const,
    }));
  });
}

export function getLatestBioRelations(model: GraphModel) {
  return getLatestNodesByDomain(model).map((node) => ({
    id: `bio-${node.domain}-${node.id}`,
    from: node.id,
    to: 'bio',
    kind: 'sequence' as const,
    label: UI_COPY.graphRelations.latestNodeInDomain,
    strength: 2 as const,
  }));
}

export function getGraphRelations(model: GraphModel) {
  const temporal = model.settings?.deriveTemporalRelationsByDomain === false ? [] : getTemporalDomainRelations(model);
  const latestBio = model.settings?.deriveLatestBioLinksByDomain === false ? [] : getLatestBioRelations(model);
  return [...temporal, ...latestBio, ...model.relations];
}
