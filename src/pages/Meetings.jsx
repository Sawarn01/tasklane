import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getMeetings, createMeeting, updateMeeting, deleteMeeting,
  getMeetingActionItems, createActionItem, toggleActionItem, actionItemToTask,
  getProjectMembers,
} from '../lib/data'

const EMOJI = { '😴': 1, '😕': 2, '😐': 3, '🙂': 4, '🚀': 5 }

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ name, size = 7 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899']
  const color  = colors[(name || '').charCodeAt(0) % colors.length]
  return (
    <div className={`w-${size} h-${size} rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold`}
      style={{ backgroundColor: color }}>
      {initials}
    </div>
  )
}

// ── New Meeting Modal ────────────────────────────────────────────
function NewMeetingModal({ members, onClose, onCreate }) {
  const [title, setTitle]   = useState('')
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [agenda, setAgenda] = useState('')
  const [attendees, setAttendees] = useState([])
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    try { await onCreate({ title: title.trim(), date, agenda, attendeeIds: attendees }) }
    finally { setSaving(false) }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-black/5 w-full max-w-md pointer-events-auto">
          <div className="px-5 pt-5 pb-4 border-b border-black/5 flex items-center justify-between">
            <h3 className="font-bold text-ink text-sm">New Meeting</h3>
            <button onClick={onClose} className="text-slate-muted hover:text-ink transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1.5">Title *</label>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Sprint 4 Planning"
                className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-slate-muted focus:outline-none focus:border-violet/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-violet/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1.5">Agenda (optional)</label>
              <textarea value={agenda} onChange={e => setAgenda(e.target.value)} rows={3}
                placeholder="What will be discussed…"
                className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-slate-muted focus:outline-none focus:border-violet/40 transition-colors resize-none"
              />
            </div>

            {members.length > 0 && (
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-2">Attendees</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => {
                    const selected = attendees.includes(m.id)
                    return (
                      <button key={m.id}
                        onClick={() => setAttendees(a => selected ? a.filter(x => x !== m.id) : [...a, m.id])}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-colors ${
                          selected ? 'bg-ink text-white border-ink' : 'border-black/10 text-slate-muted hover:text-ink'
                        }`}
                      >
                        {selected && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1 4.5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        {m.full_name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose} className="flex-1 text-sm border border-black/10 rounded-xl py-2.5 text-slate-muted hover:text-ink transition-colors">Cancel</button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={!title.trim() || saving}
              className="flex-1 text-sm bg-violet text-white rounded-xl py-2.5 font-medium hover:bg-violet/90 disabled:opacity-50 transition-colors">
              {saving ? 'Creating…' : 'Create meeting'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ── Meeting Detail Panel ─────────────────────────────────────────
function MeetingDetail({ meeting, members, projectId, onClose, onUpdated, onDeleted }) {
  const { user } = useAuth()
  const [notes,     setNotes]     = useState(meeting.notes     || '')
  const [decisions, setDecisions] = useState(meeting.decisions || '')
  const [items,     setItems]     = useState([])
  const [newItem,   setNewItem]   = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [converting, setConverting] = useState(null)
  const notesDebounce = useRef(null)

  useEffect(() => {
    getMeetingActionItems(meeting.id).then(setItems)
  }, [meeting.id])

  function autoSave(field, val) {
    clearTimeout(notesDebounce.current)
    notesDebounce.current = setTimeout(() => {
      updateMeeting({ meetingId: meeting.id, [field]: val }).catch(() => {})
      onUpdated?.({ ...meeting, [field]: val })
    }, 800)
  }

  async function addItem() {
    if (!newItem.trim()) return
    const item = await createActionItem({
      meetingId: meeting.id, projectId,
      title: newItem.trim(), assigneeId: newAssignee || null, userId: user.id,
    })
    setItems(prev => [...prev, item])
    setNewItem(''); setNewAssignee('')
  }

  async function toggleItem(item) {
    await toggleActionItem({ itemId: item.id, done: !item.done })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i))
  }

  async function convertItem(item) {
    setConverting(item.id)
    try {
      await actionItemToTask({ item, projectId, userId: user.id })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, task_id: 'created' } : i))
    } finally { setConverting(null) }
  }

  async function handleDelete() {
    if (!confirm('Delete this meeting?')) return
    await deleteMeeting(meeting.id)
    onDeleted(meeting.id)
    onClose()
  }

  const attendeeNames = (meeting.attendee_ids || [])
    .map(id => members.find(m => m.id === id)?.full_name)
    .filter(Boolean)

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="fixed top-0 right-0 h-full w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-black/5 shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1">{fmtDate(meeting.date)}</p>
              <h2 className="font-bold text-ink text-base leading-tight">{meeting.title}</h2>
              {attendeeNames.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {attendeeNames.map(n => (
                    <span key={n} className="flex items-center gap-1 text-[10px] bg-paper-dim px-2 py-0.5 rounded-full text-slate-muted">
                      <Avatar name={n} size={4} />
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleDelete} className="p-1.5 text-slate-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 3.5h9M5 3.5V2.5h3v1M4.5 3.5l.5 7h3l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button onClick={onClose} className="p-1.5 text-slate-muted hover:text-ink transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Agenda */}
          {meeting.agenda && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-2">Agenda</p>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-paper-dim rounded-xl p-3">{meeting.agenda}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); autoSave('notes', e.target.value) }}
              placeholder="Meeting notes… (auto-saved)"
              rows={6}
              className="w-full border border-black/8 rounded-xl p-3 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:border-violet/30 transition-colors resize-none bg-paper-dim/30 leading-relaxed"
            />
          </div>

          {/* Decisions */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-2">Key Decisions</p>
            <textarea
              value={decisions}
              onChange={e => { setDecisions(e.target.value); autoSave('decisions', e.target.value) }}
              placeholder="What was decided…"
              rows={3}
              className="w-full border border-black/8 rounded-xl p-3 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:border-violet/30 transition-colors resize-none bg-paper-dim/30 leading-relaxed"
            />
          </div>

          {/* Action Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted">Action Items</p>
              <span className="text-[10px] text-slate-muted">{items.filter(i => i.done).length}/{items.length} done</span>
            </div>

            <div className="space-y-2 mb-3">
              <AnimatePresence initial={false}>
                {items.map(item => (
                  <motion.div key={item.id}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                      item.done ? 'bg-sage/5 border-sage/20' : 'bg-white border-black/8'
                    }`}
                  >
                    <button onClick={() => toggleItem(item)}
                      className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        item.done ? 'bg-sage border-sage' : 'border-black/20 hover:border-violet'
                      }`}
                    >
                      {item.done && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>

                    <span className={`flex-1 text-sm leading-tight ${item.done ? 'line-through text-slate-muted' : 'text-ink'}`}>
                      {item.title}
                    </span>

                    {item.profiles?.full_name && (
                      <Avatar name={item.profiles.full_name} size={5} />
                    )}

                    {!item.task_id && !item.done && (
                      <button
                        onClick={() => convertItem(item)}
                        disabled={converting === item.id}
                        title="Convert to task"
                        className="shrink-0 text-[9px] font-mono uppercase tracking-wide text-violet hover:text-violet/70 border border-violet/20 hover:border-violet/40 px-2 py-0.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {converting === item.id ? '…' : '→ Task'}
                      </button>
                    )}
                    {item.task_id && (
                      <span className="shrink-0 text-[9px] font-mono uppercase tracking-wide text-sage px-2 py-0.5 rounded-lg bg-sage/10">✓ Task</span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add action item */}
            <div className="flex gap-2">
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Add action item… ↵"
                className="flex-1 border border-black/10 rounded-xl px-3 py-2 text-xs text-ink placeholder:text-slate-muted focus:outline-none focus:border-violet/40 transition-colors"
              />
              <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
                className="border border-black/10 rounded-xl px-2 py-2 text-xs text-slate-muted focus:outline-none bg-white max-w-28">
                <option value="">Assignee</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <button onClick={addItem} disabled={!newItem.trim()}
                className="px-3 py-2 bg-ink text-white text-xs rounded-xl disabled:opacity-40 hover:bg-ink/90 transition-colors">
                Add
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ── Main Meetings Page ───────────────────────────────────────────
export default function Meetings() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [meetings, setMeetings]     = useState([])
  const [members, setMembers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [showNew, setShowNew]       = useState(false)
  const [selected, setSelected]     = useState(null)

  useEffect(() => {
    Promise.all([getMeetings(projectId), getProjectMembers(projectId)])
      .then(([m, mem]) => { setMeetings(m); setMembers(mem) })
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleCreate(fields) {
    const m = await createMeeting({ ...fields, projectId, userId: user.id })
    setMeetings(prev => [m, ...prev])
    setShowNew(false)
    setSelected(m)
  }

  function handleUpdated(updated) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  function handleDeleted(id) {
    setMeetings(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="flex flex-col h-full bg-paper">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-black/5 bg-paper shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-ink text-lg">Meetings</h1>
          <p className="text-xs text-slate-muted mt-0.5">{meetings.length} meeting{meetings.length !== 1 ? 's' : ''}</p>
        </div>
        <motion.button whileTap={{ scale: 0.96 }}
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 text-sm bg-ink text-white rounded-xl px-4 py-2 font-medium hover:bg-ink/90 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New meeting
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
              className="font-mono text-xs uppercase tracking-wider text-slate-muted">Loading…</motion.p>
          </div>
        ) : meetings.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <div className="w-14 h-14 bg-paper-dim rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="4" width="18" height="16" rx="2" stroke="#8A8F98" strokeWidth="1.5" />
                <path d="M7 2v4M15 2v4M2 10h18" stroke="#8A8F98" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="7" cy="15" r="1" fill="#8A8F98" />
                <circle cx="11" cy="15" r="1" fill="#8A8F98" />
                <circle cx="15" cy="15" r="1" fill="#8A8F98" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">No meetings yet</p>
            <p className="text-xs text-slate-muted mt-1 mb-5">Create your first meeting to track notes and action items</p>
            <button onClick={() => setShowNew(true)}
              className="text-sm bg-ink text-white rounded-xl px-5 py-2.5 font-medium hover:bg-ink/90 transition-colors">
              Schedule a meeting
            </button>
          </motion.div>
        ) : (
          <div className="max-w-2xl space-y-3">
            {meetings.map((m, i) => {
              const total = m.meeting_action_items?.length || 0
              const done  = m.meeting_action_items?.filter(a => a.done).length || 0
              const attendeeNames = (m.attendee_ids || [])
                .map(id => members.find(mb => mb.id === id)?.full_name)
                .filter(Boolean)

              return (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(m)}
                  className="w-full text-left bg-white rounded-2xl border border-black/5 shadow-sm p-4 hover:shadow-md hover:border-black/10 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet/8 flex flex-col items-center justify-center shrink-0">
                      <span className="font-bold text-violet text-sm leading-none">
                        {new Date(m.date).getDate()}
                      </span>
                      <span className="font-mono text-[9px] text-violet/60 uppercase">
                        {new Date(m.date).toLocaleString('en-US', { month: 'short' })}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-sm leading-snug">{m.title}</p>
                      {attendeeNames.length > 0 && (
                        <p className="text-xs text-slate-muted mt-0.5">{attendeeNames.join(', ')}</p>
                      )}
                      {m.agenda && (
                        <p className="text-xs text-slate-muted mt-1 line-clamp-1 italic">{m.agenda}</p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {total > 0 && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className="h-1.5 w-16 bg-black/6 rounded-full overflow-hidden">
                            <div className="h-full bg-sage rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
                          </div>
                          <span className="font-mono text-[9px] text-slate-muted">{done}/{total}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-muted mt-1">{fmtDate(m.date)}</p>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNew && (
          <NewMeetingModal members={members} onClose={() => setShowNew(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <MeetingDetail
            meeting={selected}
            members={members}
            projectId={projectId}
            onClose={() => setSelected(null)}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
