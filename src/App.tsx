import { lazy, Suspense, useEffect, useRef } from 'react'
import './App.css'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NodeHomePage from './pages/graph/NodeHomePage'
import PageLoadingFallback from './shared/ui/PageLoadingFallback'
import DetailPageSkeleton from './shared/ui/DetailPageSkeleton'
import { trackVisitorEvent } from './shared/analytics/visitorTracking'

const NodeEditorPage = lazy(() => import('./pages/editor/NodeEditorPage'))
const NodeDetailPage = lazy(() => import('./pages/graph/NodeDetailPage'))
const BioDetailPage = lazy(() => import('./pages/graph/BioDetailPage'))
const GraphStatisticsPage = lazy(() => import('./pages/graph/GraphStatisticsPage'))
const VisitorAnalysisPage = lazy(() => import('./pages/graph/VisitorAnalysisPage'))

function App() {
  const location = useLocation()
  const hasTrackedEntryRef = useRef(false)
  const editorTab = new URLSearchParams(location.search).get('tab')
  const renderEditorWorkspace = editorTab === 'new-node' || editorTab === 'new-domain'

  useEffect(() => {
    if (!hasTrackedEntryRef.current) {
      trackVisitorEvent('entry')
      hasTrackedEntryRef.current = true
    }
  }, [])

  useEffect(() => {
    trackVisitorEvent('page_view')
  }, [location.pathname, location.search, location.hash])

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
          <Suspense fallback={<DetailPageSkeleton variant="bio" />}>
            <BioDetailPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route
        path="/nodes/:nodeId"
        element={
          <Suspense fallback={<DetailPageSkeleton variant="node" />}>
            <NodeDetailPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route
        path="/graph/statistics"
        element={
          <Suspense fallback={<DetailPageSkeleton variant="node" />}>
            <GraphStatisticsPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route
        path="/visitor-analysis"
        element={
          <Suspense fallback={<DetailPageSkeleton variant="node" />}>
            <VisitorAnalysisPage key={location.pathname} />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
