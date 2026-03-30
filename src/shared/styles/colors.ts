/**
 * --silver: #C6C2BBff;
--dim-gray: #696B6Aff;
--tan: #D3B090ff;
--onyx: #373C42ff;
--french-gray: #B4B9BDff;
 */

import type { Theme } from "../../features/graph-home/content/BioTheme";

type Palette = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent?: string;
};

export const themes2color: Record<Theme, Palette> = {
  nyc:   { primary: "#373C42", secondary: "#696B6A", background: "#D3B090", text: "#373C42", accent: "#B4B9BD" },
  joshua:  { primary: "#7D8696ff", secondary: "#535360ff", background: "#A19CA0ff", text: "#45444Bff", accent: "#28272Bff" },
  mty: { primary: "#30648Dff", secondary: "#E3E0E6ff", background: "#6796BEff", text: "#E3E0E6ff", accent: "#43444Dff" },
  atlp: { primary: "#83361Dff", secondary: "#954839ff", background: "#CE7268ff", text: "#134D8Cff", accent: "#43444Dff" },
};

// Legacy fallback used by the older non-graph homepage.
export const colors = themes2color.nyc;

export function applyThemeVars(key: Theme) {
  if (typeof document === "undefined") return; // SSR guard
  const p = themes2color[key];
  const r = document.documentElement.style;
  r.setProperty("--color-primary", p.primary);
  r.setProperty("--color-secondary", p.secondary);
  r.setProperty("--color-background", p.background);
  r.setProperty("--color-text", p.text);
  r.setProperty("--color-accent", p.accent ?? p.primary);
}
