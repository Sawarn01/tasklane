import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './lib/AuthContext'
import SignUp from './pages/SignUp'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProjectLayout from './pages/ProjectLayout'
import ProjectBoard from './pages/ProjectBoard'
import ProjectChat from './pages/ProjectChat'
import Backlog from './pages/Backlog'
import Timeline from './pages/Timeline'
import Reports from './pages/Reports'
import ProjectSettings from './pages/ProjectSettings'
import Releases from './pages/Releases'
import Billing from './pages/Billing'
import LandingPage from './pages/LandingPage'
import ProjectActivity from './pages/ProjectActivity'
import UserProfile from './pages/UserProfile'
import OrgSettings from './pages/OrgSettings'
import ProjectHome from './pages/ProjectHome'
import ProjectMembers from './pages/ProjectMembers'
import MyWork from './pages/MyWork'
import Notifications from './pages/Notifications'
import Meetings from './pages/Meetings'
import MeetingRoom from './pages/MeetingRoom'
import Onboarding from './pages/Onboarding'
import Projects from './pages/Projects'
import Finances from './pages/Finances'
import ProjectDocs from './pages/ProjectDocs'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 bg-ink rounded-lg flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-violet rounded-sm" />
        </div>
        <p className="font-mono text-xs text-slate-muted uppercase tracking-wider animate-pulse">Loading…</p>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" />
  return children
}

function OwnerRoute({ children }) {
  const { user, loading } = useAuth()
  const [ready,   setReady]   = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (!user) return
    import('./lib/data').then(({ getMyOrg }) =>
      getMyOrg().then(({ role }) => { setIsOwner(role === 'owner'); setReady(true) }).catch(() => setReady(true))
    )
  }, [user])

  if (loading || !ready) return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <p className="font-mono text-xs text-slate-muted uppercase tracking-wider animate-pulse">Loading…</p>
    </div>
  )
  if (!user) return <Navigate to="/login" />
  if (!isOwner) return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />

        {/* Full-screen meeting room — outside ProjectLayout */}
        <Route
          path="/projects/:projectId/meetings/:meetingId/room"
          element={<PrivateRoute><MeetingRoom /></PrivateRoute>}
        />

        <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/projects"      element={<PrivateRoute><Projects /></PrivateRoute>} />
        <Route path="/finances"      element={<PrivateRoute><Finances /></PrivateRoute>} />
        <Route path="/my-work"       element={<PrivateRoute><MyWork /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        <Route path="/billing" element={<OwnerRoute><Billing /></OwnerRoute>} />
        <Route path="/profile" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
        <Route path="/org/settings" element={<PrivateRoute><OrgSettings /></PrivateRoute>} />

        <Route
          path="/projects/:projectId"
          element={<PrivateRoute><ProjectLayout /></PrivateRoute>}
        >
          <Route index element={<ProjectBoard />} />
          <Route path="home"     element={<ProjectHome />} />
          <Route path="members"  element={<ProjectMembers />} />
          <Route path="backlog"  element={<Backlog />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="reports"  element={<Reports />} />
          <Route path="releases" element={<Releases />} />
          <Route path="settings" element={<ProjectSettings />} />
          <Route path="chat"     element={<ProjectChat />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="docs"     element={<ProjectDocs />} />
          <Route path="activity" element={<ProjectActivity />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
