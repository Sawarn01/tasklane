import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { submitPulse, getProjectPulse, getTodaysPulse } from '../lib/data'
import { useAuth } from '../lib/AuthContext'

const MOODS = [
  { score: 1, emoji: '😴', label: 'Drained' },
  { score: 2, emoji: '😕', label: 'Low'     },
  { score: 3, emoji: '😐', label: 'Okay'    },
  { score: 4, emoji: '🙂', label: 'Good'    },
  { score: 5, emoji: '🚀', label: 'Pumped'  },
]

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

function last7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function MiniSparkline({ data }) {
  const days   = last7Days()
  const points = days.map(d => {
    const entries = data.filter(x => x.date === d)
    return entries.length ? avg(entries.map(x => x.score)) : null
  })

  const W = 120, H = 30
  const pts = points
    .map((v, i) => v !== null ? { x: (i / 6) * W, y: H - ((v - 1) / 4) * H } : null)
    .filter(Boolean)

  if (pts.length < 2) return null

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6E56CF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#36D399" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#spark-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="url(#spark-grad)" />
      ))}
    </svg>
  )
}

export default function TeamPulse({ projectId }) {
  const { user } = useAuth()
  const [pulseData,    setPulseData]    = useState([])
  const [todayScore,   setTodayScore]   = useState(null)
  const [hovering,     setHovering]     = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [expanded,     setExpanded]     = useState(false)

  useEffect(() => {
    if (!projectId || !user?.id) return
    Promise.all([
      getProjectPulse(projectId),
      getTodaysPulse({ userId: user.id, projectId }),
    ]).then(([data, score]) => {
      setPulseData(data)
      setTodayScore(score)
    })
  }, [projectId, user?.id])

  async function handleMood(score) {
    if (submitting) return
    setSubmitting(true)
    try {
      await submitPulse({ userId: user.id, projectId, score })
      // Update local data optimistically
      const today = new Date().toISOString().slice(0, 10)
      setPulseData(prev => {
        const filtered = prev.filter(x => !(x.date === today))
        return [...filtered, { score, date: today }]
      })
      setTodayScore(score)
      setJustSubmitted(true)
      setTimeout(() => setJustSubmitted(false), 2000)
    } finally { setSubmitting(false) }
  }

  const today     = new Date().toISOString().slice(0, 10)
  const todayData = pulseData.filter(x => x.date === today)
  const teamAvg   = todayData.length ? avg(todayData.map(x => x.score)) : null
  const teamMood  = teamAvg !== null ? MOODS[Math.round(teamAvg) - 1] : null
  const checkins  = todayData.length

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-paper-dim/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet/10 rounded-xl flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1C3.5 1 1 3.2 1 6s2.5 5 5.5 5 5.5-2.2 5.5-5-2.5-5-5.5-5z" stroke="#6E56CF" strokeWidth="1.2" />
              <path d="M4.5 7.5s.5 1.5 2 1.5 2-1.5 2-1.5" stroke="#6E56CF" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="4.5" cy="5.5" r="0.7" fill="#6E56CF" />
              <circle cx="8.5" cy="5.5" r="0.7" fill="#6E56CF" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-ink leading-none">Team Pulse</p>
            {teamMood && !expanded && (
              <p className="text-[10px] text-slate-muted mt-0.5">{teamMood.emoji} {teamMood.label} today · {checkins} check-in{checkins !== 1 ? 's' : ''}</p>
            )}
            {!teamMood && !expanded && (
              <p className="text-[10px] text-slate-muted mt-0.5">How's the team feeling?</p>
            )}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`text-slate-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="M2.5 4.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-black/5 pt-3">

              {/* My check-in */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-2">
                  {todayScore ? 'Your check-in today' : 'How are you feeling today?'}
                </p>
                <div className="flex items-center gap-1.5">
                  {MOODS.map(m => (
                    <motion.button
                      key={m.score}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleMood(m.score)}
                      onMouseEnter={() => setHovering(m.score)}
                      onMouseLeave={() => setHovering(null)}
                      className={`relative text-xl w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        todayScore === m.score
                          ? 'bg-violet/10 ring-2 ring-violet/30 scale-110'
                          : 'hover:bg-paper-dim'
                      }`}
                    >
                      {m.emoji}
                      {(hovering === m.score || todayScore === m.score) && (
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-muted whitespace-nowrap">
                          {m.label}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence>
                  {justSubmitted && (
                    <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-[10px] text-sage mt-5">
                      ✓ Check-in recorded
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Team average + sparkline */}
              {pulseData.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-muted">Team trend (7 days)</p>
                    {teamMood && (
                      <span className="text-xs font-medium text-ink">
                        {teamMood.emoji} {teamAvg?.toFixed(1)} avg · {checkins} today
                      </span>
                    )}
                  </div>
                  <MiniSparkline data={pulseData} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
