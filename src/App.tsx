import { lazy, Suspense } from 'react'
import './App.css'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NodeHomePage from './pages/graph/NodeHomePage'
import PageLoadingFallback from './shared/ui/PageLoadingFallback'

const NodeEditorPage = lazy(() => import('./pages/editor/NodeEditorPage'))
const NodeDetailPage = lazy(() => import('./pages/graph/NodeDetailPage'))
const BioDetailPage = lazy(() => import('./pages/graph/BioDetailPage'))

function App() {
  const location = useLocation()
  const editorTab = new URLSearchParams(location.search).get('tab')
  const renderEditorWorkspace = editorTab === 'new-node' || editorTab === 'new-domain'

  return (
    <Routes>
      <Route path="/" element={<NodeHomePage />} />
      <Route
        path="/editor"
        element={
          renderEditorWorkspace ? (
            <Suspense fallback={<PageLoadingFallback />}>
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
          <Suspense fallback={<PageLoadingFallback />}>
            <NodeEditorPage />
          </Suspense>
        }
      />
      <Route
        path="/nodes/bio"
        element={
          <Suspense fallback={<PageLoadingFallback />}>
            <BioDetailPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route
        path="/nodes/:nodeId"
        element={
          <Suspense fallback={<PageLoadingFallback />}>
            <NodeDetailPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
