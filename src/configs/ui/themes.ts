export type ThemePalette = {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent?: string;
};

type ThemePortraitConfig = {
    imgSrc: string;
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
            text: '#000000',
            accent: '#B4B9BD',
        },
        portrait: {
            imgSrc: './assets/portrait_haoyang_nyc.jpg',
            description: 'New York, 2023',
        },
    },
    joshua: {
        label: 'Joshua Tree, 2023',
        colors: {
            primary: '#7D8696ff',
            secondary: '#535360ff',
            background: '#A19CA0ff',
            text: 'rgb(28, 27, 31)',
            accent: '#28272Bff',
        },
        portrait: {
            imgSrc: './assets/portrait_haoyang_joshua.jpg',
            description: 'Joshua Tree, 2023',
        },
    },
    mty: {
        label: 'Monterey, 2023',
        colors: {
            primary: '#30648Dff',
            secondary: '#E3E0E6ff',
            background: '#6796BEff',
            text: 'rgb(255, 255, 255)',
            accent: '#43444Dff',
        },
        portrait: {
            imgSrc: './assets/portrait_haoyang_mty.jpg',
            description: 'Monterey, 2023',
        },
    },
    atlp: {
        label: 'Antelope Canyon, 2023',
        colors: {
            primary: '#83361Dff',
            secondary: '#954839ff',
            background: '#CE7268ff',
            text: 'rgb(19, 68, 121)',
            accent: '#43444Dff',
        },
        portrait: {
            imgSrc: './assets/portrait_haoyang_atlp.jpg',
            description: 'Antelope Valley, 2023',
        },
    },
    sfhill: {
        label: 'San Francisco Bay, 2023',
        colors: {
            primary: '#46513A',
            secondary: '#8E9565',
            background: '#CEDA8D',
            text: '#1F2619',
            accent: '#BCA793',
        },
        portrait: {
            imgSrc: './assets/portrait_haoyang_sfhill.jpg',
            description: 'San Francisco Bay, 2023',
        },
    },
} as const satisfies Record<string, ThemeConfig>;

export type Theme = keyof typeof THEME_CONFIG;

// Controls the initial style when there is no saved preference in localStorage yet.
export const DEFAULT_THEME: Theme = 'nyc';
export const THEME_ORDER = Object.keys(THEME_CONFIG) as Theme[];
