import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getMyNotifications, markNotificationRead, markAllNotificationsRead,
} from '../lib/data'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatTimeAgo } from '../lib/activityFormat'

const TYPE_META = {
  comment:      { icon: '💬', label: 'Comment',  accent: 'bg-blue-50 text-blue-600'   },
  mention:      { icon: '@',  label: 'Mention',   accent: 'bg-violet/10 text-violet'   },
  assigned:     { icon: '→',  label: 'Assigned',  accent: 'bg-sage/15 text-green-700'  },
  chat_message: { icon: '✦',  label: 'Chat',      accent: 'bg-amber-50 text-amber-600' },
}

function notifDestination(n) {
  if (n.type === 'chat_message') return `/projects/${n.project_id}/chat`
  if (n.task_id) return `/projects/${n.project_id}?task=${n.task_id}`
  return `/projects/${n.project_id}`
}

function NotifRow({ n, onRead }) {
  const navigate = useNavigate()
  const meta = TYPE_META[n.type] || { icon: '·', label: n.type, accent: 'bg-paper-dim text-slate-muted' }

  function handleClick() {
    if (!n.read) onRead(n.id)
    navigate(notifDestination(n))
  }

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-4 px-5 py-4 border-b border-black/5 last:border-0 transition-colors hover:bg-paper-dim/40 ${
        !n.read ? 'bg-violet/[0.02]' : ''
      }`}
    >
      {/* Type badge */}
      <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold mt-0.5 ${meta.accent}`}>
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink leading-snug">
          <span className="font-medium">{n.profiles?.full_name || 'Someone'}</span>{' '}
          {n.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-mono text-slate-muted">{formatTimeAgo(n.created_at)}</span>
          <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full ${meta.accent}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Unread dot */}
      <div className={`shrink-0 w-2 h-2 rounded-full mt-2 transition-all ${!n.read ? 'bg-violet' : 'bg-transparent'}`} />
    </motion.button>
  )
}

export default function Notifications() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [notifs, setNotifs]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all') // 'all' | 'unread' | type key
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => { load() }, [])

  // Real-time new notifications
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel(`notifs-page-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('notifications')
          .select('*, profiles!notifications_actor_id_fkey(full_name)')
          .eq('id', payload.new.id).single()
        if (data) setNotifs(prev => [data, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id])

  async function load() {
    setLoading(true)
    try { setNotifs(await getMyNotifications()) }
    finally { setLoading(false) }
  }

  function handleRead(id) {
    markNotificationRead(id).catch(() => {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function handleMarkAll() {
    setMarkingAll(true)
    await markAllNotificationsRead().catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setMarkingAll(false)
  }

  const unread = notifs.filter(n => !n.read)

  const displayed = notifs.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter !== 'all') return n.type === filter
    return true
  })

  const FILTERS = [
    { key: 'all',         label: 'All' },
    { key: 'unread',      label: `Unread (${unread.length})` },
    { key: 'comment',     label: 'Comments' },
    { key: 'mention',     label: 'Mentions' },
    { key: 'assigned',    label: 'Assignments' },
    { key: 'chat_message',label: 'Chat' },
  ]

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-black/5">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-muted hover:text-ink transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex-1">
            <h1 className="text-lg font-bold text-ink">Notifications</h1>
            {unread.length > 0 && (
              <p className="text-xs text-violet font-medium">{unread.length} unread</p>
            )}
          </div>

          {unread.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleMarkAll}
              disabled={markingAll}
              className="text-xs text-violet hover:text-violet/70 font-medium transition-colors disabled:opacity-50"
            >
              {markingAll ? 'Marking…' : 'Mark all read'}
            </motion.button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="max-w-2xl mx-auto px-6 pb-3 flex items-center gap-1 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === f.key
                  ? 'bg-ink text-white font-medium'
                  : 'text-slate-muted hover:text-ink hover:bg-paper-dim'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="font-mono text-xs uppercase tracking-wider text-slate-muted"
            >
              Loading…
            </motion.div>
          </div>
        ) : displayed.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-12 h-12 bg-paper-dim rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1.5a7 7 0 0 1 7 7V12l2 3H1l2-3V8.5a7 7 0 0 1 7-7z" stroke="#8A8F98" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M8 16a2 2 0 0 0 4 0" stroke="#8A8F98" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">All caught up!</p>
            <p className="text-xs text-slate-muted mt-1">
              {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
            </p>
          </motion.div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <AnimatePresence initial={false}>
              {displayed.map((n, i) => (
                <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <NotifRow n={n} onRead={handleRead} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
