import { Routes, Route, Navigate } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage'
import DiagramPage from './pages/DiagramPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<DiagramPage />} />
    </Routes>
  )
}
