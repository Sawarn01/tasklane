import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMessages, sendMessage } from '../lib/data'
import { supabase } from '../lib/supabase'

export default function ProjectChat() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()

    const channel = supabase
      .channel(`messages-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
        () => {
          loadMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    try {
      const data = await getMessages(projectId)
      setMessages(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!newMessage.trim()) return
    const body = newMessage
    setNewMessage('')
    try {
      await sendMessage({ projectId, userId: user.id, body })
    } catch (err) {
      setError(err.message)
      setNewMessage(body)
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-muted font-mono text-xs uppercase tracking-wider">Loading chat...</div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] bg-paper">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-600 bg-red-50 border-b border-red-200 px-4 py-2"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isMine = m.user_id === user.id
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={isMine ? 'text-right' : ''}
              >
                <div
                  className={`inline-block max-w-md rounded-2xl px-3.5 py-2 text-sm ${
                    isMine ? 'bg-violet text-white' : 'bg-white text-ink border border-black/5'
                  }`}
                >
                  {!isMine && (
                    <p className="font-mono text-[10px] uppercase tracking-wide mb-0.5 text-slate-muted">
                      {m.profiles?.full_name || 'Unknown'}
                    </p>
                  )}
                  <p>{m.body}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {messages.length === 0 && (
          <p className="text-sm text-slate-muted text-center mt-8">No messages yet — say hi to your team.</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-black/5 p-3 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 text-sm rounded-full border border-black/10 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet/40 bg-white"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="submit"
          className="text-sm bg-violet text-white rounded-full px-4 py-2 hover:bg-violet/90 transition-colors"
        >
          Send
        </motion.button>
      </form>
    </div>
  )
}