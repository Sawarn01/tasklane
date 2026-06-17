import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMessages, sendMessage, getProjectMembers } from '../lib/data'
import { supabase } from '../lib/supabase'
import { useMentionState, MentionDropdown, renderWithMentions } from '../components/MentionInput'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  d.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  yesterday.setHours(0, 0, 0, 0)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
}

function isSameAuthorWithin(msgs, index, minutes = 5) {
  if (index === 0) return false
  const cur = msgs[index]
  const prev = msgs[index - 1]
  if (cur.user_id !== prev.user_id) return false
  const diff = (new Date(cur.created_at) - new Date(prev.created_at)) / 60000
  return diff < minutes
}

export default function ProjectChat() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [members, setMembers] = useState([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const mention = useMentionState(members)

  // Load current user's profile for optimistic messages + project members for @mentions
  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyProfile(data))
      .catch(() => {})
    getProjectMembers(projectId).then(setMembers).catch(() => {})
  }, [user.id, projectId])

  // Stable append helper — inserts a message and deduplicates by id
  const appendMessage = useCallback((msg) => {
    setMessages((prev) => {
      // Replace a matching optimistic temp message if one exists
      const withoutTemp = prev.filter(
        (m) => !(String(m.id).startsWith('temp-') && m.user_id === msg.user_id && m.body === msg.body)
      )
      // Guard against duplicate real IDs (e.g. subscription fires twice)
      if (withoutTemp.some((m) => m.id === msg.id)) return withoutTemp
      return [...withoutTemp, msg]
    })
  }, [])

  useEffect(() => {
    // Initial load
    getMessages(projectId)
      .then((data) => setMessages(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    // Real-time: on INSERT fetch the full row with profile join and append
    const channel = supabase
      .channel(`chat-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const newId = payload.new?.id
          if (!newId) return
          const { data: msg } = await supabase
            .from('messages')
            .select('*, profiles(full_name)')
            .eq('id', newId)
            .single()
          if (msg) appendMessage(msg)
        }
      )
      .subscribe((status) => {
        // If the channel connection fails, fall back to a full reload
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          getMessages(projectId).then(setMessages).catch(() => {})
        }
      })

    return () => supabase.removeChannel(channel)
  }, [projectId, appendMessage])

  // Auto-scroll when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const body = newMessage.trim()
    if (!body) return
    setNewMessage('')

    // Optimistic: show the message immediately without waiting for real-time
    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        body,
        user_id: user.id,
        project_id: projectId,
        created_at: new Date().toISOString(),
        profiles: { full_name: myProfile?.full_name || user?.email?.split('@')[0] || 'You' },
      },
    ])

    try {
      await sendMessage({ projectId, userId: user.id, body })
      // Real-time will fire and replace the temp message via appendMessage
    } catch (err) {
      setError(err.message)
      setNewMessage(body)
      // Roll back the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    }
  }

  function handleKeyDown(e) {
    // Let mention picker handle navigation/selection first
    const consumed = mention.onPickerKeyDown(e, newMessage, inputRef, setNewMessage)
    if (consumed) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="font-mono text-xs uppercase tracking-wider text-slate-muted"
        >
          Loading chat…
        </motion.p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-paper">
      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-red-600 bg-red-50 border-b border-red-200 px-5 py-2.5"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-center"
          >
            <div className="w-14 h-14 bg-white rounded-2xl border border-black/5 shadow-sm flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Start the conversation</p>
              <p className="text-sm text-slate-muted max-w-xs">
                This is the beginning of your team's chat for this project. Say hi!
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => inputRef.current?.focus()}
              className="text-sm text-violet bg-violet/8 px-4 py-2 rounded-xl hover:bg-violet/12 transition-colors"
            >
              Send the first message
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-0.5 max-w-2xl mx-auto">
            {messages.map((m, i) => {
              const isMine = m.user_id === user.id
              const grouped = isSameAuthorWithin(messages, i)
              const showDate = i === 0 || !isSameDay(messages[i - 1].created_at, m.created_at)
              const authorName = m.profiles?.full_name || 'Unknown'
              const authorInitial = authorName[0].toUpperCase()

              return (
                <div key={m.id}>
                  {/* Date divider */}
                  {showDate && (
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-black/5" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-slate-muted px-2">
                        {formatDateLabel(m.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-black/5" />
                    </div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-end gap-2.5 ${isMine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-0.5' : 'mt-3'}`}
                    onMouseEnter={() => setHoveredId(m.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Avatar */}
                    {!isMine && (
                      <div className={`shrink-0 transition-opacity ${grouped ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="w-7 h-7 rounded-full bg-violet/15 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-violet">{authorInitial}</span>
                        </div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-md`}>
                      {/* Author name (only for grouped first message) */}
                      {!isMine && !grouped && (
                        <p className="text-[10px] font-mono text-slate-muted mb-1 ml-1">{authorName}</p>
                      )}

                      {/* Bubble */}
                      <div
                        className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMine
                            ? 'bg-violet text-white rounded-br-sm'
                            : 'bg-white text-ink border border-black/5 shadow-sm rounded-bl-sm'
                        } ${grouped && isMine ? 'rounded-br-2xl' : ''} ${grouped && !isMine ? 'rounded-bl-2xl' : ''}`}
                      >
                        {renderWithMentions(m.body, members, isMine)}
                      </div>

                      {/* Timestamp on hover */}
                      <AnimatePresence>
                        {hoveredId === m.id && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="text-[9px] font-mono text-slate-muted mt-1 mx-1"
                          >
                            {formatTime(m.created_at)}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </div>
              )
            })}
            <div ref={bottomRef} className="h-2" />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-black/5 bg-white px-5 py-3">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-2.5 items-end">
          <div className="flex-1 relative">
            {/* @mention picker */}
            <AnimatePresence>
              {mention.isOpen && (
                <MentionDropdown
                  members={mention.filtered}
                  pickerIdx={mention.pickerIdx}
                  onSelect={(m) => mention.doInsert(m, newMessage, inputRef, setNewMessage)}
                />
              )}
            </AnimatePresence>

            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                mention.detect(e.target.value, e.target.selectionStart)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… type @ to mention someone"
              rows={1}
              style={{ resize: 'none', minHeight: '40px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              className="w-full text-sm rounded-2xl border border-black/10 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-paper-dim placeholder:text-slate-muted/50 transition-all"
            />
            {/* Char hint */}
            {newMessage.length > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute right-3 bottom-2 text-[9px] font-mono text-slate-muted/40"
              >
                {newMessage.length}
              </motion.span>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.93 }}
            type="submit"
            disabled={!newMessage.trim()}
            className="w-9 h-9 bg-violet text-white rounded-xl flex items-center justify-center hover:bg-violet/90 disabled:opacity-40 transition-all shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7H2M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        </form>
        <p className="text-[9px] text-slate-muted/40 font-mono text-center mt-1.5 max-w-2xl mx-auto">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
