import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
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
        (payload) => {
          // fetch the inserted row with the joined profile, since the raw payload won't have it
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
      setNewMessage(body) // restore on failure
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Loading chat...</div>

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] bg-white">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border-b border-red-200 px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={m.user_id === user.id ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-md rounded-lg px-3 py-2 text-sm ${
                m.user_id === user.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-900'
              }`}
            >
              {m.user_id !== user.id && (
                <p className="text-xs font-semibold mb-0.5 opacity-70">{m.profiles?.full_name || 'Unknown'}</p>
              )}
              <p>{m.body}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center mt-8">No messages yet — say hi to your team.</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-slate-200 p-3 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 text-sm rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" className="text-sm bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-700">
          Send
        </button>
      </form>
    </div>
  )
}