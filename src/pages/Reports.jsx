import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getTasks, getSprints, getProjectMembers } from '../lib/data'

function StatCard({ label, value, sub, color = 'violet' }) {
  const colorMap = { violet: 'text-violet bg-violet/10', green: 'text-sage bg-sage/10', amber: 'text-amber-500 bg-amber-50', red: 'text-red-500 bg-red-50' }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm"
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-2">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${colorMap[color]?.split(' ')[0] || 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-muted">{sub}</p>}
    </motion.div>
  )
}

// Simple SVG line chart for burndown
function BurndownChart({ sprint, tasks }) {
  if (!sprint || !sprint.start_date || !sprint.end_date) return (
    <div className="flex items-center justify-center h-40 text-sm text-slate-muted">No active sprint with dates set</div>
  )

  const start = new Date(sprint.start_date)
  const end = new Date(sprint.end_date)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const totalDays = Math.max(Math.round((end - start) / 86400000), 1)
  const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id)
  const totalPoints = sprintTasks.reduce((s, t) => s + (t.story_points || 1), 0)

  // Ideal line
  const idealPoints = Array.from({ length: totalDays + 1 }, (_, i) => totalPoints - (totalPoints / totalDays) * i)

  // Actual: tasks done by day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysSoFar = Math.min(Math.round((today - start) / 86400000), totalDays)

  const actualPoints = [totalPoints]
  let remaining = totalPoints
  for (let d = 1; d <= daysSoFar; d++) {
    const dayDate = new Date(start.getTime() + d * 86400000)
    const doneThatDay = sprintTasks.filter((t) => {
      if (t.status !== 'done') return false
      const updated = new Date(t.updated_at || t.created_at)
      updated.setHours(0, 0, 0, 0)
      return updated.getTime() === dayDate.getTime()
    })
    remaining -= doneThatDay.reduce((s, t) => s + (t.story_points || 1), 0)
    actualPoints.push(Math.max(remaining, 0))
  }

  const W = 480
  const H = 160
  const pad = { top: 10, right: 20, bottom: 30, left: 36 }
  const chartW = W - pad.left - pad.right
  const chartH = H - pad.top - pad.bottom

  function toX(day) { return pad.left + (day / totalDays) * chartW }
  function toY(pts) { return pad.top + chartH - (pts / Math.max(totalPoints, 1)) * chartH }

  const idealPath = idealPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(p)}`).join(' ')
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(p)}`).join(' ')

  // Axis labels
  const yLabels = [0, Math.round(totalPoints / 2), totalPoints]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
      {/* Grid */}
      {yLabels.map((y) => (
        <g key={y}>
          <line x1={pad.left} y1={toY(y)} x2={W - pad.right} y2={toY(y)} stroke="#0F111508" strokeWidth="1" strokeDasharray="4 2" />
          <text x={pad.left - 4} y={toY(y) + 3} textAnchor="end" fontSize="9" fill="#8A8F98">{y}</text>
        </g>
      ))}
      {/* X axis */}
      <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="#0F11150F" strokeWidth="1" />
      <text x={pad.left} y={H - 10} fontSize="9" fill="#8A8F98">{new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
      <text x={W - pad.right} y={H - 10} textAnchor="end" fontSize="9" fill="#8A8F98">{new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>

      {/* Ideal */}
      <path d={idealPath} fill="none" stroke="#8A8F98" strokeWidth="1.5" strokeDasharray="5 3" />

      {/* Actual */}
      <path d={actualPath} fill="none" stroke="#6E56CF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {actualPoints.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p)} r="3" fill="#6E56CF" />
      ))}

      {/* Legend */}
      <g transform={`translate(${pad.left}, ${H - 8})`}>
        <line x1="0" y1="0" x2="16" y2="0" stroke="#8A8F98" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="20" y="3" fontSize="9" fill="#8A8F98">Ideal</text>
        <line x1="60" y1="0" x2="76" y2="0" stroke="#6E56CF" strokeWidth="2" />
        <circle cx="86" cy="0" r="3" fill="#6E56CF" />
        <text x="92" y="3" fontSize="9" fill="#6E56CF">Actual</text>
      </g>
    </svg>
  )
}

// Bar chart for velocity
function VelocityChart({ sprints, tasks }) {
  const completedSprints = sprints.filter((s) => s.status === 'completed').slice(-6)
  if (completedSprints.length === 0) return (
    <div className="flex items-center justify-center h-32 text-sm text-slate-muted">No completed sprints yet</div>
  )

  const data = completedSprints.map((s) => ({
    name: s.name,
    pts: tasks.filter((t) => t.sprint_id === s.id && t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0),
  }))

  const maxPts = Math.max(...data.map((d) => d.pts), 1)
  const barH = 100

  return (
    <div className="flex items-end gap-3 pt-4">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-ink">{d.pts}</span>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.pts / maxPts) * barH}px` }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="w-full bg-violet/70 rounded-t-lg"
            style={{ minHeight: 4 }}
          />
          <span className="text-[9px] font-mono text-slate-muted text-center truncate w-full">{d.name.slice(0, 8)}</span>
        </div>
      ))}
    </div>
  )
}

// Donut-like issue type chart using CSS
function IssueTypeBreakdown({ tasks }) {
  const counts = {}
  tasks.forEach((t) => {
    const type = t.issue_type || 'task'
    counts[type] = (counts[type] || 0) + 1
  })

  const COLORS = { epic: '#8B5CF6', story: '#36D399', task: '#3B82F6', bug: '#EF4444', subtask: '#6B7280' }
  const total = tasks.length || 1

  return (
    <div className="space-y-2 mt-2">
      {Object.entries(counts).map(([type, count]) => (
        <div key={type} className="flex items-center gap-3">
          <span className="text-xs text-slate-muted w-14 capitalize">{type}</span>
          <div className="flex-1 h-2 bg-paper-dim rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(count / total) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS[type] || '#8A8F98' }}
            />
          </div>
          <span className="font-mono text-xs text-slate-muted w-10 text-right">{count} ({Math.round((count / total) * 100)}%)</span>
        </div>
      ))}
    </div>
  )
}

// Team workload chart
function TeamWorkload({ tasks, members }) {
  if (members.length === 0) return null
  const assigneeCounts = {}
  tasks.forEach((t) => {
    if (t.assignee_id) {
      assigneeCounts[t.assignee_id] = (assigneeCounts[t.assignee_id] || { open: 0, done: 0 })
      if (t.status === 'done') assigneeCounts[t.assignee_id].done += 1
      else assigneeCounts[t.assignee_id].open += 1
    }
  })
  const max = Math.max(...Object.values(assigneeCounts).map((c) => c.open + c.done), 1)

  return (
    <div className="space-y-3 mt-2">
      {members.map((m) => {
        const c = assigneeCounts[m.id] || { open: 0, done: 0 }
        const total = c.open + c.done
        return (
          <div key={m.id} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-violet/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-violet">{(m.full_name || 'U')[0].toUpperCase()}</span>
            </div>
            <span className="text-xs text-slate-muted w-24 truncate">{m.full_name}</span>
            <div className="flex-1 h-2.5 bg-paper-dim rounded-full overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(c.done / Math.max(total, 1)) * (total / max) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-sage rounded-l-full"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(c.open / Math.max(total, 1)) * (total / max) * 100}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="h-full bg-violet/60"
              />
            </div>
            <span className="font-mono text-[10px] text-slate-muted w-16 text-right">{c.done}d / {c.open}o</span>
          </div>
        )
      })}
      <div className="flex items-center gap-4 text-[10px] text-slate-muted font-mono pt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-sage rounded-full inline-block" /> Done</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-violet/60 rounded-full inline-block" /> Open</span>
      </div>
    </div>
  )
}

export default function Reports() {
  const { projectId } = useParams()
  const [tasks, setTasks] = useState([])
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSprintId, setActiveSprintId] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [t, m] = await Promise.all([getTasks(projectId), getProjectMembers(projectId)])
        setTasks(t)
        setMembers(m)
        try {
          const s = await getSprints(projectId)
          setSprints(s)
          const active = s.find((sp) => sp.status === 'active')
          if (active) setActiveSprintId(active.id)
        } catch {}
      } catch {}
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} className="font-mono text-xs uppercase tracking-wider text-slate-muted">
        Calculating metrics…
      </motion.p>
    </div>
  )

  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length
  const overdue = tasks.filter((t) => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date()).length
  const totalPoints = tasks.reduce((s, t) => s + (t.story_points || 0), 0)
  const donePoints = tasks.filter((t) => t.status === 'done').reduce((s, t) => s + (t.story_points || 0), 0)

  const activeSprint = sprints.find((s) => s.status === 'active')
  const selectedSprint = sprints.find((s) => s.id === activeSprintId) || activeSprint

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-ink">Reports</h2>
          <p className="text-sm text-slate-muted">Sprint performance and team insights</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total issues" value={total} sub={`${done} completed`} color="violet" />
          <StatCard label="In progress" value={inProgress} sub="currently active" color="amber" />
          <StatCard label="Overdue" value={overdue} sub="past due date" color="red" />
          <StatCard label="Story points" value={`${donePoints}/${totalPoints}`} sub="completed / total" color="green" />
        </div>

        {/* Sprint burndown + velocity */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Burndown */}
          <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-ink text-sm">Sprint burndown</p>
                <p className="text-xs text-slate-muted mt-0.5">Remaining story points over time</p>
              </div>
              {sprints.length > 0 && (
                <select
                  value={activeSprintId || ''}
                  onChange={(e) => setActiveSprintId(e.target.value)}
                  className="text-xs border border-black/10 rounded-lg px-2 py-1 bg-white"
                >
                  {sprints.filter((s) => s.status !== 'planning').map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
            <BurndownChart sprint={selectedSprint} tasks={tasks} />
          </div>

          {/* Velocity */}
          <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
            <p className="font-semibold text-ink text-sm mb-0.5">Sprint velocity</p>
            <p className="text-xs text-slate-muted mb-3">Story points completed per sprint</p>
            <VelocityChart sprints={sprints} tasks={tasks} />
            {sprints.filter((s) => s.status === 'completed').length === 0 && (
              <p className="text-sm text-slate-muted text-center mt-8">Complete sprints to see velocity</p>
            )}
          </div>
        </div>

        {/* Issue breakdown + team workload */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Issue type breakdown */}
          <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
            <p className="font-semibold text-ink text-sm mb-0.5">Issue types</p>
            <p className="text-xs text-slate-muted mb-2">Distribution across the project</p>
            {tasks.length > 0 ? (
              <IssueTypeBreakdown tasks={tasks} />
            ) : (
              <p className="text-sm text-slate-muted mt-6 text-center">No issues yet</p>
            )}
          </div>

          {/* Team workload */}
          <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
            <p className="font-semibold text-ink text-sm mb-0.5">Team workload</p>
            <p className="text-xs text-slate-muted mb-2">Open vs completed issues per member</p>
            <TeamWorkload tasks={tasks} members={members} />
            {members.length === 0 && (
              <p className="text-sm text-slate-muted mt-6 text-center">No members found</p>
            )}
          </div>
        </div>

        {/* Status breakdown table */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
          <p className="font-semibold text-ink text-sm mb-4">Status breakdown</p>
          <div className="grid grid-cols-4 gap-3">
            {['todo', 'in_progress', 'in_review', 'done'].map((status) => {
              const count = tasks.filter((t) => t.status === status).length
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const colors = { todo: '#8A8F98', in_progress: '#6E56CF', in_review: '#F59E0B', done: '#36D399' }
              return (
                <div key={status} className="text-center p-3 rounded-xl bg-paper-dim">
                  <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${colors[status]}20` }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[status] }} />
                  </div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-muted">{status.replace(/_/g, ' ')}</p>
                  <p className="text-xl font-bold text-ink mt-1">{count}</p>
                  <p className="text-[10px] text-slate-muted">{pct}%</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
          <p className="font-semibold text-ink text-sm mb-1">Priority distribution</p>
          <p className="text-xs text-slate-muted mb-4">Open issues by priority level</p>
          <div className="space-y-2.5">
            {[
              { key: 'urgent', label: 'Urgent', color: '#EF4444' },
              { key: 'high',   label: 'High',   color: '#F97316' },
              { key: 'medium', label: 'Medium', color: '#6E56CF' },
              { key: 'low',    label: 'Low',    color: '#8A8F98' },
            ].map(({ key, label, color }) => {
              const count = tasks.filter(t => (t.priority || 'medium') === key && t.status !== 'done').length
              const max   = Math.max(...['urgent','high','medium','low'].map(k => tasks.filter(t => (t.priority||'medium') === k && t.status !== 'done').length), 1)
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-muted w-14">{label}</span>
                  <div className="flex-1 h-2 bg-paper-dim rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <span className="font-mono text-xs text-slate-muted w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
          {tasks.filter(t => t.status !== 'done').length === 0 && (
            <p className="text-sm text-slate-muted text-center mt-4">No open issues</p>
          )}
        </div>
      </div>
    </div>
  )
}
