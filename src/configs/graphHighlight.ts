export type HighlightBorderGrowthDirection = 'inward' | 'outward';

export const GRAPH_NODE_HIGHLIGHT_RING_WIDTH = {
    idle: 1.35,
    connected: 3,
    active: 4,
} as const;

export const GRAPH_NODE_HIGHLIGHT_RING_OPACITY = {
    idle: 0.8,
    connected: 0.9,
    active: 0.95,
} as const;

export const GRAPH_EDGE_HIGHLIGHT_STROKE_WIDTH = {
    idle: 1.35,
    active: 2.35,
} as const;

export const GRAPH_BIO_PORTRAIT_BORDER = {
    width: 1.35,
    opacity: 1,
} as const;

export const GRAPH_NODE_HIGHLIGHT_GROWTH_DIRECTION: HighlightBorderGrowthDirection = 'outward';

export const DETAIL_PAGE_ACTION_BORDER = {
    idleWidth: 1.35,
    idleOpacity: 0.8,
    activeWidth: 3,
    activeOpacity: 0.9,
} as const;

export const DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION: HighlightBorderGrowthDirection = 'outward';

export function getHighlightBorderShadowPrefix(direction: HighlightBorderGrowthDirection) {
    return direction === 'outward' ? '0 0 0' : 'inset 0 0 0';
}
