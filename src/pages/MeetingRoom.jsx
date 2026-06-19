import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMeeting, getProjectMembers } from '../lib/data'
import { supabase } from '../lib/supabase'
import { useWebRTC, watchAudioLevel } from '../hooks/useWebRTC'

// ── Icons ─────────────────────────────────────────────────────────────────────
const MicOnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="6" y="1" width="6" height="10" rx="3" fill="currentColor" />
    <path d="M3 9a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="9" y1="15" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
const MicOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 2l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 1a3 3 0 0 1 3 3v3.5M6 6v4a3 3 0 0 0 5.2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 9a6 6 0 0 0 11 3.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="9" y1="15" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
const CamOnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="11" height="10" rx="2" fill="currentColor" />
    <path d="M12 7l5-3v10l-5-3V7z" fill="currentColor" opacity="0.7" />
  </svg>
)
const CamOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 2l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 4H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 1.7-1M12 9.9V6l5-3v9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ScreenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="2" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 16h8M9 14v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 9l2-3 2 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="9" y1="6" x2="9" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)
const PhoneOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 2l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5.4 5.4L3 7.8c1 2 2.5 3.9 4.8 5.2l2.8-2.8M10 4a8 8 0 0 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M15 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4l3 3 3-3h2a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <line x1="5" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="5" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)
const PeopleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1 16c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" opacity="0.6" />
    <path d="M16 15.5c0-2-1.3-3.5-3-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
  </svg>
)

// ── Control button ─────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active = true, danger = false, title, badge, children }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      title={title}
      className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
        danger  ? 'bg-red-500 hover:bg-red-600 text-white' :
        active  ? 'bg-white/12 text-white hover:bg-white/18' :
                  'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet text-white text-[9px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </motion.button>
  )
}

// ── Video tile ─────────────────────────────────────────────────────────────────
function VideoTile({ stream, displayName, muted = false, local = false, videoEnabled = true }) {
  const videoRef = useRef(null)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!videoRef.current || !stream) return
    videoRef.current.srcObject = stream
  }, [stream])

  // Speaking indicator
  useEffect(() => {
    if (!stream || muted) return
    return watchAudioLevel(stream, lvl => setSpeaking(lvl > 12))
  }, [stream, muted])

  const initials = (displayName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const showVideo = stream && videoEnabled

  return (
    <motion.div
      layout
      className={`relative rounded-2xl overflow-hidden bg-[#1a1c2e] flex items-center justify-center transition-shadow ${
        speaking ? 'ring-2 ring-violet shadow-[0_0_0_2px_#6E56CF]' : 'ring-1 ring-white/5'
      }`}
      style={{ aspectRatio: '16/9' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover transition-opacity ${showVideo ? 'opacity-100' : 'opacity-0 absolute'}`}
      />

      {/* Avatar (shown when video off or no stream) */}
      {!showVideo && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-violet/20 border border-violet/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-violet">{initials}</span>
          </div>
          <p className="text-white/50 text-xs">{displayName}</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 flex items-end justify-between">
        <div className="flex items-center gap-1.5">
          {speaking && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-sage"
            />
          )}
          <span className="text-white text-[11px] font-medium drop-shadow">
            {displayName}{local ? ' (You)' : ''}
          </span>
        </div>
        {!videoEnabled && (
          <span className="text-white/40">
            <CamOffIcon />
          </span>
        )}
      </div>

      {/* Local badge */}
      {local && (
        <div className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-wide bg-black/50 text-white/50 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
          You
        </div>
      )}
    </motion.div>
  )
}

// ── In-room chat ───────────────────────────────────────────────────────────────
function RoomChat({ meetingId, userId, displayName }) {
  const [messages, setMessages]   = useState([])
  const [draft,    setDraft]      = useState('')
  const bottomRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    const ch = supabase.channel(`meeting-chat-${meetingId}`, {
      config: { broadcast: { self: true } },
    })
    channelRef.current = ch

    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      setMessages(prev => [...prev, payload])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }).subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [meetingId])

  function send() {
    if (!draft.trim()) return
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat',
      payload: { userId, displayName, body: draft.trim(), ts: Date.now() },
    })
    setDraft('')
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/8 shrink-0">
        <p className="text-white font-semibold text-sm">Chat</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-white/25 text-xs text-center mt-8">No messages yet</p>
        )}
        {messages.map((m, i) => {
          const mine = m.userId === userId
          return (
            <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && (
                <span className="text-[10px] text-white/40 mb-1 ml-0.5">{m.displayName}</span>
              )}
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-snug ${
                mine ? 'bg-violet text-white' : 'bg-white/8 text-white/90'
              }`}>
                {m.body}
              </div>
              <span className="text-[9px] text-white/25 mt-1 mx-0.5">{fmtTime(m.ts)}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-3 shrink-0">
        <div className="flex gap-2 bg-white/8 rounded-xl p-1.5">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Message everyone…"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 px-2 focus:outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={send}
            disabled={!draft.trim()}
            className="w-8 h-8 rounded-lg bg-violet text-white flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 6h10M7 2l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Participants panel ─────────────────────────────────────────────────────────
function ParticipantsPanel({ localName, peers }) {
  const all = [
    { id: 'local', name: `${localName} (You)` },
    ...Object.entries(peers).map(([id, p]) => ({ id, name: p.displayName || 'Guest' })),
  ]
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between">
        <p className="text-white font-semibold text-sm">Participants</p>
        <span className="font-mono text-[10px] text-white/40">{all.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {all.map(p => {
          const initials = (p.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          const colors = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444', '#3B82F6']
          const color  = colors[(p.name || '').charCodeAt(0) % colors.length]
          return (
            <div key={p.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                style={{ backgroundColor: color }}>
                {initials}
              </div>
              <span className="text-white/80 text-sm truncate">{p.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MeetingRoom() {
  const { projectId, meetingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [meeting,  setMeeting]  = useState(null)
  const [members,  setMembers]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [elapsed,  setElapsed]  = useState(0)
  const [sidebar,  setSidebar]  = useState(null)   // null | 'chat' | 'people'
  const [unread,   setUnread]   = useState(0)
  const startTs = useRef(Date.now())

  useEffect(() => {
    Promise.all([getMeeting(meetingId), getProjectMembers(projectId)])
      .then(([m, mem]) => { setMeeting(m); setMembers(mem) })
      .finally(() => setLoading(false))
  }, [meetingId, projectId])

  // Running timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTs.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  // Unread badge
  useEffect(() => {
    if (sidebar === 'chat') setUnread(0)
  }, [sidebar])

  const myProfile  = members.find(m => m.id === user?.id)
  const myName     = myProfile?.full_name || 'You'

  const {
    localStream, peers, audioEnabled, videoEnabled,
    screenSharing, status, mediaError,
    toggleAudio, toggleVideo, startScreenShare, stopScreenShare, leave,
  } = useWebRTC({ meetingId, userId: user?.id, displayName: myName, enabled: !loading && !!user })

  function handleLeave() {
    leave()
    navigate(`/projects/${projectId}/meetings`)
  }

  function toggleSidebar(panel) {
    setSidebar(s => s === panel ? null : panel)
    if (panel === 'chat') setUnread(0)
  }

  function fmt(s) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const mm  = String(m).padStart(2, '0')
    const ss  = String(sec).padStart(2, '0')
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
  }

  const peerList = Object.entries(peers)
  const tiles = [
    { id: 'local', stream: localStream, name: myName, muted: true, local: true, videoEnabled },
    ...peerList.map(([id, p]) => ({
      id, stream: p.stream, name: p.displayName || 'Guest', muted: false, local: false, videoEnabled: true,
    })),
  ]

  const count = tiles.length
  const gridClass =
    count === 1                     ? 'grid-cols-1' :
    count === 2                     ? 'grid-cols-2' :
    count <= 4                      ? 'grid-cols-2' :
    count <= 9                      ? 'grid-cols-3' : 'grid-cols-4'

  // Full-screen for single remote participant — make local tile smaller
  const featuredLayout = count === 2

  return (
    <div className="h-screen bg-[#0a0b0f] flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-[#0F1115]/80 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="text-white/40 hover:text-white transition-colors"
            title="Back to meetings"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p className="text-white font-semibold text-sm leading-none">{meeting?.title || 'Meeting Room'}</p>
            <p className="font-mono text-[10px] text-white/35 mt-0.5">{fmt(elapsed)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <motion.span
              animate={status === 'connected' ? { opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected' ? 'bg-sage' :
                status === 'error'     ? 'bg-red-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-white/35 text-[10px]">
              {status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Connecting…'}
            </span>
          </div>
          <div className="h-3.5 w-px bg-white/10" />
          <span className="text-white/35 text-[10px]">
            {count} participant{count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Media error banner */}
      {mediaError && (
        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }}
          className="shrink-0 bg-amber-500/15 border-b border-amber-500/20 px-5 py-2.5 flex items-center gap-2"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1L12 11H1L6.5 1z" stroke="#F59E0B" strokeWidth="1.3" />
            <line x1="6.5" y1="5" x2="6.5" y2="8" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="6.5" cy="9.5" r="0.7" fill="#F59E0B" />
          </svg>
          <span className="text-amber-400 text-xs">
            {mediaError === 'both'
              ? 'Camera and microphone access denied. Others cannot see or hear you.'
              : 'Camera not available — joining with audio only.'}
          </span>
        </motion.div>
      )}

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">

        {/* Video area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-4">
            {featuredLayout ? (
              // 2-person layout: remote fills space, local is pip
              <div className="relative h-full">
                <VideoTile
                  stream={tiles[1].stream}
                  displayName={tiles[1].name}
                  muted={false}
                  local={false}
                  videoEnabled
                />
                {/* PiP local */}
                <div className="absolute bottom-3 right-3 w-48 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <VideoTile
                    stream={tiles[0].stream}
                    displayName={tiles[0].name}
                    muted
                    local
                    videoEnabled={videoEnabled}
                  />
                </div>
              </div>
            ) : (
              <div className={`grid ${gridClass} gap-3 h-full auto-rows-fr`}>
                {tiles.map(t => (
                  <VideoTile key={t.id} {...t} />
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="shrink-0 flex items-center justify-center gap-3 py-4 px-6">
            {/* Left spacer */}
            <div className="flex-1" />

            {/* Core controls */}
            <div className="flex items-center gap-3">
              <CtrlBtn onClick={toggleAudio} active={audioEnabled} title={audioEnabled ? 'Mute mic' : 'Unmute mic'}>
                {audioEnabled ? <MicOnIcon /> : <MicOffIcon />}
              </CtrlBtn>
              <CtrlBtn onClick={toggleVideo} active={videoEnabled} title={videoEnabled ? 'Stop camera' : 'Start camera'}>
                {videoEnabled ? <CamOnIcon /> : <CamOffIcon />}
              </CtrlBtn>
              <CtrlBtn
                onClick={screenSharing ? stopScreenShare : startScreenShare}
                active={!screenSharing}
                title={screenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <ScreenIcon />
              </CtrlBtn>

              {/* Leave — larger gap before */}
              <div className="w-3" />
              <CtrlBtn onClick={handleLeave} danger title="Leave meeting">
                <PhoneOffIcon />
              </CtrlBtn>
            </div>

            {/* Right: chat + people */}
            <div className="flex-1 flex items-center justify-end gap-2">
              <CtrlBtn
                onClick={() => toggleSidebar('people')}
                active={sidebar === 'people'}
                title="Participants"
              >
                <PeopleIcon />
              </CtrlBtn>
              <CtrlBtn
                onClick={() => toggleSidebar('chat')}
                active={sidebar === 'chat'}
                badge={sidebar !== 'chat' ? unread : 0}
                title="Chat"
              >
                <ChatIcon />
              </CtrlBtn>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebar && (
            <motion.div
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 bg-[#0F1115] border-l border-white/5 overflow-hidden"
              style={{ width: 300 }}
            >
              <div className="w-[300px] h-full">
                {sidebar === 'chat' && (
                  <RoomChat
                    meetingId={meetingId}
                    userId={user?.id}
                    displayName={myName}
                  />
                )}
                {sidebar === 'people' && (
                  <ParticipantsPanel localName={myName} peers={peers} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
