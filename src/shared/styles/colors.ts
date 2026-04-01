import {
  DEFAULT_THEME,
  THEME_CONFIG,
  THEME_ORDER,
  type Theme,
  type ThemePalette,
} from "../../configs/themes";

export const themes2color: Record<Theme, ThemePalette> = Object.fromEntries(
  THEME_ORDER.map((theme) => [theme, THEME_CONFIG[theme].colors])
) as Record<Theme, ThemePalette>;

// Legacy fallback used by the older non-graph homepage.
export const colors = themes2color[DEFAULT_THEME];

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
