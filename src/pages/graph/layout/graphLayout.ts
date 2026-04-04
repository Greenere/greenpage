/**
 * Pure graph layout functions — no React, no ReactFlow, no DOM.
 *
 * Depends only on:
 *   - content types from ../content/Nodes
 *   - chronology sort key from shared/chronology
 *   - layout config from ./graphLayoutConfig
 */

import { getChronologySortKey } from '../../../shared/chronology';
import { type DomainId, type GraphCardNode, type GraphModel, getDomainLayout } from '../content/Nodes';
import {
    COLLISION_CELL_SIZE,
    LAYOUT_ARC,
    RELAX_INITIAL_NODES_CONFIG,
    SETTLE_NODES_AROUND_ANCHOR_CONFIG,
    ENFORCE_ANCHOR_CLEARANCE_CONFIG,
} from './graphLayoutConfig';

// ---------------------------------------------------------------------------
// Shared geometry types
// ---------------------------------------------------------------------------

export type Point = { x: number; y: number };

export type BoxState = {
    x: number;
    y: number;
    w: number;
    h: number;
    pad: number;
};

// ---------------------------------------------------------------------------
// Tiny math helpers
// ---------------------------------------------------------------------------

export function half(n: number) {
    return n / 2;
}

function sign(n: number) {
    return n < 0 ? -1 : n > 0 ? 1 : 1;
}

// ---------------------------------------------------------------------------
// AABB collision / spatial-hash relaxation
// ---------------------------------------------------------------------------

/**
 * Returns the minimum translation vector to separate two AABBs.
 * Returns [0, 0] if they are not overlapping.
 */
export function mtvSeparateAABB(
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

export function getCollisionCellKey(x: number, y: number) {
    return `${x}:${y}`;
}

export function getExpandedBox(box: BoxState) {
    return {
        x: box.x - box.pad,
        y: box.y - box.pad,
        w: box.w + box.pad * 2,
        h: box.h + box.pad * 2,
    };
}

export function getCollisionCellBounds(box: BoxState, cellSize: number) {
    const expanded = getExpandedBox(box);
    return {
        minX: Math.floor(expanded.x / cellSize),
        maxX: Math.floor((expanded.x + expanded.w) / cellSize),
        minY: Math.floor(expanded.y / cellSize),
        maxY: Math.floor((expanded.y + expanded.h) / cellSize),
    };
}

export function buildCollisionIndex(pos: Map<string, BoxState>, cellSize: number) {
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

export function getPotentialCollisionIds(id: string, box: BoxState, index: Map<string, string[]>, cellSize: number) {
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

/**
 * Iteratively separates overlapping boxes in-place.
 * Boxes in `immovableIds` act as fixed obstacles.
 *
 * Each iteration runs three passes in priority order:
 *   1. Collision separation (AABB MTV) — hard constraint, always wins.
 *   2. Edge spring attraction — pulls connected node pairs toward each other,
 *      scaled by relation strength. Applied as a symmetric simultaneous update
 *      so result is independent of iteration order.
 *   3. Target spring — gently pulls each node toward its assigned radial target
 *      to prevent sector drift.
 *
 * Coefficient guide:
 *   springK    ~0.04  — weak sector anchor, leaves room for edge forces
 *   edgeSpringK ~0.06 — edge attraction; strength 3 edges pull ~2× harder than strength 1
 */
export function relaxBoxPositions(
    pos: Map<string, BoxState>,
    {
        immovableIds,
        maxIters,
        damping,
        maxStep,
        cellSize = COLLISION_CELL_SIZE,
        targets,
        springK = 0,
        nodeSpringK,
        relations,
        edgeSpringK = 0,
    }: {
        immovableIds?: Set<string>;
        maxIters: number;
        damping: number;
        maxStep: number;
        cellSize?: number;
        targets?: Map<string, Point>;
        /** Default spring coefficient pulling each node toward its target. 0 = off. */
        springK?: number;
        /** Per-node spring overrides — takes precedence over springK when present. */
        nodeSpringK?: Map<string, number>;
        /** Graph relations — used to pull connected node pairs toward each other. */
        relations?: ReadonlyArray<{ from: string; to: string; strength: number }>;
        /** Spring coefficient for edge attraction. 0 = off. */
        edgeSpringK?: number;
    }
) {
    for (let iter = 0; iter < maxIters; iter++) {
        let movedAny = false;
        const collisionIndex = buildCollisionIndex(pos, cellSize);

        // Pass 1: collision separation
        for (const [bid, bp] of pos) {
            if (immovableIds?.has(bid)) continue;

            const candidateIds = getPotentialCollisionIds(bid, bp, collisionIndex, cellSize);

            for (const aid of candidateIds) {
                const ap = pos.get(aid);
                if (!ap) continue;
                const expandedA = getExpandedBox(ap);
                const expandedB = getExpandedBox(bp);

                const [dx, dy] = mtvSeparateAABB(
                    expandedA.x, expandedA.y, expandedA.w, expandedA.h,
                    expandedB.x, expandedB.y, expandedB.w, expandedB.h
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

        // Pass 2: edge spring attraction (symmetric — both endpoints move together)
        if (edgeSpringK > 0 && relations) {
            for (const rel of relations) {
                const a = pos.get(rel.from);
                const b = pos.get(rel.to);
                if (!a || !b) continue;

                const acx = a.x + a.w / 2;
                const acy = a.y + a.h / 2;
                const bcx = b.x + b.w / 2;
                const bcy = b.y + b.h / 2;
                const k = edgeSpringK * (rel.strength / 3);

                if (!immovableIds?.has(rel.from)) {
                    a.x += (bcx - acx) * k;
                    a.y += (bcy - acy) * k;
                }
                if (!immovableIds?.has(rel.to)) {
                    b.x += (acx - bcx) * k;
                    b.y += (acy - bcy) * k;
                }
            }
        }

        // Pass 3: target spring — keeps nodes near their assigned radial sector.
        // Per-node overrides (nodeSpringK) take precedence over the global springK,
        // allowing inner-ring nodes to be held tightly while outer nodes drift freely.
        if (targets && (springK > 0 || nodeSpringK)) {
            for (const [bid, bp] of pos) {
                if (immovableIds?.has(bid)) continue;
                const target = targets.get(bid);
                if (!target) continue;
                const k = nodeSpringK?.get(bid) ?? springK;
                if (k <= 0) continue;
                bp.x += (target.x - bp.w / 2 - bp.x) * k;
                bp.y += (target.y - bp.h / 2 - bp.y) * k;
            }
        }

        if (!movedAny) break;
    }
}

/**
 * Pushes all boxes away from an anchor's expanded footprint.
 * Used to ensure a clearance halo around the bio node.
 */
export function enforceAnchorClearance(
    pos: Map<string, BoxState>,
    anchorId: string,
    extraPadding: number,
    {
        maxIters = ENFORCE_ANCHOR_CLEARANCE_CONFIG.maxIters,
        damping = ENFORCE_ANCHOR_CLEARANCE_CONFIG.damping,
        maxStep = ENFORCE_ANCHOR_CLEARANCE_CONFIG.maxStep,
    }: {
        maxIters?: number;
        damping?: number;
        maxStep?: number;
    } = {}
) {
    const anchor = pos.get(anchorId);
    if (!anchor) return;

    // Synthetic box for the anchor's full clearance footprint.
    // Kept constant because the anchor never moves in this pass.
    const halo: BoxState = {
        x: anchor.x - (anchor.pad + extraPadding),
        y: anchor.y - (anchor.pad + extraPadding),
        w: anchor.w + (anchor.pad + extraPadding) * 2,
        h: anchor.h + (anchor.pad + extraPadding) * 2,
        pad: 0,
    };

    for (let iter = 0; iter < maxIters; iter++) {
        let movedAny = false;

        // Rebuild the spatial index each iteration so nodes pushed outward
        // in the previous iteration are no longer returned as candidates.
        const collisionIndex = buildCollisionIndex(pos, COLLISION_CELL_SIZE);

        // Only visit nodes whose cells overlap the halo — O(k) instead of O(N).
        const candidateIds = getPotentialCollisionIds(anchorId, halo, collisionIndex, COLLISION_CELL_SIZE);

        for (const nodeId of candidateIds) {
            const node = pos.get(nodeId);
            if (!node) continue;

            const [dx, dy] = mtvSeparateAABB(
                halo.x, halo.y, halo.w, halo.h,
                node.x - node.pad,
                node.y - node.pad,
                node.w + node.pad * 2,
                node.h + node.pad * 2
            );

            if (dx === 0 && dy === 0) continue;

            const nextX = node.x + Math.max(-maxStep, Math.min(maxStep, dx * damping));
            const nextY = node.y + Math.max(-maxStep, Math.min(maxStep, dy * damping));

            if (nextX !== node.x || nextY !== node.y) {
                node.x = nextX;
                node.y = nextY;
                movedAny = true;
            }
        }

        if (!movedAny) break;
    }
}

// ---------------------------------------------------------------------------
// Domain ordering
// ---------------------------------------------------------------------------

function getDomainPairKey(left: DomainId, right: DomainId) {
    return left < right ? `${left}|${right}` : `${right}|${left}`;
}

/**
 * Greedy O(D²) domain ordering that replaces the original O(D!) exhaustive search.
 *
 * Builds the sequence incrementally: seed with the fallback-order domain that has
 * the highest total affinity (most inter-domain connections), then at each step
 * append the unplaced domain whose insertion at the current tail maximises the
 * same scoring objective used by the old exhaustive scorer:
 *
 *   score = Σ adjacent_affinity × 6  −  Σ |fallback_pos − actual_pos| × 0.85
 *
 * Because domain affinity is dominated by direct adjacency, greedy insertion
 * produces near-optimal results across realistic graph sizes.
 */
export function greedyDomainOrder(
    domains: DomainId[],
    affinity: Map<string, number>,
    fallbackIndex: Map<DomainId, number>,
): DomainId[] {
    if (domains.length <= 1) return [...domains];

    // Score a complete candidate sequence with the same formula as before.
    function scoreOrder(order: DomainId[]) {
        let score = 0;
        for (let i = 0; i < order.length - 1; i++) {
            score += (affinity.get(getDomainPairKey(order[i], order[i + 1])) ?? 0) * 6;
        }
        for (let i = 0; i < order.length; i++) {
            score -= Math.abs((fallbackIndex.get(order[i]) ?? i) - i) * 0.85;
        }
        return score;
    }

    const remaining = new Set(domains);

    // Seed: pick the domain with the highest sum of affinity to all others.
    let seedDomain = domains[0];
    let bestSeedAffinity = -Infinity;
    for (const domain of domains) {
        let total = 0;
        for (const other of domains) {
            if (other !== domain) total += affinity.get(getDomainPairKey(domain, other)) ?? 0;
        }
        if (total > bestSeedAffinity) { bestSeedAffinity = total; seedDomain = domain; }
    }

    const result: DomainId[] = [seedDomain];
    remaining.delete(seedDomain);

    // Greedy insertion: at each step try appending each remaining domain at the
    // tail and pick the one that produces the best full-sequence score.
    while (remaining.size > 0) {
        let bestNext: DomainId | null = null;
        let bestScore = -Infinity;

        for (const candidate of remaining) {
            const candidate_score = scoreOrder([...result, candidate]);
            if (candidate_score > bestScore) {
                bestScore = candidate_score;
                bestNext = candidate;
            }
        }

        if (bestNext === null) break;
        result.push(bestNext);
        remaining.delete(bestNext);
    }

    return result;
}

export function buildDomainWeights(contentNodes: GraphCardNode[], graphRelations: GraphModel['relations']) {
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

export function buildDomainLaneOrder(contentNodes: GraphCardNode[], graphRelations: GraphModel['relations']) {
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

    return greedyDomainOrder(fallbackOrder, affinity, fallbackIndex);
}

export function normalizeAngle(angle: number) {
    let normalized = angle;
    while (normalized <= -Math.PI) normalized += Math.PI * 2;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    return normalized;
}

export function getAngularDistance(left: number, right: number) {
    return Math.abs(normalizeAngle(left - right));
}

export function rotateDomains(domains: DomainId[], offset: number) {
    return domains.map((_, index) => domains[(index + offset) % domains.length]);
}

export function buildLaneAnglePlan(
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

export function chooseBalancedDomainPlan(contentNodes: GraphCardNode[], graphRelations: GraphModel['relations']) {
    const baseOrder = buildDomainLaneOrder(contentNodes, graphRelations);
    const domainWeights = buildDomainWeights(contentNodes, graphRelations);
    const preferredAngles = new Map(
        baseOrder.map((domain) => [domain, getDomainLayout(domain).seedAngle * (Math.PI / 180)])
    );
    const arcStart = LAYOUT_ARC.startDeg * (Math.PI / 180);
    const arcSpan = LAYOUT_ARC.spanDeg * (Math.PI / 180);
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

// ---------------------------------------------------------------------------
// Radial placement
// ---------------------------------------------------------------------------

/**
 * Computes target center positions for each content node arranged in
 * domain-coloured lanes around a central point.
 *
 * @param innerRadiusMin  - minimum inner ring radius (pixels)
 * @param innerRadiusMax  - maximum inner ring radius (pixels)
 * @param radialGapMin    - minimum gap between rings (pixels)
 * @param radialGapMax    - maximum gap between rings (pixels)
 * @param maxAngleOffset  - maximum angular spread within a lane (radians)
 */
export function buildLaneTargetPositions(
    contentNodes: GraphCardNode[],
    graphRelations: GraphModel['relations'],
    centerX: number,
    centerY: number,
    viewportWidth: number,
    viewportHeight: number,
    {
        innerRadiusMin,
        innerRadiusMax,
        radialGapMin,
        radialGapMax,
        maxAngleOffset,
    }: {
        innerRadiusMin: number;
        innerRadiusMax: number;
        radialGapMin: number;
        radialGapMax: number;
        maxAngleOffset: number;
    }
): { targets: Map<string, Point>; layers: Map<string, number> } {
    const lanePlan = chooseBalancedDomainPlan(contentNodes, graphRelations);
    const domainOrder = [...lanePlan.keys()];
    const minViewport = Math.min(viewportWidth, viewportHeight);
    // Stretch targets horizontally to fill the wide screen.
    // Nodes are placed on an ellipse whose x-radius = innerRadius * aspectX
    // and y-radius = innerRadius, so the layout fills the viewport proportionally
    // rather than expanding as a circle scaled to the shorter (height) dimension.
    const aspectX = Math.min(viewportWidth / viewportHeight, 2.2);
    const innerRadius = Math.max(innerRadiusMin, Math.min(innerRadiusMax, minViewport * 0.245));
    const radialGap = Math.max(radialGapMin, Math.min(radialGapMax, minViewport * 0.128));
    // Outermost ring must not exceed this distance from center.
    const maxOuterRadius = minViewport * 0.44;

    // Build the set of nodes directly connected to the bio anchor so they can
    // be placed at layer 0 (innermost ring) in their respective lanes.
    const bioConnectedIds = new Set<string>();
    for (const rel of graphRelations) {
        if (rel.from === 'bio') bioConnectedIds.add(rel.to);
        if (rel.to === 'bio') bioConnectedIds.add(rel.from);
    }

    const targets = new Map<string, Point>();
    const layers = new Map<string, number>();

    for (const domain of domainOrder) {
        const laneNodes = contentNodes
            .filter((node) => node.domain === domain)
            .sort((left, right) => {
                // Bio-connected nodes always come first so they land at layer 0.
                const leftBio = bioConnectedIds.has(left.id) ? 1 : 0;
                const rightBio = bioConnectedIds.has(right.id) ? 1 : 0;
                if (leftBio !== rightBio) return rightBio - leftBio;
                // Within each tier, sort by chronology descending (most recent first).
                return getChronologySortKey(right.chronology) - getChronologySortKey(left.chronology);
            });
        const lane = lanePlan.get(domain);
        if (!lane) continue;

        const outerLayerCount = Math.max(1, Math.ceil((laneNodes.length - 1) / 2));
        // Shrink the gap when there are many nodes so the outermost ring stays
        // within maxOuterRadius. With few nodes the cap has no effect.
        const effectiveRadialGap = outerLayerCount > 1
            ? Math.min(radialGap, (maxOuterRadius - innerRadius) / outerLayerCount)
            : radialGap;
        const effectiveMaxAngleOffset = Math.min(maxAngleOffset, lane.span * 0.34);
        const angleStep = outerLayerCount > 0 ? effectiveMaxAngleOffset / outerLayerCount : 0;

        laneNodes.forEach((node, index) => {
            const layer = index === 0 ? 0 : Math.ceil(index / 2);
            const side = index === 0 ? 0 : index % 2 === 1 ? -1 : 1;
            const angleOffset = side * angleStep * layer;
            const angle = lane.centerAngle + angleOffset;
            const radius = innerRadius + layer * effectiveRadialGap;
            const tangentOffset = side === 0 ? 0 : side * effectiveRadialGap * 0.14;

            targets.set(node.id, {
                x: centerX + Math.cos(angle) * radius * aspectX - Math.sin(angle) * tangentOffset * aspectX,
                y: centerY + Math.sin(angle) * radius + Math.cos(angle) * tangentOffset,
            });
            layers.set(node.id, layer);
        });
    }

    return { targets, layers };
}

// ---------------------------------------------------------------------------
// Box-map relaxation helpers (work with generic BoxState, not ReactFlow nodes)
// ---------------------------------------------------------------------------

/**
 * Relaxes a set of boxes in-place, keeping `anchorId` fixed and clearing
 * its halo. This is a two-step settle used after `buildLaneTargetPositions`.
 */
export function settleBoxesAroundAnchor(
    pos: Map<string, BoxState>,
    anchorId: string,
    anchorClearancePad: number,
    {
        maxIters = SETTLE_NODES_AROUND_ANCHOR_CONFIG.maxIters,
        damping = SETTLE_NODES_AROUND_ANCHOR_CONFIG.damping,
        maxStep = SETTLE_NODES_AROUND_ANCHOR_CONFIG.maxStep,
    }: {
        maxIters?: number;
        damping?: number;
        maxStep?: number;
    } = {}
) {
    if (!pos.has(anchorId)) return;

    relaxBoxPositions(pos, {
        immovableIds: new Set([anchorId]),
        maxIters,
        damping,
        maxStep,
    });
    enforceAnchorClearance(pos, anchorId, anchorClearancePad);
}

/**
 * Relaxes boxes from a default-overlap state (all stacked at target centers),
 * with the anchor fixed. Pass `targets` (center points) and `springK` to keep
 * nodes attracted to their assigned radial positions during separation.
 */
export function relaxBoxesFromTargets(
    pos: Map<string, BoxState>,
    anchorId: string,
    {
        maxIters = RELAX_INITIAL_NODES_CONFIG.maxIters,
        damping = RELAX_INITIAL_NODES_CONFIG.damping,
        maxStep = RELAX_INITIAL_NODES_CONFIG.maxStep,
        targets,
        springK,
        nodeSpringK,
        relations,
        edgeSpringK,
    }: {
        maxIters?: number;
        damping?: number;
        maxStep?: number;
        targets?: Map<string, Point>;
        springK?: number;
        nodeSpringK?: Map<string, number>;
        relations?: ReadonlyArray<{ from: string; to: string; strength: number }>;
        edgeSpringK?: number;
    } = {}
) {
    relaxBoxPositions(pos, {
        immovableIds: new Set([anchorId]),
        maxIters,
        damping,
        maxStep,
        targets,
        springK,
        nodeSpringK,
        relations,
        edgeSpringK,
    });
}
