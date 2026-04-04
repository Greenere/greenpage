/**
 * All tunable numbers for the radial graph layout.
 * Changing values here affects placement, spacing, and relaxation without
 * touching the algorithm itself.
 */

/** Side length of each cell in the spatial-hash collision grid (pixels). */
export const COLLISION_CELL_SIZE = 240;

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

/** Collision-relaxation parameters for the first pass (content nodes against the bio node). */
export const RELAX_INITIAL_NODES_CONFIG = {
    maxIters: 34,
    damping: 0.82,
    maxStep: 44,
} as const;

/** Collision-relaxation parameters for the secondary settlement pass. */
export const SETTLE_NODES_AROUND_ANCHOR_CONFIG = {
    maxIters: 16,
    damping: 0.72,
    maxStep: 42,
} as const;

/** Parameters for the clearance pass that keeps nodes out of the bio node's halo. */
export const ENFORCE_ANCHOR_CLEARANCE_CONFIG = {
    maxIters: 8,
    damping: 0.88,
    maxStep: 52,
} as const;
