import {
  DEFAULT_THEME,
  THEME_CONFIG,
  type Theme,
} from '../../../configs/ui/themes';

const THEME_STORAGE_KEY = 'greenpage-active-theme';

type ThemeInfo = {
    imgSrc: string,
    url: string,
    description: string
};

const BIOTHEME: Record<Theme, ThemeInfo> = {
    nyc: THEME_CONFIG.nyc.portrait,
    joshua: THEME_CONFIG.joshua.portrait,
    mty: THEME_CONFIG.mty.portrait,
    atlp: THEME_CONFIG.atlp.portrait,
};

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

export { BIOTHEME };
export { THEME_STORAGE_KEY, isTheme, readStoredTheme, persistTheme };
export type { Theme };
