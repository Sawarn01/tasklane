import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMyAllTasks, updateTaskPosition } from '../lib/data'
import { IssueTypeIcon, PriorityIcon, StatusBadge } from '../components/IssueIcons'

const STATUS_GROUPS = [
  { key: 'todo',        label: 'To Do',      accent: '#8A8F98' },
  { key: 'in_progress', label: 'In Progress', accent: '#6E56CF' },
  { key: 'review',      label: 'In Review',   accent: '#F59E0B' },
  { key: 'done',        label: 'Done',        accent: '#36D399' },
]

const PRIORITY_COLORS = {
  urgent: { text: 'text-red-500',    bg: 'bg-red-50',    label: 'Urgent' },
  high:   { text: 'text-amber-500',  bg: 'bg-amber-50',  label: 'High'   },
  medium: { text: 'text-violet',     bg: 'bg-violet/10', label: 'Medium' },
  low:    { text: 'text-slate-muted',bg: 'bg-paper-dim', label: 'Low'    },
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return diff
}

function DueDateBadge({ dueDate, status }) {
  if (!dueDate || status === 'done') return null
  const days = daysUntil(dueDate)
  const overdue = days < 0
  const today   = days === 0
  const soon    = days > 0 && days <= 3

  if (!overdue && !today && !soon) {
    return (
      <span className="text-[9px] font-mono text-slate-muted">
        {new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
    )
  }

  return (
    <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
      overdue ? 'bg-red-100 text-red-600' : today ? 'bg-amber-100 text-amber-600' : 'bg-orange-50 text-orange-500'
    }`}>
      {overdue ? `${Math.abs(days)}d overdue` : today ? 'Due today' : `${days}d left`}
    </span>
  )
}

function TaskRow({ task, onStatusChange, onOpen }) {
  const [changing, setChanging] = useState(false)

  async function handleStatusChange(status) {
    if (status === task.status) return
    setChanging(true)
    try {
      await updateTaskPosition({ taskId: task.id, status, position: 0, userId: null, projectId: task.project_id })
    } finally {
      setChanging(false)
      onStatusChange()
    }
  }

  const pri = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 px-4 py-2.5 border-b border-black/5 last:border-0 group hover:bg-paper-dim/40 transition-colors"
    >
      {/* Status toggle */}
      <div className="relative shrink-0">
        <select
          disabled={changing}
          value={task.status}
          onChange={e => handleStatusChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          className="appearance-none opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10"
        >
          {STATUS_GROUPS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <StatusBadge status={task.status} />
      </div>

      {/* Type icon */}
      <IssueTypeIcon type={task.issue_type || 'task'} size={13} />

      {/* Title — click to navigate to board */}
      <button
        onClick={() => onOpen(task)}
        className={`flex-1 text-sm text-left truncate transition-colors hover:text-violet ${
          task.status === 'done' ? 'line-through text-slate-muted' : 'text-ink'
        }`}
      >
        {task.title}
      </button>

      {/* Project pill */}
      <span className="text-[10px] font-mono bg-paper-dim text-slate-muted px-2 py-0.5 rounded-full shrink-0 max-w-[120px] truncate">
        {task.projects?.name}
      </span>

      {/* Due date */}
      <DueDateBadge dueDate={task.due_date} status={task.status} />

      {/* Priority */}
      <PriorityIcon priority={task.priority || 'medium'} size={11} />

      {/* Story points */}
      {task.story_points != null && (
        <span className="font-mono text-[10px] text-slate-muted shrink-0">{task.story_points}p</span>
      )}
    </motion.div>
  )
}

function StatusSection({ group, tasks, onStatusChange, onOpen, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-4 bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-paper-dim/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.accent }} />
        <span className="font-semibold text-sm text-ink">{group.label}</span>
        <span className="font-mono text-[10px] bg-paper-dim text-slate-muted px-1.5 py-0.5 rounded-full">{tasks.length}</span>
        <motion.svg
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          className="ml-auto text-slate-muted/50"
          width="10" height="10" viewBox="0 0 10 10" fill="none"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && tasks.length > 0 && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-black/5"
          >
            <AnimatePresence initial={false}>
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onOpen={onOpen} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        {open && tasks.length === 0 && (
          <div className="px-4 py-5 text-center border-t border-black/5">
            <p className="text-xs text-slate-muted">No issues here.</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MyWork() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filterPriority, setFilterPriority] = useState('')
  const [filterProject, setFilterProject]   = useState('')
  const [showDone, setShowDone] = useState(false)

  useEffect(() => { load() }, [user?.id])

  async function load() {
    if (!user?.id) return
    setLoading(true)
    try { setTasks(await getMyAllTasks(user.id)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const projects = [...new Map(tasks.map(t => [t.project_id, t.projects?.name])).entries()]
    .map(([id, name]) => ({ id, name }))

  function matches(task) {
    if (filterPriority && (task.priority || 'medium') !== filterPriority) return false
    if (filterProject && task.project_id !== filterProject) return false
    return true
  }

  const filtered   = tasks.filter(matches)
  const activeSections = showDone ? STATUS_GROUPS : STATUS_GROUPS.filter(g => g.key !== 'done')

  const overdue = filtered.filter(t => t.status !== 'done' && daysUntil(t.due_date) !== null && daysUntil(t.due_date) < 0)
  const today   = filtered.filter(t => t.status !== 'done' && daysUntil(t.due_date) === 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="font-mono text-xs uppercase tracking-wider text-slate-muted"
      >
        Loading your work…
      </motion.p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-muted hover:text-ink transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-ink">My Work</h1>
            <p className="text-xs text-slate-muted">
              {filtered.filter(t => t.status !== 'done').length} open · across {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filters */}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white"
            >
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white"
            >
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={() => setShowDone(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showDone ? 'bg-ink text-white border-ink' : 'border-black/10 text-slate-muted hover:text-ink'
              }`}
            >
              {showDone ? 'Hide done' : 'Show done'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Urgent / due alerts */}
        {(overdue.length > 0 || today.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-red-50 border border-red-200 rounded-2xl px-5 py-4"
          >
            <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.25" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4.5v3M7 9v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Attention needed
            </p>
            <div className="space-y-1.5">
              {[...overdue, ...today].map(task => (
                <div key={task.id} className="flex items-center gap-2 text-xs text-red-600">
                  <DueDateBadge dueDate={task.due_date} status={task.status} />
                  <span className="text-ink font-medium truncate">{task.title}</span>
                  <span className="text-slate-muted shrink-0">{task.projects?.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Status sections */}
        {activeSections.map((group, i) => (
          <StatusSection
            key={group.key}
            group={group}
            tasks={filtered.filter(t => t.status === group.key)}
            onStatusChange={load}
            onOpen={task => navigate(`/projects/${task.project_id}?task=${task.id}`)}
            defaultOpen={group.key !== 'done'}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-sage/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-7" stroke="#36D399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-sm font-medium text-ink">All clear!</p>
            <p className="text-xs text-slate-muted mt-1">No issues assigned to you{filterPriority || filterProject ? ' matching the current filters' : ''}.</p>
          </div>
        )}
      </div>
    </div>
  )
}
