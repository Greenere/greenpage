import './App.css'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NodeHomePage from './features/graph-home/NodeHomePage'
import NodeDetailPage from './features/graph-home/NodeDetailPage'
import BioDetailPage from './features/graph-home/BioDetailPage'

function App() {
  const location = useLocation()

  return (
    <Routes>
      <Route path="/" element={<NodeHomePage />} />
      <Route path="/nodes/bio" element={<BioDetailPage key={location.pathname} />} />
      <Route path="/nodes/:nodeId" element={<NodeDetailPage key={location.pathname} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
