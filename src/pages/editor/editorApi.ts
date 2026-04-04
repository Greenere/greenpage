import type { DomainId } from '../../configs/domains';
import type { ChronologyValue } from '../../shared/chronology';
import type { AppLanguage } from '../../i18n';
import { localeToFileSuffix } from '../../i18n/localeFiles';
import {
  loadGraphModel,
  loadGraphNodeContent,
  type GraphNodeContent,
  type GraphNodeRef,
  type NodeKind,
  type RelationKind,
} from '../graph/content/Nodes';

export const EDITOR_CAN_MUTATE_PROJECT = import.meta.env.DEV;
export const EDITOR_EXPORTS_TO_LOCAL_FILE = !EDITOR_CAN_MUTATE_PROJECT;

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

type DeleteNodePayload = {
  nodeId: string;
};

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: string | Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
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
    const explicitRelations = model.relations.filter((relation) => relation.from === nodeId || relation.to === nodeId);

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

async function writeLocalFile(suggestedName: string, payload: string) {
  const savePickerWindow = window as SavePickerWindow;

  if (savePickerWindow.showSaveFilePicker) {
    const fileHandle = await savePickerWindow.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'JSON file',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
    });

    const writable = await fileHandle.createWritable();
    await writable.write(payload);
    await writable.close();
    return;
  }

  const blob = new Blob([payload], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export async function saveEditorNode(
  nodeId: string,
  content: GraphNodeContent,
  node: GraphNodeRef,
  explicitRelations: EditorExplicitRelation[],
  lang: AppLanguage,
) {
  if (!EDITOR_CAN_MUTATE_PROJECT) {
    const exportPayload = {
      exportType: 'greenpage-node-editor-export',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      nodeId,
      lang,
      node,
      content,
      explicitRelations,
    };

    await writeLocalFile(
      `${nodeId}.${localeToFileSuffix(lang)}.greenpage-node-export.json`,
      `${JSON.stringify(exportPayload, null, 2)}\n`,
    );

    return { ok: true as const };
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
