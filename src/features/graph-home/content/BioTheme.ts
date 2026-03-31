type Theme = 'nyc' | 'joshua' | 'mty' | 'atlp'

const THEME_STORAGE_KEY = 'greenpage-active-theme';

type ThemeInfo = {
    imgSrc: string,
    url: string,
    description: string
}

const BIOTHEME: Record<Theme,ThemeInfo> = {
    'nyc': {
        'imgSrc': './assets/portrait-haoyang-nyc.jpg',
        'url': 'https://www.linkedin.com/in/haoyanghowyoung/',
        'description': 'New York, 2023',
    },
    'joshua': {
        'imgSrc': './assets/portrait-haoyang-joshua.jpg',
        'url': 'https://www.linkedin.com/in/haoyanghowyoung/',
        'description': 'Joshua Tree, 2023',
    },
    'mty': {
        'imgSrc': './assets/portrait-haoyang-mty.jpg',
        'url': 'https://www.linkedin.com/in/haoyanghowyoung/',
        'description': 'Monterey, 2023',
    },
    'atlp': {
        'imgSrc': './assets/portrait-haoyang-atlp.jpg',
        'url': 'https://www.linkedin.com/in/haoyanghowyoung/',
        'description': 'Antelope Valley, 2023',
    }
}

function isTheme(value: unknown): value is Theme {
    return value === 'nyc' || value === 'joshua' || value === 'mty' || value === 'atlp';
}

function readStoredTheme(): Theme {
    if (typeof window === 'undefined') return 'nyc';

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : 'nyc';
}

function persistTheme(theme: Theme) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export { BIOTHEME }
export { THEME_STORAGE_KEY, isTheme, readStoredTheme, persistTheme }
export type { Theme }
