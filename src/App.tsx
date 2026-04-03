import { lazy, Suspense } from 'react'
import './App.css'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NodeHomePage from './features/graph_home/NodeHomePage'
import NodeDetailPage from './features/graph_home/NodeDetailPage'
import BioDetailPage from './features/graph_home/BioDetailPage'
import { useAppLanguage } from './i18n/LanguageProvider'

const DevNodeEditorPage = import.meta.env.DEV
  ? lazy(() => import('./features/node_editor/NodeEditorPage'))
  : null

function App() {
  const location = useLocation()
  const { messages } = useAppLanguage()

  return (
    <Routes>
      <Route path="/" element={<NodeHomePage />} />
      {import.meta.env.DEV && DevNodeEditorPage ? (
        <>
          <Route
            path="/editor"
            element={
              <Suspense fallback={<div style={{ padding: '1rem' }}>{messages.appShell.loadingEditor}</div>}>
                <DevNodeEditorPage />
              </Suspense>
            }
          />
          <Route
            path="/editor/nodes/:nodeId"
            element={
              <Suspense fallback={<div style={{ padding: '1rem' }}>{messages.appShell.loadingEditor}</div>}>
                <DevNodeEditorPage />
              </Suspense>
            }
          />
        </>
      ) : null}
      <Route path="/nodes/bio" element={<BioDetailPage key={location.pathname} />} />
      <Route path="/nodes/:nodeId" element={<NodeDetailPage key={location.pathname} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
