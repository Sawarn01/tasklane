import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createSubtask, getProjectMembers } from '../lib/data'
import { useAuth } from '../lib/AuthContext'

export default function BreakdownModal({ task, projectId, onClose, onCreated }) {
  const { user } = useAuth()
  const [lines,    setLines]    = useState(['', '', ''])
  const [members,  setMembers]  = useState([])
  const [assignee, setAssignee] = useState('')
  const [creating, setCreating] = useState(false)
  const [done,     setDone]     = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    getProjectMembers(projectId).then(setMembers)
    textareaRef.current?.focus()
  }, [])

  const nonEmpty = lines.filter(l => l.trim())

  async function handleCreate() {
    if (!nonEmpty.length || creating) return
    setCreating(true)
    try {
      const created = []
      for (const title of nonEmpty) {
        const sub = await createSubtask({
          parentTaskId: task.id,
          projectId,
          title: title.trim(),
          userId: user.id,
          assigneeId: assignee || null,
        })
        created.push(sub)
      }
      setDone(true)
      setTimeout(() => { onCreated?.(created); onClose() }, 900)
    } catch {
      setCreating(false)
    }
  }

  function handleTextareaChange(e) {
    const newLines = e.target.value.split('\n')
    setLines(newLines.length >= 1 ? newLines : [''])
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleCreate()
    }
  }

  const textValue = lines.join('\n')

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-black/5 w-full max-w-md pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-black/5">
            <div className="flex items-center gap-2 mb-0.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3h10M4 7h8M6 11h6" stroke="#6E56CF" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <h3 className="font-bold text-ink text-sm">Break down task</h3>
            </div>
            <p className="text-xs text-slate-muted ml-5 truncate">{task.title}</p>
          </div>

          {/* Instructions */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-2">
              Subtasks — one per line
            </p>
          </div>

          {/* Textarea */}
          <div className="px-5 pb-3">
            <div className="relative border border-black/10 rounded-xl overflow-hidden focus-within:border-violet/40 transition-colors">
              {/* Line numbers */}
              <div className="absolute left-0 top-0 bottom-0 w-7 bg-paper-dim flex flex-col items-center pt-2.5 gap-0 select-none border-r border-black/6">
                {lines.map((_, i) => (
                  <div key={i} className="text-[9px] font-mono text-slate-muted/50 leading-[1.6rem] w-full text-center">
                    {i + 1}
                  </div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={textValue}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                rows={Math.max(5, lines.length + 1)}
                placeholder={"Write test cases for login flow\nSet up API error handling\nUpdate documentation"}
                className="w-full pl-9 pr-3 py-2.5 text-sm text-ink placeholder:text-slate-muted/40 focus:outline-none resize-none bg-white leading-[1.6rem] font-mono"
              />
            </div>
            <p className="text-[10px] text-slate-muted mt-1.5">
              {nonEmpty.length} subtask{nonEmpty.length !== 1 ? 's' : ''} · <kbd className="font-mono bg-paper-dim px-1 py-0.5 rounded text-[9px]">⌘↵</kbd> to create all
            </p>
          </div>

          {/* Assignee */}
          {members.length > 0 && (
            <div className="px-5 pb-4">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1.5">Assign all to (optional)</label>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setAssignee('')}
                  className={`text-xs px-2.5 py-1 rounded-xl border transition-colors ${!assignee ? 'bg-ink text-white border-ink' : 'border-black/10 text-slate-muted hover:text-ink'}`}>
                  Unassigned
                </button>
                {members.map(m => (
                  <button key={m.id} onClick={() => setAssignee(m.id)}
                    className={`text-xs px-2.5 py-1 rounded-xl border transition-colors ${assignee === m.id ? 'bg-ink text-white border-ink' : 'border-black/10 text-slate-muted hover:text-ink'}`}>
                    {m.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose}
              className="flex-1 text-sm border border-black/10 rounded-xl py-2.5 text-slate-muted hover:text-ink transition-colors">
              Cancel
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCreate}
              disabled={!nonEmpty.length || creating}
              className={`flex-1 text-sm rounded-xl py-2.5 font-medium transition-colors ${
                done
                  ? 'bg-sage text-white'
                  : 'bg-ink text-white hover:bg-ink/90 disabled:opacity-40'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    ✓ Created {nonEmpty.length} subtask{nonEmpty.length !== 1 ? 's' : ''}
                  </motion.span>
                ) : creating ? (
                  <motion.span key="creating" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Creating…
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Create {nonEmpty.length || ''} subtask{nonEmpty.length !== 1 ? 's' : ''}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
