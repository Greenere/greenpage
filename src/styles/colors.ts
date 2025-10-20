/**
 * --silver: #C6C2BBff;
--dim-gray: #696B6Aff;
--tan: #D3B090ff;
--onyx: #373C42ff;
--french-gray: #B4B9BDff;
 */

import type { Theme } from "../contents/BioTheme";

type Palette = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent?: string;
};

const themes2color: Record<Theme, Palette> = {
  nyc:   { primary: "#373C42", secondary: "#696B6A", background: "#D3B090", text: "#373C42", accent: "#B4B9BD" },
  joshua:  { primary: "#7D8696ff", secondary: "#535360ff", background: "#A19CA0ff", text: "#45444Bff", accent: "#28272Bff" },
  mty: { primary: "#30648Dff", secondary: "#E3E0E6ff", background: "#6796BEff", text: "#43444Dff", accent: "#43444Dff" },
};

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
