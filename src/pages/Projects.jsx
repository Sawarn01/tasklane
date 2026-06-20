import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMyOrg, getProjectsWithStats, getMyProfile, getProjectKey } from '../lib/data'
import DashboardSidebar from '../components/DashboardSidebar'
import CreateProjectModal from '../components/CreateProjectModal'

// ── Project card (grid view) ──────────────────────────────────────────────────
function ProjectCard({ project, index, onClick }) {
  const pct = project.totalTasks > 0
    ? Math.round((project.doneTasks / project.totalTasks) * 100)
    : 0
  const key = getProjectKey(project.name)

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      onClick={onClick}
      className="bg-white rounded-2xl border border-black/5 p-5 cursor-pointer group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-violet/10 flex items-center justify-center shrink-0">
          <span className="font-bold text-violet text-xs">{key}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          className="text-slate-muted/30 group-hover:text-violet transition-colors mt-1">
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="font-semibold text-ink mb-1 truncate">{project.name}</h3>
      {project.description && (
        <p className="text-xs text-slate-muted mb-3 line-clamp-2">{project.description}</p>
      )}
      <div className="flex gap-3 mb-3">
        {[
          { label: 'Todo',     count: project.todoTasks,       color: 'bg-slate-200' },
          { label: 'Progress', count: project.inProgressTasks, color: 'bg-violet/40' },
          { label: 'Done',     count: project.doneTasks,       color: 'bg-sage/60' },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
            <span className="text-[10px] text-slate-muted">{count} {label}</span>
          </div>
        ))}
      </div>
      <div className="w-full h-1.5 bg-paper-dim rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: 0.2 + index * 0.04, ease: 'easeOut' }}
          className="h-full bg-sage rounded-full" />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-slate-muted">{project.totalTasks} issues</span>
        <span className="text-[10px] text-slate-muted font-mono">{pct}%</span>
      </div>
    </motion.div>
  )
}

// ── Project row (list view) ────────────────────────────────────────────────────
function ProjectRow({ project, index, onClick }) {
  const pct = project.totalTasks > 0
    ? Math.round((project.doneTasks / project.totalTasks) * 100)
    : 0
  const key = getProjectKey(project.name)

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onClick={onClick}
      className="flex items-center gap-4 bg-white rounded-xl border border-black/5 px-5 py-3.5 cursor-pointer hover:shadow-sm hover:border-black/10 transition-all group">
      <div className="w-8 h-8 rounded-lg bg-violet/10 flex items-center justify-center shrink-0">
        <span className="font-bold text-violet text-[10px]">{key}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink text-sm truncate group-hover:text-violet transition-colors">{project.name}</p>
        {project.description && (
          <p className="text-[11px] text-slate-muted truncate mt-0.5">{project.description}</p>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          {[
            { count: project.todoTasks,       color: 'bg-slate-300',  tip: 'Todo' },
            { count: project.inProgressTasks, color: 'bg-violet/50',  tip: 'In Progress' },
            { count: project.doneTasks,       color: 'bg-sage/70',    tip: 'Done' },
          ].map(({ count, color, tip }) => (
            <span key={tip} title={tip} className="flex items-center gap-1 text-[10px] text-slate-muted font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${color}`} />{count}
            </span>
          ))}
        </div>
        <div className="w-24 h-1.5 bg-paper-dim rounded-full overflow-hidden">
          <div className="h-full bg-sage rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[10px] text-slate-muted w-8 text-right">{pct}%</span>
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
        className="text-slate-muted/30 group-hover:text-violet transition-colors shrink-0">
        <path d="M3 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Projects() {
  const { user }    = useAuth()
  const navigate    = useNavigate()

  const [org,     setOrg]     = useState(null)
  const [role,    setRole]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)

  const [showNewProject, setShowNewProject] = useState(false)
  const [search,   setSearch]   = useState('')
  const [sortBy,   setSortBy]   = useState('name')   // 'name' | 'progress' | 'issues'
  const [viewMode, setViewMode] = useState('grid')   // 'grid' | 'list'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { org, role } = await getMyOrg()
      setOrg(org); setRole(role)
      const [profileRes, projectsRes] = await Promise.allSettled([
        getMyProfile(user.id),
        getProjectsWithStats(org.id),
      ])
      if (profileRes.status === 'fulfilled')  setProfile(profileRes.value)
      if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value)
    } catch {}
    finally { setLoading(false) }
  }

  // Filter + sort
  const filtered = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'progress') {
        const pctA = a.totalTasks > 0 ? a.doneTasks / a.totalTasks : 0
        const pctB = b.totalTasks > 0 ? b.doneTasks / b.totalTasks : 0
        return pctB - pctA
      }
      if (sortBy === 'issues') return b.totalTasks - a.totalTasks
      return a.name.localeCompare(b.name)
    })

  const totalIssues = projects.reduce((s, p) => s + p.totalTasks, 0)
  const doneIssues  = projects.reduce((s, p) => s + p.doneTasks, 0)
  const openIssues  = projects.reduce((s, p) => s + p.todoTasks + p.inProgressTasks, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}
          className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 bg-ink rounded-xl flex items-center justify-center">
            <div className="w-3 h-3 bg-violet rounded-sm" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-muted">Loading projects…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <DashboardSidebar
        org={org} role={role} profile={profile} user={user}
        projects={projects}
        onNewProject={() => setShowNewProject(true)}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-black/5 px-8 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-ink">Projects</h1>
            <p className="text-[11px] text-slate-muted">{org?.name}</p>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1.5 bg-violet text-white text-xs px-3.5 py-2 rounded-xl font-medium hover:bg-violet/90 transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New project
          </motion.button>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total projects', value: projects.length,  accent: 'violet', icon: '📁' },
              { label: 'Total issues',   value: totalIssues,      accent: 'ink',    icon: '📋' },
              { label: 'Open issues',    value: openIssues,       accent: 'amber',  icon: '🔓' },
              { label: 'Done',           value: doneIssues,       accent: 'sage',   icon: '✅' },
            ].map(({ label, value, icon }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-black/5 px-5 py-4 flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-xl font-bold text-ink tabular-nums">{value}</p>
                  <p className="text-[11px] text-slate-muted">{label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Controls: search + sort + view toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted pointer-events-none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-black/8 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/25 placeholder:text-slate-muted/50"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 bg-white border border-black/8 rounded-xl p-1">
              <span className="text-[10px] font-mono text-slate-muted px-2 uppercase tracking-wide">Sort</span>
              {[
                { id: 'name',     label: 'Name' },
                { id: 'progress', label: 'Progress' },
                { id: 'issues',   label: 'Issues' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setSortBy(id)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors font-medium ${sortBy === id ? 'bg-violet/10 text-violet' : 'text-slate-muted hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-white border border-black/8 rounded-xl p-1">
              {[
                { id: 'grid', icon: <><rect x="1" y="1" width="4" height="4" rx="0.8" fill="currentColor" /><rect x="7" y="1" width="4" height="4" rx="0.8" fill="currentColor" /><rect x="1" y="7" width="4" height="4" rx="0.8" fill="currentColor" /><rect x="7" y="7" width="4" height="4" rx="0.8" fill="currentColor" /></> },
                { id: 'list', icon: <><rect x="1" y="2" width="10" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="5.25" width="10" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="8.5" width="10" height="1.5" rx="0.75" fill="currentColor" /></> },
              ].map(({ id, icon }) => (
                <button key={id} onClick={() => setViewMode(id)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${viewMode === id ? 'bg-violet/10 text-violet' : 'text-slate-muted hover:text-ink'}`}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">{icon}</svg>
                </button>
              ))}
            </div>
          </div>

          {/* Project grid / list */}
          {filtered.length === 0 && search ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white rounded-2xl border border-black/5 py-16 text-center">
              <p className="text-sm font-medium text-ink mb-1">No projects match "{search}"</p>
              <p className="text-xs text-slate-muted">Try a different search term.</p>
            </motion.div>
          ) : projects.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-dashed border-black/10 p-16 text-center">
              <div className="w-14 h-14 bg-paper-dim rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <rect x="2" y="2" width="9" height="9" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                  <rect x="15" y="2" width="9" height="9" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                  <rect x="2" y="15" width="9" height="9" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                  <rect x="15" y="15" width="9" height="9" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                </svg>
              </div>
              <p className="font-semibold text-ink mb-1">No projects yet</p>
              <p className="text-sm text-slate-muted mb-5">Create your first project to get your team organised.</p>
              <button onClick={() => setShowNewProject(true)}
                className="bg-violet text-white text-sm rounded-xl px-5 py-2.5 hover:bg-violet/90 transition-colors">
                Create project
              </button>
            </motion.div>
          ) : (
            <>
              {/* Result count */}
              {search && (
                <p className="text-xs text-slate-muted -mb-2">
                  {filtered.length} of {projects.length} projects
                </p>
              )}

              <AnimatePresence mode="wait">
                {viewMode === 'grid' ? (
                  <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((p, i) => (
                      <ProjectCard key={p.id} project={p} index={i} onClick={() => navigate(`/projects/${p.id}`)} />
                    ))}
                    {/* New project tile */}
                    <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: filtered.length * 0.04 }}
                      whileHover={{ y: -3, transition: { duration: 0.15 } }}
                      onClick={() => setShowNewProject(true)}
                      className="bg-white rounded-2xl border border-dashed border-black/10 p-5 flex flex-col items-center justify-center gap-2 hover:border-violet/30 hover:bg-violet/2 transition-all min-h-[176px]">
                      <div className="w-10 h-10 rounded-xl border-2 border-dashed border-black/10 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 2v12M2 8h12" stroke="#8A8F98" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-sm text-slate-muted">New project</p>
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="space-y-2">
                    {/* List header */}
                    <div className="hidden sm:flex items-center gap-4 px-5 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-muted/60">
                      <div className="w-8 shrink-0" />
                      <span className="flex-1">Project</span>
                      <span className="w-40 text-center shrink-0">Status breakdown</span>
                      <span className="w-24 text-center shrink-0">Progress</span>
                      <div className="w-4" />
                    </div>
                    {filtered.map((p, i) => (
                      <ProjectRow key={p.id} project={p} index={i} onClick={() => navigate(`/projects/${p.id}`)} />
                    ))}
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: filtered.length * 0.04 }}
                      onClick={() => setShowNewProject(true)}
                      className="w-full flex items-center gap-3 bg-white rounded-xl border border-dashed border-black/10 px-5 py-3.5 hover:border-violet/30 hover:bg-violet/2 transition-all text-slate-muted hover:text-ink">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <span className="text-sm">New project</span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showNewProject && (
          <CreateProjectModal
            orgId={org?.id} userId={user?.id}
            onCreated={() => { setShowNewProject(false); loadAll() }}
            onClose={() => setShowNewProject(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
