import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMeeting, getProjectMembers, completeMeeting, uploadMeetingRecording } from '../lib/data'
import { supabase } from '../lib/supabase'
import { useWebRTC, watchAudioLevel } from '../hooks/useWebRTC'

// ── Icons ─────────────────────────────────────────────────────────────────────
const MicOnIcon    = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="6" y="1" width="6" height="10" rx="3" fill="currentColor" /><path d="M3 9a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="9" y1="15" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="6" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
const MicOffIcon   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M9 1a3 3 0 0 1 3 3v3.5M6 6v4a3 3 0 0 0 5.2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M3 9a6 6 0 0 0 11 3.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="9" y1="15" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="6" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
const CamOnIcon    = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="4" width="11" height="10" rx="2" fill="currentColor" /><path d="M12 7l5-3v10l-5-3V7z" fill="currentColor" opacity="0.7" /></svg>
const CamOffIcon   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M7 4H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 1.7-1M12 9.9V6l5-3v9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
const ScreenIcon   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="2" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M5 16h8M9 14v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M7 9l2-3 2 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><line x1="9" y1="6" x2="9" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
const LeaveIcon    = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M5.4 5.4L3 7.8c1 2 2.5 3.9 4.8 5.2l2.8-2.8M10 4a8 8 0 0 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
const ChatIcon     = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4l3 3 3-3h2a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><line x1="5" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><line x1="5" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
const PeopleIcon   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M1 16c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" opacity="0.6" /><path d="M16 15.5c0-2-1.3-3.5-3-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" /></svg>
const TxIcon       = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><line x1="5" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
const RecIcon = ({ on }) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" /><circle cx="9" cy="9" r="3.5" fill={on ? '#EF4444' : 'currentColor'} /></svg>

// ── Control button ─────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active = true, danger = false, record = false, title, badge = 0, children }) {
  return (
    <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }} onClick={onClick} title={title}
      className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
        ${danger ? 'bg-red-500 hover:bg-red-600 text-white'
        : record ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        : active ? 'bg-white/12 text-white hover:bg-white/18'
                 : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'}`}>
      {children}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet text-white text-[9px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </motion.button>
  )
}

// ── Quality badge ─────────────────────────────────────────────────────────────
function QualityBadge({ tier }) {
  if (!tier || tier === 'high') return null
  const map = { medium: ['M', 'text-amber-400'], low: ['L', 'text-orange-400'], audio: ['A', 'text-red-400'] }
  const [label, cls] = map[tier] || []
  if (!label) return null
  return (
    <span className={`absolute top-2 left-2 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm ${cls}`}>
      {label}
    </span>
  )
}

// ── Video tile ─────────────────────────────────────────────────────────────────
// mirror: wraps the <video> in its own div so scaleX(-1) never affects
//         the overlay nameplate (which would make text appear backwards)
const VideoTile = memo(function VideoTile({ stream, displayName, muted, local, videoEnabled, sfuTier }) {
  const videoRef = useRef(null)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!videoRef.current || !stream) return
    videoRef.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    if (!stream || muted) return
    return watchAudioLevel(stream, lvl => setSpeaking(lvl > 12))
  }, [stream, muted])

  const initials   = (displayName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const showVideo  = Boolean(stream && videoEnabled)

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-[#1a1c2e] flex items-center justify-center w-full h-full transition-shadow
      ${speaking ? 'ring-2 ring-violet' : 'ring-1 ring-white/5'}`}>

      {/* ── Video wrapper — ONLY this is mirrored for the local tile ───────── */}
      {/* Separate wrapper prevents the nameplate overlay from being flipped.   */}
      <div className="absolute inset-0 overflow-hidden" style={{ transform: 'scaleX(-1)' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full object-cover transition-opacity ${showVideo ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      {/* Avatar fallback (video off / not yet loaded) */}
      {!showVideo && (
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-violet/20 border border-violet/30 flex items-center justify-center">
            <span className="text-xl font-bold text-violet">{initials}</span>
          </div>
          <p className="text-white/40 text-xs">{displayName}</p>
        </div>
      )}

      {/* SFU quality badge (top-left) */}
      <QualityBadge tier={sfuTier} />

      {/* Nameplate overlay — NOT inside the mirrored wrapper */}
      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-3 pb-2 pt-6 flex items-end gap-2 z-10">
        {speaking && (
          <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
        )}
        <span className="text-white text-[11px] font-medium truncate">
          {displayName}{local ? ' (You)' : ''}
        </span>
      </div>
    </div>
  )
})

// ── Audio avatar — lightweight for non-featured participants ───────────────────
const AudioAvatar = memo(function AudioAvatar({ stream, displayName }) {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => { if (!stream) return; return watchAudioLevel(stream, l => setSpeaking(l > 12)) }, [stream])
  const initials = (displayName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors   = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444', '#3B82F6']
  const color    = colors[(displayName || '').charCodeAt(0) % colors.length]
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold transition-shadow ${speaking ? 'ring-2 ring-violet' : ''}`}
        style={{ backgroundColor: color }}>{initials}</div>
      <p className="text-white/40 text-[10px] text-center truncate max-w-14">{displayName}</p>
    </div>
  )
})

// ── Tile grid ─────────────────────────────────────────────────────────────────
// ≤8 people: responsive grid  |  9-50 people: SFU-lite speaker view
function TileGrid({ tiles, activeSpeakerId }) {
  const count = tiles.length
  if (!count) return null

  if (count > 8) {
    const speaker = tiles.find(t => t.id === activeSpeakerId) || tiles[0]
    const rest    = tiles.filter(t => t.id !== speaker.id)
    return (
      <div className="flex flex-col h-full gap-3">
        <div className="flex-1 min-h-0">
          <VideoTile stream={speaker.stream} displayName={speaker.name} muted={speaker.muted}
            local={speaker.local} videoEnabled={speaker.videoEnabled} sfuTier={speaker.sfuTier} />
        </div>
        <div className="shrink-0 flex gap-4 overflow-x-auto pb-1 px-1">
          {rest.map(t => <AudioAvatar key={t.id} stream={t.stream} displayName={t.name} />)}
        </div>
      </div>
    )
  }

  if (count === 2) {
    const [a, b] = tiles
    return (
      <div className="relative h-full">
        <VideoTile stream={b.stream} displayName={b.name} muted={b.muted}
          local={b.local} videoEnabled={b.videoEnabled} sfuTier={b.sfuTier} />
        <div className="absolute bottom-3 right-3 w-44 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10" style={{ aspectRatio: '16/9' }}>
          <VideoTile stream={a.stream} displayName={a.name} muted={a.muted}
            local={a.local} videoEnabled={a.videoEnabled} sfuTier={a.sfuTier} />
        </div>
      </div>
    )
  }

  const cols = count === 1 ? 'grid-cols-1' : count <= 4 ? 'grid-cols-2' : count <= 6 ? 'grid-cols-3' : 'grid-cols-4'
  return (
    <div className={`grid ${cols} gap-3 h-full auto-rows-fr`}>
      {tiles.map(t => (
        <VideoTile key={t.id} stream={t.stream} displayName={t.name} muted={t.muted}
          local={t.local} videoEnabled={t.videoEnabled} sfuTier={t.sfuTier} />
      ))}
    </div>
  )
}

// ── In-room chat ───────────────────────────────────────────────────────────────
function RoomChat({ meetingId, userId, displayName }) {
  const [messages, setMessages] = useState([])
  const [draft,    setDraft]    = useState('')
  const bottomRef  = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    const ch = supabase.channel(`meeting-chat-${meetingId}`, {
      config: { broadcast: { self: false, ack: false } },
    })
    channelRef.current = ch
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      setMessages(p => [...p, payload])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
    }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [meetingId])

  function sendMsg() {
    if (!draft.trim()) return
    const msg = { userId, displayName, body: draft.trim(), ts: Date.now() }
    setMessages(p => [...p, msg])
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg })
    setDraft('')
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/8 shrink-0"><p className="text-white font-semibold text-sm">Chat</p></div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!messages.length && <p className="text-white/25 text-xs text-center mt-8">No messages yet</p>}
        {messages.map((m, i) => {
          const mine = m.userId === userId
          return (
            <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && <span className="text-[10px] text-white/40 mb-1 ml-0.5">{m.displayName}</span>}
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-snug ${mine ? 'bg-violet text-white' : 'bg-white/8 text-white/90'}`}>{m.body}</div>
              <span className="text-[9px] text-white/25 mt-1">{new Date(m.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 pb-3 shrink-0">
        <div className="flex gap-2 bg-white/8 rounded-xl p-1.5">
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsg())}
            placeholder="Message everyone…"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 px-2 focus:outline-none" />
          <motion.button whileTap={{ scale: 0.93 }} onClick={sendMsg} disabled={!draft.trim()}
            className="w-8 h-8 rounded-lg bg-violet text-white flex items-center justify-center disabled:opacity-30 shrink-0">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M7 2l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Participants panel ─────────────────────────────────────────────────────────
function ParticipantsPanel({ localName, peers }) {
  const all = [{ id: 'local', name: `${localName} (You)` }, ...Object.entries(peers).map(([id, p]) => ({ id, name: p.displayName || 'Guest' }))]
  const colors = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444', '#3B82F6']
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between">
        <p className="text-white font-semibold text-sm">Participants</p>
        <span className="font-mono text-[10px] text-white/40">{all.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {all.map(p => {
          const initials = (p.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          const color    = colors[(p.name || '').charCodeAt(0) % colors.length]
          return (
            <div key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold" style={{ backgroundColor: color }}>{initials}</div>
              <span className="text-white/80 text-sm truncate">{p.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Transcript panel ───────────────────────────────────────────────────────────
function TranscriptPanel({ lines, interim, transcribing, onStart, onStop, supported, errorMsg }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines.length, interim])
  const fmtTs = ts => {
    const d = new Date(ts)
    return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  }
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-white font-semibold text-sm">Transcript</p>
          {transcribing && <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-sage" />}
        </div>
        {supported
          ? <motion.button whileTap={{ scale: 0.93 }} onClick={transcribing ? onStop : onStart}
              className={`text-[10px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-lg border transition-colors ${transcribing ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-white/15 text-white/50 hover:text-white hover:border-white/30'}`}>
              {transcribing ? 'Stop' : 'Start'}
            </motion.button>
          : <span className="text-[10px] text-white/25">Chrome/Edge only</span>
        }
      </div>

      {errorMsg && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
          {errorMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {supported && !lines.length && !interim && (
          <p className="text-white/25 text-xs text-center mt-10">
            {transcribing ? 'Listening… speak now' : 'Click Start to transcribe live'}
          </p>
        )}
        {!supported && <p className="text-white/25 text-xs text-center mt-10">Requires Chrome or Edge</p>}
        {lines.map((l, i) => (
          <div key={i} className="space-y-0.5">
            <span className="font-mono text-[9px] text-white/25">{fmtTs(l.ts)}</span>
            <p className="text-white/80 text-sm leading-relaxed">{l.text}</p>
          </div>
        ))}
        {interim && <p className="text-white/30 text-sm leading-relaxed italic">{interim}…</p>}
        <div ref={bottomRef} />
      </div>

      {lines.length > 0 && (
        <div className="px-4 py-2 border-t border-white/5 shrink-0">
          <p className="font-mono text-[10px] text-white/20">{lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0)} words · {lines.length} segments</p>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MeetingRoom() {
  const { projectId, meetingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [meeting, setMeeting] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [sidebar, setSidebar] = useState(null)   // null | 'chat' | 'people' | 'transcript'
  const [unread,  setUnread]  = useState(0)

  // ── Active speaker tracking ────────────────────────────────────────────────
  const [activeSpeakerId, setActiveSpeakerId] = useState('local')
  const levelMap   = useRef({})   // id → { level, ts }
  const speakerTmr = useRef(null)

  function reportLevel(id, level) {
    levelMap.current[id] = { level, ts: Date.now() }
    if (speakerTmr.current) return   // throttle to 300ms
    speakerTmr.current = setTimeout(() => {
      speakerTmr.current = null
      const top = Object.entries(levelMap.current).sort((a, b) => b[1].level - a[1].level)[0]
      if (top?.[1]?.level > 15) setActiveSpeakerId(top[0])
    }, 300)
  }

  // ── Recording (auto-starts when stream is ready) ───────────────────────────
  const [recording,  setRecording]  = useState(false)
  const [recElapsed, setRecElapsed] = useState(0)
  const [savingRec,  setSavingRec]  = useState(false)
  const [recError,   setRecError]   = useState(null)
  const mrRef       = useRef(null)   // MediaRecorder
  const chunksRef   = useRef([])
  const recTimerRef = useRef(null)

  const startRecording = useCallback((stream) => {
    if (!stream || mrRef.current) return
    const mt = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'audio/webm'
    try {
      const mr = new MediaRecorder(stream, { mimeType: mt })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(1000)
      mrRef.current = mr
      setRecording(true)
      setRecElapsed(0)
      recTimerRef.current = setInterval(() => setRecElapsed(d => d + 1), 1000)
    } catch {}
  }, [])

  function stopRecordingBlob() {
    return new Promise(resolve => {
      clearInterval(recTimerRef.current)
      setRecording(false)
      const mr = mrRef.current
      if (!mr || mr.state === 'inactive') return resolve(null)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType })
        mrRef.current = null
        resolve(blob.size > 0 ? blob : null)
      }
      mr.stop()
    })
  }

  // ── Transcription — ref-based handlers to eliminate stale closures ─────────
  // The "handler refs" pattern: event callbacks are stored in mutable refs
  // that are updated every render, so they always see the latest state/refs.
  const [txLines,      setTxLines]      = useState([])
  const [interim,      setInterim]      = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [txError,      setTxError]      = useState(null)
  const recogRef       = useRef(null)   // current SpeechRecognition instance
  const transcribingRef = useRef(false) // always-fresh copy for callbacks
  const txLinesRef     = useRef([])
  const txResultRef    = useRef(null)   // handler refs — updated each render
  const txErrorRef     = useRef(null)
  const txEndRef       = useRef(null)

  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

  useEffect(() => { txLinesRef.current = txLines }, [txLines])
  useEffect(() => { transcribingRef.current = transcribing }, [transcribing])

  // Update handlers every render — no stale closures possible
  txResultRef.current = (e) => {
    let im = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        const text = e.results[i][0].transcript.trim()
        if (text) setTxLines(prev => [...prev, { ts: Date.now(), text }])
      } else {
        im += e.results[i][0].transcript
      }
    }
    setInterim(im)
  }

  txErrorRef.current = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      setTxError('Mic access denied — allow microphone in browser settings')
      recogRef.current = null
      setTranscribing(false)
      return
    }
    if (e.error === 'network') {
      setTxError('Speech service network error — check your internet connection')
    }
    // no-speech / audio-capture: let onend handle restart
    if (e.error === 'no-speech') setInterim('')
  }

  txEndRef.current = () => {
    setInterim('')
    if (!transcribingRef.current || !recogRef.current) return
    // Small delay prevents rapid restart loops (e.g. on repeated no-speech)
    const prev = recogRef.current
    setTimeout(() => {
      if (!transcribingRef.current) return
      // Only restart if the recognition that ended is still the current one
      if (recogRef.current !== prev) return
      const next = buildRec()
      recogRef.current = next
      try { next.start() } catch {}
    }, 150)
  }

  function buildRec() {
    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'
    // Use refs so each call goes to the current handler version
    rec.onresult = e => txResultRef.current?.(e)
    rec.onerror  = e => txErrorRef.current?.(e)
    rec.onend    = () => txEndRef.current?.()
    return rec
  }

  const startTranscription = useCallback(() => {
    if (!SR || recogRef.current) return
    setTxError(null)
    const rec = buildRec()
    recogRef.current = rec
    setTranscribing(true)
    setSidebar('transcript')
    try {
      rec.start()
    } catch (err) {
      setTxError('Could not start: ' + err.message)
      recogRef.current = null
      setTranscribing(false)
    }
  }, [SR])

  const stopTranscription = useCallback(() => {
    const rec = recogRef.current
    recogRef.current = null   // clear FIRST — onend checks this and won't restart
    rec?.abort()
    setTranscribing(false)
    setInterim('')
  }, [])

  // ── Session timer ──────────────────────────────────────────────────────────
  const startTs = useRef(Date.now())
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTs.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { if (sidebar === 'chat') setUnread(0) }, [sidebar])

  useEffect(() => {
    Promise.all([getMeeting(meetingId), getProjectMembers(projectId)])
      .then(([m, mem]) => { setMeeting(m); setMembers(mem) })
      .finally(() => setLoading(false))
  }, [meetingId, projectId])

  useEffect(() => {
    return () => {
      clearInterval(recTimerRef.current)
      clearTimeout(speakerTmr.current)
      if (mrRef.current?.state !== 'inactive') mrRef.current?.stop()
      stopTranscription()
    }
  }, [stopTranscription])

  const myProfile = members.find(m => m.id === user?.id)
  const myName    = myProfile?.full_name || 'You'

  const {
    localStream, peers, audioEnabled, videoEnabled,
    screenSharing, status, mediaError,
    toggleAudio, toggleVideo, startScreenShare, stopScreenShare, leave,
    setTxQuality, QUALITY,
  } = useWebRTC({ meetingId, userId: user?.id, displayName: myName, enabled: !loading && !!user })

  // Auto-start recording when we get a stream
  useEffect(() => { if (localStream && !mrRef.current) startRecording(localStream) }, [localStream, startRecording])

  // ── SFU-lite quality management ────────────────────────────────────────────
  // When there are > 8 peers, switch to speaker-priority quality:
  //   active speaker → HIGH to everyone | others → AUDIO (video paused)
  // Under 8 peers, medium quality is fine for all.
  const peerIds = Object.keys(peers)
  useEffect(() => {
    if (peerIds.length <= 8) return
    peerIds.forEach(id => {
      const tier = id === activeSpeakerId ? QUALITY.HIGH : QUALITY.AUDIO
      setTxQuality(id, tier)
    })
  }, [activeSpeakerId, peerIds.join(','), peerIds.length > 8])

  // ── Leave & save ───────────────────────────────────────────────────────────
  async function handleLeave() {
    if (recording || mrRef.current) setSavingRec(true)
    stopTranscription()
    const blob = await stopRecordingBlob()

    let recordingPath = null
    if (blob) {
      try {
        recordingPath = await uploadMeetingRecording({ meetingId, blob })
      } catch (err) {
        console.error('Recording upload failed:', err)
        setRecError('Upload failed — ensure the meeting-recordings bucket exists in Supabase')
        setSavingRec(false)
      }
    }

    const transcript = txLinesRef.current.length
      ? txLinesRef.current.map(l => {
          const d = new Date(l.ts)
          return `[${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}] ${l.text}`
        }).join('\n')
      : null

    try { await completeMeeting({ meetingId, durationSeconds: elapsed, recordingPath, transcript }) } catch {}

    setSavingRec(false)
    leave()
    navigate(`/projects/${projectId}/meetings`)
  }

  function toggleSidebar(panel) {
    setSidebar(s => s === panel ? null : panel)
    if (panel === 'chat') setUnread(0)
  }

  function fmtSecs(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
  }

  const peerList = Object.entries(peers)
  const tiles = [
    { id: 'local', stream: localStream, name: myName, muted: true, local: true, videoEnabled },
    ...peerList.map(([id, p]) => ({ id, stream: p.stream, name: p.displayName || 'Guest', muted: false, local: false, videoEnabled: true, sfuTier: p.txQuality })),
  ]

  return (
    <div className="h-screen bg-[#0a0b0f] flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-ink/80 backdrop-blur border-b border-white/5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={handleLeave} className="text-white/40 hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div>
            <p className="text-white font-semibold text-sm leading-none">{meeting?.title || 'Meeting Room'}</p>
            <p className="font-mono text-[10px] text-white/35 mt-0.5">{fmtSecs(elapsed)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <AnimatePresence>
            {recording && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-red-500/15 border border-red-500/25 px-3 py-1.5 rounded-xl">
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-red-400 text-[11px] font-mono">REC {fmtSecs(recElapsed)}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {transcribing && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-sage/10 border border-sage/25 px-3 py-1.5 rounded-xl">
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="w-2 h-2 rounded-full bg-sage shrink-0" />
                <span className="text-sage text-[11px] font-mono">CC {txLines.length}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {peerIds.length > 8 && (
            <div className="flex items-center gap-1.5 bg-violet/10 border border-violet/20 px-3 py-1.5 rounded-xl">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-violet">
                <path d="M5 1v4l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <span className="text-violet text-[10px] font-mono">SFU-lite · {tiles.length} peers</span>
            </div>
          )}

          <AnimatePresence>
            {savingRec && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-white/50 text-xs">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M11 6A5 5 0 1 1 6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </motion.div>
                Saving…
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {recError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl">
                <span className="text-amber-400 text-[10px] max-w-48 truncate">{recError}</span>
                <button onClick={() => setRecError(null)} className="text-amber-400/50 hover:text-amber-400">×</button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-3.5 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <motion.span
              animate={status === 'connected' ? { opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-sage' : status === 'error' ? 'bg-red-400' : 'bg-amber-400'}`}
            />
            <span className="text-white/35 text-[10px]">
              {status === 'connected' ? `${tiles.length} in room` : status === 'error' ? 'Error' : 'Connecting…'}
            </span>
          </div>
        </div>
      </div>

      {mediaError && (
        <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/20 px-5 py-2">
          <span className="text-amber-400 text-xs">{mediaError === 'both' ? 'Camera and mic access denied.' : 'Camera unavailable — audio only.'}</span>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 min-h-0">
            <TileGrid tiles={tiles} activeSpeakerId={activeSpeakerId} />
          </div>

          {/* Controls */}
          <div className="shrink-0 flex items-center justify-center gap-3 py-4 px-6">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <CtrlBtn onClick={toggleAudio} active={audioEnabled} title={audioEnabled ? 'Mute' : 'Unmute'}>
                {audioEnabled ? <MicOnIcon /> : <MicOffIcon />}
              </CtrlBtn>
              <CtrlBtn onClick={toggleVideo} active={videoEnabled} title={videoEnabled ? 'Stop video' : 'Start video'}>
                {videoEnabled ? <CamOnIcon /> : <CamOffIcon />}
              </CtrlBtn>
              <CtrlBtn onClick={screenSharing ? stopScreenShare : startScreenShare} active={!screenSharing} title={screenSharing ? 'Stop share' : 'Share screen'}>
                <ScreenIcon />
              </CtrlBtn>
              <CtrlBtn onClick={recording ? stopRecordingBlob : () => startRecording(localStream)} record={recording} active={!recording} title={recording ? 'Stop recording' : 'Start recording'}>
                <RecIcon on={recording} />
              </CtrlBtn>
              <div className="w-3" />
              <CtrlBtn onClick={handleLeave} danger title="Leave — saves recording &amp; transcript">
                <LeaveIcon />
              </CtrlBtn>
            </div>
            <div className="flex-1 flex items-center justify-end gap-2">
              <CtrlBtn onClick={() => { if (!transcribing) startTranscription(); toggleSidebar('transcript') }}
                active={sidebar === 'transcript' || transcribing} title="Live transcript">
                <TxIcon />
              </CtrlBtn>
              <CtrlBtn onClick={() => toggleSidebar('people')} active={sidebar === 'people'} title="Participants">
                <PeopleIcon />
              </CtrlBtn>
              <CtrlBtn onClick={() => toggleSidebar('chat')} active={sidebar === 'chat'} badge={sidebar !== 'chat' ? unread : 0} title="Chat">
                <ChatIcon />
              </CtrlBtn>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebar && (
            <motion.div key="sb"
              initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 bg-ink border-l border-white/5 overflow-hidden">
              <div className="w-75 h-full">
                {sidebar === 'chat'       && <RoomChat meetingId={meetingId} userId={user?.id} displayName={myName} />}
                {sidebar === 'people'     && <ParticipantsPanel localName={myName} peers={peers} />}
                {sidebar === 'transcript' && (
                  <TranscriptPanel lines={txLines} interim={interim} transcribing={transcribing}
                    supported={Boolean(SR)} onStart={startTranscription} onStop={stopTranscription} errorMsg={txError} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
