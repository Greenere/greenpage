import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom'
import NodeHomePage from './features/graph-home/NodeHomePage'
import NodeDetailPage from './features/graph-home/NodeDetailPage'
import BioDetailPage from './features/graph-home/BioDetailPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<NodeHomePage />} />
      <Route path="/nodes/bio" element={<BioDetailPage />} />
      <Route path="/nodes/:nodeId" element={<NodeDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
