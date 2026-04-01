export type ThemePalette = {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent?: string;
};

type ThemePortraitConfig = {
    imgSrc: string;
    url: string;
    description: string;
};

type ThemeConfig = {
    label: string;
    colors: ThemePalette;
    portrait: ThemePortraitConfig;
};

export const THEME_CONFIG = {
    nyc: {
        label: 'New York, 2023',
        colors: {
            primary: '#373C42',
            secondary: '#696B6A',
            background: '#D3B090',
            text: '#373C42',
            accent: '#B4B9BD',
        },
        portrait: {
            imgSrc: './assets/portrait-haoyang-nyc.jpg',
            url: 'https://www.linkedin.com/in/haoyanghowyoung/',
            description: 'New York, 2023',
        },
    },
    joshua: {
        label: 'Joshua Tree, 2023',
        colors: {
            primary: '#7D8696ff',
            secondary: '#535360ff',
            background: '#A19CA0ff',
            text: '#45444Bff',
            accent: '#28272Bff',
        },
        portrait: {
            imgSrc: './assets/portrait-haoyang-joshua.jpg',
            url: 'https://www.linkedin.com/in/haoyanghowyoung/',
            description: 'Joshua Tree, 2023',
        },
    },
    mty: {
        label: 'Monterey, 2023',
        colors: {
            primary: '#30648Dff',
            secondary: '#E3E0E6ff',
            background: '#6796BEff',
            text: '#E3E0E6ff',
            accent: '#43444Dff',
        },
        portrait: {
            imgSrc: './assets/portrait-haoyang-mty.jpg',
            url: 'https://www.linkedin.com/in/haoyanghowyoung/',
            description: 'Monterey, 2023',
        },
    },
    atlp: {
        label: 'Antelope Canyon, 2023',
        colors: {
            primary: '#83361Dff',
            secondary: '#954839ff',
            background: '#CE7268ff',
            text: '#134D8Cff',
            accent: '#43444Dff',
        },
        portrait: {
            imgSrc: './assets/portrait-haoyang-atlp.jpg',
            url: 'https://www.linkedin.com/in/haoyanghowyoung/',
            description: 'Antelope Valley, 2023',
        },
    },
} as const satisfies Record<string, ThemeConfig>;

export type Theme = keyof typeof THEME_CONFIG;

// Controls the initial style when there is no saved preference in localStorage yet.
export const DEFAULT_THEME: Theme = 'nyc';
export const THEME_ORDER = Object.keys(THEME_CONFIG) as Theme[];
