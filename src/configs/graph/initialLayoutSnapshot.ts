export type GraphInitialLayoutSnapshot = {
    signature: string;
    positionsByNodeId: Record<string, { x: number; y: number }>;
};

// Optional hand-tuned initial layout. Positions are relative to the bio node's
// top-left corner so the snapshot stays portable across viewport sizes.
// Keep this as `null` to use the computed layout path.
export const GRAPH_INITIAL_LAYOUT_SNAPSHOT: GraphInitialLayoutSnapshot | null = {
  "signature": "adversarial-writing|bio|biotoggle|california-one-2022|cornell|data-visualizations-2021|faceswap|howlang|hust|hust-mclab|layoff-journey|louvre-evacuation|microwave-notes-2019|naec|noise-modulation|oxford|puerto-rico-2022|realai|signature-attack|verily|verily-intern|waymo|weibe|wellmail",
  "positionsByNodeId": {
    "bio": {
      "x": 0,
      "y": 0
    },
    "biotoggle": {
      "x": 155.96,
      "y": -52.63
    },
    "adversarial-writing": {
      "x": 237.62,
      "y": -422.22
    },
    "california-one-2022": {
      "x": -369.48,
      "y": 459.54
    },
    "cornell": {
      "x": 235.28,
      "y": 57.78
    },
    "data-visualizations-2021": {
      "x": 214.07,
      "y": 530.89
    },
    "faceswap": {
      "x": -250.18,
      "y": 217.54
    },
    "howlang": {
      "x": 5.82,
      "y": 286
    },
    "hust": {
      "x": 484.62,
      "y": 46.19
    },
    "hust-mclab": {
      "x": -11.44,
      "y": -467.53
    },
    "layoff-journey": {
      "x": 237.33,
      "y": -189.22
    },
    "louvre-evacuation": {
      "x": -107.17,
      "y": 527.33
    },
    "microwave-notes-2019": {
      "x": 483.62,
      "y": -203.81
    },
    "naec": {
      "x": -612.1,
      "y": 393.73
    },
    "noise-modulation": {
      "x": -1.31,
      "y": -229.33
    },
    "oxford": {
      "x": 716.62,
      "y": 145.42
    },
    "puerto-rico-2022": {
      "x": -513.33,
      "y": 169.73
    },
    "realai": {
      "x": -763.36,
      "y": 157.55
    },
    "signature-attack": {
      "x": -245.44,
      "y": -238.54
    },
    "verily": {
      "x": -497.36,
      "y": -54.27
    },
    "verily-intern": {
      "x": -483.44,
      "y": -280.43
    },
    "waymo": {
      "x": -243.31,
      "y": -18.54
    },
    "weibe": {
      "x": 240.25,
      "y": 278.55
    },
    "wellmail": {
      "x": 472.25,
      "y": 320.37
    }
  }
};