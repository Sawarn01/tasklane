import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { searchIssues } from '../lib/data'
import { IssueTypeIcon, PriorityIcon } from './IssueIcons'

export default function GlobalSearch({ onClose, projectId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchIssues({ query, projectId })
        setResults(data || [])
        setSelected(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [query, projectId])

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) {
      navigate(`/projects/${results[selected].project_id}`)
      onClose()
    }
  }

  const STATUS_COLORS = {
    todo: 'text-slate-muted',
    in_progress: 'text-violet',
    review: 'text-amber-500',
    done: 'text-sage',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -12, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -8, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-muted flex-shrink-0">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search issues..."
            className="flex-1 text-sm text-ink placeholder-slate-muted focus:outline-none bg-transparent"
          />
          {loading && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-3.5 h-3.5 rounded-full border-2 border-violet border-t-transparent animate-spin"
            />
          )}
          <kbd className="font-mono text-[10px] text-slate-muted bg-paper-dim px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.map((issue, i) => (
              <button
                key={issue.id}
                onClick={() => { navigate(`/projects/${issue.project_id}`); onClose() }}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selected ? 'bg-paper-dim' : 'hover:bg-paper-dim'
                }`}
              >
                <IssueTypeIcon type={issue.issue_type || 'task'} size={14} />
                <span className="flex-1 text-sm text-ink truncate">{issue.title}</span>
                <span className={`font-mono text-[10px] uppercase tracking-wide ${STATUS_COLORS[issue.status] || 'text-slate-muted'}`}>
                  {issue.status?.replace('_', ' ')}
                </span>
                <PriorityIcon priority={issue.priority} size={12} />
              </button>
            ))}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-muted">No issues found for "{query}"</p>
          </div>
        )}

        {!query && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-muted">Type to search issues across the project</p>
          </div>
        )}

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-black/5 flex items-center gap-4">
          <span className="font-mono text-[10px] text-slate-muted flex items-center gap-1">
            <kbd className="bg-paper-dim px-1 rounded">↑↓</kbd> navigate
          </span>
          <span className="font-mono text-[10px] text-slate-muted flex items-center gap-1">
            <kbd className="bg-paper-dim px-1 rounded">↵</kbd> open
          </span>
          <span className="font-mono text-[10px] text-slate-muted flex items-center gap-1">
            <kbd className="bg-paper-dim px-1 rounded">ESC</kbd> close
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}
