import { lazy, Suspense } from 'react'
import './App.css'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NodeHomePage from './pages/graph/NodeHomePage'
import { useAppLanguage } from './i18n/useAppLanguage'

const NodeEditorPage = lazy(() => import('./pages/editor/NodeEditorPage'))
const NodeDetailPage = lazy(() => import('./pages/graph/NodeDetailPage'))
const BioDetailPage = lazy(() => import('./pages/graph/BioDetailPage'))

function App() {
  const location = useLocation()
  const { messages } = useAppLanguage()
  const editorTab = new URLSearchParams(location.search).get('tab')
  const renderEditorWorkspace = editorTab === 'new-node' || editorTab === 'new-domain'

  return (
    <Routes>
      <Route path="/" element={<NodeHomePage />} />
      <Route
        path="/editor"
        element={
          renderEditorWorkspace ? (
            <Suspense fallback={<div style={{ padding: '1rem' }}>{messages.appShell.loadingEditor}</div>}>
              <NodeEditorPage />
            </Suspense>
          ) : (
            <Navigate to="/editor/nodes/bio" replace />
          )
        }
      />
      <Route
        path="/editor/nodes/:nodeId"
        element={
          <Suspense fallback={<div style={{ padding: '1rem' }}>{messages.appShell.loadingEditor}</div>}>
            <NodeEditorPage />
          </Suspense>
        }
      />
      <Route
        path="/nodes/bio"
        element={
          <Suspense fallback={<div style={{ padding: '1rem' }}>{messages.appShell.loadingEditor}</div>}>
            <BioDetailPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route
        path="/nodes/:nodeId"
        element={
          <Suspense fallback={<div style={{ padding: '1rem' }}>{messages.appShell.loadingEditor}</div>}>
            <NodeDetailPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
