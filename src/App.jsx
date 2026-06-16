import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import SignUp from './pages/SignUp'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProjectLayout from './pages/ProjectLayout'
import ProjectBoard from './pages/ProjectBoard'
import ProjectChat from './pages/ProjectChat'
import Billing from './pages/Billing'
import LandingPage from './pages/LandingPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <PrivateRoute>
              <ProjectLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<ProjectBoard />} />
          <Route path="chat" element={<ProjectChat />} />
        </Route>
        <Route path="/billing" element={
          <PrivateRoute>
            <Billing />
          </PrivateRoute>
        } />
        
      </Routes>
    </BrowserRouter>
    
  )
}

export default App