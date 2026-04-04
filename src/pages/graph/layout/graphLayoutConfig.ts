/**
 * All tunable numbers for the radial graph layout.
 * Changing values here affects placement, spacing, and relaxation without
 * touching the algorithm itself.
 */

/** Side length of each cell in the spatial-hash collision grid (pixels). */
export const COLLISION_CELL_SIZE = 220;

/**
 * Arc over which content nodes are distributed around the bio node.
 * startDeg: where the arc begins (clockwise from 3 o'clock / east).
 * spanDeg: how many degrees the arc covers.
 * A span of 360 would be a full circle; 320 leaves a gap near the bottom-right.
 */
export const LAYOUT_ARC = {
    startDeg: 65,
    spanDeg: 320,
} as const;

/**
 * Collision-relaxation parameters for the first pass (uses estimated node sizes).
 * maxStep should be ≥ half the node width so a fully-stacked pair separates in 2 steps.
 * With 23 nodes and cascading overlaps, maxIters needs room for full propagation.
 */
export const RELAX_INITIAL_NODES_CONFIG = {
    maxIters: 80,
    damping: 0.88,
    maxStep: 200,
} as const;

/**
 * Collision-relaxation parameters for the settle pass (uses measured node sizes).
 * Runs after ReactFlow has measured real dimensions, so it must fully resolve all overlap.
 */
export const SETTLE_NODES_AROUND_ANCHOR_CONFIG = {
    maxIters: 80,
    damping: 0.88,
    maxStep: 1000,
} as const;

/** Parameters for the clearance pass that keeps nodes out of the bio node's halo. */
export const ENFORCE_ANCHOR_CLEARANCE_CONFIG = {
    maxIters: 24,
    damping: 0.90,
    maxStep: 100,
} as const;

/**
 * Per-layer spring strengths pulling nodes toward their radial target during relaxation.
 * Layer 0 nodes (bio-connected) are locked — their spring is never applied.
 * Layer 1 (second ring, most recent after bio node) needs a strong spring so chronological
 * proximity to bio is preserved despite edge forces pulling them outward.
 * Outer layers (2+) can drift more freely so topology dominates over strict radial order.
 */
/**
 * Pure force weights for chronological ordering.
 * The target spring is the dominant force — it should always beat edgeSpringK so
 * nodes stay near their chronologically-assigned positions. Inner-ring nodes (layer 1,
 * bio-adjacent) get a stronger pull so they cluster tightly around the bio node.
 */
export const LAYOUT_CHRONOLOGY_SPRING = {
    /** springK for layer 1 nodes — strong pull; keeps bio-adjacent nodes close. */
    innerLayerSpringK: 0.35,
    /** springK for layer 2+ nodes — moderate pull; topology can shift them, but not far. */
    outerLayerSpringK: 0.12,
} as const;

/** Camera animation used when returning from a detail page and recentring the graph. */
export const GRAPH_RETURN_FOCUS_CAMERA_DURATION_MS = 420;
