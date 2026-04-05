import type { AppLanguage } from '../../i18n';
import { UI_COPY } from '../../configs/ui/uiCopy';
import type { GraphNodeRef } from '../graph/content/Nodes';
import type { EditorExplicitRelation, EditorNodeOption } from './editorApi';
import { getEditorNodeTitle, sortNodeRefs } from './editorNodeUtils';

export type EditorConnectedNodeEntry = {
  key: string;
  relatedNodeId: string;
  relatedNodeTitle: string;
  displayKind: string;
  displayLabel: string;
  removable: boolean;
  explicitRelationIndex?: number;
};

export function createEmptyExplicitRelation(nodeId: string): EditorExplicitRelation {
  return {
    from: nodeId,
    to: '',
    kind: 'topic',
    labels: {},
    strength: 2,
  };
}

export function getExplicitRelationIdentityKey(relation: EditorExplicitRelation) {
  return relation.id ?? `${relation.from}::${relation.to}::${relation.kind}::${relation.strength}`;
}

export function getExplicitRelationLabel(relation: EditorExplicitRelation, language: AppLanguage) {
  return relation.labels[language] ?? '';
}

export function setExplicitRelationLabel(
  relation: EditorExplicitRelation,
  language: AppLanguage,
  value: string,
): EditorExplicitRelation {
  return {
    ...relation,
    labels: {
      ...relation.labels,
      [language]: value,
    },
  };
}

export function areExplicitRelationsEquivalent(left: EditorExplicitRelation[], right: EditorExplicitRelation[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((relation, index) => {
    const other = right[index];
    if (!other) {
      return false;
    }

    return (
      relation.id === other.id &&
      relation.from === other.from &&
      relation.to === other.to &&
      relation.kind === other.kind &&
      JSON.stringify(relation.labels) === JSON.stringify(other.labels) &&
      relation.strength === other.strength
    );
  });
}

function getExplicitRelationPeerId(relation: EditorExplicitRelation, currentNodeId: string) {
  if (relation.from === currentNodeId) {
    return relation.to;
  }

  if (relation.to === currentNodeId) {
    return relation.from;
  }

  return relation.to || relation.from;
}

export function anchorExplicitRelationToNode(relation: EditorExplicitRelation, currentNodeId: string): EditorExplicitRelation {
  if (relation.from === currentNodeId || relation.to === currentNodeId) {
    return relation;
  }

  return {
    ...relation,
    from: currentNodeId,
  };
}

export function isCompleteExplicitRelation(relation: EditorExplicitRelation) {
  return relation.from.trim().length > 0 && relation.to.trim().length > 0;
}

function getTimelineConnectionPeers(currentNode: GraphNodeRef, nodes: EditorNodeOption[]) {
  const domainNodes = nodes
    .map((node) => (node.id === currentNode.id ? { ...node, chronology: currentNode.chronology } : node))
    .filter((node) => node.domain === currentNode.domain)
    .sort(sortNodeRefs);
  const currentIndex = domainNodes.findIndex((node) => node.id === currentNode.id);

  if (currentIndex === -1) {
    return [];
  }

  const neighbors = [domainNodes[currentIndex - 1], domainNodes[currentIndex + 1]].filter(
    (node): node is EditorNodeOption => Boolean(node),
  );

  return neighbors;
}

export function buildTimelineConnectionEntries(currentNode: GraphNodeRef, nodes: EditorNodeOption[]): EditorConnectedNodeEntry[] {
  const neighbors = getTimelineConnectionPeers(currentNode, nodes);

  return neighbors.map((node, index) => ({
    key: `timeline-${node.id}-${index}`,
    relatedNodeId: node.id,
    relatedNodeTitle: getEditorNodeTitle(node, node.id),
    displayKind: 'sequence',
    displayLabel: UI_COPY.graphRelations.nextInTimeline,
    removable: false,
  }));
}

function getBioConnectionPeerId(currentNode: GraphNodeRef, nodes: EditorNodeOption[]) {
  if (currentNode.id === 'bio') {
    return null;
  }

  const domainNodes = nodes
    .map((node) => (node.id === currentNode.id ? { ...node, chronology: currentNode.chronology } : node))
    .filter((node) => node.domain === currentNode.domain)
    .sort(sortNodeRefs);
  const latestNode = domainNodes[domainNodes.length - 1];

  if (!latestNode || latestNode.id !== currentNode.id) {
    return null;
  }

  return 'bio';
}

export function buildBioConnectionEntry(currentNode: GraphNodeRef, nodes: EditorNodeOption[]): EditorConnectedNodeEntry | null {
  const relatedNodeId = getBioConnectionPeerId(currentNode, nodes);
  if (!relatedNodeId) {
    return null;
  }

  return {
    key: 'bio-derived-connection',
    relatedNodeId,
    relatedNodeTitle: UI_COPY.nodeDetailPage.bioEntry.title,
    displayKind: UI_COPY.nodeDetailPage.bioEntry.kind,
    displayLabel: UI_COPY.graphRelations.latestNodeInDomain,
    removable: false,
  };
}

export function getOccupiedConnectionPeerIds(
  currentNode: GraphNodeRef,
  nodes: EditorNodeOption[],
  relations: EditorExplicitRelation[],
  ignoredIndex: number | null = null,
) {
  const peerIds = new Set<string>();

  getTimelineConnectionPeers(currentNode, nodes).forEach((node) => {
    peerIds.add(node.id);
  });

  const bioPeerId = getBioConnectionPeerId(currentNode, nodes);
  if (bioPeerId) {
    peerIds.add(bioPeerId);
  }

  relations.forEach((relation, index) => {
    if (ignoredIndex !== null && index === ignoredIndex) {
      return;
    }

    const peerId = getExplicitRelationPeerId(relation, currentNode.id).trim();
    if (peerId) {
      peerIds.add(peerId);
    }
  });

  return peerIds;
}

export function findDuplicateExplicitRelationIndexes(
  currentNode: GraphNodeRef | null,
  nodes: EditorNodeOption[],
  relations: EditorExplicitRelation[],
) {
  if (!currentNode) {
    return new Set<number>();
  }

  const implicitPeerIds = getOccupiedConnectionPeerIds(currentNode, nodes, []);
  const firstIndexByPeerId = new Map<string, number>();
  const duplicateIndexes = new Set<number>();

  relations.forEach((relation, index) => {
    const peerId = getExplicitRelationPeerId(relation, currentNode.id).trim();
    if (!peerId) {
      return;
    }

    if (implicitPeerIds.has(peerId)) {
      duplicateIndexes.add(index);
      return;
    }

    const firstIndex = firstIndexByPeerId.get(peerId);
    if (firstIndex === undefined) {
      firstIndexByPeerId.set(peerId, index);
      return;
    }

    duplicateIndexes.add(firstIndex);
    duplicateIndexes.add(index);
  });

  return duplicateIndexes;
}

export function wouldCreateDuplicateExplicitRelation(
  currentNode: GraphNodeRef,
  nodes: EditorNodeOption[],
  relations: EditorExplicitRelation[],
  candidate: EditorExplicitRelation,
  ignoredIndex: number | null = null,
) {
  const candidatePeerId = getExplicitRelationPeerId(candidate, currentNode.id).trim();
  if (!candidatePeerId) {
    return false;
  }

  return getOccupiedConnectionPeerIds(currentNode, nodes, relations, ignoredIndex).has(candidatePeerId);
}

export function buildExplicitConnectionEntry(
  relation: EditorExplicitRelation,
  relationIndex: number,
  currentNodeId: string,
  nodeById: Map<string, EditorNodeOption>,
  language: AppLanguage,
): EditorConnectedNodeEntry {
  const relatedNodeId = getExplicitRelationPeerId(relation, currentNodeId);
  const relatedNode = nodeById.get(relatedNodeId);
  const hasChosenPeer = Boolean(relatedNodeId);
  const relationLabel = getExplicitRelationLabel(relation, language);

  return {
    key: `explicit-${relationIndex}-${relation.from}-${relation.to}-${relation.kind}`,
    relatedNodeId,
    relatedNodeTitle: hasChosenPeer ? getEditorNodeTitle(relatedNode, relatedNodeId) : UI_COPY.nodeEditor.common.chooseNodeFallback,
    displayKind: relation.kind,
    displayLabel:
      relationLabel.trim() ||
      (hasChosenPeer
        ? UI_COPY.nodeEditor.connectedNodes.relationLabelFallback
        : UI_COPY.nodeEditor.connectedNodes.relationIncompleteFallback),
    removable: true,
    explicitRelationIndex: relationIndex,
  };
}
