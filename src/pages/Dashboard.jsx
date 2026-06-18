import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getMyOrg, createProject, createInvite,
  getProjectsWithStats, getMyAssignedTasks, getMyOrgActivity,
  getMyNotifications, markNotificationRead, markAllNotificationsRead,
  getOrgMembers, getProjectKey, getMyProfile,
} from '../lib/data'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'
import { formatActivity, formatTimeAgo } from '../lib/activityFormat'
import { IssueTypeIcon, PriorityIcon, StatusBadge } from '../components/IssueIcons'

// ── Animated counter ─────────────────────────────────────────
function AnimatedNumber({ value }) {
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 90, damping: 18 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    motionVal.set(value)
  }, [value])

  useEffect(() => {
    return spring.on('change', (v) => setDisplay(Math.round(v)))
  }, [spring])

  return <span>{display}</span>
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, icon, accent, delay = 0 }) {
  const colors = {
    violet: 'bg-violet/10 text-violet',
    sage: 'bg-sage/15 text-green-700',
    amber: 'bg-amber-100 text-amber-600',
    ink: 'bg-ink/8 text-ink',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="bg-white rounded-2xl border border-black/5 p-5 flex items-center gap-4"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[accent] || colors.violet}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-ink tracking-tight">
          <AnimatedNumber value={value} />
        </p>
        <p className="text-xs text-slate-muted mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

// ── Project card ──────────────────────────────────────────────
function ProjectCard({ project, index, onClick }) {
  const pct = project.totalTasks > 0
    ? Math.round((project.doneTasks / project.totalTasks) * 100)
    : 0
  const key = getProjectKey(project.name)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 + index * 0.06, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      onClick={onClick}
      className="bg-white rounded-2xl border border-black/5 p-5 cursor-pointer group hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-violet/10 flex items-center justify-center shrink-0">
          <span className="font-bold text-violet text-xs">{key}</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className="text-slate-muted/40 group-hover:text-violet transition-colors mt-0.5"
        >
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="font-semibold text-ink mb-1 truncate">{project.name}</h3>
      {project.description && (
        <p className="text-xs text-slate-muted mb-3 line-clamp-2">{project.description}</p>
      )}

      {/* Task breakdown */}
      <div className="flex gap-2 mb-3">
        {[
          { label: 'Todo', count: project.todoTasks, color: 'bg-slate-200' },
          { label: 'Progress', count: project.inProgressTasks, color: 'bg-violet/40' },
          { label: 'Done', count: project.doneTasks, color: 'bg-sage/60' },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
            <span className="text-[10px] text-slate-muted">{count}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-paper-dim rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: 0.3 + index * 0.06, ease: 'easeOut' }}
          className="h-full bg-sage rounded-full"
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-slate-muted">{project.totalTasks} issues</span>
        <span className="text-[10px] text-slate-muted font-mono">{pct}%</span>
      </div>
    </motion.div>
  )
}

// ── Notification destination helper ──────────────────────────
function notifDestination(n) {
  if (n.type === 'chat_message') return `/projects/${n.project_id}/chat`
  if (n.task_id) return `/projects/${n.project_id}?task=${n.task_id}`
  return `/projects/${n.project_id}`
}

// ── Notification panel ────────────────────────────────────────
function NotificationsPanel({ notifications, onSelect, onMarkAll, onClose }) {
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-xl border border-black/5 z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <p className="font-semibold text-sm text-ink">Notifications</p>
        {unread.length > 0 && (
          <button onClick={onMarkAll} className="text-[10px] text-violet hover:opacity-70 transition-opacity font-mono uppercase tracking-wide">
            Mark all read
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-muted">No notifications</p>
          </div>
        )}
        {notifications.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => { onSelect(n.id); navigate(notifDestination(n)) }}
            className={`px-4 py-3 border-b border-black/5 cursor-pointer hover:bg-paper-dim transition-colors ${!n.read ? 'bg-violet/3' : ''}`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-violet' : 'bg-transparent'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink leading-relaxed">
                  <span className="font-medium">{n.profiles?.full_name || 'Someone'}</span>{' '}
                  {n.message}
                </p>
                <p className="text-[10px] text-slate-muted mt-0.5 font-mono">{formatTimeAgo(n.created_at)}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Create project modal ──────────────────────────────────────
function CreateProjectModal({ orgId, userId, onCreated, onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      await createProject({ orgId, name: name.trim(), description: description.trim(), userId })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-ink mb-5">Create new project</h3>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Project name *</label>
            <input
              autoFocus required
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing website"
              className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="What is this project about?"
              className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet/30"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit" disabled={creating}
              className="flex-1 bg-violet text-white text-sm rounded-xl py-2.5 hover:bg-violet/90 disabled:opacity-50 transition-colors font-medium"
            >
              {creating ? 'Creating…' : 'Create project'}
            </button>
            <button type="button" onClick={onClose} className="px-4 text-sm text-slate-muted hover:text-ink transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Activity icon per action ──────────────────────────────────
function ActivityIcon({ action }) {
  const cfg = {
    task_created:     { bg: 'bg-violet/10',   icon: <path d="M6 1v10M1 6h10" stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" /> },
    task_moved:       { bg: 'bg-amber-50',     icon: <path d="M2 6h10M7 2l4 4-4 4" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> },
    task_assigned:    { bg: 'bg-sage/15',      icon: <path d="M6 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0 1c-2.8 0-5 1.1-5 2.5V11h10V9.5c0-1.4-2.2-2.5-5-2.5z" fill="#36D399" /> },
    comment_added:    { bg: 'bg-blue-50',      icon: <><path d="M1 2h10v7H7L4 11V9H1V2z" stroke="#3B82F6" strokeWidth="1.3" fill="none" /></> },
    sprint_started:   { bg: 'bg-sage/15',      icon: <path d="M3 2l8 4-8 4V2z" fill="#36D399" /> },
    sprint_completed: { bg: 'bg-violet/10',    icon: <path d="M2 7l3 3 5-6" stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> },
    version_released: { bg: 'bg-amber-50',     icon: <><circle cx="6" cy="6" r="5" stroke="#D97706" strokeWidth="1.3" fill="none" /><path d="M6 3v3.5L8 8" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round" /></> },
    default:          { bg: 'bg-paper-dim',    icon: <circle cx="6" cy="6" r="2.5" fill="#8A8F98" /> },
  }
  const { bg, icon } = cfg[action] || cfg.default
  return (
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">{icon}</svg>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [org, setOrg]               = useState(null)
  const [role, setRole]             = useState(null)
  const [profile, setProfile]       = useState(null)
  const [projects, setProjects]     = useState([])
  const [myTasks, setMyTasks]       = useState([])
  const [activity, setActivity]     = useState([])
  const [orgMembers, setOrgMembers] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [showNewProject, setShowNewProject] = useState(false)
  const [showNotifs, setShowNotifs]         = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef(null)
  const [inviteLink, setInviteLink]         = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copySuccess, setCopySuccess]           = useState(false)

  const notifsRef = useRef(null)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    function handleClick(e) {
      if (notifsRef.current && !notifsRef.current.contains(e.target)) {
        setShowNotifs(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Real-time: prepend incoming notifications so the badge updates live
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`dashboard-notifs-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const { data: notif } = await supabase
            .from('notifications')
            .select('*, profiles!notifications_actor_id_fkey(full_name)')
            .eq('id', payload.new.id)
            .single()
          if (notif) setNotifications((prev) => [notif, ...prev])
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const { org, role } = await getMyOrg()
      setOrg(org)
      setRole(role)

      const [profileRes, projectStats, tasks, act, members, notifs] = await Promise.allSettled([
        getMyProfile(user.id),
        getProjectsWithStats(org.id),
        getMyAssignedTasks(user.id),
        getMyOrgActivity(),
        getOrgMembers(org.id),
        getMyNotifications(),
      ])

      if (profileRes.status === 'fulfilled') setProfile(profileRes.value)
      if (projectStats.status === 'fulfilled') setProjects(projectStats.value)
      if (tasks.status === 'fulfilled') setMyTasks(tasks.value)
      if (act.status === 'fulfilled') setActivity(act.value)
      if (members.status === 'fulfilled') setOrgMembers(members.value)
      if (notifs.status === 'fulfilled') setNotifications(notifs.value)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateInvite() {
    setGeneratingInvite(true)
    try {
      const invite = await createInvite({ orgId: org.id, createdBy: user.id })
      setInviteLink(`${window.location.origin}/signup?invite=${invite.token}`)
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

  async function handleMarkRead(id) {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  async function handleMarkAll() {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.read).length
  const totalTasks  = projects.reduce((s, p) => s + p.totalTasks, 0)
  const openTasks   = projects.reduce((s, p) => s + p.todoTasks + p.inProgressTasks, 0)
  const greeting    = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-7 h-7 bg-ink rounded-xl flex items-center justify-center">
            <div className="w-3 h-3 bg-violet rounded-sm" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-muted">Loading workspace…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-paper">
      {/* ── Sidebar ────────────────────────────────────────── */}
      <motion.aside
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-56 bg-white border-r border-black/5 flex flex-col shrink-0 h-screen sticky top-0"
      >
        {/* ── Logo ─────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center shrink-0">
              <div className="w-3 h-3 bg-violet rounded-sm" />
            </div>
            <span className="font-bold text-ink text-[15px] tracking-tight">Tasklane</span>
          </div>
        </div>

        {/* ── Workspace block ───────────────────────────── */}
        <div className="mx-3 mb-3">
          <button
            onClick={() => (role === 'owner' || role === 'admin') && navigate('/org/settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-paper-dim transition-colors text-left group ${(role === 'owner' || role === 'admin') ? 'hover:bg-paper-dim/80 cursor-pointer' : 'cursor-default'}`}
          >
            <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">{(org?.name || 'W')[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate leading-tight">{org?.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-violet">{org?.plan}</span>
                <span className="text-slate-muted/40 text-[9px]">·</span>
                <span className="text-[9px] text-slate-muted capitalize">{role}</span>
              </div>
            </div>
            {(role === 'owner' || role === 'admin') && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-slate-muted/30 group-hover:text-slate-muted/60 transition-colors shrink-0">
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Divider ───────────────────────────────────── */}
        <div className="mx-5 border-t border-black/5 mb-3" />

        {/* ── Invite (admin/owner only) ─────────────────── */}
        {(role === 'owner' || role === 'admin') && (
          <div className="px-3 mb-1">
            {!inviteLink ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleGenerateInvite}
                disabled={generatingInvite}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-muted hover:text-ink hover:bg-paper-dim transition-colors disabled:opacity-50 text-left"
              >
                <div className="w-5 h-5 rounded-md bg-paper-dim flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="4" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M7.5 6.5l2 2M7 5h2.5M8.2 3.8v2.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                </div>
                {generatingInvite ? 'Generating…' : 'Invite teammate'}
              </motion.button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-violet/5 border border-violet/10 rounded-xl p-2.5"
              >
                <p className="font-mono text-[9px] text-violet/70 uppercase tracking-wide mb-1.5">Invite link · 1 use</p>
                <div className="flex gap-1.5">
                  <input
                    readOnly value={inviteLink}
                    onClick={(e) => e.target.select()}
                    className="flex-1 text-[10px] bg-white rounded-lg px-2 py-1.5 border border-black/5 truncate focus:outline-none text-ink"
                  />
                  <button
                    onClick={handleCopyInvite}
                    className="text-[10px] bg-violet text-white rounded-lg px-2 py-1.5 shrink-0 hover:bg-violet/90 transition-colors font-medium"
                  >
                    {copySuccess ? '✓' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => setInviteLink('')} className="text-[9px] text-slate-muted hover:text-ink mt-1.5 transition-colors">
                  Generate new link
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* ── Projects ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-1">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-muted/70 font-semibold select-none">
              Projects
            </p>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowNewProject(true)}
              className="w-5 h-5 rounded-md hover:bg-paper-dim flex items-center justify-center transition-colors text-slate-muted hover:text-ink"
              title="New project"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </motion.button>
          </div>

          <nav className="space-y-0.5">
            <AnimatePresence initial={false}>
              {projects.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.035, duration: 0.22 }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-paper-dim transition-colors text-left group"
                >
                  {/* Color dot */}
                  <div className="w-5 h-5 rounded-md bg-violet/10 flex items-center justify-center shrink-0">
                    <span className="text-[8px] font-bold text-violet leading-none">{getProjectKey(p.name).slice(0, 2)}</span>
                  </div>
                  <span className="flex-1 truncate text-[13px] text-ink/80 group-hover:text-ink transition-colors">{p.name}</span>
                  {/* Task count badge — appears on hover */}
                  {p.totalTasks > 0 && (
                    <span className="text-[9px] font-mono text-slate-muted/50 opacity-0 group-hover:opacity-100 transition-opacity bg-paper-dim rounded px-1 py-0.5">
                      {p.totalTasks}
                    </span>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>

            {projects.length === 0 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowNewProject(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-dashed border-black/10 text-slate-muted hover:text-ink hover:border-violet/30 hover:bg-violet/2 transition-all text-left"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span className="text-xs">Create first project</span>
              </motion.button>
            )}

            {/* New project shortcut at bottom of list */}
            {projects.length > 0 && (
              <button
                onClick={() => setShowNewProject(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-slate-muted/50 hover:text-slate-muted hover:bg-paper-dim transition-colors text-left"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="text-xs">New project</span>
              </button>
            )}
          </nav>
        </div>

        {/* ── User footer ───────────────────────────────── */}
        <div className="border-t border-black/5 px-3 py-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-paper-dim transition-colors text-left group"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-black/6 shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-violet/15 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-violet">
                    {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-ink truncate leading-tight">{profile?.full_name || user?.email}</p>
              <p className="text-[10px] text-slate-muted truncate">{user?.email}</p>
            </div>
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className="text-slate-muted/30 group-hover:text-slate-muted/60 transition-colors shrink-0"
            >
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </motion.button>
        </div>
      </motion.aside>

      {/* ── Main area ──────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-black/5 px-8 py-3 flex items-center justify-between"
        >
          <div>
            <h1 className="text-sm font-semibold text-ink">
              {greeting()}, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'} 👋
            </h1>
            <p className="text-[11px] text-slate-muted">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications bell */}
            <div ref={notifsRef} className="relative">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setShowNotifs((v) => !v)}
                className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-paper-dim transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9V6a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-violet text-white rounded-full text-[9px] flex items-center justify-center font-bold"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
              <AnimatePresence>
                {showNotifs && (
                  <NotificationsPanel
                    notifications={notifications}
                    onSelect={(id) => { handleMarkRead(id); setShowNotifs(false) }}
                    onMarkAll={handleMarkAll}
                    onClose={() => setShowNotifs(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Profile avatar + dropdown */}
            <div ref={profileMenuRef} className="relative">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setShowProfileMenu((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-paper-dim transition-colors"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-black/5 shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-violet/15 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-violet">
                        {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {/* Name */}
                <span className="text-xs font-medium text-ink hidden sm:block max-w-24 truncate">
                  {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
                </span>
                <motion.svg
                  animate={{ rotate: showProfileMenu ? 180 : 0 }}
                  transition={{ duration: 0.15 }}
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className="text-slate-muted hidden sm:block"
                >
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </motion.svg>
              </motion.button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-56 bg-white rounded-2xl shadow-xl border border-black/5 z-50 overflow-hidden"
                  >
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-black/5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-black/5 shrink-0">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-violet/15 flex items-center justify-center">
                            <span className="text-sm font-bold text-violet">
                              {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{profile?.full_name || 'You'}</p>
                        <p className="text-[10px] text-slate-muted truncate">{user?.email}</p>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      {[
                        {
                          label: 'My profile',
                          onClick: () => { setShowProfileMenu(false); navigate('/profile') },
                          icon: <path d="M6 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0 1c-2.8 0-5 1.1-5 2.5V11h10V9.5c0-1.4-2.2-2.5-5-2.5z" fill="currentColor" />,
                        },
                        ...(role === 'owner' || role === 'admin' ? [{
                          label: 'Org settings',
                          onClick: () => { setShowProfileMenu(false); navigate('/org/settings') },
                          icon: <><circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" /><path d="M6 1v1M6 10v1M1 6h1M10 6h1M2.1 2.1l.7.7M9.2 9.2l.7.7M9.2 2.8l-.7.7M2.8 9.2l-.7.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></>,
                          fill: false,
                        }] : []),
                        {
                          label: 'Billing',
                          onClick: () => { setShowProfileMenu(false); navigate('/billing') },
                          icon: <><rect x="1" y="2.5" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M1 5.5h10" stroke="currentColor" strokeWidth="1.2" /><rect x="2.5" y="7" width="2.5" height="1.2" rx="0.5" fill="currentColor" /></>,
                          fill: false,
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={item.onClick}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-paper-dim transition-colors text-left"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-muted shrink-0">
                            {item.icon}
                          </svg>
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-black/5 py-1.5">
                      <button
                        onClick={async () => { setShowProfileMenu(false); await signOut(); navigate('/login') }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                          <path d="M4.5 6H11M8.5 3.5L11 6l-2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M7 1.5H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        Log out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
            >
              {error}
            </motion.div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total projects" value={projects.length} accent="violet" delay={0.05}
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1.5" fill="currentColor" /><rect x="8.5" y="2" width="5.5" height="5.5" rx="1.5" fill="currentColor" /><rect x="2" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" /><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" /></svg>}
            />
            <StatCard
              label="Open issues" value={openTasks} accent="amber" delay={0.1}
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" /><path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
            />
            <StatCard
              label="Team members" value={orgMembers.length} accent="sage" delay={0.15}
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" /><path d="M1 13c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M11 7c1.5 0 3 .9 3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="12" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3" /></svg>}
            />
            <StatCard
              label="Issues closed" value={projects.reduce((s, p) => s + p.doneTasks, 0)} accent="ink" delay={0.2}
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M5 8l2.5 2.5L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            />
          </div>

          {/* My tasks + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* My assigned tasks */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="lg:col-span-3 bg-white rounded-2xl border border-black/5 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
                <p className="font-semibold text-sm text-ink">My open tasks</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-slate-muted uppercase tracking-wide">{myTasks.length} issues</span>
                  <button
                    onClick={() => navigate('/my-work')}
                    className="text-[10px] text-violet hover:text-violet/70 font-medium transition-colors"
                  >
                    View all →
                  </button>
                </div>
              </div>
              <div className="divide-y divide-black/5">
                {myTasks.length === 0 && (
                  <div className="py-10 flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-paper-dim rounded-2xl flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M3 9l3.5 3.5L15 5" stroke="#36D399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-ink">All caught up!</p>
                    <p className="text-xs text-slate-muted">No open tasks assigned to you.</p>
                  </div>
                )}
                <AnimatePresence>
                  {myTasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-paper-dim/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projects/${task.project_id}`)}
                    >
                      <IssueTypeIcon type={task.issue_type || 'task'} size={14} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{task.title}</p>
                        <p className="text-[10px] text-slate-muted mt-0.5">{task.projects?.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.story_points && (
                          <span className="font-mono text-[9px] bg-violet/8 text-violet px-1.5 py-0.5 rounded">
                            {task.story_points}
                          </span>
                        )}
                        <PriorityIcon priority={task.priority || 'medium'} size={12} />
                        <StatusBadge status={task.status} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Recent activity */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="lg:col-span-2 bg-white rounded-2xl border border-black/5 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-black/5">
                <p className="font-semibold text-sm text-ink">Recent activity</p>
              </div>
              <div className="divide-y divide-black/5 max-h-80 overflow-y-auto">
                {activity.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-muted">No activity yet.</p>
                  </div>
                )}
                {activity.slice(0, 12).map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.03 }}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <ActivityIcon action={entry.action} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink leading-relaxed line-clamp-2">{formatActivity(entry)}</p>
                      <p className="text-[9px] text-slate-muted mt-0.5 font-mono">
                        {entry.projects?.name} · {formatTimeAgo(entry.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Team members */}
          {orgMembers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="bg-white rounded-2xl border border-black/5 px-5 py-4"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-sm text-ink">Team</p>
                <span className="font-mono text-[10px] text-slate-muted uppercase tracking-wide">{orgMembers.length} members</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {orgMembers.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.04 }}
                    className="flex items-center gap-2 bg-paper-dim rounded-xl px-3 py-1.5"
                    title={m.full_name}
                  >
                    <div className="w-5 h-5 rounded-full bg-violet/15 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-violet">{(m.full_name || 'U')[0].toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-ink">{m.full_name}</span>
                    {m.role !== 'member' && (
                      <span className="text-[9px] font-mono text-slate-muted capitalize">{m.role}</span>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Projects grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink">Projects</h2>
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-1.5 text-sm text-violet hover:opacity-70 transition-opacity"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                New project
              </button>
            </div>
            {projects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-dashed border-black/10 p-10 text-center"
              >
                <div className="w-12 h-12 bg-paper-dim rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="2" y="2" width="8" height="8" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                    <rect x="12" y="2" width="8" height="8" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                    <rect x="2" y="12" width="8" height="8" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                    <rect x="12" y="12" width="8" height="8" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
                  </svg>
                </div>
                <p className="font-semibold text-ink mb-1">Create your first project</p>
                <p className="text-sm text-slate-muted mb-4">Organize your team's work into focused projects.</p>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="bg-violet text-white text-sm rounded-xl px-5 py-2.5 hover:bg-violet/90 transition-colors"
                >
                  Create project
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  />
                ))}
                {/* New project tile */}
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + projects.length * 0.06 }}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  onClick={() => setShowNewProject(true)}
                  className="bg-white rounded-2xl border border-dashed border-black/10 p-5 flex flex-col items-center justify-center gap-2 hover:border-violet/30 hover:bg-violet/2 transition-all min-h-36"
                >
                  <div className="w-10 h-10 rounded-xl border-2 border-dashed border-black/10 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v12M2 8h12" stroke="#8A8F98" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-muted">New project</p>
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showNewProject && (
          <CreateProjectModal
            orgId={org?.id}
            userId={user?.id}
            onCreated={() => { setShowNewProject(false); loadAll() }}
            onClose={() => setShowNewProject(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
