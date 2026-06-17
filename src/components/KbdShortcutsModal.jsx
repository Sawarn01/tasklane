import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SHORTCUTS = [
  {
    group: 'Navigation',
    items: [
      { keys: ['G', 'B'], description: 'Go to Board' },
      { keys: ['G', 'L'], description: 'Go to Backlog' },
      { keys: ['G', 'T'], description: 'Go to Timeline' },
      { keys: ['G', 'R'], description: 'Go to Reports' },
      { keys: ['G', 'C'], description: 'Go to Chat' },
    ],
  },
  {
    group: 'Global',
    items: [
      { keys: ['⌘', 'K'], description: 'Open command search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close dialog / cancel' },
    ],
  },
  {
    group: 'Board',
    items: [
      { keys: ['C'], description: 'Create new issue' },
      { keys: ['F'], description: 'Toggle filters panel' },
      { keys: ['1'], description: 'Group by: None' },
      { keys: ['2'], description: 'Group by: Assignee' },
      { keys: ['3'], description: 'Group by: Priority' },
      { keys: ['4'], description: 'Group by: Epic' },
      { keys: ['M'], description: 'Filter: Only my issues' },
    ],
  },
  {
    group: 'Issue detail',
    items: [
      { keys: ['E'], description: 'Edit title' },
      { keys: ['A'], description: 'Assign to me' },
      { keys: ['L'], description: 'Open link issue' },
      { keys: ['⌘', 'Enter'], description: 'Submit comment' },
    ],
  },
]

function Key({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-paper-dim border border-black/10 font-mono text-[10px] text-slate-muted shadow-sm">
      {children}
    </kbd>
  )
}

export default function KbdShortcutsModal({ onClose }) {
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 16, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
          <div>
            <h2 className="font-semibold text-ink">Keyboard Shortcuts</h2>
            <p className="text-[10px] text-slate-muted font-mono mt-0.5">Press ? anywhere to open this panel</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-muted hover:text-ink transition-colors p-1 rounded-lg hover:bg-paper-dim"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Shortcuts grid */}
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {SHORTCUTS.map((section) => (
              <div key={section.group}>
                <p className="font-mono text-[9px] font-semibold text-slate-muted uppercase tracking-widest mb-3">
                  {section.group}
                </p>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <div key={item.description} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-ink">{item.description}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <Key>{k}</Key>
                            {i < item.keys.length - 1 && (
                              <span className="text-[9px] text-slate-muted/40 font-mono">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
