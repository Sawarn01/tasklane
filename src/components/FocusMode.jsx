import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { logTime } from '../lib/data'
import { useAuth } from '../lib/AuthContext'

const FocusCtx = createContext(null)

export function useFocus() {
  return useContext(FocusCtx)
}

export function FocusModeProvider({ children }) {
  const { user } = useAuth()
  const [task, setTask]           = useState(null)
  const [duration, setDuration]   = useState(25)    // minutes
  const [elapsed, setElapsed]     = useState(0)     // seconds
  const [running, setRunning]     = useState(false)
  const [completed, setCompleted] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pendingTask, setPendingTask] = useState(null)
  const [pickerMins, setPickerMins]  = useState(25)
  const timerRef  = useRef(null)
  const anchorRef = useRef(0) // Date.now() when this run of the timer started

  const totalSeconds = duration * 60
  const remaining    = Math.max(0, totalSeconds - elapsed)
  const progress     = Math.min(1, elapsed / totalSeconds)

  // Timer tick
  useEffect(() => {
    if (!running) { clearInterval(timerRef.current); return }
    anchorRef.current = Date.now() - elapsed * 1000
    timerRef.current = setInterval(() => {
      const e = Math.floor((Date.now() - anchorRef.current) / 1000)
      if (e >= totalSeconds) {
        clearInterval(timerRef.current)
        setElapsed(totalSeconds)
        setRunning(false)
        setCompleted(true)
        if (task && user?.id) {
          logTime({ taskId: task.id, userId: user.id, minutes: duration, description: `Focus session` }).catch(() => {})
        }
      } else {
        setElapsed(e)
      }
    }, 500)
    return () => clearInterval(timerRef.current)
  }, [running])

  function openPicker(t) {
    setPendingTask(t)
    setPickerMins(25)
    setShowPicker(true)
  }

  function confirmStart() {
    setTask(pendingTask)
    setDuration(pickerMins)
    setElapsed(0)
    setRunning(true)
    setCompleted(false)
    setShowPicker(false)
  }

  const pause  = useCallback(() => setRunning(false), [])
  const resume = useCallback(() => setRunning(true),  [])

  const stop = useCallback((log = true) => {
    clearInterval(timerRef.current)
    setRunning(false)
    if (log && task && user?.id && elapsed >= 60) {
      const mins = Math.round(elapsed / 60)
      logTime({ taskId: task.id, userId: user.id, minutes: mins, description: 'Focus session (early stop)' }).catch(() => {})
    }
    setTask(null); setElapsed(0); setCompleted(false)
  }, [task, user, elapsed])

  return (
    <FocusCtx.Provider value={{ task, start: openPicker, stop, pause, resume, running, active: !!task }}>
      {children}

      {/* ── Duration picker ── */}
      <AnimatePresence>
        {showPicker && pendingTask && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-black/5 w-80 pointer-events-auto overflow-hidden">
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🎯</span>
                    <h3 className="font-bold text-ink text-sm">Start Focus Session</h3>
                  </div>
                  <p className="text-xs text-slate-muted truncate mt-0.5 ml-6">{pendingTask.title}</p>
                </div>

                {/* Duration selector */}
                <div className="px-5 pb-4">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-2">Duration</p>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[15, 25, 45, 60].map(m => (
                      <button key={m} onClick={() => setPickerMins(m)}
                        className={`text-sm font-semibold py-2 rounded-xl transition-colors ${
                          pickerMins === m ? 'bg-ink text-white' : 'bg-paper-dim text-ink hover:bg-paper-dim/80'
                        }`}
                      >{m}m</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min="5" max="120" step="5" value={pickerMins}
                      onChange={e => setPickerMins(Number(e.target.value))}
                      className="flex-1 accent-violet"
                    />
                    <span className="font-mono text-sm text-ink w-12 text-right">{pickerMins} min</span>
                  </div>
                </div>

                <div className="px-5 pb-5 flex gap-3">
                  <button onClick={() => setShowPicker(false)}
                    className="flex-1 text-sm border border-black/10 rounded-xl py-2.5 text-slate-muted hover:text-ink hover:border-black/20 transition-colors">
                    Cancel
                  </button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={confirmStart}
                    className="flex-1 text-sm bg-violet text-white rounded-xl py-2.5 font-medium hover:bg-violet/90 transition-colors">
                    Start focusing
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Floating widget ── */}
      <AnimatePresence>
        {task && (
          <FocusWidget
            task={task}
            elapsed={elapsed}
            remaining={remaining}
            progress={progress}
            running={running}
            completed={completed}
            duration={duration}
            onPause={pause}
            onResume={resume}
            onStop={stop}
            onRestart={() => { stop(false); openPicker(task) }}
          />
        )}
      </AnimatePresence>
    </FocusCtx.Provider>
  )
}

function pad(n) { return String(n).padStart(2, '0') }

function FocusWidget({ task, elapsed, remaining, progress, running, completed, duration, onPause, onResume, onStop, onRestart }) {
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const C = 2 * Math.PI * 32       // circumference for r=32
  const dashOffset = C * (1 - progress)

  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 220 }}
      className="fixed bottom-6 right-6 z-40 select-none"
    >
      <div className="bg-[#0F1115] rounded-2xl shadow-2xl text-white w-64 overflow-hidden">

        {completed ? (
          /* ── Completion state ── */
          <div className="p-5 text-center">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200 }}
              className="text-4xl mb-2"
            >🎉</motion.div>
            <p className="font-bold text-sm">Session complete!</p>
            <p className="text-xs text-white/50 mt-0.5">{duration} min auto-logged to this task</p>
            <div className="flex gap-2 mt-4">
              <button onClick={onRestart}
                className="flex-1 text-xs bg-white/10 hover:bg-white/15 rounded-xl py-2.5 transition-colors">
                Again
              </button>
              <button onClick={() => onStop(false)}
                className="flex-1 text-xs bg-violet hover:bg-violet/80 rounded-xl py-2.5 font-medium transition-colors">
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Active timer ── */
          <div className="p-4">
            {/* Task name */}
            <p className="text-[9px] font-mono uppercase tracking-wider text-white/30 mb-1.5">Focusing on</p>
            <p className="text-xs font-medium text-white/90 leading-snug truncate mb-4">{task.title}</p>

            {/* Circular timer */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
                  <motion.circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke="#6E56CF"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    animate={{ strokeDashoffset: dashOffset }}
                    transition={{ duration: 0.6, ease: 'linear' }}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-xl font-bold text-white tracking-tight">
                    {pad(mins)}:{pad(secs)}
                  </span>
                  <span className="font-mono text-[9px] text-white/30 uppercase tracking-wider">
                    {running ? 'focusing' : 'paused'}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {running ? (
                <button onClick={onPause}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 rounded-xl py-2.5 transition-colors">
                  <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
                    <rect x="0.5" y="0.5" width="3" height="9" rx="0.5" />
                    <rect x="5.5" y="0.5" width="3" height="9" rx="0.5" />
                  </svg>
                  Pause
                </button>
              ) : (
                <button onClick={onResume}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-violet hover:bg-violet/80 rounded-xl py-2.5 font-medium transition-colors">
                  <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
                    <path d="M1 1.2l7.5 3.8L1 8.8V1.2z" />
                  </svg>
                  Resume
                </button>
              )}
              <button onClick={() => onStop(true)}
                className="px-3.5 text-xs text-white/30 hover:text-white/70 rounded-xl hover:bg-white/10 transition-colors"
                title="Stop and log elapsed time"
              >
                Stop
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
