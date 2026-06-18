import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getProjectActivity, getTasks, getProjectMembers } from '../lib/data'

const ACTION_DONE      = new Set(['task_status_changed'])
const ACTION_PROGRESS  = new Set(['task_created', 'task_assigned', 'comment_added'])

function sinceHours(hrs) {
  return new Date(Date.now() - hrs * 3600 * 1000).toISOString()
}

export default function StandupModal({ projectId, onClose }) {
  const [loading, setLoading]   = useState(true)
  const [since, setSince]       = useState(24)           // hours back
  const [data, setData]         = useState(null)
  const [format, setFormat]     = useState('plain')      // plain | slack | markdown
  const [copied, setCopied]     = useState(false)

  useEffect(() => { generate() }, [since])

  async function generate() {
    setLoading(true)
    try {
      const [activity, tasks, members] = await Promise.all([
        getProjectActivity(projectId),
        getTasks(projectId),
        getProjectMembers(projectId),
      ])

      const cutoff = sinceHours(since)
      const recent = activity.filter(a => a.created_at >= cutoff)

      // Build per-member picture
      const memberMap = {}
      members.forEach(m => {
        memberMap[m.id] = { member: m, completed: [], inProgress: [], blockers: [] }
      })

      // Completed: tasks whose status changed TO 'done' in the window
      recent.forEach(a => {
        if (a.action !== 'task_status_changed') return
        const toStatus   = a.metadata?.to_status   || a.metadata?.new_status
        const taskTitle  = a.metadata?.title || `Task ${a.metadata?.task_id?.slice(0,6)}`
        const actorId    = a.actor_id
        if (toStatus === 'done' && memberMap[actorId]) {
          memberMap[actorId].completed.push(taskTitle)
        }
      })

      // In-progress: open tasks assigned to each member (not done)
      tasks.forEach(t => {
        if (!t.assignee_id || t.status === 'done') return
        if (!memberMap[t.assignee_id]) return
        if (t.status === 'in_progress' || t.status === 'review') {
          memberMap[t.assignee_id].inProgress.push(t.title)
        }
      })

      // Blockers: tasks that are overdue and not done
      const now = new Date()
      tasks.forEach(t => {
        if (!t.assignee_id || t.status === 'done' || !t.due_date) return
        if (!memberMap[t.assignee_id]) return
        if (new Date(t.due_date) < now) {
          memberMap[t.assignee_id].blockers.push(t.title)
        }
      })

      setData({ members: Object.values(memberMap).filter(m => m.completed.length || m.inProgress.length || m.blockers.length) })
    } finally {
      setLoading(false)
    }
  }

  function buildText() {
    if (!data?.members?.length) return 'No activity found for this period.'
    const b = format === 'slack'
    const lines = []

    if (format === 'markdown') lines.push(`# Standup — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`, '')
    if (format === 'plain')    lines.push(`Standup — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`, '')

    data.members.forEach(({ member, completed, inProgress, blockers }) => {
      const name = member.full_name || 'Unknown'
      if (b) lines.push(`*${name}*`)
      else if (format === 'markdown') lines.push(`## ${name}`)
      else lines.push(name)

      if (completed.length) {
        lines.push(b ? `✅ *Done:*` : format === 'markdown' ? `**✅ Done:**` : '✅ Done:')
        completed.forEach(t => lines.push(`  • ${t}`))
      }
      if (inProgress.length) {
        lines.push(b ? `🔄 *In Progress:*` : format === 'markdown' ? `**🔄 In Progress:**` : '🔄 In Progress:')
        inProgress.slice(0, 3).forEach(t => lines.push(`  • ${t}`))
        if (inProgress.length > 3) lines.push(`  • …and ${inProgress.length - 3} more`)
      }
      if (blockers.length) {
        lines.push(b ? `⚠️ *Blockers (overdue):*` : format === 'markdown' ? `**⚠️ Blockers:**` : '⚠️ Blockers:')
        blockers.forEach(t => lines.push(`  • ${t}`))
      } else {
        lines.push(b ? `✓ No blockers` : '✓ No blockers')
      }
      lines.push('')
    })

    return lines.join('\n')
  }

  const text = buildText()

  function copyText() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-black/5 w-full max-w-xl pointer-events-auto overflow-hidden flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-black/5 flex items-start gap-3 shrink-0">
            <div className="w-9 h-9 bg-violet/10 rounded-xl flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h5" stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-ink text-sm">Standup Generator</h2>
              <p className="text-xs text-slate-muted mt-0.5">Auto-compiled from your team's activity</p>
            </div>
            <button onClick={onClose} className="text-slate-muted hover:text-ink transition-colors p-1 shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>

          {/* Controls */}
          <div className="px-5 py-3 border-b border-black/5 flex items-center gap-3 shrink-0 flex-wrap">
            {/* Time window */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-muted uppercase tracking-wider">Last</span>
              <div className="flex items-center bg-paper-dim rounded-lg p-0.5">
                {[{ v: 24, l: '24h' }, { v: 48, l: '48h' }, { v: 72, l: '3 days' }].map(o => (
                  <button key={o.v} onClick={() => setSince(o.v)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      since === o.v ? 'bg-white text-ink shadow-sm font-medium' : 'text-slate-muted hover:text-ink'
                    }`}>{o.l}</button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-muted uppercase tracking-wider">Format</span>
              <div className="flex items-center bg-paper-dim rounded-lg p-0.5">
                {[{ v: 'plain', l: 'Plain' }, { v: 'slack', l: 'Slack' }, { v: 'markdown', l: 'MD' }].map(o => (
                  <button key={o.v} onClick={() => setFormat(o.v)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      format === o.v ? 'bg-white text-ink shadow-sm font-medium' : 'text-slate-muted hover:text-ink'
                    }`}>{o.l}</button>
                ))}
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={generate}
              className="ml-auto text-xs text-slate-muted hover:text-ink transition-colors flex items-center gap-1"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M9.5 5.5A4 4 0 1 1 5.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M9.5 1.5v4h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh
            </motion.button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-16">
                <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
                  className="font-mono text-xs uppercase tracking-wider text-slate-muted">
                  Compiling standup…
                </motion.p>
              </div>
            ) : (
              <textarea
                readOnly
                value={text}
                className="w-full h-full min-h-[300px] resize-none p-5 text-sm font-mono text-ink bg-paper leading-relaxed focus:outline-none"
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between shrink-0 bg-white">
            <p className="text-[10px] text-slate-muted">
              {data?.members?.length ?? 0} team member{data?.members?.length !== 1 ? 's' : ''} · {since}h window
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="text-xs text-slate-muted hover:text-ink transition-colors px-3 py-2">
                Close
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={copyText}
                className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-medium transition-colors ${
                  copied ? 'bg-sage text-white' : 'bg-ink text-white hover:bg-ink/90'
                }`}
              >
                {copied ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <rect x="3.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M2.5 7.5H2a1 1 0 01-1-1V2a1 1 0 011-1h4.5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    Copy {format === 'slack' ? 'for Slack' : format === 'markdown' ? 'Markdown' : 'Text'}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
