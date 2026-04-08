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
            imgSrc: './assets/portraits/portrait_haoyang_nyc.jpg',
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
            imgSrc: './assets/portraits/portrait_haoyang_joshua.jpg',
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
            imgSrc: './assets/portraits/portrait_haoyang_mty.jpg',
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
            imgSrc: './assets/portraits/portrait_haoyang_atlp.jpg',
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
            imgSrc: './assets/portraits/portrait_haoyang_sfhill.jpg',
            description: 'San Francisco Bay, 2023',
        },
    },
    mtfuji: {
        label: 'Mount Fuji, 2024',
        colors: {
            primary: '#355B80',
            secondary: '#8E2F28',
            background: '#D5E4F1',
            text: '#1A2840',
            accent: '#F4F7FA',
        },
        portrait: {
            imgSrc: './assets/portraits/portrait_haoyang_mtfuji.jpg',
            description: 'Mount Fuji, 2024',
        },
    },
    squamish: {
        label: 'Squamish, 2024',
        colors: {
            primary: '#29465C',
            secondary: '#526774',
            background: '#A8C0D2',
            text: '#1B2B34',
            accent: '#D2CBC3',
        },
        portrait: {
            imgSrc: './assets/portraits/portrait_haoyang_squamish.jpg',
            description: 'Squamish, 2024',
        },
    },
    cornellsailing: {
        label: 'Cornell Sailing, 2021',
        colors: {
            primary: '#28477F',
            secondary: '#6F8FA3',
            background: '#B7D0E2',
            text: '#1E3150',
            accent: '#C9B36A',
        },
        portrait: {
            imgSrc: './assets/portraits/portrait_haoyang_cornellsailing.jpg',
            description: 'Cornell Sailing, 2021',
        },
    },
    machupicchu: {
        label: 'Machu Picchu, 2024',
        colors: {
            primary: '#586351',
            secondary: '#8A7A72',
            background: '#D7D7DD',
            text: '#2C2925',
            accent: '#B7A79E',
        },
        portrait: {
            imgSrc: './assets/portraits/portrait_haoyang_machupicchu.jpg',
            description: 'Machu Picchu, 2024',
        },
    },
    whitesands: {
        label: 'White Sands, 2025',
        colors: {
            primary: '#3A4451',
            secondary: '#9D938B',
            background: '#E5D8CC',
            text: '#332D2A',
            accent: '#8D4F42',
        },
        portrait: {
            imgSrc: './assets/portraits/portrait_haoyang_whitesands.jpg',
            description: 'White Sands, 2025',
        },
    },
} as const satisfies Record<string, ThemeConfig>;

export type Theme = keyof typeof THEME_CONFIG;

// Controls the initial style when there is no saved preference in localStorage yet.
export const DEFAULT_THEME: Theme = 'whitesands';
export const THEME_ORDER: Theme[] = [
    'cornellsailing',
    'sfhill',
    'nyc',
    'mty',
    'atlp',
    'joshua',
    'squamish',
    'mtfuji',
    'machupicchu',
    'whitesands',
];
