import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Markdown renderer ─────────────────────────────────────────────────────────
// Converts markdown text to React elements. Handles the most common patterns.
export function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={key++} className="bg-[#F1EFE7] rounded-lg p-3 my-2 overflow-x-auto border border-black/5">
          <code className="font-mono text-xs text-ink leading-relaxed">
            {codeLines.join('\n')}
          </code>
        </pre>
      )
      i++
      continue
    }

    // Heading 1
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-base font-bold text-ink mt-3 mb-1">{inlineMarkdown(line.slice(2))}</h1>)
      i++; continue
    }
    // Heading 2
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-sm font-semibold text-ink mt-2.5 mb-1">{inlineMarkdown(line.slice(3))}</h2>)
      i++; continue
    }
    // Heading 3
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-xs font-semibold text-ink mt-2 mb-1">{inlineMarkdown(line.slice(4))}</h3>)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={key++} className="border-l-3 border-violet/40 pl-3 py-0.5 my-1 text-slate-muted text-xs italic">
          {inlineMarkdown(line.slice(2))}
        </blockquote>
      )
      i++; continue
    }

    // Unordered list
    if (line.match(/^[-*]\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push(<li key={i} className="text-xs text-ink">{inlineMarkdown(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={key++} className="list-disc list-inside space-y-0.5 my-1.5 pl-1">{items}</ul>)
      continue
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        const content = lines[i].replace(/^\d+\.\s/, '')
        items.push(<li key={i} className="text-xs text-ink">{inlineMarkdown(content)}</li>)
        i++
      }
      elements.push(<ol key={key++} className="list-decimal list-inside space-y-0.5 my-1.5 pl-1">{items}</ol>)
      continue
    }

    // Horizontal rule
    if (line.match(/^---+$|^===+$/)) {
      elements.push(<hr key={key++} className="border-black/10 my-3" />)
      i++; continue
    }

    // Empty line → spacing
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1.5" />)
      i++; continue
    }

    // Paragraph
    elements.push(
      <p key={key++} className="text-xs text-ink leading-relaxed my-0.5">
        {inlineMarkdown(line)}
      </p>
    )
    i++
  }

  return elements
}

// Handles inline markdown: **bold**, *italic*, `code`, ~~strikethrough~~, [link](url)
function inlineMarkdown(text) {
  const parts = []
  let remaining = text
  let k = 0
  const patterns = [
    { re: /\*\*(.+?)\*\*/,  render: (m) => <strong key={k++} className="font-semibold">{m[1]}</strong> },
    { re: /__(.+?)__/,      render: (m) => <strong key={k++} className="font-semibold">{m[1]}</strong> },
    { re: /\*(.+?)\*/,      render: (m) => <em key={k++} className="italic">{m[1]}</em> },
    { re: /_(.+?)_/,        render: (m) => <em key={k++} className="italic">{m[1]}</em> },
    { re: /~~(.+?)~~/,      render: (m) => <del key={k++} className="line-through opacity-60">{m[1]}</del> },
    { re: /`(.+?)`/,        render: (m) => <code key={k++} className="font-mono text-[10px] bg-[#F1EFE7] px-1 py-0.5 rounded text-violet">{m[1]}</code> },
    { re: /\[(.+?)\]\((.+?)\)/, render: (m) => <a key={k++} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-violet hover:underline">{m[1]}</a> },
  ]

  while (remaining.length > 0) {
    let earliest = null
    let earliestMatch = null

    for (const p of patterns) {
      const m = remaining.match(p.re)
      if (m && (earliest === null || m.index < earliest.index)) {
        earliest = { re: p.re, render: p.render, index: m.index }
        earliestMatch = m
      }
    }

    if (!earliest || !earliestMatch) {
      parts.push(remaining)
      break
    }

    if (earliest.index > 0) {
      parts.push(remaining.slice(0, earliest.index))
    }
    parts.push(earliest.render(earliestMatch))
    remaining = remaining.slice(earliest.index + earliestMatch[0].length)
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function TB({ title, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center text-[#8A8F98] hover:text-ink hover:bg-black/5 rounded-md transition-colors text-xs font-mono"
    >
      {children}
    </button>
  )
}

// ── MarkdownEditor ────────────────────────────────────────────────────────────
// Drop-in replacement for a plain <textarea> with formatting toolbar + preview.
//
// Props:
//   value, onChange, onBlur, placeholder, className, minRows
export function MarkdownEditor({ value, onChange, onBlur, placeholder = 'Write a description… supports **markdown**', minRows = 4 }) {
  const [preview, setPreview] = useState(false)
  const ref = useRef(null)

  function insert(before, after = '', placeholder = '') {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = value.slice(start, end) || placeholder
    const newVal = value.slice(0, start) + before + sel + after + value.slice(end)
    onChange({ target: { value: newVal } })
    setTimeout(() => {
      el.focus()
      const cursor = start + before.length + sel.length
      el.setSelectionRange(cursor, cursor)
    }, 0)
  }

  function insertLine(prefix) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const before = value.slice(0, lineStart)
    const line   = value.slice(lineStart, value.indexOf('\n', start) === -1 ? undefined : value.indexOf('\n', start))
    const rest   = value.slice(before.length + line.length)
    const newLine = line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line
    const newVal  = before + newLine + rest
    onChange({ target: { value: newVal } })
    setTimeout(() => { el.focus() }, 0)
  }

  const TOOLBAR = [
    { title: 'Bold (Ctrl+B)',      action: () => insert('**', '**', 'bold text'),   icon: <span className="font-bold text-[11px]">B</span> },
    { title: 'Italic (Ctrl+I)',    action: () => insert('*', '*', 'italic text'),    icon: <span className="italic text-[11px]">I</span> },
    { title: 'Strikethrough',      action: () => insert('~~', '~~', 'text'),         icon: <span className="line-through text-[11px]">S</span> },
    { title: 'Inline code',        action: () => insert('`', '`', 'code'),           icon: <span className="font-mono text-[10px]">{'`'}</span> },
    { title: 'Code block',         action: () => insert('```\n', '\n```', 'code'),   icon: <span className="font-mono text-[9px]">{'{ }'}</span> },
    { divider: true },
    { title: 'Heading 1',          action: () => insertLine('# '),                   icon: <span className="font-bold text-[11px]">H1</span> },
    { title: 'Heading 2',          action: () => insertLine('## '),                  icon: <span className="font-bold text-[10px]">H2</span> },
    { divider: true },
    { title: 'Bullet list',        action: () => insertLine('- '),                   icon: <span className="text-[11px]">•—</span> },
    { title: 'Numbered list',      action: () => insertLine('1. '),                  icon: <span className="text-[11px]">1.</span> },
    { title: 'Blockquote',         action: () => insertLine('> '),                   icon: <span className="text-[12px] font-bold text-slate-400">"</span> },
    { title: 'Horizontal rule',    action: () => insert('\n---\n', ''),              icon: <span className="font-mono text-[10px]">—</span> },
  ]

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); insert('**', '**', 'bold text') }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); insert('*', '*', 'italic text') }
    if (e.key === 'Tab') { e.preventDefault(); insert('  ') }
  }

  return (
    <div className="rounded-xl border border-black/10 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-violet/20 focus-within:border-violet/30 transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-black/5 bg-[#FAFAF7]">
        {TOOLBAR.map((item, i) =>
          item.divider
            ? <div key={i} className="w-px h-4 bg-black/10 mx-1" />
            : <TB key={i} title={item.title} onClick={item.action}>{item.icon}</TB>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setPreview(v => !v)}
            className={`text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors ${preview ? 'bg-violet/10 text-violet' : 'text-[#8A8F98] hover:text-ink hover:bg-black/5'}`}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="px-3 py-2.5 min-h-[80px]"
          >
            {value ? renderMarkdown(value) : <p className="text-xs text-[#8A8F98] italic">Nothing to preview.</p>}
          </motion.div>
        ) : (
          <motion.textarea
            key="editor"
            ref={ref}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={minRows}
            className="w-full px-3 py-2.5 text-xs text-ink placeholder:text-[#8A8F98]/50 resize-none focus:outline-none leading-relaxed font-mono"
            style={{ minHeight: `${minRows * 20 + 20}px` }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
