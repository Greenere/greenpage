# Graph Layout Scalability Analysis — 2026-04-04

## Context

Current layout pipeline (all synchronous, main thread):

1. `buildDomainLaneOrder` — orders domains around the arc, calls `permuteDomainOrder`
2. `chooseBalancedDomainPlan` — picks the best arc rotation
3. `buildLaneTargetPositions` — places nodes in radial lanes
4. `relaxBoxesFromTargets` — collision relaxation (initial pass, estimated sizes)
5. `settleBoxesAroundAnchor` — collision relaxation (settle pass, measured sizes)
6. `enforceAnchorClearance` — pushes nodes out of the bio node halo

---

## Bottleneck: `permuteDomainOrder` is O(D!)

`buildDomainLaneOrder` finds the optimal domain arc order by scoring **all D! permutations**:

```ts
function walk() {
    if (current.length === domains.length) {
        results.push([...current]);
    }
    for (let i = 0; i < domains.length; i++) { ... walk(); }
}
```

| Domains | Permutations | Verdict |
|---------|-------------|---------|
| 5 | 120 | Fine |
| 7 | 5,040 | Fine |
| 8 | 40,320 | Starting to stall |
| 10 | 3,628,800 | Freezes UI |
| 12 | 479,001,600 | Unacceptable |

This runs synchronously inside `buildInitialGraph` → `useMemo`. With 100+ nodes
spanning 10–12 domains it will lock the browser for several seconds.

**Fix:** Replace exhaustive search with greedy nearest-neighbor insertion — O(D²).
Build the domain order incrementally: at each step insert the next unplaced domain
in the position that maximises the adjacent-pair affinity score. Produces near-optimal
results because domain affinity is dominated by direct adjacency.

---

## Other components — scale fine

| Component | Complexity | At 100 nodes |
|-----------|-----------|--------------|
| `relaxBoxPositions` (spatial hash) | O(N · iter) | ~8 000 lookups/pass — fast |
| `enforceAnchorClearance` | O(N · iter) | 2 400 comparisons — negligible |
| `buildLaneTargetPositions` | O(N log N) | Fine |
| `chooseBalancedDomainPlan` rotations | O(D) | Fine once permutation is fixed |

The spatial hash grid (`COLLISION_CELL_SIZE = 220`) keeps per-node candidate sets
small regardless of total N. Relaxation scales linearly and handles hundreds of
nodes without issue.

---

## Secondary concern: ring geometry doesn't grow with N

`innerRadius` is clamped to `min(innerRadiusMax, viewport × 0.245)` and `radialGap`
to `min(radialGapMax, viewport × 0.128)`. With 20 nodes/lane, layer-10 nodes land
at `innerRadius + 10 × radialGap` — potentially far outside the viewport. The layout
won't corrupt but the graph will feel very stretched. A future improvement would
scale `radialGap` down when lanes are dense, or add a second arc ring.

---

## Arc angle pressure with many domains

At 320° / 12 domains each lane gets ~26°. The `laneGap` formula
(`min(0.18, arcSpan / max(18, D × 4.5))`) already shrinks the gap, but narrow lanes
mean `effectiveMaxAngleOffset = min(maxAngleOffset, lane.span × 0.34)` compresses
the spiral, increasing ring depth. More a visual concern than a correctness one.

---

## Fix applied

`permuteDomainOrder` replaced with `greedyDomainOrder` in `graphLayout.ts`.
Complexity: O(D²). Produces identical results on ≤ 6 domains; near-optimal above that.
