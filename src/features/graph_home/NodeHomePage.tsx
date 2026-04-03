import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    ReactFlow,
    type Node,
    type Edge,
    type Viewport,
    useNodesState,
    useEdgesState,
    useReactFlow,
    type ReactFlowInstance,
    type NodeMouseHandler,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import BioNode from './nodes/BioNode';
import { edgeTypes } from './nodes/EdgeTypes';
import StoryNode from './nodes/StoryNode';
import BioToggleNode from './nodes/BioToggleNode';
import type { DynamicHandle } from './nodes/Handles';
import { applyThemeVars } from '../../shared/styles/colors';
import { getChronologySortKey } from '../../shared/chronology';
import { GRAPH_NODE_FOCUS_ZOOM } from '../../configs/graphFocus';
import {
    GRAPH_BIO_PORTRAIT_BORDER_OPACITY,
    GRAPH_BIO_PORTRAIT_BORDER_WIDTH,
    GRAPH_EDGE_HIGHLIGHT_STROKE_WIDTH,
    GRAPH_NODE_HIGHLIGHT_GROWTH_DIRECTION,
    GRAPH_NODE_HIGHLIGHT_RING_OPACITY,
    GRAPH_NODE_HIGHLIGHT_RING_WIDTH,
    getHighlightBorderShadowPrefix,
} from '../../configs/graphHighlight';
import { UI_COPY } from '../../configs/uiCopy';
import { useAppLanguage } from '../../i18n/LanguageProvider';
import { persistTheme, readStoredTheme, type Theme } from './content/BioTheme';
import {
    type DomainId,
    type GraphContentNode,
    type GraphModel,
    getContentNodes,
    getDisplayDomain,
    getDomainLayout,
    getGraphRelations,
    loadGraphModel,
    readCachedGraphModel,
} from './content/Nodes';

const nodeTypes = {
    bioNode: BioNode,
    bioToggleNode: BioToggleNode,
    storyNode: StoryNode
};

type Point = { x: number; y: number };

type StoryNodeData = {
    nodeRole: 'content';
    nodeId: string;
    domain: DomainId;
    domainTag: string;
    handles?: DynamicHandle[];
    title: string;
    subtitle?: string;
    summary: string;
    detail?: GraphContentNode['detail'];
    badges?: string[];
};

const CONTENT_NODE_WIDTH = 196;
const CONTENT_NODE_HEIGHT = 190;
const BIO_NODE_WIDTH = 228;
const BIO_NODE_HEIGHT = 248;
const CONTENT_COLLISION_PADDING = 18;
const BIO_COLLISION_PADDING = 24;
const TOGGLE_COLLISION_PADDING = 10;
const TOGGLE_NODE_WIDTH = 170;
const TOGGLE_NODE_HEIGHT = 48;
const HANDLE_MARGIN = 0.14;
const PREFERRED_HANDLE_GAP = 0.11;
const HANDLE_SMOOTHING = 0.35;
const FLOATING_NODE_Z_INDEX = 10000;
const FLOATING_EDGE_Z_INDEX = 10001;
const GRAPH_VIEW_STORAGE_KEY = 'greenpage-graph-view';
const GRAPH_RETURN_FOCUS_NODE_KEY = 'greenpage-graph-return-focus-node';
const GRAPH_NODE_CLASS_NAME = 'greenpage-graph-node';
const GRAPH_NODE_HIGHLIGHT_SELF_CLASS_NAME = 'greenpage-graph-node-highlight-self';
const GRAPH_NODE_HIGHLIGHT_CONNECTED_CLASS_NAME = 'greenpage-graph-node-highlight-connected';
const STYLE_NODE_CLASS_NAME = 'greenpage-style-node';
const GRAPH_OVERVIEW_PADDING_RATIO = 0.1;
const GRAPH_MIN_ZOOM = 0.5;
const GRAPH_MAX_ZOOM = 2;
const DRAG_EDGE_SYNC_INTERVAL_MS = 34;
const DRAG_EDGE_SYNC_DISTANCE = 16;
const DOMAIN_LAYOUT_INNER_RADIUS_MIN = 228;
const DOMAIN_LAYOUT_INNER_RADIUS_MAX = 292;
const DOMAIN_LAYOUT_RADIAL_GAP_MIN = 98;
const DOMAIN_LAYOUT_RADIAL_GAP_MAX = 134;
const DOMAIN_LAYOUT_MAX_ANGLE_OFFSET = 0.42;

type ProjectedHandle = DynamicHandle & {
    nodeId: string;
    desiredOffset: number;
};

const EMPTY_HANDLES: DynamicHandle[] = [];
const COLLISION_CELL_SIZE = 240;

type BoxState = {
    x: number;
    y: number;
    w: number;
    h: number;
    pad: number;
};

type StoredGraphView = {
    nodes: Array<{ id: string; x: number; y: number }>;
    viewport?: Viewport;
};

type PendingGraphRestore = {
    nodes: Node[];
    viewport?: Viewport;
    returnFocusNodeId: string | null;
};

function half(n: number) {
    return n / 2;
}

function sign(n: number) {
    return n < 0 ? -1 : n > 0 ? 1 : 1;
}

function mtvSeparateAABB(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number
): [number, number] {
    const acx = ax + half(aw);
    const acy = ay + half(ah);
    const bcx = bx + half(bw);
    const bcy = by + half(bh);

    const overlapX = half(aw) + half(bw) - Math.abs(acx - bcx);
    const overlapY = half(ah) + half(bh) - Math.abs(acy - bcy);

    if (overlapX <= 0 || overlapY <= 0) return [0, 0];

    if (overlapX < overlapY) {
        return [sign(bcx - acx) * overlapX, 0];
    }

    return [0, sign(bcy - acy) * overlapY];
}

function getCollisionCellKey(x: number, y: number) {
    return `${x}:${y}`;
}

function getExpandedBox(box: BoxState) {
    return {
        x: box.x - box.pad,
        y: box.y - box.pad,
        w: box.w + box.pad * 2,
        h: box.h + box.pad * 2,
    };
}

function getCollisionCellBounds(box: BoxState, cellSize: number) {
    const expanded = getExpandedBox(box);
    return {
        minX: Math.floor(expanded.x / cellSize),
        maxX: Math.floor((expanded.x + expanded.w) / cellSize),
        minY: Math.floor(expanded.y / cellSize),
        maxY: Math.floor((expanded.y + expanded.h) / cellSize),
    };
}

function buildCollisionIndex(pos: Map<string, BoxState>, cellSize: number) {
    const buckets = new Map<string, string[]>();

    for (const [id, box] of pos) {
        const bounds = getCollisionCellBounds(box, cellSize);

        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                const key = getCollisionCellKey(x, y);
                const existing = buckets.get(key) ?? [];
                existing.push(id);
                buckets.set(key, existing);
            }
        }
    }

    return buckets;
}

function getPotentialCollisionIds(id: string, box: BoxState, index: Map<string, string[]>, cellSize: number) {
    const bounds = getCollisionCellBounds(box, cellSize);
    const candidates = new Set<string>();

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (const candidateId of index.get(getCollisionCellKey(x, y)) ?? []) {
                if (candidateId !== id) {
                    candidates.add(candidateId);
                }
            }
        }
    }

    return candidates;
}

function relaxBoxPositions(
    pos: Map<string, BoxState>,
    {
        immovableIds,
        maxIters,
        damping,
        maxStep,
        cellSize = COLLISION_CELL_SIZE,
    }: {
        immovableIds?: Set<string>;
        maxIters: number;
        damping: number;
        maxStep: number;
        cellSize?: number;
    }
) {
    for (let iter = 0; iter < maxIters; iter++) {
        let movedAny = false;
        const collisionIndex = buildCollisionIndex(pos, cellSize);

        for (const [bid, bp] of pos) {
            if (immovableIds?.has(bid)) continue;

            const candidateIds = getPotentialCollisionIds(bid, bp, collisionIndex, cellSize);

            for (const aid of candidateIds) {
                const ap = pos.get(aid);
                if (!ap) continue;
                const expandedA = getExpandedBox(ap);
                const expandedB = getExpandedBox(bp);

                const [dx, dy] = mtvSeparateAABB(
                    expandedA.x,
                    expandedA.y,
                    expandedA.w,
                    expandedA.h,
                    expandedB.x,
                    expandedB.y,
                    expandedB.w,
                    expandedB.h
                );
                if (dx === 0 && dy === 0) continue;

                const nextX = bp.x + Math.max(-maxStep, Math.min(maxStep, dx * damping));
                const nextY = bp.y + Math.max(-maxStep, Math.min(maxStep, dy * damping));

                if (nextX !== bp.x || nextY !== bp.y) {
                    bp.x = nextX;
                    bp.y = nextY;
                    movedAny = true;
                }
            }
        }

        if (!movedAny) break;
    }
}

function getNodeDimensions(node: Node) {
    if (typeof node.measured?.width === 'number' && typeof node.measured?.height === 'number') {
        return { w: node.measured.width, h: node.measured.height };
    }

    if (typeof node.width === 'number' && typeof node.height === 'number') {
        return { w: node.width, h: node.height };
    }

    if (node.id === 'bio') {
        return { w: BIO_NODE_WIDTH, h: BIO_NODE_HEIGHT };
    }

    if (node.id === 'biotoggle') {
        return { w: TOGGLE_NODE_WIDTH, h: TOGGLE_NODE_HEIGHT };
    }

    return { w: CONTENT_NODE_WIDTH, h: CONTENT_NODE_HEIGHT };
}

function shouldSyncDragEdges(
    previousPosition: Point | null,
    nextPosition: Point,
    now: number,
    lastSyncAt: number
) {
    if (!previousPosition) {
        return true;
    }

    const dx = nextPosition.x - previousPosition.x;
    const dy = nextPosition.y - previousPosition.y;

    return (
        now - lastSyncAt >= DRAG_EDGE_SYNC_INTERVAL_MS ||
        Math.hypot(dx, dy) >= DRAG_EDGE_SYNC_DISTANCE
    );
}

function getCollisionPadding(nodeId: string) {
    if (nodeId === 'bio') return BIO_COLLISION_PADDING;
    if (nodeId === 'biotoggle') return TOGGLE_COLLISION_PADDING;
    return CONTENT_COLLISION_PADDING;
}

function participatesInCollision(nodeId: string) {
    return nodeId !== 'biotoggle';
}

function readStoredGraphView(): StoredGraphView | null {
    if (typeof window === 'undefined') return null;

    const raw = window.sessionStorage.getItem(GRAPH_VIEW_STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<StoredGraphView>;
        if (!Array.isArray(parsed.nodes)) return null;

        const nodes = parsed.nodes.filter(
            (node): node is { id: string; x: number; y: number } =>
                Boolean(node) &&
                typeof node.id === 'string' &&
                typeof node.x === 'number' &&
                typeof node.y === 'number'
        );

        const viewport =
            parsed.viewport &&
            typeof parsed.viewport.x === 'number' &&
            typeof parsed.viewport.y === 'number' &&
            typeof parsed.viewport.zoom === 'number'
                ? parsed.viewport
                : undefined;

        return { nodes, viewport };
    } catch {
        return null;
    }
}

function persistGraphView(nodes: Node[], viewport?: Viewport) {
    if (typeof window === 'undefined') return;

    const payload: StoredGraphView = {
        nodes: nodes.map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
        })),
        viewport,
    };

    window.sessionStorage.setItem(GRAPH_VIEW_STORAGE_KEY, JSON.stringify(payload));
}

function readReturnFocusNodeId() {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(GRAPH_RETURN_FOCUS_NODE_KEY);
}

function clearReturnFocusNodeId() {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(GRAPH_RETURN_FOCUS_NODE_KEY);
}

function getCenter(node: Node) {
    const { w, h } = getNodeDimensions(node);
    return {
        x: node.position.x + half(w),
        y: node.position.y + half(h),
    };
}

function clampZoom(zoom: number) {
    return Math.max(GRAPH_MIN_ZOOM, Math.min(GRAPH_MAX_ZOOM, zoom));
}

function getNodeFocusZoom(nodeId: string) {
    return nodeId === 'bio'
        ? GRAPH_NODE_FOCUS_ZOOM.bio
        : GRAPH_NODE_FOCUS_ZOOM.content;
}

function getGraphOverviewZoom(nodes: Node[], viewportWidth: number, viewportHeight: number, focusNodeId = 'bio') {
    const focusNode = nodes.find((node) => node.id === focusNodeId);
    if (!focusNode) {
        return GRAPH_MIN_ZOOM;
    }

    const focusCenter = getCenter(focusNode);
    let maxDx = 1;
    let maxDy = 1;

    for (const node of nodes) {
        const { w, h } = getNodeDimensions(node);
        const left = node.position.x;
        const right = left + w;
        const top = node.position.y;
        const bottom = top + h;

        maxDx = Math.max(maxDx, Math.abs(left - focusCenter.x), Math.abs(right - focusCenter.x));
        maxDy = Math.max(maxDy, Math.abs(top - focusCenter.y), Math.abs(bottom - focusCenter.y));
    }

    const availableWidth = Math.max(1, viewportWidth * (1 - GRAPH_OVERVIEW_PADDING_RATIO * 2));
    const availableHeight = Math.max(1, viewportHeight * (1 - GRAPH_OVERVIEW_PADDING_RATIO * 2));
    const zoomX = availableWidth / (maxDx * 2);
    const zoomY = availableHeight / (maxDy * 2);

    return clampZoom(Math.min(zoomX, zoomY));
}

function clampOffset(offset: number) {
    return Math.max(HANDLE_MARGIN, Math.min(1 - HANDLE_MARGIN, offset));
}

function projectHandleToBoundary(node: Node, toward: Point) {
    const { w, h } = getNodeDimensions(node);
    const center = getCenter(node);
    const halfWidth = w / 2;
    const halfHeight = h / 2;
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;

    if (dx === 0 && dy === 0) {
        return {
            side: 'right' as const,
            offset: 0.5,
        };
    }

    const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
    const edgeX = center.x + dx * scale;
    const edgeY = center.y + dy * scale;
    const left = node.position.x;
    const top = node.position.y;
    const right = left + w;
    const epsilon = 0.5;

    if (Math.abs(edgeX - left) < epsilon) {
        return {
            side: 'left' as const,
            offset: clampOffset((edgeY - top) / h),
        };
    }
    if (Math.abs(edgeX - right) < epsilon) {
        return {
            side: 'right' as const,
            offset: clampOffset((edgeY - top) / h),
        };
    }
    if (Math.abs(edgeY - top) < epsilon) {
        return {
            side: 'top' as const,
            offset: clampOffset((edgeX - left) / w),
        };
    }

    return {
        side: 'bottom' as const,
        offset: clampOffset((edgeX - left) / w),
    };
}

function spreadProjectedHandles(handles: ProjectedHandle[]) {
    if (handles.length === 0) return [];
    if (handles.length === 1) {
        return [{ ...handles[0], offset: clampOffset(handles[0].desiredOffset) }];
    }

    const sorted = [...handles].sort((left, right) => left.desiredOffset - right.desiredOffset);
    const maxGap = (1 - HANDLE_MARGIN * 2) / (sorted.length - 1);
    const gap = Math.min(PREFERRED_HANDLE_GAP, maxGap);
    const offsets = sorted.map((handle) => clampOffset(handle.desiredOffset));

    for (let index = 1; index < offsets.length; index++) {
        offsets[index] = Math.max(offsets[index], offsets[index - 1] + gap);
    }

    const overflow = offsets[offsets.length - 1] - (1 - HANDLE_MARGIN);
    if (overflow > 0) {
        for (let index = 0; index < offsets.length; index++) {
            offsets[index] -= overflow;
        }
    }

    for (let index = offsets.length - 2; index >= 0; index--) {
        offsets[index] = Math.min(offsets[index], offsets[index + 1] - gap);
    }

    const underflow = HANDLE_MARGIN - offsets[0];
    if (underflow > 0) {
        for (let index = 0; index < offsets.length; index++) {
            offsets[index] += underflow;
        }
    }

    return sorted.map((handle, index) => ({
        ...handle,
        offset: clampOffset(offsets[index]),
    }));
}

function getExistingHandleLookup(nodes: Node[]) {
    const lookup = new Map<string, DynamicHandle>();

    for (const node of nodes) {
        if (!node.data || typeof node.data !== 'object') continue;
        const data = node.data as { handles?: unknown };
        if (!Array.isArray(data.handles)) continue;

        for (const handle of data.handles) {
            if (!handle || typeof handle !== 'object') continue;
            const candidate = handle as Partial<DynamicHandle>;
            if (
                typeof candidate.id === 'string' &&
                typeof candidate.offset === 'number' &&
                (candidate.type === 'source' || candidate.type === 'target') &&
                (candidate.side === 'left' || candidate.side === 'right' || candidate.side === 'top' || candidate.side === 'bottom')
            ) {
                lookup.set(`${node.id}:${candidate.id}`, candidate as DynamicHandle);
            }
        }
    }

    return lookup;
}

function smoothProjectedHandle(handle: ProjectedHandle, previousHandles: Map<string, DynamicHandle>) {
    const previous = previousHandles.get(`${handle.nodeId}:${handle.id}`);
    if (!previous || previous.side !== handle.side) {
        return handle;
    }

    return {
        ...handle,
        desiredOffset: clampOffset(previous.offset + (handle.desiredOffset - previous.offset) * HANDLE_SMOOTHING),
    };
}

function areHandlesEqual(left: DynamicHandle[] | undefined, right: DynamicHandle[] | undefined) {
    const safeLeft = left ?? EMPTY_HANDLES;
    const safeRight = right ?? EMPTY_HANDLES;

    if (safeLeft.length !== safeRight.length) {
        return false;
    }

    for (let index = 0; index < safeLeft.length; index++) {
        const leftHandle = safeLeft[index];
        const rightHandle = safeRight[index];

        if (
            leftHandle.id !== rightHandle.id ||
            leftHandle.type !== rightHandle.type ||
            leftHandle.side !== rightHandle.side ||
            leftHandle.hidden !== rightHandle.hidden ||
            Math.abs(leftHandle.offset - rightHandle.offset) > 0.0001
        ) {
            return false;
        }
    }

    return true;
}

function applyHandlesToNodes(nodes: Node[], handles: ProjectedHandle[]) {
    const handlesByNode = new Map<string, DynamicHandle[]>();
    const handlesByNodeSide = new Map<string, ProjectedHandle[]>();

    for (const handle of handles) {
        const key = `${handle.nodeId}:${handle.side}`;
        const group = handlesByNodeSide.get(key) ?? [];
        group.push(handle);
        handlesByNodeSide.set(key, group);
    }

    for (const groupedHandles of handlesByNodeSide.values()) {
        const resolved = spreadProjectedHandles(groupedHandles);
        for (const handle of resolved) {
            const existing = handlesByNode.get(handle.nodeId) ?? [];
            existing.push({
                id: handle.id,
                type: handle.type,
                side: handle.side,
                offset: handle.offset,
            });
            handlesByNode.set(handle.nodeId, existing);
        }
    }

    return nodes.map((node) => {
        const nextHandles = handlesByNode.get(node.id) ?? EMPTY_HANDLES;
        const currentData = (node.data ?? {}) as { handles?: DynamicHandle[]; portraitConnected?: boolean };
        const portraitConnected = node.id === 'bio' ? true : currentData.portraitConnected;

        if (areHandlesEqual(currentData.handles, nextHandles) && currentData.portraitConnected === portraitConnected) {
            return node;
        }

        return {
            ...node,
            data: {
                ...node.data,
                ...(node.id === 'bio' ? { portraitConnected: true } : null),
                handles: nextHandles,
            },
        };
    });
}

function buildEdgeStyle(edge: Pick<Edge, 'source' | 'target'>, highlightedNodeId: string | null) {
    const highlighted = Boolean(highlightedNodeId && (edge.source === highlightedNodeId || edge.target === highlightedNodeId));

    return {
        opacity: 1,
        strokeDasharray: highlighted ? 'none' : '4 2',
        strokeWidth: highlighted ? GRAPH_EDGE_HIGHLIGHT_STROKE_WIDTH.active : GRAPH_EDGE_HIGHLIGHT_STROKE_WIDTH.idle,
    };
}

function buildConnectedNodeIdsByNode(graphRelations: GraphModel['relations']) {
    const connectedByNode = new Map<string, Set<string>>();

    for (const relation of graphRelations) {
        const sourceNodes = connectedByNode.get(relation.from) ?? new Set<string>([relation.from]);
        sourceNodes.add(relation.to);
        connectedByNode.set(relation.from, sourceNodes);

        const targetNodes = connectedByNode.get(relation.to) ?? new Set<string>([relation.to]);
        targetNodes.add(relation.from);
        connectedByNode.set(relation.to, targetNodes);
    }

    const bioNodes = connectedByNode.get('bio') ?? new Set<string>(['bio']);
    bioNodes.add('biotoggle');
    connectedByNode.set('bio', bioNodes);

    const toggleNodes = connectedByNode.get('biotoggle') ?? new Set<string>(['biotoggle']);
    toggleNodes.add('bio');
    connectedByNode.set('biotoggle', toggleNodes);

    return connectedByNode;
}

function getStyleNodeClassName(highlightedNodeId: string | null, connectedNodeIds: Set<string>) {
    const baseClassName = `${GRAPH_NODE_CLASS_NAME} ${STYLE_NODE_CLASS_NAME}`;

    if (!highlightedNodeId) {
        return baseClassName;
    }

    if (highlightedNodeId === 'biotoggle') {
        return `${baseClassName} ${GRAPH_NODE_HIGHLIGHT_SELF_CLASS_NAME}`;
    }

    if (connectedNodeIds.has('biotoggle')) {
        return `${baseClassName} ${GRAPH_NODE_HIGHLIGHT_CONNECTED_CLASS_NAME}`;
    }

    return baseClassName;
}

function getNodeClassName(nodeId: string, highlightedNodeId: string | null, connectedNodeIds: Set<string>) {
    if (nodeId === 'biotoggle') {
        return getStyleNodeClassName(highlightedNodeId, connectedNodeIds);
    }

    if (!highlightedNodeId) {
        return GRAPH_NODE_CLASS_NAME;
    }

    if (nodeId === highlightedNodeId) {
        return `${GRAPH_NODE_CLASS_NAME} ${GRAPH_NODE_HIGHLIGHT_SELF_CLASS_NAME}`;
    }

    if (connectedNodeIds.has(nodeId)) {
        return `${GRAPH_NODE_CLASS_NAME} ${GRAPH_NODE_HIGHLIGHT_CONNECTED_CLASS_NAME}`;
    }

    return GRAPH_NODE_CLASS_NAME;
}

function getEdgeZIndex(edge: Pick<Edge, 'source' | 'target'>) {
    if (edge.source === 'biotoggle' || edge.target === 'biotoggle') {
        return FLOATING_EDGE_Z_INDEX;
    }

    return 0;
}

function areEdgeStylesEqual(left: Edge['style'], right: Edge['style']) {
    const safeLeft = left ?? {};
    const safeRight = right ?? {};
    const leftKeys = Object.keys(safeLeft);
    const rightKeys = Object.keys(safeRight);
    const leftRecord = safeLeft as Record<string, unknown>;
    const rightRecord = safeRight as Record<string, unknown>;

    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    return leftKeys.every((key) => leftRecord[key] === rightRecord[key]);
}

function reuseEdgeIfPossible(previous: Edge | undefined, next: Edge, highlightedNodeId: string | null) {
    const nextStyle = buildEdgeStyle(next, highlightedNodeId);
    const nextZIndex = getEdgeZIndex(next);

    if (
        previous &&
        previous.source === next.source &&
        previous.target === next.target &&
        previous.sourceHandle === next.sourceHandle &&
        previous.targetHandle === next.targetHandle &&
        previous.type === next.type &&
        areEdgeStylesEqual(previous.style, nextStyle) &&
        previous.zIndex === nextZIndex
    ) {
        return previous;
    }

    return {
        ...next,
        style: nextStyle,
        zIndex: nextZIndex,
    };
}

function applyEdgeOpacity(edges: Edge[], previousHighlightedNodeId: string | null, nextHighlightedNodeId: string | null) {
    const affectedNodeIds = new Set<string>();

    if (previousHighlightedNodeId) {
        affectedNodeIds.add(previousHighlightedNodeId);
    }
    if (nextHighlightedNodeId) {
        affectedNodeIds.add(nextHighlightedNodeId);
    }

    if (affectedNodeIds.size === 0) {
        return edges;
    }

    let updated = false;
    const nextEdges = edges.map((edge) => {
        if (!affectedNodeIds.has(edge.source) && !affectedNodeIds.has(edge.target)) {
            return edge;
        }

        const nextStyle = buildEdgeStyle(edge, nextHighlightedNodeId);

        if (areEdgeStylesEqual(edge.style, nextStyle)) {
            return edge;
        }

        updated = true;
        return {
            ...edge,
            style: nextStyle,
        };
    });

    return updated ? nextEdges : edges;
}

function getDomainPairKey(left: DomainId, right: DomainId) {
    return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function permuteDomainOrder(domains: DomainId[]) {
    const results: DomainId[][] = [];
    const current: DomainId[] = [];
    const used = new Array(domains.length).fill(false);

    function walk() {
        if (current.length === domains.length) {
            results.push([...current]);
            return;
        }

        for (let index = 0; index < domains.length; index++) {
            if (used[index]) continue;
            used[index] = true;
            current.push(domains[index]);
            walk();
            current.pop();
            used[index] = false;
        }
    }

    walk();
    return results;
}

function buildDomainLaneOrder(contentNodes: GraphContentNode[], graphRelations: GraphModel['relations']) {
    const domains = [...new Set(contentNodes.map((node) => node.domain))] as DomainId[];
    const fallbackOrder = [...domains].sort((left, right) => getDomainLayout(left).seedAngle - getDomainLayout(right).seedAngle);
    const fallbackIndex = new Map(fallbackOrder.map((domain, index) => [domain, index]));
    const nodeById = new Map(contentNodes.map((node) => [node.id, node]));
    const affinity = new Map<string, number>();

    for (const relation of graphRelations) {
        const fromNode = nodeById.get(relation.from);
        const toNode = nodeById.get(relation.to);
        if (!fromNode || !toNode || fromNode.domain === toNode.domain) continue;

        const key = getDomainPairKey(fromNode.domain, toNode.domain);
        const relationWeight =
            relation.kind === 'reason' || relation.kind === 'outcome'
                ? 1.35
                : relation.kind === 'topic' || relation.kind === 'tool'
                    ? 1.2
                    : relation.kind === 'time'
                        ? 1.05
                        : 1;
        affinity.set(key, (affinity.get(key) ?? 0) + relation.strength * relationWeight);
    }

    let bestOrder = fallbackOrder;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const order of permuteDomainOrder(fallbackOrder)) {
        let score = 0;

        for (let index = 0; index < order.length - 1; index++) {
            score += (affinity.get(getDomainPairKey(order[index], order[index + 1])) ?? 0) * 6;
        }

        for (let index = 0; index < order.length; index++) {
            score -= Math.abs((fallbackIndex.get(order[index]) ?? index) - index) * 0.85;
        }

        if (score > bestScore) {
            bestScore = score;
            bestOrder = order;
        }
    }

    return bestOrder;
}

function normalizeAngle(angle: number) {
    let normalized = angle;

    while (normalized <= -Math.PI) normalized += Math.PI * 2;
    while (normalized > Math.PI) normalized -= Math.PI * 2;

    return normalized;
}

function getAngularDistance(left: number, right: number) {
    return Math.abs(normalizeAngle(left - right));
}

function rotateDomains(domains: DomainId[], offset: number) {
    return domains.map((_, index) => domains[(index + offset) % domains.length]);
}

function buildDomainWeights(contentNodes: GraphContentNode[], graphRelations: GraphModel['relations']) {
    const weights = new Map<DomainId, number>();
    const nodeById = new Map(contentNodes.map((node) => [node.id, node]));

    for (const node of contentNodes) {
        weights.set(node.domain, (weights.get(node.domain) ?? 0) + 1.3);
    }

    for (const relation of graphRelations) {
        const fromNode = nodeById.get(relation.from);
        const toNode = nodeById.get(relation.to);
        if (!fromNode || !toNode || fromNode.domain === toNode.domain) continue;

        const relationWeight =
            relation.kind === 'reason' || relation.kind === 'outcome'
                ? 0.55
                : relation.kind === 'topic' || relation.kind === 'tool'
                    ? 0.45
                    : 0.3;

        weights.set(fromNode.domain, (weights.get(fromNode.domain) ?? 1) + relation.strength * relationWeight);
        weights.set(toNode.domain, (weights.get(toNode.domain) ?? 1) + relation.strength * relationWeight);
    }

    return weights;
}

function buildLaneAnglePlan(
    orderedDomains: DomainId[],
    domainWeights: Map<DomainId, number>,
    baseArcStart: number,
    totalArcSpan: number
) {
    const laneGap = Math.min(0.18, totalArcSpan / Math.max(18, orderedDomains.length * 4.5));
    const usableArcSpan = totalArcSpan - laneGap * Math.max(0, orderedDomains.length - 1);
    const totalWeight = orderedDomains.reduce((sum, domain) => sum + (domainWeights.get(domain) ?? 1), 0);
    let cursor = baseArcStart;
    const plan = new Map<DomainId, { centerAngle: number; span: number }>();

    for (const domain of orderedDomains) {
        const weight = domainWeights.get(domain) ?? 1;
        const span = usableArcSpan * (weight / totalWeight);
        plan.set(domain, {
            centerAngle: cursor + span / 2,
            span,
        });
        cursor += span + laneGap;
    }

    return plan;
}

function chooseBalancedDomainPlan(contentNodes: GraphContentNode[], graphRelations: GraphModel['relations']) {
    const baseOrder = buildDomainLaneOrder(contentNodes, graphRelations);
    const domainWeights = buildDomainWeights(contentNodes, graphRelations);
    const preferredAngles = new Map(
        baseOrder.map((domain) => [domain, getDomainLayout(domain).seedAngle * (Math.PI / 180)])
    );
    const arcStart = -25 * (Math.PI / 180);
    const arcSpan = 320 * (Math.PI / 180);
    let bestPlan = buildLaneAnglePlan(baseOrder, domainWeights, arcStart, arcSpan);
    let bestScore = Number.POSITIVE_INFINITY;

    for (let rotation = 0; rotation < baseOrder.length; rotation++) {
        const rotatedOrder = rotateDomains(baseOrder, rotation);
        const plan = buildLaneAnglePlan(rotatedOrder, domainWeights, arcStart, arcSpan);
        let anchorPenalty = 0;
        let balanceX = 0;
        let balanceY = 0;

        for (const domain of rotatedOrder) {
            const weight = domainWeights.get(domain) ?? 1;
            const centerAngle = plan.get(domain)?.centerAngle ?? 0;
            const preferredAngle = preferredAngles.get(domain) ?? centerAngle;
            anchorPenalty += getAngularDistance(centerAngle, preferredAngle) * weight * 0.95;
            balanceX += Math.cos(centerAngle) * weight;
            balanceY += Math.sin(centerAngle) * weight;
        }

        const balancePenalty = Math.hypot(balanceX, balanceY) * 0.55;
        const score = anchorPenalty + balancePenalty;

        if (score < bestScore) {
            bestScore = score;
            bestPlan = plan;
        }
    }

    return bestPlan;
}

function buildLaneTargetPositions(
    contentNodes: GraphContentNode[],
    graphRelations: GraphModel['relations'],
    centerX: number,
    centerY: number,
    viewportWidth: number,
    viewportHeight: number
) {
    const lanePlan = chooseBalancedDomainPlan(contentNodes, graphRelations);
    const domainOrder = [...lanePlan.keys()];
    const minViewport = Math.min(viewportWidth, viewportHeight);
    const innerRadius = Math.max(DOMAIN_LAYOUT_INNER_RADIUS_MIN, Math.min(DOMAIN_LAYOUT_INNER_RADIUS_MAX, minViewport * 0.245));
    const radialGap = Math.max(DOMAIN_LAYOUT_RADIAL_GAP_MIN, Math.min(DOMAIN_LAYOUT_RADIAL_GAP_MAX, minViewport * 0.128));
    const targets = new Map<string, Point>();

    for (const domain of domainOrder) {
        const laneNodes = contentNodes
            .filter((node) => node.domain === domain)
            .sort((left, right) => getChronologySortKey(right.chronology) - getChronologySortKey(left.chronology));
        const lane = lanePlan.get(domain);
        if (!lane) continue;

        const outerLayerCount = Math.max(1, Math.ceil((laneNodes.length - 1) / 2));
        const maxAngleOffset = Math.min(DOMAIN_LAYOUT_MAX_ANGLE_OFFSET, lane.span * 0.34);
        const angleStep = outerLayerCount > 0 ? maxAngleOffset / outerLayerCount : 0;

        laneNodes.forEach((node, index) => {
            const layer = index === 0 ? 0 : Math.ceil(index / 2);
            const side = index === 0 ? 0 : index % 2 === 1 ? -1 : 1;
            const angleOffset = side * angleStep * layer;
            const angle = lane.centerAngle + angleOffset;
            const radius = innerRadius + layer * radialGap;
            const tangentOffset = side === 0 ? 0 : side * radialGap * 0.14;

            targets.set(node.id, {
                x: centerX + Math.cos(angle) * radius - Math.sin(angle) * tangentOffset,
                y: centerY + Math.sin(angle) * radius + Math.cos(angle) * tangentOffset,
            });
        });
    }

    return targets;
}

function buildEdgesForNodes(
    nodes: Node[],
    graphRelations: GraphModel['relations'],
    highlightedNodeId: string | null = null,
    previousEdges: Edge[] = []
) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const previousHandles = getExistingHandleLookup(nodes);
    const previousEdgeById = new Map(previousEdges.map((edge) => [edge.id, edge]));
    const projectedHandles: ProjectedHandle[] = [];
    const bioToggleNode = nodeById.get('biotoggle');
    const bioNode = nodeById.get('bio');

    if (bioToggleNode && bioNode) {
        const toggleProjection = projectHandleToBoundary(bioToggleNode, getCenter(bioNode));

        projectedHandles.push(smoothProjectedHandle({
            nodeId: bioToggleNode.id,
            id: 'bio-toggle-port',
            type: 'source',
            side: toggleProjection.side,
            offset: toggleProjection.offset,
            desiredOffset: toggleProjection.offset,
        }, previousHandles));
    }

    const edges: Edge[] = [
        reuseEdgeIfPossible(
            previousEdgeById.get('edge-theme-bio'),
            {
                id: 'edge-theme-bio',
                source: 'biotoggle',
                target: 'bio',
                sourceHandle: 'bio-toggle-port',
                targetHandle: 'portrait-port',
                type: 'dotted',
            },
            highlightedNodeId
        ),
    ];

    for (const relation of graphRelations) {
        const sourceNode = nodeById.get(relation.from);
        const targetNode = nodeById.get(relation.to);
        if (!sourceNode || !targetNode) continue;

        const sourceHandleId = `edge-${relation.id}-source`;
        const targetHandleId = `edge-${relation.id}-target`;
        const sourceProjection = projectHandleToBoundary(sourceNode, getCenter(targetNode));
        const targetProjection = projectHandleToBoundary(targetNode, getCenter(sourceNode));

        projectedHandles.push(smoothProjectedHandle({
            nodeId: sourceNode.id,
            id: sourceHandleId,
            type: 'source',
            side: sourceProjection.side,
            offset: sourceProjection.offset,
            desiredOffset: sourceProjection.offset,
        }, previousHandles));
        projectedHandles.push(smoothProjectedHandle({
            nodeId: targetNode.id,
            id: targetHandleId,
            type: 'target',
            side: targetProjection.side,
            offset: targetProjection.offset,
            desiredOffset: targetProjection.offset,
        }, previousHandles));

        edges.push(
            reuseEdgeIfPossible(
                previousEdgeById.get(`edge-${relation.id}`),
                {
                    id: `edge-${relation.id}`,
                    source: relation.from,
                    target: relation.to,
                    sourceHandle: sourceHandleId,
                    targetHandle: targetHandleId,
                    type: 'dotted',
                },
                highlightedNodeId
            )
        );
    }

    return {
        nodes: applyHandlesToNodes(nodes, projectedHandles),
        edges,
    };
}

function relaxInitialNodes(nodes: Node[]) {
    const lockedIds = new Set(['bio']);
    const pos = new Map<string, BoxState>();

    for (const node of nodes) {
        if (!participatesInCollision(node.id)) continue;
        const size = getNodeDimensions(node);

        pos.set(node.id, {
            x: node.position.x,
            y: node.position.y,
            w: size.w,
            h: size.h,
            pad: getCollisionPadding(node.id),
        });
    }

    relaxBoxPositions(pos, {
        immovableIds: lockedIds,
        maxIters: 34,
        damping: 0.82,
        maxStep: 44,
    });

    return nodes.map((node) => {
        if (!participatesInCollision(node.id)) {
            return node;
        }
        const current = pos.get(node.id)!;
        return { ...node, position: { x: current.x, y: current.y } };
    });
}

function buildInitialGraph(
    model: GraphModel,
    graphRelations: GraphModel['relations'],
    theme: Theme,
    setTheme: (theme: Theme) => void,
    viewportWidth: number,
    viewportHeight: number
) {
    const bioPosition = {
        x: viewportWidth / 2 - BIO_NODE_WIDTH / 2,
        y: viewportHeight / 2 - BIO_NODE_HEIGHT / 2,
    };
    const bioCenter = {
        x: bioPosition.x + BIO_NODE_WIDTH / 2,
        y: bioPosition.y + BIO_NODE_HEIGHT / 2,
    };
    const togglePosition = {
        x: bioPosition.x + BIO_NODE_WIDTH - TOGGLE_NODE_WIDTH * 0.68,
        y: bioPosition.y - TOGGLE_NODE_HEIGHT - 26,
    };
    const contentNodes = getContentNodes(model);
    const targetCenters = buildLaneTargetPositions(
        contentNodes,
        graphRelations,
        bioCenter.x,
        bioCenter.y,
        viewportWidth,
        viewportHeight
    );
    const positionById = new Map(contentNodes.map((node) => [node.id, targetCenters.get(node.id) ?? bioCenter]));

    const relaxedNodes = relaxInitialNodes([
        {
            id: 'bio',
            type: 'bioNode',
            position: bioPosition,
            data: { theme, nodeRole: 'bio' },
            className: GRAPH_NODE_CLASS_NAME,
        },
        {
            id: 'biotoggle',
            type: 'bioToggleNode',
            position: togglePosition,
            data: { theme, setTheme, nodeRole: 'toggle' },
            zIndex: FLOATING_NODE_Z_INDEX,
            className: `${GRAPH_NODE_CLASS_NAME} ${STYLE_NODE_CLASS_NAME}`,
        },
        ...contentNodes.map((node) => {
            const position = positionById.get(node.id) ?? bioCenter;
            return {
                id: node.id,
                type: 'storyNode',
                className: GRAPH_NODE_CLASS_NAME,
                position: {
                    x: position.x - CONTENT_NODE_WIDTH / 2,
                    y: position.y - CONTENT_NODE_HEIGHT / 2,
                },
                data: {
                    nodeRole: 'content',
                    nodeId: node.id,
                    domain: node.domain,
                    domainTag: getDisplayDomain(node.domain),
                    title: node.title,
                    subtitle: node.subtitle,
                    summary: node.summary,
                    detail: node.detail,
                    badges: node.tags,
                } satisfies StoryNodeData,
            };
        }),
    ]);

    return buildEdgesForNodes(relaxedNodes, graphRelations);
}

const NodeCanvas: React.FC = () => {
    const { language } = useAppLanguage();
    const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
    const initialThemeRef = useRef(theme);
    const [graphModel, setGraphModel] = useState<GraphModel | null>(() => readCachedGraphModel());
    const [graphError, setGraphError] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const hasHydratedStoredViewRef = useRef(false);
    const flowReadyRef = useRef(false);
    const pendingGraphRestoreRef = useRef<PendingGraphRestore | null>(null);
    const viewport = useMemo(
        () => ({ width: window.innerWidth, height: window.innerHeight }),
        []
    );
    const highlightedNodeId = draggingNodeId ?? hoveredNodeId;
    const graphRelations = useMemo(
        () => graphModel ? getGraphRelations(graphModel) : [],
        [graphModel]
    );
    const connectedNodeIdsByNode = useMemo(
        () => buildConnectedNodeIdsByNode(graphRelations),
        [graphRelations]
    );
    const orderedGraphRelations = useMemo(
        () => [...graphRelations].sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id)),
        [graphRelations]
    );
    const initialGraph = useMemo(
        () => graphModel ? buildInitialGraph(graphModel, graphRelations, initialThemeRef.current, setTheme, viewport.width, viewport.height) : { nodes: [], edges: [] },
        [graphModel, graphRelations, viewport.height, viewport.width]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
    const { getViewport, setCenter, setViewport } = useReactFlow();
    const dragRafId = useRef<number | null>(null);
    const nodesRef = useRef<Node[]>(initialGraph.nodes);
    const edgesRef = useRef<Edge[]>(initialGraph.edges);
    const highlightedNodeIdRef = useRef<string | null>(null);
    const lastDragEdgeSyncAtRef = useRef(0);
    const lastDragEdgeSyncPositionRef = useRef<Point | null>(null);
    const persistCurrentGraphView = useCallback((nextNodes: Node[], viewport?: Viewport) => {
        if (!graphModel || nextNodes.length === 0) return;
        persistGraphView(nextNodes, viewport ?? getViewport());
    }, [getViewport, graphModel]);

    const focusNode = useCallback((
        node: Node,
        { preserveHigherZoom = false }: { preserveHigherZoom?: boolean } = {}
    ) => {
        const center = getCenter(node);
        const baseZoom = getNodeFocusZoom(node.id);
        const targetZoom = preserveHigherZoom ? Math.max(getViewport().zoom, baseZoom) : baseZoom;

        setCenter(center.x, center.y, {
            zoom: targetZoom,
            duration: 400,
        });
    }, [getViewport, setCenter]);

    const handleResetGraph = useCallback(() => {
        if (dragRafId.current) {
            cancelAnimationFrame(dragRafId.current);
            dragRafId.current = null;
        }

        setHoveredNodeId(null);
        setDraggingNodeId(null);
        highlightedNodeIdRef.current = null;
        lastDragEdgeSyncAtRef.current = 0;
        lastDragEdgeSyncPositionRef.current = null;

        const resetNodes = initialGraph.nodes.map((node) => {
            if (node.id === 'bio') {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        theme,
                        onResetGraph: handleResetGraph,
                    },
                    className: GRAPH_NODE_CLASS_NAME,
                };
            }

            if (node.id === 'biotoggle') {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        theme,
                        setTheme,
                    },
                    className: `${GRAPH_NODE_CLASS_NAME} ${STYLE_NODE_CLASS_NAME}`,
                };
            }

            return {
                ...node,
                className: GRAPH_NODE_CLASS_NAME,
            };
        });

        const resetGraph = buildEdgesForNodes(resetNodes, orderedGraphRelations, null);
        setNodes(resetGraph.nodes);
        setEdges(resetGraph.edges);
        edgesRef.current = resetGraph.edges;
        persistCurrentGraphView(resetGraph.nodes);

        requestAnimationFrame(() => {
            const bioNode = resetGraph.nodes.find((node) => node.id === 'bio');
            if (!bioNode) return;

            focusNode(bioNode);
        });
    }, [focusNode, initialGraph.nodes, orderedGraphRelations, persistCurrentGraphView, setEdges, setNodes, setTheme, theme]);

    const applyPendingGraphRestore = useCallback(() => {
        if (!flowReadyRef.current || !pendingGraphRestoreRef.current) {
            return false;
        }

        const pendingRestore = pendingGraphRestoreRef.current;
        pendingGraphRestoreRef.current = null;

        requestAnimationFrame(() => {
            if (pendingRestore.viewport) {
                setViewport(pendingRestore.viewport, { duration: 0 });
            }

            if (!pendingRestore.returnFocusNodeId) {
                return;
            }

            const targetNode = pendingRestore.nodes.find((node) => node.id === pendingRestore.returnFocusNodeId);
            if (!targetNode) {
                clearReturnFocusNodeId();
                return;
            }

            const center = getCenter(targetNode);
            const targetZoom = pendingRestore.viewport?.zoom ?? getViewport().zoom;

            requestAnimationFrame(() => {
                setCenter(center.x, center.y, {
                    zoom: targetZoom,
                    duration: 420,
                });
                clearReturnFocusNodeId();
            });
        });

        return true;
    }, [getViewport, setCenter, setViewport]);

    useEffect(() => {
        let cancelled = false;

        if (graphModel) {
            return () => {
                cancelled = true;
            };
        }

        loadGraphModel()
            .then((model) => {
                if (cancelled) return;
                setGraphModel(model);
                setGraphError(null);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setGraphError(error instanceof Error ? error.message : 'Failed to load graph model.');
            });

        return () => {
            cancelled = true;
        };
    }, [graphModel]);

    useEffect(() => {
        if (!graphModel) return;

        const storedView = hasHydratedStoredViewRef.current ? null : readStoredGraphView();
        const returnFocusNodeId = readReturnFocusNodeId();
        const storedPositions = new Map(storedView?.nodes.map((node) => [node.id, node]) ?? []);
        const restoredNodes = initialGraph.nodes.map((node) => {
            const storedNode = storedPositions.get(node.id);
            if (!storedNode) return node;

            return {
                ...node,
                position: {
                    x: storedNode.x,
                    y: storedNode.y,
                },
            };
        });
        const restoredGraph = buildEdgesForNodes(restoredNodes, orderedGraphRelations);

        setNodes(restoredGraph.nodes);
        setEdges(restoredGraph.edges);
        edgesRef.current = restoredGraph.edges;

        if (!hasHydratedStoredViewRef.current) {
            hasHydratedStoredViewRef.current = true;
        }

        pendingGraphRestoreRef.current = {
            nodes: restoredGraph.nodes,
            viewport: storedView?.viewport,
            returnFocusNodeId,
        };
        applyPendingGraphRestore();
    }, [applyPendingGraphRestore, graphModel, initialGraph, orderedGraphRelations, setEdges, setNodes]);

    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        edgesRef.current = edges;
    }, [edges]);

    useEffect(() => {
        setNodes((prev) => {
            let updated = false;

            const nextNodes = prev.map((node) => {
                if (node.id === 'biotoggle' || node.id === 'bio') {
                    return node;
                }

                const nodeData = node.data as StoryNodeData | undefined;
                if (!nodeData || nodeData.nodeRole !== 'content') {
                    return node;
                }

                const nextDomainTag = getDisplayDomain(nodeData.domain);
                if (nodeData.domainTag === nextDomainTag) {
                    return node;
                }

                updated = true;
                return {
                    ...node,
                    data: {
                        ...nodeData,
                        domainTag: nextDomainTag,
                    },
                };
            });

            return updated ? nextNodes : prev;
        });
    }, [language, setNodes]);

    useEffect(() => {
        const previousHighlightedNodeId = highlightedNodeIdRef.current;
        if (previousHighlightedNodeId === highlightedNodeId) {
            return;
        }

        const previousConnectedNodeIds = previousHighlightedNodeId
            ? connectedNodeIdsByNode.get(previousHighlightedNodeId) ?? new Set<string>([previousHighlightedNodeId])
            : new Set<string>();
        const nextConnectedNodeIds = highlightedNodeId
            ? connectedNodeIdsByNode.get(highlightedNodeId) ?? new Set<string>([highlightedNodeId])
            : new Set<string>();
        const changedNodeIds = new Set<string>([
            ...previousConnectedNodeIds,
            ...nextConnectedNodeIds,
        ]);

        setEdges((prev) => applyEdgeOpacity(prev, previousHighlightedNodeId, highlightedNodeId));

        if (changedNodeIds.size > 0) {
            setNodes((prev) => {
                let updated = false;
                const nextNodes = prev.map((node) => {
                    if (!changedNodeIds.has(node.id) && node.id !== 'biotoggle') {
                        return node;
                    }

                    const nextClassName = getNodeClassName(node.id, highlightedNodeId, nextConnectedNodeIds);
                    if ((node.className ?? '') === nextClassName) {
                        return node;
                    }

                    updated = true;
                    return {
                        ...node,
                        className: nextClassName,
                    };
                });

                return updated ? nextNodes : prev;
            });
        }

        highlightedNodeIdRef.current = highlightedNodeId;
    }, [connectedNodeIdsByNode, highlightedNodeId, setEdges, setNodes]);

    const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
        if (node.id === 'biotoggle') return;

        focusNode(node, { preserveHigherZoom: true });
    }, [focusNode]);

    const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
        if (node.id === 'biotoggle') return;

        const bioNode = nodes.find((graphNode) => graphNode.id === 'bio');
        if (!bioNode) {
            return;
        }

        const bioCenter = getCenter(bioNode);
        const overviewZoom = getGraphOverviewZoom(nodes, viewport.width, viewport.height);

        setCenter(bioCenter.x, bioCenter.y, {
            zoom: overviewZoom,
            duration: 450,
        });
    }, [nodes, setCenter, viewport.height, viewport.width]);

    const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
        setHoveredNodeId(node.id);
    }, []);

    const onNodeMouseLeave: NodeMouseHandler = useCallback((_, node) => {
        setHoveredNodeId((current) => (current === node.id ? null : current));
    }, []);

    const onInit = (instance: ReactFlowInstance) => {
        flowReadyRef.current = true;
        if (applyPendingGraphRestore()) {
            return;
        }

        if (initialGraph.nodes.length === 0) return;
        const storedView = readStoredGraphView();
        if (storedView?.viewport) {
            instance.setViewport(storedView.viewport, { duration: 0 });
            return;
        }
        instance.fitView({
            nodes: initialGraph.nodes.map((node) => ({ id: node.id })),
            padding: 0.8,
            duration: 500,
            includeHiddenNodes: false,
        });
    };

    const onMoveEnd = useCallback(() => {
        persistCurrentGraphView(nodes);
    }, [nodes, persistCurrentGraphView]);

    const onNodeDrag = useCallback((_: unknown, dragged: Node) => {
        if (!graphModel) {
            return;
        }

        if (draggingNodeId !== dragged.id) {
            setDraggingNodeId(dragged.id);
        }

        if (dragRafId.current) cancelAnimationFrame(dragRafId.current);

        dragRafId.current = requestAnimationFrame(() => {
            const now = performance.now();
            const dragPosition = { x: dragged.position.x, y: dragged.position.y };
            const syncEdges = shouldSyncDragEdges(
                lastDragEdgeSyncPositionRef.current,
                dragPosition,
                now,
                lastDragEdgeSyncAtRef.current
            );

            if (syncEdges) {
                lastDragEdgeSyncAtRef.current = now;
                lastDragEdgeSyncPositionRef.current = dragPosition;
            }

            setNodes((prev) => {
                if (dragged.id === 'biotoggle') {
                    const nextNodes = prev.map((node) =>
                        node.id === dragged.id
                            ? { ...node, position: { x: dragged.position.x, y: dragged.position.y } }
                            : node
                    );

                    if (!syncEdges) {
                        return nextNodes;
                    }

                    const nextGraph = buildEdgesForNodes(nextNodes, orderedGraphRelations, dragged.id, edgesRef.current);
                    edgesRef.current = nextGraph.edges;
                    setEdges(nextGraph.edges);
                    return nextGraph.nodes;
                }

                const pos = new Map<string, BoxState>();

                for (const node of prev) {
                    if (!participatesInCollision(node.id)) continue;
                    const { w, h } = getNodeDimensions(node);
                    pos.set(node.id, {
                        x: node.position.x,
                        y: node.position.y,
                        w,
                        h,
                        pad: getCollisionPadding(node.id),
                    });
                }

                if (pos.has(dragged.id)) {
                    const current = pos.get(dragged.id)!;
                    current.x = dragged.position.x;
                    current.y = dragged.position.y;
                }

                relaxBoxPositions(pos, {
                    immovableIds: new Set([dragged.id]),
                    maxIters: 8,
                    damping: 0.64,
                    maxStep: 38,
                });

                const nextNodes = prev.map((node) => {
                    if (!participatesInCollision(node.id)) {
                        return node;
                    }
                    const point = pos.get(node.id)!;
                    const nextPosition = node.id === dragged.id
                        ? { x: dragged.position.x, y: dragged.position.y }
                        : { x: point.x, y: point.y };

                    if (node.position.x === nextPosition.x && node.position.y === nextPosition.y) {
                        return node;
                    }

                    return { ...node, position: nextPosition };
                });

                if (!syncEdges) {
                    return nextNodes;
                }

                const nextGraph = buildEdgesForNodes(nextNodes, orderedGraphRelations, dragged.id, edgesRef.current);
                edgesRef.current = nextGraph.edges;
                setEdges(nextGraph.edges);
                return nextGraph.nodes;
            });
        });
    }, [draggingNodeId, graphModel, orderedGraphRelations, setEdges, setNodes]);

    const onNodeDragStop = useCallback((_: unknown, dragged: Node) => {
        if (dragRafId.current) cancelAnimationFrame(dragRafId.current);
        lastDragEdgeSyncAtRef.current = 0;
        lastDragEdgeSyncPositionRef.current = null;
        setNodes((prev) => {
            if (dragged.id === 'biotoggle') {
                const nextNodes = prev.map((node) =>
                    node.id === dragged.id
                        ? { ...node, position: { x: dragged.position.x, y: dragged.position.y } }
                        : node
                );

                const nextGraph = buildEdgesForNodes(nextNodes, orderedGraphRelations, null, edgesRef.current);
                edgesRef.current = nextGraph.edges;
                setEdges(nextGraph.edges);
                return nextGraph.nodes;
            }

            const pos = new Map<string, BoxState>();

            for (const node of prev) {
                if (!participatesInCollision(node.id)) continue;
                const { w, h } = getNodeDimensions(node);
                pos.set(node.id, {
                    x: node.position.x,
                    y: node.position.y,
                    w,
                    h,
                    pad: getCollisionPadding(node.id),
                });
            }

            if (pos.has(dragged.id)) {
                const current = pos.get(dragged.id)!;
                current.x = dragged.position.x;
                current.y = dragged.position.y;
            }

            relaxBoxPositions(pos, {
                immovableIds: new Set([dragged.id]),
                maxIters: 16,
                damping: 0.72,
                maxStep: 42,
            });

            const nextNodes = prev.map((node) => {
                if (!participatesInCollision(node.id)) {
                    return node;
                }
                const point = pos.get(node.id)!;
                if (node.position.x === point.x && node.position.y === point.y) {
                    return node;
                }

                return {
                    ...node,
                    position: { x: point.x, y: point.y },
                };
            });

            const nextGraph = buildEdgesForNodes(nextNodes, orderedGraphRelations, null, edgesRef.current);
            edgesRef.current = nextGraph.edges;
            setEdges(nextGraph.edges);
            return nextGraph.nodes;
        });
        setDraggingNodeId(null);
        requestAnimationFrame(() => {
            persistCurrentGraphView(nodesRef.current);
        });
    }, [orderedGraphRelations, persistCurrentGraphView, setEdges, setNodes]);

    useEffect(() => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id === 'bio') {
                    return { ...node, data: { ...node.data, theme, onResetGraph: handleResetGraph } };
                }
                if (node.id === 'biotoggle') {
                    return { ...node, data: { ...node.data, theme, setTheme } };
                }
                return node;
            })
        );
    }, [handleResetGraph, theme, setNodes, setTheme]);

    useEffect(() => {
        applyThemeVars(theme);
        persistTheme(theme);
    }, [theme]);

    useEffect(() => {
        return () => {
            if (dragRafId.current) cancelAnimationFrame(dragRafId.current);
        };
    }, []);

    if (graphError) {
        return (
            <div style={{ color: 'crimson', padding: '1rem' }}>
                {UI_COPY.graphHome.errorLoading}: {graphError}
            </div>
        );
    }

    if (!graphModel) {
        return <div style={{ padding: '1rem', color: 'var(--color-text)' }}>{UI_COPY.graphHome.loading}</div>;
    }

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodeClickDistance={6}
            nodeDragThreshold={4}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onInit={onInit}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onMoveEnd={onMoveEnd}
            elevateNodesOnSelect={false}
            panOnDrag
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
        />
    );
}

export default function NodeHomePage() {
    const graphStyleVars = {
        width: "100vw",
        height: "100vh",
        margin: 0,
        inset: 0,
        ['--greenpage-node-ring-width-idle' as const]: GRAPH_NODE_HIGHLIGHT_RING_WIDTH.idle,
        ['--greenpage-node-ring-width-connected' as const]: GRAPH_NODE_HIGHLIGHT_RING_WIDTH.connected,
        ['--greenpage-node-ring-width-active' as const]: GRAPH_NODE_HIGHLIGHT_RING_WIDTH.active,
        ['--greenpage-node-ring-opacity-idle' as const]: GRAPH_NODE_HIGHLIGHT_RING_OPACITY.idle,
        ['--greenpage-node-ring-opacity-connected' as const]: GRAPH_NODE_HIGHLIGHT_RING_OPACITY.connected,
        ['--greenpage-node-ring-opacity-active' as const]: GRAPH_NODE_HIGHLIGHT_RING_OPACITY.active,
        ['--greenpage-node-ring-shadow-prefix' as const]: getHighlightBorderShadowPrefix(GRAPH_NODE_HIGHLIGHT_GROWTH_DIRECTION),
        ['--greenpage-bio-portrait-border-width-idle' as const]: GRAPH_BIO_PORTRAIT_BORDER_WIDTH.idle,
        ['--greenpage-bio-portrait-border-width-connected' as const]: GRAPH_BIO_PORTRAIT_BORDER_WIDTH.connected,
        ['--greenpage-bio-portrait-border-width-active' as const]: GRAPH_BIO_PORTRAIT_BORDER_WIDTH.active,
        ['--greenpage-bio-portrait-border-opacity-idle' as const]: GRAPH_BIO_PORTRAIT_BORDER_OPACITY.idle,
        ['--greenpage-bio-portrait-border-opacity-connected' as const]: GRAPH_BIO_PORTRAIT_BORDER_OPACITY.connected,
        ['--greenpage-bio-portrait-border-opacity-active' as const]: GRAPH_BIO_PORTRAIT_BORDER_OPACITY.active,
    } as React.CSSProperties;

    return (
        <div style={graphStyleVars}>
            <ReactFlowProvider>
                <NodeCanvas />
            </ReactFlowProvider>
        </div>
    );
}
