import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getMyOrg, getMyProjects, createProject } from '../lib/data'
import { signOut } from '../lib/auth'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [role, setRole] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const { org, role } = await getMyOrg()
      setOrg(org)
      setRole(role)
      const projectList = await getMyProjects(org.id)
      setProjects(projectList)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProject(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await createProject({ orgId: org.id, name: newProjectName, userId: user.id })
      setNewProjectName('')
      setShowNewProject(false)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <p className="font-semibold text-slate-900 truncate">{org?.name}</p>
          <p className="text-xs text-slate-500 capitalize">{org?.plan} plan · {role}</p>
          <button
            onClick={() => navigate('/billing')}
            className="text-xs text-indigo-600 hover:text-indigo-700 mt-1"
        >
  Manage billing →
</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Projects</p>
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="text-indigo-600 text-sm font-medium hover:text-indigo-700"
            >
              + New
            </button>
          </div>

          {showNewProject && (
            <form onSubmit={handleCreateProject} className="mb-3 px-1">
              <input
                type="text"
                required
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="w-full text-sm rounded-md border border-slate-300 px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full text-sm bg-indigo-600 text-white rounded-md py-1.5 hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </form>
          )}

          <nav className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="w-full text-left text-sm text-slate-700 hover:bg-slate-100 rounded-md px-2 py-1.5 truncate"
              >
                {project.name}
              </button>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-slate-400 px-2">No projects yet</p>
            )}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-slate-600 hover:text-slate-900 text-left px-2 py-1.5"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Welcome back</h1>
        <p className="text-slate-500">Select a project from the sidebar, or create a new one to get started.</p>
      </main>
    </div>
  )
}