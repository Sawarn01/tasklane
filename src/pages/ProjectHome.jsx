import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getProject, getProjectMembers, getTasks, getSprints,
  getProjectActivity, getProjectVersions, getProjectKey,
} from '../lib/data'
import { renderMarkdown } from '../components/MarkdownEditor'
import StandupModal from '../components/StandupModal'
import TeamPulse from '../components/TeamPulse'

const STATUS_META = {
  todo:        { label: 'To Do',      color: '#8A8F98', bg: '#8A8F9815' },
  in_progress: { label: 'In Progress', color: '#6E56CF', bg: '#6E56CF15' },
  in_review:   { label: 'In Review',  color: '#F59E0B', bg: '#F59E0B15' },
  done:        { label: 'Done',       color: '#36D399', bg: '#36D39915' },
}

const TYPE_COLOR = {
  epic:    '#8B5CF6',
  story:   '#36D399',
  task:    '#3B82F6',
  bug:     '#EF4444',
  subtask: '#8A8F98',
}

const PRI_COLOR = {
  urgent: '#EF4444',
  high:   '#F97316',
  medium: '#6E56CF',
  low:    '#8A8F98',
}

function StatCard({ label, value, color, sub, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`bg-white rounded-2xl border border-black/5 p-4 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[#8A8F98] mt-0.5">{sub}</p>}
    </motion.div>
  )
}

function Avatar({ name, color, size = 8 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

const MEMBER_COLORS = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6']

export default function ProjectHome() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [project, setProject]       = useState(null)
  const [members, setMembers]       = useState([])
  const [tasks, setTasks]           = useState([])
  const [sprints, setSprints]       = useState([])
  const [activity, setActivity]     = useState([])
  const [versions, setVersions]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showStandup, setShowStandup] = useState(false)

  useEffect(() => {
    Promise.all([
      getProject(projectId),
      getProjectMembers(projectId),
      getTasks(projectId),
      getSprints(projectId),
      getProjectActivity(projectId),
      getProjectVersions(projectId),
    ]).then(([proj, mem, tsk, spr, act, ver]) => {
      setProject(proj)
      setMembers(mem)
      setTasks(tsk)
      setSprints(spr)
      setActivity(act.slice(0, 12))
      setVersions(ver)
    }).finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
          className="font-mono text-xs uppercase tracking-wider text-[#8A8F98]">Loading…</motion.p>
      </div>
    )
  }

  const activeSprint = sprints.find(s => s.status === 'active')
  const sprintTasks  = activeSprint ? tasks.filter(t => t.sprint_id === activeSprint.id) : []
  const doneTasks    = sprintTasks.filter(t => t.status === 'done')
  const pct          = sprintTasks.length ? Math.round((doneTasks.length / sprintTasks.length) * 100) : 0

  const daysLeft = activeSprint?.end_date
    ? Math.max(0, Math.ceil((new Date(activeSprint.end_date) - new Date()) / 86400000))
    : null

  // Sprint health forecast
  const sprintHealth = (() => {
    if (!activeSprint?.start_date || !activeSprint?.end_date) return null
    const start        = new Date(activeSprint.start_date)
    const end          = new Date(activeSprint.end_date)
    const now          = new Date()
    const totalDays    = Math.max(1, Math.ceil((end - start) / 86400000))
    const elapsedDays  = Math.max(0, Math.ceil((now - start) / 86400000))
    const remainDays   = Math.max(0, totalDays - elapsedDays)

    const totalPts     = sprintTasks.reduce((s, t) => s + (t.story_points || 0), 0)
    const donePts      = doneTasks.reduce((s, t) => s + (t.story_points || 0), 0)
    const remainPts    = totalPts - donePts

    if (totalPts === 0) return null // no point-estimated tasks

    const ptsPerDay     = elapsedDays > 0 ? donePts / elapsedDays : 0
    const ptsPerDayReq  = remainDays > 0  ? remainPts / remainDays : Infinity
    const forecastDays  = ptsPerDay > 0   ? Math.ceil(remainPts / ptsPerDay) : null

    // Score 0–100: ratio of actual velocity vs required velocity
    const velocityRatio = ptsPerDayReq > 0 ? Math.min(2, ptsPerDay / ptsPerDayReq) : (elapsedDays === 0 ? 1 : 0)
    const score         = Math.round(velocityRatio * 100)
    const pctElapsed    = Math.min(1, elapsedDays / totalDays)
    const pctDone       = totalPts > 0 ? donePts / totalPts : 0
    const onTrack       = pctDone >= pctElapsed * 0.85  // within 15% tolerance

    let label, accent
    if (score >= 90)      { label = 'On track';      accent = 'sage' }
    else if (score >= 65) { label = 'Slightly behind'; accent = 'amber' }
    else                  { label = 'At risk';        accent = 'red' }

    const daysAheadBehind = forecastDays !== null ? remainDays - forecastDays : null

    return { score: Math.min(score, 100), label, accent, ptsPerDay: Math.round(ptsPerDay * 10) / 10, ptsPerDayReq: Math.round(ptsPerDayReq * 10) / 10, donePts, totalPts, forecastDays, remainDays, daysAheadBehind, onTrack }
  })()

  // Stats
  const byStatus = Object.keys(STATUS_META).reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s).length
    return acc
  }, {})

  // Member workload: count open tasks per member
  const workload = members.map((m, i) => ({
    ...m,
    color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    open: tasks.filter(t => t.assignee_id === m.id && t.status !== 'done').length,
  }))

  const projectKey = getProjectKey(project?.name || '')

  // By issue type
  const byType = ['epic', 'story', 'task', 'bug', 'subtask'].map(t => ({
    type: t,
    count: tasks.filter(x => (x.issue_type || 'task') === t).length,
  })).filter(x => x.count > 0)

  // Upcoming release
  const nextRelease = versions.find(v => v.status === 'unreleased')
  const lastRelease = [...versions].reverse().find(v => v.status === 'released')

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAF7] px-6 py-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Project header ───────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#8A8F98]">{projectKey}</span>
              </div>
              <h1 className="text-xl font-bold text-ink">{project?.name}</h1>
              {project?.description && (
                <div className="mt-1.5 text-sm text-[#8A8F98] leading-relaxed max-w-xl prose-sm">
                  {renderMarkdown(project.description) || <p className="text-sm text-[#8A8F98]">{project.description}</p>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowStandup(true)}
                className="flex items-center gap-1.5 text-xs border border-violet/30 text-violet rounded-xl px-3 py-1.5 hover:bg-violet/10 transition-colors font-medium"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 3h10M1 6h7M1 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Standup
              </motion.button>
              <button
                onClick={() => navigate(`/projects/${projectId}/settings`)}
                className="text-xs text-slate-muted border border-black/10 rounded-xl px-3 py-1.5 hover:bg-black/3 transition-colors"
              >
                Settings →
              </button>
            </div>
          </div>

          {/* Status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(STATUS_META).map(([s, meta]) => (
              <StatCard
                key={s}
                label={meta.label}
                value={byStatus[s] || 0}
                color={meta.color}
                sub={s === 'done' ? 'issues completed' : 'issues'}
                onClick={() => navigate(`/projects/${projectId}`)}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Sprint Health Score ─────────────────────────────────── */}
        {sprintHealth && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className={`rounded-2xl border shadow-sm p-5 ${
              sprintHealth.accent === 'sage'  ? 'bg-sage/8 border-sage/20' :
              sprintHealth.accent === 'amber' ? 'bg-amber-50 border-amber-200' :
                                               'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-4 flex-wrap">
              {/* Score ring */}
              <div className="relative shrink-0">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                  <circle
                    cx="32" cy="32" r="26" fill="none"
                    stroke={sprintHealth.accent === 'sage' ? '#36D399' : sprintHealth.accent === 'amber' ? '#F59E0B' : '#EF4444'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - sprintHealth.score / 100)}`}
                    transform="rotate(-90 32 32)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-bold text-sm text-ink">{sprintHealth.score}</span>
                  <span className="font-mono text-[8px] text-slate-muted uppercase">score</span>
                </div>
              </div>

              {/* Label + details */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink text-sm mb-0.5 flex items-center gap-2">
                  Sprint Health
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    sprintHealth.accent === 'sage'  ? 'bg-sage/20 text-green-700' :
                    sprintHealth.accent === 'amber' ? 'bg-amber-100 text-amber-700' :
                                                     'bg-red-100 text-red-700'
                  }`}>{sprintHealth.label}</span>
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-muted mt-1">
                  <span><strong className="text-ink">{sprintHealth.donePts}</strong> / {sprintHealth.totalPts} pts done</span>
                  <span>Velocity <strong className="text-ink">{sprintHealth.ptsPerDay}</strong> pts/day</span>
                  <span>Required <strong className="text-ink">{sprintHealth.ptsPerDayReq}</strong> pts/day</span>
                  {sprintHealth.daysAheadBehind !== null && (
                    <span className={sprintHealth.daysAheadBehind >= 0 ? 'text-green-700' : 'text-red-600'}>
                      {sprintHealth.daysAheadBehind >= 0
                        ? `${sprintHealth.daysAheadBehind}d ahead of schedule`
                        : `${Math.abs(sprintHealth.daysAheadBehind)}d behind schedule`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid sm:grid-cols-3 gap-5">

          {/* ── Left column (sprint + activity) ─────────────────── */}
          <div className="sm:col-span-2 space-y-5">

            {/* Active sprint card */}
            {activeSprint ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
                className="bg-white rounded-2xl border border-black/5 shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />
                      <p className="font-semibold text-sm text-ink">{activeSprint.name}</p>
                      <span className="font-mono text-[9px] bg-violet/10 text-violet px-2 py-0.5 rounded-full uppercase">Active</span>
                    </div>
                    {activeSprint.goal && <p className="text-xs text-[#8A8F98] mt-0.5 italic">"{activeSprint.goal}"</p>}
                  </div>
                  {daysLeft !== null && (
                    <div className="text-right">
                      <p className="text-xl font-bold text-ink">{daysLeft}</p>
                      <p className="text-[10px] text-[#8A8F98]">days left</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-[#F1EFE7] rounded-full overflow-hidden mb-2">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: pct === 100 ? '#36D399' : '#6E56CF' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#8A8F98] font-mono mb-4">
                  <span>{doneTasks.length} / {sprintTasks.length} issues done</span>
                  <span>{pct}%</span>
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(STATUS_META).map(([s, meta]) => {
                    const count = sprintTasks.filter(t => t.status === s).length
                    return (
                      <div key={s} className="text-center bg-[#FAFAF7] rounded-xl py-2.5 px-1">
                        <p className="text-base font-bold" style={{ color: meta.color }}>{count}</p>
                        <p className="font-mono text-[8px] uppercase tracking-wide text-[#8A8F98]">{meta.label}</p>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => navigate(`/projects/${projectId}`)}
                  className="mt-3 text-xs text-violet hover:opacity-70 transition-opacity"
                >
                  Open board →
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
                className="bg-white rounded-2xl border border-dashed border-black/10 p-6 text-center"
              >
                <p className="text-sm font-medium text-ink mb-1">No active sprint</p>
                <p className="text-xs text-[#8A8F98] mb-3">Start a sprint from the backlog to track progress here.</p>
                <button onClick={() => navigate(`/projects/${projectId}/backlog`)}
                  className="text-xs text-violet bg-violet/8 px-3 py-1.5 rounded-lg hover:bg-violet/12 transition-colors">
                  Go to Backlog →
                </button>
              </motion.div>
            )}

            {/* Issue type breakdown */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-5"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98] mb-3">Issue breakdown</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {byType.map(({ type, count }) => {
                  const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0
                  return (
                    <div key={type} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: TYPE_COLOR[type] }} />
                      <span className="capitalize text-ink">{type}</span>
                      <span className="font-mono text-[#8A8F98]">{count}</span>
                    </div>
                  )
                })}
              </div>
              {/* Stacked bar */}
              <div className="h-2.5 rounded-full overflow-hidden flex">
                {byType.map(({ type, count }) => (
                  <motion.div
                    key={type}
                    initial={{ flex: 0 }} animate={{ flex: count }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    style={{ backgroundColor: TYPE_COLOR[type] }}
                    title={`${type}: ${count}`}
                  />
                ))}
              </div>
            </motion.div>

            {/* Recent activity */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98]">Recent activity</p>
                <button onClick={() => navigate(`/projects/${projectId}/activity`)}
                  className="text-[10px] text-violet hover:opacity-70 transition-opacity">View all →</button>
              </div>
              {activity.length === 0 ? (
                <p className="text-xs text-[#8A8F98] italic">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((a, i) => {
                    const name = a.profiles?.full_name || 'Someone'
                    const color = MEMBER_COLORS[members.findIndex(m => m.id === a.actor_id) % MEMBER_COLORS.length]
                    return (
                      <motion.div key={a.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.04 }}
                        className="flex items-start gap-2.5"
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0 mt-0.5"
                          style={{ backgroundColor: color || '#6E56CF' }}>
                          {name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-ink leading-snug">
                            <span className="font-medium">{name}</span>
                            {' '}<span className="text-[#8A8F98]">{a.action?.replace(/_/g, ' ')}</span>
                            {a.metadata?.task_title && <span className="text-[#8A8F98]"> "{a.metadata.task_title}"</span>}
                          </p>
                          <p className="font-mono text-[9px] text-[#8A8F98] mt-0.5">
                            {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Right column (team + releases) ──────────────────── */}
          <div className="space-y-5">

            {/* Team */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98]">Team · {members.length}</p>
                <button onClick={() => navigate(`/projects/${projectId}/members`)}
                  className="text-[10px] text-violet hover:opacity-70 transition-opacity">Manage →</button>
              </div>
              <div className="space-y-2.5">
                {workload.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: m.color }}>
                      {(m.full_name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{m.full_name || m.email || 'Unknown'}</p>
                      <p className="text-[9px] text-[#8A8F98] font-mono">{m.open} open issue{m.open !== 1 ? 's' : ''}</p>
                    </div>
                    {m.id === user.id && (
                      <span className="text-[8px] font-mono bg-[#F1EFE7] text-[#8A8F98] px-1.5 py-0.5 rounded">you</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Releases */}
            {(nextRelease || lastRelease) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                className="bg-white rounded-2xl border border-black/5 shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98]">Releases</p>
                  <button onClick={() => navigate(`/projects/${projectId}/releases`)}
                    className="text-[10px] text-violet hover:opacity-70 transition-opacity">View all →</button>
                </div>
                {nextRelease && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <p className="text-xs font-semibold text-ink">{nextRelease.name}</p>
                    </div>
                    <p className="font-mono text-[9px] text-[#8A8F98] uppercase tracking-wide">Upcoming</p>
                    {nextRelease.release_date && (
                      <p className="text-[10px] text-[#8A8F98] mt-0.5">
                        Target: {new Date(nextRelease.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
                {lastRelease && (
                  <div className="border-t border-black/5 pt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sage" />
                      <p className="text-xs font-semibold text-ink">{lastRelease.name}</p>
                    </div>
                    <p className="font-mono text-[9px] text-[#8A8F98] uppercase tracking-wide">Released</p>
                    {lastRelease.release_date && (
                      <p className="text-[10px] text-[#8A8F98] mt-0.5">
                        {new Date(lastRelease.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Team Pulse */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <TeamPulse projectId={projectId} />
            </motion.div>

            {/* Quick actions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-5"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98] mb-3">Quick links</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Board', sub: `${byStatus.in_progress} in progress`, path: '' },
                  { label: 'Backlog', sub: `${(byStatus.todo || 0)} unstarted`, path: '/backlog' },
                  { label: 'Timeline', sub: 'Roadmap view', path: '/timeline' },
                  { label: 'Reports', sub: 'Velocity & burndown', path: '/reports' },
                  { label: 'Meetings', sub: 'Notes & action items', path: '/meetings' },
                  { label: 'Chat', sub: 'Team conversation', path: '/chat' },
                ].map(item => (
                  <button key={item.path}
                    onClick={() => navigate(`/projects/${projectId}${item.path}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#F1EFE7] transition-colors text-left group"
                  >
                    <div>
                      <p className="text-xs font-medium text-ink">{item.label}</p>
                      <p className="text-[9px] text-[#8A8F98]">{item.sub}</p>
                    </div>
                    <span className="text-[#8A8F98] opacity-0 group-hover:opacity-100 transition-opacity text-xs">→</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Standup modal */}
      <AnimatePresence>
        {showStandup && (
          <StandupModal projectId={projectId} onClose={() => setShowStandup(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
