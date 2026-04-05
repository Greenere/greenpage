import { UI_COPY } from '../configs/ui/uiCopy';
import type { RelationKind } from '../pages/graph/content/Nodes';

export function getRelationKindLabel(kind: RelationKind) {
  return UI_COPY.graphRelations.kindLabels[kind];
}

export function getDirectionalRelationKindLabel(direction: 'next' | 'previous') {
  return direction === 'next' ? UI_COPY.graphRelations.next : UI_COPY.graphRelations.previous;
}

export function getDirectionalTimelineLabel(direction: 'next' | 'previous') {
  return direction === 'next'
    ? UI_COPY.graphRelations.nextInTimeline
    : UI_COPY.graphRelations.previousInTimeline;
}
