import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n/LanguageProvider'
import { getInitialLanguage, getLocaleMessages, setActiveLanguage } from './i18n'

function resolveSiteAsset(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\.\//, '').replace(/^\//, '')}`
}

const initialLanguage = getInitialLanguage()
setActiveLanguage(initialLanguage)
const siteMeta = getLocaleMessages(initialLanguage).siteMeta

document.title = siteMeta.title

const iconHref = resolveSiteAsset(siteMeta.iconHref)
let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

if (!favicon) {
  favicon = document.createElement('link')
  favicon.rel = 'icon'
  document.head.appendChild(favicon)
}

favicon.type = siteMeta.iconType
favicon.href = iconHref

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </BrowserRouter>,
)
