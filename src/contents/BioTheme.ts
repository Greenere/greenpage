type Theme = 'nyc' | 'joshua' | 'mty'

type ThemeInfo = {
    imgSrc: string,
    url: string,
    description: string,
    keyColor: string
}

const BIOTHEME: Record<Theme,ThemeInfo> = {
    'nyc': {
        'imgSrc': './assets/portrait-haoyang-nyc.jpg',
        'url': 'https://www.linkedin.com/in/haoyanghowyoung/',
        'description': 'New York City, 2023',
        'keyColor': '#373C42ff'
    },
    'joshua': {
        'imgSrc': './assets/portrait-haoyang-joshua.jpg',
        'url': 'https://www.linkedin.com/in/haoyanghowyoung/',
        'description': 'Joshua Tree National Park, 2023',
        'keyColor': '#7D8696ff'
    },
    'mty': {
        'imgSrc': './assets/portrait-haoyang-mty.jpg',
        'url': 'https://www.linkedin.com/in/haoyanghowyoung/',
        'description': 'Monterrey, CA, 2023',
        'keyColor': '#30648Dff'
    }
}

export { BIOTHEME }
export type { Theme }