import type { DomainId } from '../../configs/content/domains';
import type { ChronologyValue } from '../../shared/chronology';
import type { AppLanguage } from '../../i18n';
import { localeToFileSuffix } from '../../i18n/localeFiles';
import { loadBioPageContentWithResolution, type BioPageContent } from '../graph/content/BioPage';
import {
  loadGraphModel,
  loadGraphNodeContent,
  type GraphNodeContent,
  type GraphNodeRef,
  type NodeKind,
  type RelationKind,
  type RelationStrength,
} from '../graph/content/Nodes';

export const EDITOR_CAN_MUTATE_PROJECT = import.meta.env.DEV;

export type EditorNodeOption = GraphNodeRef & {
  title?: string;
  subtitle?: string;
};

export type EditorBootstrapResponse = {
  nodes: EditorNodeOption[];
};

export type EditorRelationLabels = Partial<Record<AppLanguage, string>>;

export type EditorExplicitRelation = {
  id?: string;
  from: string;
  to: string;
  kind: RelationKind;
  labels: EditorRelationLabels;
  strength: RelationStrength;
};

export type EditorNodeResponse = {
  node: GraphNodeRef;
  content: GraphNodeContent;
  contentPath: string;
  isFallbackContent: boolean;
  resolvedLanguage: AppLanguage;
  explicitRelations: EditorExplicitRelation[];
};

export type EditorBioResponse = {
  content: BioPageContent;
  contentPath: string;
  isFallbackContent: boolean;
  resolvedLanguage: AppLanguage;
};

type CreateNodePayload = {
  node: GraphNodeRef;
  content: GraphNodeContent;
};

type CreateDomainPayload = {
  domainId: string;
  display: string;
  cardTag: string;
  seedAngle: number;
};

type DeleteDomainPayload = {
  domainId: string;
};

type DeleteNodePayload = {
  nodeId: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore JSON parsing failures and keep the default message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchEditorBootstrap(lang: AppLanguage) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    const model = await loadGraphModel(undefined, lang);
    return {
      nodes: model.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        domain: node.domain,
        chronology: node.chronology,
        contentPath: node.contentPath,
        title: node.title,
        subtitle: node.subtitle,
      })),
    } satisfies EditorBootstrapResponse;
  }

  const response = await fetch(`/__editor/bootstrap?lang=${encodeURIComponent(lang)}`);
  return parseResponse<EditorBootstrapResponse>(response);
}

export async function fetchEditorNode(nodeId: string, lang: AppLanguage) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    const model = await loadGraphModel(undefined, lang);
    const node = model.nodes.find((entry) => entry.id === nodeId);

    if (!node) {
      throw new Error(`Node "${nodeId}" was not found.`);
    }

    const content = await loadGraphNodeContent(node, lang);
    const explicitRelations = model.relations
      .filter((relation) => relation.from === nodeId || relation.to === nodeId)
      .map((relation) => ({
        ...relation,
        labels: { [lang]: relation.label },
      }));

    return {
      node: {
        id: node.id,
        kind: node.kind,
        domain: node.domain,
        chronology: node.chronology,
        contentPath: node.contentPath,
      },
      content,
      contentPath:
        node.contentPath ??
        `/data/nodes/${node.domain}/${node.id.replace(/-/g, '_')}.${localeToFileSuffix(lang)}.json`,
      isFallbackContent: false,
      resolvedLanguage: lang,
      explicitRelations,
    } satisfies EditorNodeResponse;
  }

  const response = await fetch(`/__editor/node?nodeId=${encodeURIComponent(nodeId)}&lang=${encodeURIComponent(lang)}`);
  return parseResponse<EditorNodeResponse>(response);
}

export async function fetchEditorBio(lang: AppLanguage) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    const payload = await loadBioPageContentWithResolution(lang);
    return {
      content: payload.content,
      contentPath: `/data/bio.${localeToFileSuffix(payload.resolvedLanguage)}.json`,
      isFallbackContent: payload.isFallbackContent,
      resolvedLanguage: payload.resolvedLanguage,
    } satisfies EditorBioResponse;
  }

  const response = await fetch(`/__editor/bio?lang=${encodeURIComponent(lang)}`);
  return parseResponse<EditorBioResponse>(response);
}

export async function saveEditorNode(
  nodeId: string,
  content: GraphNodeContent,
  node: GraphNodeRef,
  explicitRelations: EditorExplicitRelation[],
  lang: AppLanguage,
) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    throw new Error('Writing node files is only available in development mode.');
  }

  const response = await fetch('/__editor/node/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nodeId, lang, content, node, explicitRelations }),
  });

  return parseResponse<{ ok: true }>(response);
}

export async function saveEditorBio(content: BioPageContent, lang: AppLanguage) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    throw new Error('Writing bio files is only available in development mode.');
  }

  const response = await fetch('/__editor/bio/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lang, content }),
  });

  return parseResponse<{ ok: true }>(response);
}

export async function createEditorNode(payload: CreateNodePayload) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    throw new Error('Creating new nodes is only available in development mode.');
  }

  const response = await fetch('/__editor/node/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ ok: true; nodeId: string; node: GraphNodeRef }>(response);
}

export async function createEditorDomain(payload: CreateDomainPayload) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    throw new Error('Creating new domains is only available in development mode.');
  }

  const response = await fetch('/__editor/domain/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ ok: true; domainId: string }>(response);
}

export async function deleteEditorDomain(payload: DeleteDomainPayload) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    throw new Error('Deleting domains is only available in development mode.');
  }

  const response = await fetch('/__editor/domain/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ ok: true; domainId: string }>(response);
}

export async function deleteEditorNode(payload: DeleteNodePayload) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    throw new Error('Deleting nodes is only available in development mode.');
  }

  if (payload.nodeId === 'bio') {
    throw new Error('The bio node cannot be deleted.');
  }

  const response = await fetch('/__editor/node/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ ok: true; nodeId: string }>(response);
}

export type NewNodeDraft = {
  nodeId: string;
  domain: DomainId;
  kind: NodeKind;
  chronology: ChronologyValue;
  title: string;
  subtitle: string;
  summary: string;
  template: string;
};
