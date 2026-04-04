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
    startDeg: -25,
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
    maxStep: 150,
} as const;

/**
 * Collision-relaxation parameters for the settle pass (uses measured node sizes).
 * Runs after ReactFlow has measured real dimensions, so it must fully resolve all overlap.
 */
export const SETTLE_NODES_AROUND_ANCHOR_CONFIG = {
    maxIters: 80,
    damping: 0.88,
    maxStep: 90,
} as const;

/** Parameters for the clearance pass that keeps nodes out of the bio node's halo. */
export const ENFORCE_ANCHOR_CLEARANCE_CONFIG = {
    maxIters: 24,
    damping: 0.90,
    maxStep: 80,
} as const;
