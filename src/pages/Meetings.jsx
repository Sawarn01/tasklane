import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getMeetings, getProject, createMeeting, updateMeeting, deleteMeeting,
  getMeetingActionItems, createActionItem, toggleActionItem, actionItemToTask,
  getProjectMembers, sendMeetingInvites, getMeetingRecordingUrl,
} from '../lib/data'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDuration(secs) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
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

// ── Full-screen recording modal ───────────────────────────────────
function RecordingModal({ url, title, date, duration, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/92 z-60 backdrop-blur-md"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-61 flex flex-col items-center justify-center p-6 pointer-events-none"
      >
        <div className="w-full max-w-4xl pointer-events-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-base leading-tight">{title}</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-white/40 text-xs">{date}</p>
                {duration && (
                  <span className="flex items-center gap-1 text-white/40 text-xs">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M5 3v2l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                    </svg>
                    {duration}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Download */}
              <a
                href={url}
                download
                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-xl transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v7M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M1 9v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Download
              </a>

              {/* Close */}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Video */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0a0b0f] shadow-2xl ring-1 ring-white/8">
            <video
              ref={videoRef}
              src={url}
              controls
              autoPlay
              className="w-full"
              style={{ maxHeight: '72vh' }}
            />
          </div>

          <p className="text-center text-white/20 text-[11px] mt-3">
            Press <kbd className="font-mono bg-white/8 px-1.5 py-0.5 rounded-md text-white/35">Esc</kbd> to close
          </p>
        </div>
      </motion.div>
    </>
  )
}

// ── Recording player ──────────────────────────────────────────────
function RecordingPlayer({ recordingPath, meetingTitle, meetingDate, meetingDuration }) {
  const [url,       setUrl]       = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(false)
  const [showModal, setShowModal] = useState(false)

  async function open() {
    if (url) { setShowModal(true); return }
    setLoading(true)
    try {
      const signed = await getMeetingRecordingUrl(recordingPath)
      if (!signed) throw new Error()
      setUrl(signed)
      setShowModal(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Preview card */}
      <motion.div
        onClick={error ? undefined : open}
        whileHover={error ? {} : { scale: 1.01 }}
        whileTap={error ? {} : { scale: 0.99 }}
        className={`relative rounded-2xl overflow-hidden bg-[#0d0e14] border border-white/6 ${error ? '' : 'cursor-pointer group'}`}
        style={{ aspectRatio: '16/9', maxHeight: 200 }}
      >
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {loading ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M20 11A9 9 0 1 1 11 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </motion.div>
              <p className="text-white/40 text-xs">Loading recording…</p>
            </>
          ) : error ? (
            <>
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L14 13H2L8 2z" stroke="#EF4444" strokeWidth="1.4" strokeLinejoin="round" />
                  <line x1="8" y1="7" x2="8" y2="9.5" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="8" cy="11.5" r="0.8" fill="#EF4444" />
                </svg>
              </div>
              <p className="text-red-400/80 text-xs">Recording unavailable</p>
            </>
          ) : (
            <>
              <motion.div
                className="w-14 h-14 rounded-full bg-white/10 group-hover:bg-white/18 flex items-center justify-center transition-colors"
                whileHover={{ scale: 1.08 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7 5l10 5-10 5V5z" fill="white" />
                </svg>
              </motion.div>
              <p className="text-white/40 text-xs group-hover:text-white/60 transition-colors">
                Click to watch recording
              </p>
            </>
          )}
        </div>

        {/* Duration badge */}
        {meetingDuration && !error && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white/70 text-[10px] font-mono px-2 py-0.5 rounded-lg">
            {meetingDuration}
          </div>
        )}

        {/* REC label */}
        {!error && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[9px] font-mono uppercase tracking-wide text-white/60">Rec</span>
          </div>
        )}
      </motion.div>

      {/* Full-screen modal */}
      <AnimatePresence>
        {showModal && url && (
          <RecordingModal
            url={url}
            title={meetingTitle}
            date={meetingDate}
            duration={meetingDuration}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── New Meeting Modal ─────────────────────────────────────────────
function NewMeetingModal({ members, onClose, onCreate }) {
  const [title,      setTitle]      = useState('')
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [time,       setTime]       = useState('')
  const [agenda,     setAgenda]     = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [attendees,  setAttendees]  = useState([])
  const [saving,     setSaving]     = useState(false)

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onCreate({ title: title.trim(), date, time, agenda, meetingUrl, attendeeIds: attendees })
    } finally { setSaving(false) }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-black/5 w-full max-w-md pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="px-5 pt-5 pb-4 border-b border-black/5 flex items-center justify-between sticky top-0 bg-white z-10">
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1.5">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-violet/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1.5">Time (optional)</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-violet/40 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1.5">Meeting link (optional)</label>
              <div className="relative">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted">
                  <path d="M5 8.5l3-3M8.5 3.5A2.5 2.5 0 1 1 12 7l-1.5 1.5M5 9.5A2.5 2.5 0 1 1 1 6l1.5-1.5"
                    stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/…"
                  className="w-full border border-black/10 rounded-xl pl-8 pr-3 py-2 text-sm text-ink placeholder:text-slate-muted focus:outline-none focus:border-violet/40 transition-colors"
                />
              </div>
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
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-2">
                  Attendees
                  {attendees.length > 0 && (
                    <span className="ml-2 text-violet normal-case font-normal">
                      — invite email will be sent to {attendees.length} person{attendees.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </label>
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
              {saving ? 'Creating…' : 'Create & invite'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function formatTime12(t) {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr), m = Number(mStr)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ── Transcript section ────────────────────────────────────────────
function TranscriptSection({ transcript, meetingTitle }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(transcript).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${meetingTitle || 'meeting'}-transcript.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const wordCount = transcript.trim().split(/\s+/).length
  const lines     = transcript.split('\n').filter(Boolean)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-slate-muted">
            <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="3" y1="3.5" x2="8" y2="3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <line x1="3" y1="5.5" x2="8" y2="5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <line x1="3" y1="7.5" x2="6" y2="7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
          Transcript
          <span className="text-slate-muted/50 normal-case font-sans tracking-normal font-normal">
            {wordCount} words · {lines.length} segments
          </span>
        </p>
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] text-slate-muted hover:text-violet border border-black/8 hover:border-violet/25 px-2.5 py-1 rounded-lg transition-colors">
            {copied ? (
              <>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#36D399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sage">Copied</span>
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="3.5" y="1" width="5.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M1 3.5v5a1 1 0 0 0 1 1h4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                Copy
              </>
            )}
          </motion.button>
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleDownload}
            className="flex items-center gap-1.5 text-[10px] text-slate-muted hover:text-violet border border-black/8 hover:border-violet/25 px-2.5 py-1 rounded-lg transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v6M2.5 5l2.5 2.5L7.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 8.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            .txt
          </motion.button>
        </div>
      </div>

      {/* Transcript lines */}
      <div className="bg-paper-dim rounded-2xl p-4 space-y-3 max-h-80 overflow-y-auto">
        {lines.map((line, i) => {
          const tsMatch = line.match(/^\[(\d{2}:\d{2})\]\s*(.*)$/)
          if (tsMatch) {
            return (
              <div key={i} className="flex gap-3">
                <span className="font-mono text-[10px] text-slate-muted shrink-0 pt-0.5 w-10">{tsMatch[1]}</span>
                <p className="text-sm text-ink leading-relaxed">{tsMatch[2]}</p>
              </div>
            )
          }
          return <p key={i} className="text-sm text-ink leading-relaxed">{line}</p>
        })}
      </div>
    </div>
  )
}

// ── Meeting Detail Panel ──────────────────────────────────────────
function MeetingDetail({ meeting, members, projectId, currentUserId, onClose, onUpdated, onDeleted }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes,       setNotes]       = useState(meeting.notes       || '')
  const [decisions,   setDecisions]   = useState(meeting.decisions   || '')
  const [meetingUrl,  setMeetingUrl]  = useState(meeting.meeting_url || '')
  const [meetingTime, setMeetingTime] = useState(
    meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : ''
  )
  const [items,       setItems]       = useState([])
  const [newItem,     setNewItem]     = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [converting,  setConverting]  = useState(null)
  const notesDebounce = useRef(null)
  const urlDebounce   = useRef(null)

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

  function autoSaveUrl(val) {
    clearTimeout(urlDebounce.current)
    urlDebounce.current = setTimeout(() => {
      updateMeeting({ meetingId: meeting.id, meetingUrl: val }).catch(() => {})
      onUpdated?.({ ...meeting, meeting_url: val })
    }, 800)
  }

  function autoSaveTime(val) {
    updateMeeting({ meetingId: meeting.id, time: val || null }).catch(() => {})
    onUpdated?.({ ...meeting, meeting_time: val || null })
  }

  const isHost     = meeting.created_by === currentUserId
  const isAttendee = (meeting.attendee_ids || []).includes(currentUserId)
  const canJoin    = (isHost || isAttendee) && meetingUrl
  const isCompleted = meeting.status === 'completed'

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
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted">{fmtDate(meeting.date)}</p>
                {isCompleted && (
                  <span className="text-[9px] font-mono uppercase tracking-wide bg-sage/10 text-sage px-2 py-0.5 rounded-full">
                    Completed
                  </span>
                )}
                {meeting.duration_seconds && (
                  <span className="text-[10px] text-slate-muted flex items-center gap-1">
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1" />
                      <path d="M4.5 2.5v2l1.3 1.3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    {fmtDuration(meeting.duration_seconds)}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-slate-muted shrink-0">
                    <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 3v2l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <input
                    type="time" value={meetingTime}
                    onChange={e => { setMeetingTime(e.target.value); autoSaveTime(e.target.value) }}
                    className="text-[10px] font-mono text-slate-muted bg-transparent border-none outline-none cursor-pointer hover:text-ink transition-colors w-24"
                  />
                </div>
              </div>

              <h2 className="font-bold text-ink text-base leading-tight">{meeting.title}</h2>

              {attendeeNames.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {isHost && <span className="text-[9px] font-mono uppercase text-violet tracking-wide">Host</span>}
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
              {!isCompleted && (isHost || isAttendee) && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/projects/${projectId}/meetings/${meeting.id}/room`)}
                  className="flex items-center gap-1.5 text-xs bg-violet text-white px-3 py-1.5 rounded-xl font-medium hover:bg-violet/90 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="1" y="2.5" width="7" height="6" rx="1" fill="white" />
                    <path d="M8 4.5l2.5-1.5v5L8 6.5V4.5z" fill="white" opacity="0.7" />
                  </svg>
                  {isHost ? 'Start Room' : 'Join Room'}
                </motion.button>
              )}
              {canJoin && (
                <a href={meetingUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-slate-muted hover:text-ink transition-colors underline underline-offset-2">
                  External ↗
                </a>
              )}
              {isHost && (
                <button onClick={handleDelete} className="p-1.5 text-slate-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 3.5h9M5 3.5V2.5h3v1M4.5 3.5l.5 7h3l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-slate-muted hover:text-ink transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Recording */}
          {isCompleted && meeting.recording_url && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-3 flex items-center gap-2">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-400 inline-block"
                />
                Recording
              </p>
              <RecordingPlayer
                recordingPath={meeting.recording_url}
                meetingTitle={meeting.title}
                meetingDate={fmtDate(meeting.date)}
                meetingDuration={fmtDuration(meeting.duration_seconds)}
              />
            </div>
          )}

          {/* Transcript */}
          {isCompleted && meeting.transcript && (
            <TranscriptSection transcript={meeting.transcript} meetingTitle={meeting.title} />
          )}

          {/* Agenda */}
          {meeting.agenda && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-2">Agenda</p>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-paper-dim rounded-xl p-3">{meeting.agenda}</p>
            </div>
          )}

          {/* Meeting link */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-2">Meeting Link</p>
            <div className="relative">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted">
                <path d="M5 7.5l2.5-2.5M7.5 3A2 2 0 1 1 11 6.5L10 7.5M5 8.5A2 2 0 1 1 1.5 5l1-1"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <input
                value={meetingUrl}
                onChange={e => { setMeetingUrl(e.target.value); autoSaveUrl(e.target.value) }}
                placeholder="Add a Zoom, Meet, or Teams link…"
                className="w-full border border-black/8 rounded-xl pl-8 pr-3 py-2 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:border-violet/30 transition-colors bg-paper-dim/30"
              />
            </div>
          </div>

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

                    {item.profiles?.full_name && <Avatar name={item.profiles.full_name} size={5} />}

                    {!item.task_id && !item.done && (
                      <button
                        onClick={() => convertItem(item)}
                        disabled={converting === item.id}
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

// ── Upcoming meeting card ─────────────────────────────────────────
function UpcomingCard({ m, i, members, projectId, onClick, onJoin }) {
  const total = m.meeting_action_items?.length || 0
  const done  = m.meeting_action_items?.filter(a => a.done).length || 0
  const attendeeNames = (m.attendee_ids || [])
    .map(id => members.find(mb => mb.id === id)?.full_name)
    .filter(Boolean)

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-black/5 shadow-sm p-4 hover:shadow-md hover:border-black/10 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet/8 flex flex-col items-center justify-center shrink-0">
          <span className="font-bold text-violet text-sm leading-none">{new Date(m.date).getDate()}</span>
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

        <div className="shrink-0 text-right flex flex-col items-end gap-2">
          {total > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-16 bg-black/6 rounded-full overflow-hidden">
                <div className="h-full bg-sage rounded-full" style={{ width: `${(done / total) * 100}%` }} />
              </div>
              <span className="font-mono text-[9px] text-slate-muted">{done}/{total}</span>
            </div>
          )}
          <p className="text-[10px] text-slate-muted">
            {fmtDate(m.date)}{m.meeting_time ? ` · ${formatTime12(m.meeting_time)}` : ''}
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={e => { e.stopPropagation(); onJoin() }}
            className="flex items-center gap-1 text-[10px] font-medium text-violet border border-violet/25 hover:bg-violet hover:text-white hover:border-violet px-2.5 py-1 rounded-lg transition-all"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <rect x="0.5" y="2" width="5.5" height="5" rx="1" fill="currentColor" />
              <path d="M6 3.5l2.5-1.5v5L6 5.5V3.5z" fill="currentColor" opacity="0.7" />
            </svg>
            Join Room
          </motion.button>
        </div>
      </div>
    </motion.button>
  )
}

// ── Completed meeting card ────────────────────────────────────────
function CompletedCard({ m, i, members, onClick }) {
  const total = m.meeting_action_items?.length || 0
  const done  = m.meeting_action_items?.filter(a => a.done).length || 0
  const attendeeNames = (m.attendee_ids || [])
    .map(id => members.find(mb => mb.id === id)?.full_name)
    .filter(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
      className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden"
    >
      <button
        onClick={onClick}
        className="w-full text-left p-4 hover:bg-paper-dim/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage/10 flex flex-col items-center justify-center shrink-0">
            <span className="font-bold text-sage text-sm leading-none">{new Date(m.date).getDate()}</span>
            <span className="font-mono text-[9px] text-sage/70 uppercase">
              {new Date(m.date).toLocaleString('en-US', { month: 'short' })}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-semibold text-ink text-sm leading-snug">{m.title}</p>
              <span className="text-[9px] font-mono uppercase tracking-wide bg-sage/10 text-sage px-1.5 py-0.5 rounded-full">Done</span>
              {m.recording_url && (
                <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Recording
                </span>
              )}
              {m.transcript && (
                <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-violet bg-violet/8 px-1.5 py-0.5 rounded-full">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <rect x="0.5" y="0.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="0.8" />
                    <line x1="2" y1="2.5" x2="6" y2="2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                    <line x1="2" y1="4"   x2="6" y2="4"   stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                    <line x1="2" y1="5.5" x2="4" y2="5.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                  </svg>
                  Transcript
                </span>
              )}
            </div>
            {attendeeNames.length > 0 && (
              <p className="text-xs text-slate-muted">{attendeeNames.join(', ')}</p>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {m.duration_seconds && (
              <span className="text-[10px] text-slate-muted font-mono">{fmtDuration(m.duration_seconds)}</span>
            )}
            {total > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-14 bg-black/6 rounded-full overflow-hidden">
                  <div className="h-full bg-sage rounded-full" style={{ width: `${(done / total) * 100}%` }} />
                </div>
                <span className="font-mono text-[9px] text-slate-muted">{done}/{total}</span>
              </div>
            )}
            <p className="text-[10px] text-slate-muted">{fmtDate(m.date)}</p>
          </div>
        </div>
      </button>

      {/* Inline recording player */}
      {m.recording_url && (
        <div className="px-4 pb-4 border-t border-black/4 pt-3">
          <div className="flex items-center gap-2 mb-3">
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-red-400 shrink-0"
            />
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-muted">Meeting recording</p>
          </div>
          <RecordingPlayer
            recordingPath={m.recording_url}
            meetingTitle={m.title}
            meetingDate={fmtDate(m.date)}
            meetingDuration={fmtDuration(m.duration_seconds)}
          />
        </div>
      )}
    </motion.div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function Meetings() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [meetings,     setMeetings]     = useState([])
  const [members,      setMembers]      = useState([])
  const [project,      setProject]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [showNew,      setShowNew]      = useState(false)
  const [selected,     setSelected]     = useState(null)
  const [tab,          setTab]          = useState('upcoming')
  const [inviteStatus, setInviteStatus] = useState(null)

  useEffect(() => {
    Promise.all([getMeetings(projectId), getProjectMembers(projectId), getProject(projectId)])
      .then(([m, mem, proj]) => { setMeetings(m); setMembers(mem); setProject(proj) })
      .finally(() => setLoading(false))
  }, [projectId])

  const today     = new Date().toISOString().slice(0, 10)
  const upcoming  = meetings.filter(m => m.status !== 'completed' && m.date >= today)
  const completed = meetings.filter(m => m.status === 'completed' || m.date < today)

  const myProfile = members.find(m => m.id === user?.id)

  async function handleCreate(fields) {
    const m = await createMeeting({ ...fields, projectId, userId: user.id })
    setMeetings(prev => [m, ...prev])
    setShowNew(false)
    setSelected(m)

    if (fields.attendeeIds?.length) {
      setInviteStatus('sending')
      sendMeetingInvites({
        meeting:     m,
        hostName:    myProfile?.full_name || 'A teammate',
        projectName: project?.name || 'Tasklane',
      }).then(() => {
        setInviteStatus('sent')
        setTimeout(() => setInviteStatus(null), 3000)
      }).catch(() => setInviteStatus(null))
    }
  }

  function handleUpdated(updated) {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m))
    if (selected?.id === updated.id) setSelected(updated)
  }

  function handleDeleted(id) {
    setMeetings(prev => prev.filter(m => m.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const activeList = tab === 'upcoming' ? upcoming : completed

  return (
    <div className="flex flex-col h-full bg-paper">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-black/5 bg-paper shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-bold text-ink text-lg">Meetings</h1>
            <p className="text-xs text-slate-muted mt-0.5">{meetings.length} total · {completed.length} completed</p>
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

        {/* Tabs */}
        <div className="flex gap-1 bg-paper-dim rounded-xl p-1">
          {[
            { key: 'upcoming',  label: 'Upcoming',  count: upcoming.length },
            { key: 'completed', label: 'Completed', count: completed.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg transition-all ${
                tab === t.key ? 'bg-white text-ink shadow-sm' : 'text-slate-muted hover:text-ink'
              }`}
            >
              {t.label}
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-violet/10 text-violet' : 'bg-black/5 text-slate-muted'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
              className="font-mono text-xs uppercase tracking-wider text-slate-muted">Loading…</motion.p>
          </div>
        ) : activeList.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <div className="w-14 h-14 bg-paper-dim rounded-2xl flex items-center justify-center mx-auto mb-4">
              {tab === 'upcoming' ? (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="2" y="4" width="18" height="16" rx="2" stroke="#8A8F98" strokeWidth="1.5" />
                  <path d="M7 2v4M15 2v4M2 10h18" stroke="#8A8F98" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="#36D399" strokeWidth="1.5" />
                  <path d="M7 11l3 3 5-5" stroke="#36D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-ink">
              {tab === 'upcoming' ? 'No upcoming meetings' : 'No completed meetings yet'}
            </p>
            <p className="text-xs text-slate-muted mt-1 mb-5">
              {tab === 'upcoming'
                ? 'Schedule a meeting to track notes, action items, and recordings'
                : 'Meetings you\'ve hosted will appear here once the session ends'}
            </p>
            {tab === 'upcoming' && (
              <button onClick={() => setShowNew(true)}
                className="text-sm bg-ink text-white rounded-xl px-5 py-2.5 font-medium hover:bg-ink/90 transition-colors">
                Schedule a meeting
              </button>
            )}
          </motion.div>
        ) : (
          <div className="max-w-2xl space-y-3">
            {tab === 'upcoming'
              ? upcoming.map((m, i) => (
                  <UpcomingCard
                    key={m.id}
                    m={m}
                    i={i}
                    members={members}
                    projectId={projectId}
                    onClick={() => setSelected(m)}
                    onJoin={() => navigate(`/projects/${projectId}/meetings/${m.id}/room`)}
                  />
                ))
              : completed.map((m, i) => (
                  <CompletedCard
                    key={m.id}
                    m={m}
                    i={i}
                    members={members}
                    onClick={() => setSelected(m)}
                  />
                ))
            }
          </div>
        )}
      </div>

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
            currentUserId={user?.id}
            onClose={() => setSelected(null)}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>

      {/* Invite toast */}
      <AnimatePresence>
        {inviteStatus && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-ink text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl"
          >
            {inviteStatus === 'sending' ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M11 6A5 5 0 1 1 6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </motion.div>
                Sending invites…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#36D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Invites sent to attendees
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
