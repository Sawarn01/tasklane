import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getTasks, getProjectMembers, getProject, getProjectKey } from '../lib/data'
import TaskDetailPanel from './TaskDetailPanel'

const STATUS_COLORS = {
  todo:        '#8A8F98',
  in_progress: '#6E56CF',
  review:      '#F59E0B',
  done:        '#36D399',
}

const ZOOM_LEVELS = [
  { label: 'Day',     days: 14,  cellW: 60,  fmt: (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
  { label: 'Week',    days: 60,  cellW: 90,  fmt: (d) => `W${getWeek(d)} ${d.getFullYear()}` },
  { label: 'Month',   days: 180, cellW: 120, fmt: (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
  { label: 'Quarter', days: 365, cellW: 180, fmt: (d) => `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}` },
]

function getWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
}

function getDaysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

function getHeaderCells(startDate, zoomLevel) {
  const { days, cellW, fmt } = zoomLevel
  const cells = []
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)

  if (zoomLevel.label === 'Day') {
    for (let i = 0; i < days; i++) {
      cells.push({ label: fmt(current), date: new Date(current), width: cellW })
      current.setDate(current.getDate() + 1)
    }
  } else if (zoomLevel.label === 'Week') {
    // Group by week
    const seen = new Set()
    for (let i = 0; i < days; i++) {
      const key = `${current.getFullYear()}-W${getWeek(current)}`
      if (!seen.has(key)) {
        seen.add(key)
        cells.push({ label: fmt(current), date: new Date(current), width: cellW })
      }
      current.setDate(current.getDate() + 1)
    }
  } else if (zoomLevel.label === 'Month') {
    const seen = new Set()
    for (let i = 0; i < days; i++) {
      const key = `${current.getFullYear()}-${current.getMonth()}`
      if (!seen.has(key)) {
        seen.add(key)
        cells.push({ label: fmt(current), date: new Date(current), width: cellW })
      }
      current.setDate(current.getDate() + 1)
    }
  } else {
    const seen = new Set()
    for (let i = 0; i < days; i++) {
      const key = `${current.getFullYear()}-Q${Math.ceil((current.getMonth() + 1) / 3)}`
      if (!seen.has(key)) {
        seen.add(key)
        cells.push({ label: fmt(current), date: new Date(current), width: cellW })
      }
      current.setDate(current.getDate() + 1)
    }
  }
  return cells
}

export default function Timeline() {
  const { projectId } = useParams()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [zoomIdx, setZoomIdx] = useState(0)
  const [selectedTask, setSelectedTask] = useState(null)
  const [filterGroup, setFilterGroup] = useState('status') // status | assignee | type
  const scrollRef = useRef(null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const zoom = ZOOM_LEVELS[zoomIdx]

  // Timeline start: 2 weeks before today
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 14)

  const headers = getHeaderCells(startDate, zoom)
  const totalW = headers.reduce((s, h) => s + h.width, 0)
  const pxPerDay = totalW / zoom.days

  useEffect(() => {
    async function load() {
      try {
        const [t, m, p] = await Promise.all([getTasks(projectId), getProjectMembers(projectId), getProject(projectId)])
        setTasks(t)
        setMembers(m)
        setProject(p)
      } catch {}
      setLoading(false)
    }
    load()
  }, [projectId])

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayPx = getDaysBetween(startDate, today) * pxPerDay - 100
      scrollRef.current.scrollLeft = Math.max(0, todayPx)
    }
  }, [loading, zoomIdx])

  function getBar(task) {
    const start = task.created_at ? new Date(task.created_at) : today
    const end = task.due_date ? new Date(task.due_date) : new Date(start.getTime() + 7 * 86400000)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const left = getDaysBetween(startDate, start) * pxPerDay
    const width = Math.max(getDaysBetween(start, end) * pxPerDay, 20)
    return { left, width, start, end }
  }

  function getTodayX() {
    return getDaysBetween(startDate, today) * pxPerDay
  }

  // Group tasks
  const displayTasks = tasks.filter((t) => {
    const bar = getBar(t)
    return bar.left + bar.width >= 0 && bar.left <= totalW + 300
  })

  const projectKey = project ? getProjectKey(project.name) : 'KEY'

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} className="font-mono text-xs uppercase tracking-wider text-slate-muted">
        Building timeline…
      </motion.p>
    </div>
  )

  if (tasks.filter((t) => t.due_date).length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-slate-muted/30">
        <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M16 8V4M32 8V4M4 18h40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 28h6M20 28h6M28 28h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
      <p className="text-sm text-slate-muted">No issues with due dates yet.</p>
      <p className="text-xs text-slate-muted/60">Set due dates on issues to see them on the timeline.</p>
    </div>
  )

  const todayX = getTodayX()

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-black/5 bg-white flex items-center gap-3 shrink-0">
        <span className="text-sm font-medium text-ink">Timeline</span>
        <div className="flex-1" />
        {/* Zoom */}
        <div className="flex items-center gap-1 bg-paper-dim rounded-lg p-0.5">
          {ZOOM_LEVELS.map((z, i) => (
            <button
              key={z.label}
              onClick={() => setZoomIdx(i)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${i === zoomIdx ? 'bg-white text-ink shadow-sm' : 'text-slate-muted hover:text-ink'}`}
            >
              {z.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - 100) }}
          className="text-xs border border-black/10 rounded-lg px-2.5 py-1 text-slate-muted hover:text-ink transition-colors"
        >
          Today
        </button>
      </div>

      {/* Timeline */}
      <div className="flex flex-1 overflow-hidden">
        {/* Row labels */}
        <div className="w-56 shrink-0 border-r border-black/5 overflow-y-auto bg-white">
          <div className="h-10 border-b border-black/5 px-3 flex items-center">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-muted">Issue</span>
          </div>
          {displayTasks.map((task, i) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className="flex items-center gap-2 px-3 h-10 border-b border-black/5 hover:bg-paper-dim cursor-pointer"
            >
              <span className="font-mono text-[9px] text-slate-muted/50 shrink-0">{projectKey}-{i + 1}</span>
              <span className="text-xs text-ink truncate flex-1">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Scrollable chart area */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ width: `${totalW}px`, minWidth: '100%' }}>
            {/* Header */}
            <div className="flex h-10 border-b border-black/5 sticky top-0 bg-white z-10">
              {headers.map((cell, i) => (
                <div
                  key={i}
                  style={{ width: cell.width, minWidth: cell.width }}
                  className="shrink-0 flex items-center px-2 border-r border-black/5"
                >
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-muted truncate">{cell.label}</span>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Today line */}
              {todayX >= 0 && todayX <= totalW && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-violet/60 z-20 pointer-events-none"
                  style={{ left: `${todayX}px` }}
                >
                  <div className="absolute -top-0 -translate-x-1/2 bg-violet text-white text-[8px] font-mono px-1 py-0.5 rounded whitespace-nowrap">
                    Today
                  </div>
                </div>
              )}

              {/* Grid background */}
              <div className="absolute inset-0 flex">
                {headers.map((cell, i) => (
                  <div key={i} style={{ width: cell.width, minWidth: cell.width }} className={`shrink-0 border-r border-black/5 ${i % 2 === 0 ? 'bg-transparent' : 'bg-paper/30'}`} />
                ))}
              </div>

              {/* Bars */}
              {displayTasks.map((task, i) => {
                const bar = getBar(task)
                const color = STATUS_COLORS[task.status] || STATUS_COLORS.todo
                const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < today
                return (
                  <div key={task.id} className="relative flex items-center h-10 border-b border-black/5">
                    <motion.div
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        position: 'absolute',
                        left: `${bar.left}px`,
                        width: `${bar.width}px`,
                        backgroundColor: `${color}25`,
                        borderLeft: `3px solid ${isOverdue ? '#EF4444' : color}`,
                        transformOrigin: 'left',
                      }}
                      className="h-6 rounded-r-lg flex items-center px-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedTask(task)}
                    >
                      <span className="text-[10px] font-medium text-ink truncate">{task.title}</span>
                    </motion.div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-2 border-t border-black/5 bg-white flex items-center gap-4 shrink-0">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-mono uppercase tracking-wide text-slate-muted">{status.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-[10px] font-mono uppercase tracking-wide text-slate-muted">Overdue</span>
        </div>
      </div>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailPanel
            key={selectedTask.id}
            task={selectedTask}
            members={members}
            orgPlan={null}
            projectKey={projectKey}
            onClose={() => setSelectedTask(null)}
            onTaskUpdated={async () => setTasks(await getTasks(projectId))}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
