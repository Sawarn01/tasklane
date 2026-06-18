import { useState, useEffect, useRef } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getMyOrg, getMyProjects, getProject, getProjectKey,
  getMyNotifications, markNotificationRead, markAllNotificationsRead,
  createTask, getProjectMembers,
} from '../lib/data'
import { IssueTypeIcon } from '../components/IssueIcons'
import { supabase } from '../lib/supabase'
import GlobalSearch from '../components/GlobalSearch'
import KbdShortcutsModal from '../components/KbdShortcutsModal'
import { FocusModeProvider, useFocus } from '../components/FocusMode'
import { formatTimeAgo } from '../lib/activityFormat'

// ── Nav config ───────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    group: 'Overview',
    items: [
      { key: 'home',     label: 'Home',     path: '/home',     icon: HomeIcon },
    ],
  },
  {
    group: 'Planning',
    items: [
      { key: 'board',    label: 'Board',    path: '',          icon: BoardIcon },
      { key: 'backlog',  label: 'Backlog',  path: '/backlog',  icon: BacklogIcon },
      { key: 'timeline', label: 'Timeline', path: '/timeline', icon: TimelineIcon },
    ],
  },
  {
    group: 'Collaborate',
    items: [
      { key: 'chat',     label: 'Chat',     path: '/chat',     icon: ChatIcon },
      { key: 'activity', label: 'Activity', path: '/activity', icon: ActivityIcon },
      { key: 'members',  label: 'Members',  path: '/members',  icon: MembersIcon },
    ],
  },
  {
    group: 'Reporting',
    items: [
      { key: 'reports',  label: 'Reports',  path: '/reports',  icon: ReportsIcon },
    ],
  },
  {
    group: 'Project',
    items: [
      { key: 'releases', label: 'Releases', path: '/releases', icon: ReleasesIcon },
      { key: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
    ],
  },
]

// ── Icons ────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 6.5L7 1.5l6 5V13H9V9H5v4H1V6.5z" fill="currentColor" opacity="0.7" />
    </svg>
  )
}
function MembersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="5" cy="4.5" r="2.5" fill="currentColor" opacity="0.7" />
      <path d="M1 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.7" />
      <circle cx="10" cy="4.5" r="1.8" fill="currentColor" opacity="0.4" />
      <path d="M11.5 10.5c0-1.4-.8-2.5-1.8-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.4" />
    </svg>
  )
}
function BoardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.4" />
    </svg>
  )
}
function BacklogIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2"   width="12" height="1.5" rx="0.75" fill="currentColor" opacity="0.8" />
      <rect x="1" y="5.5" width="12" height="1.5" rx="0.75" fill="currentColor" opacity="0.6" />
      <rect x="1" y="9"   width="8"  height="1.5" rx="0.75" fill="currentColor" opacity="0.4" />
    </svg>
  )
}
function TimelineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2.5" width="7" height="2" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="4" y="6"   width="9" height="2" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="2" y="9.5" width="6" height="2" rx="1" fill="currentColor" opacity="0.4" />
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M12 2.5H2a1 1 0 0 0-1 1V9a1 1 0 0 0 1 1h3l3 2.5V10h4a1 1 0 0 0 1-1V3.5a1 1 0 0 0-1-1z"
        stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"
      />
    </svg>
  )
}
function ActivityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 7h2.5l1.5-3.5 2 7 2-4.5L10.5 8H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  )
}
function ReportsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1"   y="8" width="2.5" height="5"  rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="5.25" y="5" width="2.5" height="8"  rx="0.5" fill="currentColor" opacity="0.7" />
      <rect x="9.5" y="2" width="2.5" height="11" rx="0.5" fill="currentColor" opacity="0.9" />
    </svg>
  )
}
function ReleasesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
      <path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M11.07 2.93l-1.06 1.06M3.99 10.01l-1.06 1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}
function ChevronIcon({ open }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Notification destination helper ─────────────────────────────
function notifDestination(n) {
  if (n.type === 'chat_message') return `/projects/${n.project_id}/chat`
  if (n.task_id) return `/projects/${n.project_id}?task=${n.task_id}`
  return `/projects/${n.project_id}`
}

// ── Notification dropdown ────────────────────────────────────────
function NotifDropdown({ notifications, onSelect, onMarkAll }) {
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read)
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-black/8 z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <p className="font-semibold text-sm text-ink">Notifications</p>
        {unread.length > 0 && (
          <button
            onClick={onMarkAll}
            className="text-[10px] text-violet hover:opacity-70 font-mono uppercase tracking-wide transition-opacity"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-black/5">
        {notifications.length === 0 && (
          <div className="py-10 text-center">
            <div className="w-9 h-9 bg-paper-dim rounded-xl flex items-center justify-center mx-auto mb-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9V6a5 5 0 0 1 5-5z" stroke="#8A8F98" strokeWidth="1.3" />
                <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="#8A8F98" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-slate-muted">All caught up!</p>
            <p className="text-xs text-slate-muted/60 mt-0.5">No notifications yet</p>
          </div>
        )}
        {notifications.map((n, i) => (
          <motion.button
            key={n.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => { onSelect(n.id); navigate(notifDestination(n)) }}
            className={`w-full text-left px-4 py-3 hover:bg-paper-dim transition-colors ${!n.read ? 'bg-violet/3' : ''}`}
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
          </motion.button>
        ))}
      </div>
      <button
        onClick={() => navigate('/notifications')}
        className="w-full py-2.5 text-center text-[11px] font-mono text-slate-muted hover:text-violet transition-colors border-t border-black/5"
      >
        View all notifications →
      </button>
    </motion.div>
  )
}

// ── Layout ────────────────────────────────────────────────────────
export default function ProjectLayout() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const [sidebarOpen, setSidebarOpen]           = useState(true)
  const [project, setProject]                   = useState(null)
  const [org, setOrg]                           = useState(null)
  const [projects, setProjects]                 = useState([])
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false)
  const [showSearch, setShowSearch]             = useState(false)
  const [showKbd, setShowKbd]                   = useState(false)
  const [notifications, setNotifications]       = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)
  // ── Quick create ────────────────────────────────────────────────
  const [showQuickCreate, setShowQuickCreate]   = useState(false)
  const [qcTitle, setQcTitle]                   = useState('')
  const [qcType, setQcType]                     = useState('task')
  const [qcPriority, setQcPriority]             = useState('medium')
  const [qcAssignee, setQcAssignee]             = useState('')
  const [qcCreating, setQcCreating]             = useState(false)
  const [qcMembers, setQcMembers]               = useState([])

  useEffect(() => {
    getProject(projectId).then(setProject).catch(() => {})
    getMyOrg()
      .then(({ org }) => { setOrg(org); return getMyProjects(org.id) })
      .then(setProjects)
      .catch(() => {})
    getMyNotifications().then(setNotifications).catch(() => {})
  }, [projectId])

  useEffect(() => {
    function handler(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Real-time: prepend new notifications as they arrive so the badge updates instantly
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifs-${user.id}`)
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

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault(); setShowKbd((v) => !v)
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault(); openQuickCreate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function openQuickCreate() {
    setQcTitle(''); setQcType('task'); setQcPriority('medium'); setQcAssignee('')
    setShowQuickCreate(true)
    if (!qcMembers.length) getProjectMembers(projectId).then(setQcMembers).catch(() => {})
  }

  async function handleQuickCreate(e) {
    e?.preventDefault()
    if (!qcTitle.trim() || qcCreating) return
    setQcCreating(true)
    try {
      await createTask({
        projectId,
        title: qcTitle.trim(),
        userId: user.id,
        status: 'todo',
        issueType: qcType,
        priority: qcPriority,
        assigneeId: qcAssignee || null,
      })
      setShowQuickCreate(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setQcCreating(false)
    }
  }

  const currentPath = location.pathname.replace(`/projects/${projectId}`, '') || ''

  function isActive(path) {
    if (path === '') return currentPath === '' || currentPath === '/'
    return currentPath.startsWith(path)
  }

  const projectKey   = project ? getProjectKey(project.name) : '...'
  const unreadCount  = notifications.filter((n) => !n.read).length
  const currentLabel = NAV_ITEMS.flatMap((g) => g.items).find((item) => isActive(item.path))?.label || ''

  function handleMarkRead(id) {
    markNotificationRead(id).catch(() => {})
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }
  function handleMarkAll() {
    markAllNotificationsRead().catch(() => {})
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <FocusModeProvider>
    <div className="flex h-screen bg-paper overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 220 : 52 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 bg-white border-r border-black/5 flex flex-col overflow-hidden relative z-10"
      >
        {/* Header — layout flips between horizontal (open) and vertical (closed) */}
        <AnimatePresence mode="wait" initial={false}>
          {sidebarOpen ? (
            <motion.div
              key="h-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex items-center gap-2 px-3 py-3.5 border-b border-black/5 shrink-0"
            >
              <button
                onClick={() => navigate('/dashboard')}
                title="Dashboard"
                className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
              >
                <div className="w-2.5 h-2.5 bg-violet rounded-sm" />
              </button>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-semibold text-ink truncate leading-none">{org?.name || 'Workspace'}</p>
                <p className="font-mono text-[9px] text-slate-muted uppercase tracking-wider">{org?.plan}</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-muted hover:text-ink hover:bg-paper-dim transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="h-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex flex-col items-center py-3 border-b border-black/5 gap-2 shrink-0"
            >
              <button
                onClick={() => navigate('/dashboard')}
                title="Dashboard"
                className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <div className="w-2.5 h-2.5 bg-violet rounded-sm" />
              </button>
              {/* Expand button — always visible when collapsed */}
              <button
                onClick={() => setSidebarOpen(true)}
                title="Expand sidebar"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-muted hover:text-ink hover:bg-paper-dim transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="px-2 py-2 border-b border-black/5 shrink-0">
          <button
            onClick={() => setShowSearch(true)}
            title={!sidebarOpen ? 'Search  ⌘K' : undefined}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-muted hover:text-ink hover:bg-paper-dim transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="text-xs flex-1 text-left"
                >
                  Search <span className="text-[10px] opacity-50 font-mono ml-1">⌘K</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Project switcher */}
        <div className="px-2 py-2 border-b border-black/5 shrink-0">
          <button
            onClick={() => sidebarOpen && setShowProjectSwitcher(!showProjectSwitcher)}
            title={!sidebarOpen ? (project?.name || 'Switch project') : undefined}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-dim transition-colors"
          >
            <div className="w-5 h-5 bg-violet/15 rounded flex items-center justify-center shrink-0">
              <span className="font-mono text-[8px] font-bold text-violet">{projectKey.slice(0, 2)}</span>
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0 flex items-center justify-between"
                >
                  <span className="text-xs font-medium text-ink truncate">{project?.name || 'Project'}</span>
                  <ChevronIcon open={showProjectSwitcher} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <AnimatePresence>
            {showProjectSwitcher && sidebarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden mt-1"
              >
                <div className="bg-paper-dim rounded-lg p-1 space-y-0.5">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { navigate(`/projects/${p.id}`); setShowProjectSwitcher(false) }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors truncate ${
                        p.id === projectId ? 'bg-violet/10 text-violet font-medium' : 'text-ink hover:bg-white'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full text-left text-xs px-2 py-1.5 rounded-md text-slate-muted hover:bg-white transition-colors"
                  >
                    All projects →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {NAV_ITEMS.map((group) => (
            <div key={group.group} className="mb-3">
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="font-mono text-[9px] font-semibold text-slate-muted uppercase tracking-wider px-2 mb-1"
                  >
                    {group.group}
                  </motion.p>
                )}
              </AnimatePresence>
              {group.items.map((item) => {
                const active = isActive(item.path)
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(`/projects/${projectId}${item.path}`)}
                    title={!sidebarOpen ? item.label : undefined}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors mb-0.5 relative ${
                      active
                        ? 'bg-violet/10 text-violet'
                        : 'text-slate-muted hover:text-ink hover:bg-paper-dim'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-violet/10 rounded-lg"
                        transition={{ duration: 0.15 }}
                      />
                    )}
                    <span className="relative z-10 shrink-0">
                      <item.icon />
                    </span>
                    <AnimatePresence>
                      {sidebarOpen && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className="relative z-10 text-xs font-medium"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: back to all projects */}
        <div className="px-2 py-3 border-t border-black/5 shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            title={!sidebarOpen ? 'All projects' : undefined}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-muted hover:text-ink hover:bg-paper-dim transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <path d="M2 7h10M2 7l3.5-3.5M2 7l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs"
                >
                  All projects
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="h-11 border-b border-black/5 bg-white flex items-center px-4 gap-2 shrink-0">

          {/* Breadcrumb */}
          <button
            onClick={() => navigate('/dashboard')}
            title="All projects"
            className="shrink-0 text-slate-muted/60 hover:text-ink transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.35" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.35" />
            </svg>
          </button>
          <span className="text-slate-muted/30 text-xs shrink-0">/</span>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="font-medium text-ink text-sm truncate max-w-32.5 hover:text-violet transition-colors"
          >
            {project?.name || projectKey}
          </button>
          {currentLabel && (
            <>
              <span className="text-slate-muted/30 text-xs shrink-0">/</span>
              <span className="text-xs text-slate-muted shrink-0">{currentLabel}</span>
            </>
          )}

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1.5">

            {/* Quick create */}
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={openQuickCreate}
              title="Create issue  C"
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-paper-dim transition-colors text-slate-muted hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.button>

            {/* Notifications bell */}
            <div ref={notifRef} className="relative">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setShowNotifications((v) => !v)}
                title="Notifications"
                className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-paper-dim transition-colors text-slate-muted hover:text-ink"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 1a4.5 4.5 0 0 1 4.5 4.5V9l1.5 2H1.5L3 9V5.5A4.5 4.5 0 0 1 7.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M6 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-violet text-white rounded-full text-[8px] flex items-center justify-center font-bold px-0.5"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
              <AnimatePresence>
                {showNotifications && (
                  <NotifDropdown
                    notifications={notifications}
                    onSelect={(id) => { handleMarkRead(id); setShowNotifications(false) }}
                    onMarkAll={handleMarkAll}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Search shortcut */}
            <button
              onClick={() => setShowSearch(true)}
              title="Search  ⌘K"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/10 text-slate-muted hover:text-ink hover:border-black/20 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M7.5 7.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] font-mono opacity-60">⌘K</span>
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>

      {/* Global search overlay */}
      <AnimatePresence>
        {showSearch && (
          <GlobalSearch onClose={() => setShowSearch(false)} projectId={projectId} />
        )}
      </AnimatePresence>

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showKbd && <KbdShortcutsModal onClose={() => setShowKbd(false)} />}
      </AnimatePresence>

      {/* ── Quick create dialog ──────────────────────────────────── */}
      <AnimatePresence>
        {showQuickCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
              onClick={() => setShowQuickCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <form
                onSubmit={handleQuickCreate}
                className="bg-white rounded-2xl shadow-2xl border border-black/5 overflow-hidden"
              >
                {/* Type + title row */}
                <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                  <select
                    value={qcType}
                    onChange={e => setQcType(e.target.value)}
                    className="text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white shrink-0 focus:outline-none focus:ring-2 focus:ring-violet/30"
                  >
                    {['task','bug','story','epic','subtask'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <input
                    autoFocus
                    value={qcTitle}
                    onChange={e => setQcTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setShowQuickCreate(false) }}
                    placeholder="Issue title…"
                    className="flex-1 text-sm font-medium text-ink bg-transparent focus:outline-none placeholder:text-slate-muted/50"
                  />
                </div>

                {/* Options row */}
                <div className="flex items-center gap-2 px-4 pb-4 border-b border-black/5">
                  <select
                    value={qcPriority}
                    onChange={e => setQcPriority(e.target.value)}
                    className="text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet/30"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  {qcMembers.length > 0 && (
                    <select
                      value={qcAssignee}
                      onChange={e => setQcAssignee(e.target.value)}
                      className="text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet/30"
                    >
                      <option value="">Unassigned</option>
                      {qcMembers.map(m => <option key={m.id} value={m.id}>{m.full_name || m.id}</option>)}
                    </select>
                  )}
                  <span className="text-[10px] text-slate-muted ml-1">will be added to backlog</span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[10px] font-mono text-slate-muted/50">
                    <kbd className="bg-paper-dim px-1.5 py-0.5 rounded text-[9px]">↵</kbd> create
                    <span className="mx-2">·</span>
                    <kbd className="bg-paper-dim px-1.5 py-0.5 rounded text-[9px]">Esc</kbd> cancel
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={!qcTitle.trim() || qcCreating}
                    className="text-xs bg-violet text-white rounded-xl px-4 py-2 font-medium hover:bg-violet/90 transition-colors disabled:opacity-40"
                  >
                    {qcCreating ? 'Creating…' : 'Create issue'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </FocusModeProvider>
  )
}
