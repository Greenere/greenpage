type Theme = 'nyc' | 'joshua' | 'mty'

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
    }
}

export { BIOTHEME }
export type { Theme }