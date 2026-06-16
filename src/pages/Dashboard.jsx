import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMyOrg, getMyProjects, createProject } from '../lib/data'
import { signOut } from '../lib/auth'
import { createInvite } from '../lib/data'

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
  const [inviteLink, setInviteLink] = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

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

  async function handleGenerateInvite() {
  setGeneratingInvite(true)
  setError('')
  try {
    const invite = await createInvite({ orgId: org.id, createdBy: user.id })
    const link = `${window.location.origin}/signup?invite=${invite.token}`
    setInviteLink(link)
    setCopySuccess(false)
  } catch (err) {
    setError(err.message)
  } finally {
    setGeneratingInvite(false)
  }
}

async function handleCopyInvite() {
  await navigator.clipboard.writeText(inviteLink)
  setCopySuccess(true)
  setTimeout(() => setCopySuccess(false), 2000)
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="font-mono text-xs uppercase tracking-wider text-slate-muted"
        >
          Loading workspace...
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-paper">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-64 bg-white border-r border-black/5 flex flex-col"
      >
        <div className="p-4 border-b border-black/5">
          <p className="font-semibold text-ink truncate">{org?.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-violet bg-violet-dim rounded px-1.5 py-0.5">
              {org?.plan}
            </span>
            <span className="text-xs text-slate-muted">{role}</span>
          </div>
          <button
            onClick={() => navigate('/billing')}
            className="text-xs text-violet hover:opacity-70 mt-2 transition-opacity"
          >
            Manage billing →
          </button>
        </div>

        {(role === 'owner' || role === 'admin') && (
            <div className="mt-3 px-4">
                {!inviteLink ? (
                    <button
                    onClick={handleGenerateInvite}
                    disabled={generatingInvite}
                    className="text-xs text-violet hover:opacity-70 transition-opacity disabled:opacity-50"
                    >
                        {generatingInvite ? 'Generating...' : '+ Invite teammate'}
                    </button>
        ) : (
      <div className="bg-paper-dim rounded-lg p-2 mt-1">
        <p className="font-mono text-[9px] text-slate-muted uppercase tracking-wide mb-1">Invite link (1 use)</p>
        <div className="flex items-center gap-1">
          <input
            readOnly
            value={inviteLink}
            className="flex-1 text-[10px] bg-white rounded px-1.5 py-1 border border-black/5 truncate"
            onClick={(e) => e.target.select()}
          />
          <button
            onClick={handleCopyInvite}
            className="text-[10px] bg-violet text-white rounded px-2 py-1 flex-shrink-0 hover:bg-violet/90 transition-colors"
          >
            {copySuccess ? '✓' : 'Copy'}
          </button>
        </div>
      </div>
    )}
  </div>
)}

        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider">
              Projects
            </p>
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="text-violet text-sm font-medium hover:opacity-70 transition-opacity"
            >
              + New
            </button>
          </div>

          <AnimatePresence>
            {showNewProject && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreateProject}
                className="mb-3 px-1 overflow-hidden"
              >
                <input
                  type="text"
                  required
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-violet/40"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full text-sm bg-violet text-white rounded-lg py-1.5 hover:bg-violet/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <nav className="space-y-1">
            <AnimatePresence>
              {projects.map((project, i) => (
                <motion.button
                  key={project.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  whileHover={{ x: 2 }}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full text-left text-sm text-ink hover:bg-paper-dim rounded-lg px-2 py-1.5 truncate block"
                >
                  {project.name}
                </motion.button>
              ))}
            </AnimatePresence>
            {projects.length === 0 && (
              <p className="text-sm text-slate-muted px-2">No projects yet</p>
            )}
          </nav>
        </div>

        <div className="p-3 border-t border-black/5">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-slate-muted hover:text-ink text-left px-2 py-1.5 transition-colors"
          >
            Log out
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {error}
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-xl font-semibold text-ink mb-2">Welcome back</h1>
          <p className="text-slate-muted">Select a project from the sidebar, or create a new one to get started.</p>
        </motion.div>
      </main>
    </div>
  )
}