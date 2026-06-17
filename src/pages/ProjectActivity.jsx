import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getProjectActivity } from '../lib/data'
import { formatActivity, formatTimeAgo } from '../lib/activityFormat'
import { supabase } from '../lib/supabase'

const FILTERS = ['All', 'Tasks', 'Sprints', 'Comments', 'Releases']

const ACTION_FILTER = {
  Tasks:    ['task_created', 'task_moved', 'task_assigned', 'task_unassigned', 'task_priority_changed', 'task_type_changed', 'task_estimate_changed', 'task_sprint_changed', 'task_version_changed', 'task_linked'],
  Sprints:  ['sprint_created', 'sprint_started', 'sprint_completed'],
  Comments: ['comment_added'],
  Releases: ['version_created', 'version_released', 'task_version_changed'],
}

const ACTION_META = {
  task_created:         { bg: 'bg-violet/10',  dot: 'bg-violet',      icon: <path d="M6 2v8M2 6h8" stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" /> },
  task_moved:           { bg: 'bg-amber-50',   dot: 'bg-amber-400',   icon: <path d="M1.5 6h9M7 2.5l4 3.5-4 3.5" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /> },
  task_assigned:        { bg: 'bg-sage/15',    dot: 'bg-sage',        icon: <><circle cx="5.5" cy="4" r="2.5" stroke="#36D399" strokeWidth="1.3" /><path d="M1 10c0-2 2-3.5 4.5-3.5" stroke="#36D399" strokeWidth="1.3" strokeLinecap="round" /><path d="M8 7.5l1.5 1.5 2.5-2.5" stroke="#36D399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></> },
  task_unassigned:      { bg: 'bg-paper-dim',  dot: 'bg-slate-300',   icon: <><circle cx="6" cy="4.5" r="2.5" stroke="#8A8F98" strokeWidth="1.3" /><path d="M2 11c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke="#8A8F98" strokeWidth="1.3" strokeLinecap="round" /></> },
  comment_added:        { bg: 'bg-blue-50',    dot: 'bg-blue-400',    icon: <><rect x="1" y="1.5" width="10" height="7" rx="1.5" stroke="#3B82F6" strokeWidth="1.3" fill="none" /><path d="M3.5 9.5L2 12l3-2" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></> },
  sprint_created:       { bg: 'bg-violet/10',  dot: 'bg-violet',      icon: <><rect x="1" y="1" width="10" height="10" rx="2" stroke="#6E56CF" strokeWidth="1.3" fill="none" /><path d="M3.5 6l2 2 3-3" stroke="#6E56CF" strokeWidth="1.3" strokeLinecap="round" /></> },
  sprint_started:       { bg: 'bg-sage/15',    dot: 'bg-sage',        icon: <path d="M3 2l7 4-7 4V2z" fill="#36D399" /> },
  sprint_completed:     { bg: 'bg-sage/15',    dot: 'bg-sage',        icon: <path d="M1.5 6l3 3 6-6" stroke="#36D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> },
  version_created:      { bg: 'bg-amber-50',   dot: 'bg-amber-400',   icon: <><circle cx="6" cy="6" r="4.5" stroke="#D97706" strokeWidth="1.3" fill="none" /><path d="M6 3.5V6.5L7.5 8" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round" /></> },
  version_released:     { bg: 'bg-sage/15',    dot: 'bg-sage',        icon: <><circle cx="6" cy="6" r="4.5" stroke="#36D399" strokeWidth="1.3" fill="none" /><path d="M4 6l1.5 1.5L8 4" stroke="#36D399" strokeWidth="1.4" strokeLinecap="round" /></> },
  task_linked:          { bg: 'bg-blue-50',    dot: 'bg-blue-400',    icon: <path d="M3.5 8.5a2 2 0 0 1 0-3l1-1a2 2 0 0 1 2.8 2.8l-.5.5M8.5 3.5a2 2 0 0 1 0 3l-1 1a2 2 0 0 1-2.8-2.8l.5-.5" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" /> },
  default:              { bg: 'bg-paper-dim',  dot: 'bg-slate-300',   icon: <circle cx="6" cy="6" r="2.5" fill="#8A8F98" /> },
}

function getActionMeta(action) {
  return ACTION_META[action] || ACTION_META.default
}

function groupByDate(entries) {
  const groups = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const entry of entries) {
    const d = new Date(entry.created_at)
    d.setHours(0, 0, 0, 0)
    let label
    if (d.getTime() === today.getTime()) label = 'Today'
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(entry)
  }
  return groups
}

function ActivityRow({ entry, index }) {
  const meta = getActionMeta(entry.action)
  const actorInitial = (entry.profiles?.full_name || 'U')[0].toUpperCase()
  const actorName = entry.profiles?.full_name || 'Someone'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="flex items-start gap-4 py-3.5 group"
    >
      {/* Actor avatar */}
      <div className="w-7 h-7 rounded-full bg-violet/15 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-violet">{actorInitial}</span>
      </div>

      {/* Event icon */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">{meta.icon}</svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm text-ink leading-relaxed">
          <span className="font-medium">{actorName}</span>{' '}
          {formatActivity(entry).replace(actorName, '').trim()}
        </p>
        <p className="text-[10px] text-slate-muted mt-0.5 font-mono">
          {formatTimeAgo(entry.created_at)} ·{' '}
          {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  )
}

export default function ProjectActivity() {
  const { projectId } = useParams()
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    loadActivity()
    const channel = supabase
      .channel(`activity-${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'activity_log',
        filter: `project_id=eq.${projectId}`,
      }, loadActivity)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [projectId])

  async function loadActivity() {
    try {
      const data = await getProjectActivity(projectId)
      setActivity(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'All'
    ? activity
    : activity.filter((e) => (ACTION_FILTER[filter] || []).includes(e.action))

  const groups = groupByDate(filtered)
  const groupLabels = Object.keys(groups)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="font-mono text-xs uppercase tracking-wider text-slate-muted"
        >
          Loading activity…
        </motion.p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-lg font-semibold text-ink">Activity</h2>
          <p className="text-sm text-slate-muted">All changes and events in this project</p>
        </motion.div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex gap-1 mb-6 bg-paper-dim rounded-xl p-1 w-fit"
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-150 font-medium relative ${
                filter === f ? 'text-ink' : 'text-slate-muted hover:text-ink/70'
              }`}
            >
              {filter === f && (
                <motion.div
                  layoutId="activity-tab"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                />
              )}
              <span className="relative z-10">{f}</span>
            </button>
          ))}
        </motion.div>

        {/* Activity feed */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center"
          >
            <div className="w-12 h-12 bg-paper-dim rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4v6l3 3" stroke="#8A8F98" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="10" cy="10" r="8" stroke="#8A8F98" strokeWidth="1.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">No activity yet</p>
            <p className="text-xs text-slate-muted mt-1">
              {filter === 'All' ? 'Actions will appear here as your team works.' : `No ${filter.toLowerCase()} events yet.`}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {groupLabels.map((label, gi) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.06 }}
              >
                {/* Date header */}
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-slate-muted font-semibold shrink-0">{label}</p>
                  <div className="flex-1 h-px bg-black/5" />
                </div>

                {/* Rows */}
                <div className="bg-white rounded-2xl border border-black/5 divide-y divide-black/5 px-5">
                  {groups[label].map((entry, i) => (
                    <ActivityRow key={entry.id} entry={entry} index={i} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
