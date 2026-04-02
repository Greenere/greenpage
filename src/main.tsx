import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SITE_META } from './configs/siteMeta'

function resolveSiteAsset(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\.\//, '').replace(/^\//, '')}`
}

document.title = SITE_META.title

const iconHref = resolveSiteAsset(SITE_META.iconHref)
let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

if (!favicon) {
  favicon = document.createElement('link')
  favicon.rel = 'icon'
  document.head.appendChild(favicon)
}

favicon.type = SITE_META.iconType
favicon.href = iconHref

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <App />
  </BrowserRouter>,
)
