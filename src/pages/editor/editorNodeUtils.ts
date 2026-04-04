import { UI_COPY } from '../../configs/ui/uiCopy';
import { getChronologySortKeySafe } from '../../shared/chronology';
import { getDisplayDomain, type GraphNodeRef } from '../graph/content/Nodes';
import type { EditorNodeOption } from './editorApi';

export function sortNodeRefs(left: GraphNodeRef, right: GraphNodeRef) {
  if (left.domain !== right.domain) {
    return left.domain.localeCompare(right.domain);
  }

  const chronologyDelta = getChronologySortKeySafe(left.chronology) - getChronologySortKeySafe(right.chronology);
  if (chronologyDelta !== 0) {
    return chronologyDelta;
  }

  return left.id.localeCompare(right.id);
}

export function getEditorNodeTitle(node: EditorNodeOption | undefined, fallbackId: string) {
  return node?.title?.trim() || fallbackId || node?.id || UI_COPY.nodeEditor.common.chooseNodeFallback;
}

export function formatEditorNodeOptionLabel(node: GraphNodeRef & { title?: string; subtitle?: string }) {
  if (node.title?.trim() && node.title !== node.id) {
    return `${node.title} — ${node.domain} / ${node.id}`;
  }

  return `${node.domain} / ${node.id}`;
}

export function getEditorNodeSearchText(node: EditorNodeOption) {
  return [node.title, node.subtitle, node.id, node.domain, getDisplayDomain(node.domain)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
