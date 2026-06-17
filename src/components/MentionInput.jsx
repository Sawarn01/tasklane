import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

// ── useMentionState ───────────────────────────────────────────────
// Call at the top of any component that hosts a mention-aware input.
// members: [{ id, full_name }]
export function useMentionState(members) {
  const [anchorPos, setAnchorPos] = useState(null) // index of '@' in text, null = closed
  const [query,     setQuery]     = useState('')
  const [pickerIdx, setPickerIdx] = useState(0)

  const filtered = anchorPos !== null
    ? members
        .filter((m) => (m.full_name || '').toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, 7)
    : []

  const isOpen = anchorPos !== null && filtered.length > 0

  // Call inside onChange handler with (newValue, selectionStart)
  const detect = useCallback((value, cursor) => {
    const before = value.slice(0, cursor)
    const match  = before.match(/@(\w*)$/)
    if (match) {
      setAnchorPos(before.length - match[0].length)
      setQuery(match[1])
      setPickerIdx(0)
    } else {
      setAnchorPos(null)
    }
  }, [])

  // Call inside onKeyDown — returns true when the picker consumed the event
  const onPickerKeyDown = useCallback((e, value, inputRef, setValue) => {
    if (anchorPos === null || filtered.length === 0) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setPickerIdx((i) => Math.min(i + 1, filtered.length - 1)); return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault(); setPickerIdx((i) => Math.max(i - 1, 0)); return true
    }
    if (e.key === 'Escape') {
      setAnchorPos(null); return true
    }
    // Tab or Enter while picker is open → insert selected member
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault(); doInsert(filtered[pickerIdx], value, inputRef, setValue); return true
    }
    return false
  }, [anchorPos, filtered, pickerIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Insert @Name into text, replacing the @query that triggered the picker
  const doInsert = useCallback((member, value, inputRef, setValue) => {
    const cursor  = inputRef.current?.selectionStart ?? value.length
    const mention = `@${member.full_name}`
    const newValue = value.slice(0, anchorPos) + mention + ' ' + value.slice(cursor)
    setValue(newValue)
    setAnchorPos(null)
    const newCursor = anchorPos + mention.length + 1
    setTimeout(() => {
      inputRef.current?.setSelectionRange(newCursor, newCursor)
      inputRef.current?.focus()
    }, 0)
  }, [anchorPos])

  return { isOpen, filtered, pickerIdx, detect, onPickerKeyDown, doInsert }
}

// ── MentionDropdown ───────────────────────────────────────────────
// Render inside a `position: relative` container.
// Uses onMouseDown + preventDefault so the input doesn't blur on click.
export function MentionDropdown({ members, pickerIdx, onSelect }) {
  if (!members.length) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-full left-0 mb-2 w-60 bg-white rounded-2xl shadow-xl border border-black/8 z-50 overflow-hidden py-1"
    >
      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-muted/60 px-3 pt-2 pb-1">
        Mention a teammate
      </p>
      {members.map((m, i) => (
        <button
          key={m.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(m) }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
            i === pickerIdx ? 'bg-violet/8' : 'hover:bg-paper-dim'
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-violet/15 flex items-center justify-center shrink-0 text-[10px] font-bold text-violet">
            {(m.full_name || '?')[0].toUpperCase()}
          </div>
          <span className={`text-xs font-medium truncate ${i === pickerIdx ? 'text-violet' : 'text-ink'}`}>
            {m.full_name}
          </span>
        </button>
      ))}
    </motion.div>
  )
}

// ── renderWithMentions ────────────────────────────────────────────
// Returns mixed array of strings and <span> elements with @mentions highlighted.
// Sorts member names longest-first so "@Alice Smith" beats "@Alice".
// dark=true for mentions inside a dark/violet bubble (own chat messages)
export function renderWithMentions(text, members, dark = false) {
  if (!text || !members?.length) return text

  const names = members
    .map((m) => m.full_name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  if (!names.length) return text

  const escaped  = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex    = new RegExp(`@(${escaped.join('|')})`, 'g')
  const spanCls  = dark
    ? 'font-semibold bg-white/25 rounded px-0.5'
    : 'text-violet font-semibold bg-violet/10 rounded px-0.5'

  const parts = []
  let lastIdx = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index))
    parts.push(
      <span key={match.index} className={spanCls}>
        {match[0]}
      </span>
    )
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts.length > 1 ? parts : text
}
