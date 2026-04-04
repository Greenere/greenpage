import { lazy, Suspense } from 'react'
import './App.css'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NodeHomePage from './pages/graph/NodeHomePage'
import NodeDetailPage from './pages/graph/NodeDetailPage'
import BioDetailPage from './pages/graph/BioDetailPage'
import { useAppLanguage } from './i18n/useAppLanguage'

const NodeEditorPage = lazy(() => import('./pages/editor/NodeEditorPage'))

function App() {
  const location = useLocation()
  const { messages } = useAppLanguage()

  return (
    <Routes>
      <Route path="/" element={<NodeHomePage />} />
      <Route path="/editor" element={<Navigate to="/editor/nodes/bio" replace />} />
      <Route
        path="/editor/nodes/:nodeId"
        element={
          <Suspense fallback={<div style={{ padding: '1rem' }}>{messages.appShell.loadingEditor}</div>}>
            <NodeEditorPage />
          </Suspense>
        }
      />
      <Route path="/nodes/bio" element={<BioDetailPage key={location.pathname} />} />
      <Route path="/nodes/:nodeId" element={<NodeDetailPage key={location.pathname} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
