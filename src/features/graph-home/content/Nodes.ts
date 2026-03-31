export type DomainId = 'research' | 'education' | 'travel' | 'blog' | 'experience' | 'project';
export type AnchorId = DomainId;

export type NodeKind =
  | 'research'
  | 'education'
  | 'travel'
  | 'writing'
  | 'experience'
  | 'project';

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

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'link'; label: string; href: string };

export type GraphContentNode = {
  id: string;
  kind: NodeKind;
  domain: DomainId;
  title: string;
  subtitle?: string;
  summary: string;
  chronology: number;
  tags?: string[];
  gallery?: NodeGalleryImage[];
  detail?: ContentBlock[];
};

export type GraphNodeRef = {
  id: string;
  kind: NodeKind;
  domain: DomainId;
  chronology: number;
  contentPath?: string;
};

export type GraphNodeContent = {
  title: string;
  subtitle?: string;
  summary: string;
  tags?: string[];
  gallery?: NodeGalleryImage[];
  detail?: ContentBlock[];
};

export type GraphNodeContentIndex = Record<string, GraphNodeContent>;

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
  nodes: GraphContentNode[];
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
export const GRAPH_NODE_CONTENT_INDEX_URL = `${import.meta.env.BASE_URL}data/nodes/index.json`;

export const DOMAIN_LAYOUTS: Record<DomainId, DomainLayout> = {
  research: { seedAngle: -140 },
  education: { seedAngle: -95 },
  travel: { seedAngle: -20 },
  blog: { seedAngle: 25 },
  experience: { seedAngle: 95 },
  project: { seedAngle: 150 },
};

function withBaseUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\.\//, '').replace(/^\//, '')}`;
}

export function resolveAssetUrl(path: string) {
  return withBaseUrl(path);
}

export function getNodeDetailPath(nodeId: string) {
  return `/nodes/${encodeURIComponent(nodeId)}`;
}

export function getNodeTransitionName(nodeId: string) {
  return `content-node-${nodeId}`;
}

function isDomainId(value: unknown): value is DomainId {
  return value === 'research' || value === 'education' || value === 'travel' || value === 'blog' || value === 'experience' || value === 'project';
}

function isNodeKind(value: unknown): value is NodeKind {
  return value === 'research' || value === 'education' || value === 'travel' || value === 'writing' || value === 'experience' || value === 'project';
}

function isRelationKind(value: unknown): value is RelationKind {
  return value === 'time' || value === 'location' || value === 'topic' || value === 'reason' || value === 'outcome' || value === 'tool' || value === 'sequence';
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

export function normalizeGraphStructure(raw: unknown): GraphStructure {
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
      !isDomainId(item.domain) ||
      typeof item.chronology !== 'number'
    ) {
      throw new Error(`Node "${String(item.id ?? index)}" is missing required fields.`);
    }

    return {
      id: item.id,
      kind: item.kind,
      domain: item.domain,
      chronology: item.chronology,
      contentPath: typeof item.contentPath === 'string' ? item.contentPath : undefined,
    } satisfies GraphNodeRef;
  });

  const relations = candidate.relations.map((relation, index) => {
    if (!relation || typeof relation !== 'object') {
      throw new Error(`Relation at index ${index} is invalid.`);
    }
    const item = relation as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      typeof item.from !== 'string' ||
      typeof item.to !== 'string' ||
      !isRelationKind(item.kind) ||
      typeof item.label !== 'string' ||
      (item.strength !== 1 && item.strength !== 2 && item.strength !== 3)
    ) {
      throw new Error(`Relation "${String(item.id ?? index)}" is missing required fields.`);
    }

    return {
      id: item.id,
      from: item.from,
      to: item.to,
      kind: item.kind,
      label: item.label,
      strength: item.strength,
    } satisfies GraphRelation;
  });

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
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Node content for "${nodeId}" must be an object.`);
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.title !== 'string' || typeof candidate.summary !== 'string') {
    throw new Error(`Node content for "${nodeId}" is missing title or summary.`);
  }

  return {
    title: candidate.title,
    subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle : undefined,
    summary: candidate.summary,
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    gallery: normalizeGalleryImages(candidate.gallery),
    detail: normalizeContentBlocks(candidate.detail),
  } satisfies GraphNodeContent;
}

function getNodeContentUrl(node: GraphNodeRef) {
  return withBaseUrl(node.contentPath ?? `${GRAPH_NODE_CONTENT_DIR}${node.id}.json`);
}

async function loadNodeContent(node: GraphNodeRef) {
  const response = await fetch(getNodeContentUrl(node));
  if (!response.ok) {
    throw new Error(`Failed to load content for "${node.id}": ${response.status}`);
  }
  const raw = await response.json();
  return normalizeNodeContent(raw, node.id);
}

function normalizeNodeContentIndex(raw: unknown): GraphNodeContentIndex {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Node content index must be an object.');
  }

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([nodeId, content]) => [nodeId, normalizeNodeContent(content, nodeId)])
  );
}

async function loadNodeContentIndex() {
  const response = await fetch(GRAPH_NODE_CONTENT_INDEX_URL);
  if (!response.ok) {
    return null;
  }

  const raw = await response.json();
  return normalizeNodeContentIndex(raw);
}

async function loadGraphModelUncached(url = GRAPH_MODEL_URL): Promise<GraphModel> {
  const [response, contentIndex] = await Promise.all([fetch(url), loadNodeContentIndex()]);
  if (!response.ok) {
    throw new Error(`Failed to load graph model: ${response.status}`);
  }

  const raw = await response.json();
  const structure = normalizeGraphStructure(raw);
  const resolvedNodes = await Promise.all(
    structure.nodes.map(async (node) => {
      const content = contentIndex?.[node.id] ?? await loadNodeContent(node);
      return {
        ...node,
        ...content,
      } satisfies GraphContentNode;
    })
  );

  const model = {
    nodes: resolvedNodes,
    relations: structure.relations,
    settings: structure.settings,
  };

  if (url === GRAPH_MODEL_URL) {
    graphModelCache = model;
  }

  return model;
}

let graphModelPromise: Promise<GraphModel> | null = null;
let graphModelCache: GraphModel | null = null;

export function readCachedGraphModel() {
  return graphModelCache;
}

export async function loadGraphModel(url = GRAPH_MODEL_URL): Promise<GraphModel> {
  if (url !== GRAPH_MODEL_URL) {
    return loadGraphModelUncached(url);
  }

  if (!graphModelPromise) {
    graphModelPromise = loadGraphModelUncached(url).catch((error) => {
      graphModelPromise = null;
      throw error;
    });
  }

  return graphModelPromise;
}

export function getContentNodes(model: GraphModel) {
  return model.nodes;
}

export function getLatestNodesByDomain(model: GraphModel) {
  const latestByDomain = new Map<DomainId, GraphContentNode>();

  for (const node of model.nodes) {
    const current = latestByDomain.get(node.domain);
    if (!current || node.chronology > current.chronology) {
      latestByDomain.set(node.domain, node);
    }
  }

  return [...latestByDomain.values()];
}

export function getDomainLayout(domain: DomainId) {
  return DOMAIN_LAYOUTS[domain];
}

export function getDisplayDomain(domain: DomainId) {
  if (domain === 'blog') return 'writing';
  return domain;
}

export function getTemporalDomainRelations(model: GraphModel) {
  const byDomain = new Map<DomainId, GraphContentNode[]>();

  for (const node of model.nodes) {
    const existing = byDomain.get(node.domain) ?? [];
    existing.push(node);
    byDomain.set(node.domain, existing);
  }

  return [...byDomain.entries()].flatMap(([domain, nodes]) => {
    const sorted = [...nodes].sort((a, b) => a.chronology - b.chronology);
    return sorted.slice(1).map((node, index) => ({
      id: `seq-${domain}-${sorted[index].id}-${node.id}`,
      from: sorted[index].id,
      to: node.id,
      kind: 'sequence' as const,
      label: 'next in timeline',
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
    label: 'latest node in domain',
    strength: 2 as const,
  }));
}

export function getGraphRelations(model: GraphModel) {
  const temporal = model.settings?.deriveTemporalRelationsByDomain === false ? [] : getTemporalDomainRelations(model);
  const latestBio = model.settings?.deriveLatestBioLinksByDomain === false ? [] : getLatestBioRelations(model);
  return [...temporal, ...latestBio, ...model.relations];
}
