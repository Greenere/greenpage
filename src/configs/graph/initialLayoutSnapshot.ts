export type GraphInitialLayoutSnapshot = {
    graphHash?: string;
    signature?: string;
    initialZoom?: number;
    positionsByNodeId: Record<string, { x: number; y: number }>;
};

// Optional hand-tuned initial layout. Positions are relative to the bio node's
// top-left corner so the snapshot stays portable across viewport sizes.
// Keep this as `null` to use the computed layout path.
export const GRAPH_INITIAL_LAYOUT_SNAPSHOT: GraphInitialLayoutSnapshot | null = {
  "graphHash":"graph-7deec41b",
  "initialZoom": 1.5,
  "positionsByNodeId": {
    "bio": {
      "x": 0,
      "y": 0
    },
    "biotoggle": {
      "x": 156.01,
      "y": -51.97
    },
    "adversarial-writing": {
      "x": 237.67,
      "y": -421.56
    },
    "california-one-2022": {
      "x": -349.43,
      "y": 460.2
    },
    "cornell": {
      "x": 234,
      "y": 51.77
    },
    "data-visualizations-2021": {
      "x": 140.12,
      "y": 505.55
    },
    "faceswap": {
      "x": -250.13,
      "y": 218.2
    },
    "howlang": {
      "x": -4.79,
      "y": 286
    },
    "hust": {
      "x": 478.67,
      "y": 46.85
    },
    "hust-mclab": {
      "x": -11.39,
      "y": -466.87
    },
    "layoff-journey": {
      "x": 237.38,
      "y": -188.56
    },
    "louvre-evacuation": {
      "x": -111.12,
      "y": 505.99
    },
    "microwave-notes-2019": {
      "x": 483.67,
      "y": -203.15
    },
    "naec": {
      "x": -592.05,
      "y": 407.43
    },
    "noise-modulation": {
      "x": 3.41,
      "y": -228
    },
    "oxford": {
      "x": 710.67,
      "y": 192.08
    },
    "puerto-rico-2022": {
      "x": -489.39,
      "y": 181.43
    },
    "realai": {
      "x": -489.31,
      "y": -263.61
    },
    "signature-attack": {
      "x": -245.39,
      "y": -237.88
    },
    "verily": {
      "x": -483.39,
      "y": -42.57
    },
    "verily-intern": {
      "x": -725.39,
      "y": 76.39
    },
    "waymo": {
      "x": -246.59,
      "y": -15.88
    },
    "weibe": {
      "x": 236.97,
      "y": 272.55
    },
    "wellmail": {
      "x": 478.3,
      "y": 275.03
    }
  }
};
