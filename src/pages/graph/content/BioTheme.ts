import {
  DEFAULT_THEME,
  THEME_CONFIG,
  type Theme,
} from '../../../configs/ui/themes';

const THEME_STORAGE_KEY = 'greenpage-active-theme';

function isTheme(value: unknown): value is Theme {
    return typeof value === 'string' && value in THEME_CONFIG;
}

function readStoredTheme(): Theme {
    if (typeof window === 'undefined') return DEFAULT_THEME;

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
}

function persistTheme(theme: Theme) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export { THEME_STORAGE_KEY, isTheme, readStoredTheme, persistTheme };
export type { Theme };
