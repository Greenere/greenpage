import type { DomainId } from '../../configs/domains';
import type { ChronologyValue } from '../../shared/chronology';
import type { AppLanguage } from '../../i18n';
import type { GraphNodeContent, GraphNodeRef, NodeKind, RelationKind } from '../graph/content/Nodes';

export type EditorNodeOption = GraphNodeRef & {
  title?: string;
  subtitle?: string;
};

export type EditorBootstrapResponse = {
  nodes: EditorNodeOption[];
};

export type EditorExplicitRelation = {
  id?: string;
  from: string;
  to: string;
  kind: RelationKind;
  label: string;
  strength: 1 | 2 | 3;
};

export type EditorNodeResponse = {
  node: GraphNodeRef;
  content: GraphNodeContent;
  contentPath: string;
  isFallbackContent: boolean;
  resolvedLanguage: AppLanguage;
  explicitRelations: EditorExplicitRelation[];
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
  const response = await fetch(`/__editor/bootstrap?lang=${encodeURIComponent(lang)}`);
  return parseResponse<EditorBootstrapResponse>(response);
}

export async function fetchEditorNode(nodeId: string, lang: AppLanguage) {
  const response = await fetch(`/__editor/node?nodeId=${encodeURIComponent(nodeId)}&lang=${encodeURIComponent(lang)}`);
  return parseResponse<EditorNodeResponse>(response);
}

export async function saveEditorNode(
  nodeId: string,
  content: GraphNodeContent,
  node: GraphNodeRef,
  explicitRelations: EditorExplicitRelation[],
  lang: AppLanguage,
) {
  const response = await fetch('/__editor/node/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nodeId, lang, content, node, explicitRelations }),
  });

  return parseResponse<{ ok: true }>(response);
}

export async function createEditorNode(payload: CreateNodePayload) {
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
  const response = await fetch('/__editor/domain/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ ok: true; domainId: string }>(response);
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
