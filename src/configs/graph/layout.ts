function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

function lerp(loose: number, tight: number, tightness: number) {
    return loose + (tight - loose) * clamp01(tightness);
}

export const GRAPH_LAYOUT_TIGHTNESS = 1;

export const GRAPH_LAYOUT = {
    contentNodeWidth: 220,
    contentNodeHeight: 200,
    bioNodeWidth: 228,
    bioNodeHeight: 248,
    contentCollisionPadding: 18,
    bioCollisionPadding: 24,
    bioClearancePadding: 26,
    toggleCollisionPadding: 10,
    toggleNodeWidth: 170,
    toggleNodeHeight: 48,
    handleMargin: 0.14,
    preferredHandleGap: 0.11,
    maxAngleOffset: 0.42,
    ring: {
        innerRadiusMin: Math.round(lerp(332, 258, GRAPH_LAYOUT_TIGHTNESS)),
        innerRadiusMax: Math.round(lerp(384, 310, GRAPH_LAYOUT_TIGHTNESS)),
        radialGapMin: Math.round(lerp(122, 93, GRAPH_LAYOUT_TIGHTNESS)),
        radialGapMax: Math.round(lerp(158, 134, GRAPH_LAYOUT_TIGHTNESS)),
    },
    relationStrengthWeights: {
        1: 1,
        2: 1.55,
        3: 2.45,
        4: 3.4,
        5: 7.5,
    },
    derivedRelationStrengths: {
        temporalSequence: 4,
        latestNodeToBio: 5,
    },
    styleNodeOffsetFromBio: {
        x: 128 + Math.round(lerp(36, 14, GRAPH_LAYOUT_TIGHTNESS)),
        y: -68 - Math.round(48 * lerp(0.42, 0.58, GRAPH_LAYOUT_TIGHTNESS)),
    },
} as const;
