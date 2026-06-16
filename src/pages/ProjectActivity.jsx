import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getProjectActivity } from '../lib/data'
import { formatActivity } from '../lib/activityFormat'
import { supabase } from '../lib/supabase'

export default function ProjectActivity() {
  const { projectId } = useParams()
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadActivity()

    const channel = supabase
      .channel(`activity-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `project_id=eq.${projectId}` },
        () => {
          loadActivity()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  async function loadActivity() {
    try {
      const data = await getProjectActivity(projectId)
      setActivity(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-muted font-mono text-xs uppercase tracking-wider">Loading activity...</div>
  }

  return (
    <div className="min-h-screen bg-paper p-6 max-w-2xl">
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {activity.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 py-2.5 border-b border-black/5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-ink">{formatActivity(entry)}</p>
                <p className="font-mono text-[10px] text-slate-muted uppercase tracking-wide mt-0.5">
                  {new Date(entry.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {activity.length === 0 && (
          <p className="text-sm text-slate-muted py-8 text-center">No activity yet.</p>
        )}
      </div>
    </div>
  )
}