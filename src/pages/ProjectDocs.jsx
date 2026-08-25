import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getProjectDocs, getProjectDoc, createDoc, updateDoc, deleteDoc,
  getDocFiles, uploadDocFile, deleteDocFile, getDocFileUrl,
} from '../lib/data'

// ── Utilities ──────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return ''
  const date = new Date(d)
  const now  = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtBytes(n) {
  if (!n) return ''
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const EMOJI_OPTIONS = ['📄','📝','📌','📋','🗒️','💡','🚀','🎯','🔧','📊','🗺️','📖','✅','⚡','🔑','🏗️','🎨','📐','🔍','💬']

const IMAGE_TYPES = ['image/png','image/jpeg','image/jpg','image/gif','image/webp','image/svg+xml']

// ── Minimal markdown renderer ───────────────────────────────────────
function renderMd(text) {
  if (!text) return ''
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-ink mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-lg font-bold text-ink mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-xl font-bold text-ink mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/`(.+?)`/g,      '<code class="bg-paper-dim text-violet px-1.5 py-0.5 rounded text-[13px] font-mono">$1</code>')
    .replace(/^> (.+)$/gm,    '<blockquote class="border-l-2 border-violet/30 pl-4 text-slate-muted italic my-2">$1</blockquote>')
    .replace(/^- (.+)$/gm,    '<li class="ml-4 list-disc text-ink">$1</li>')
    .replace(/^\d+\. (.+)$/gm,'<li class="ml-4 list-decimal text-ink">$1</li>')
    .replace(/^---$/gm,       '<hr class="border-black/8 my-4" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-violet underline" target="_blank">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br/>')
}

// ── Emoji picker ────────────────────────────────────────────────────
function EmojiPicker({ current, onChange, onClose }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.12 }}
      className="absolute top-10 left-0 z-30 bg-white rounded-2xl shadow-xl border border-black/8 p-3 grid grid-cols-5 gap-1.5 w-44"
      onClick={e => e.stopPropagation()}>
      {EMOJI_OPTIONS.map(e => (
        <button key={e} onClick={() => { onChange(e); onClose() }}
          className={`w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-paper-dim transition-colors ${e === current ? 'bg-violet/10' : ''}`}>
          {e}
        </button>
      ))}
    </motion.div>
  )
}

// ── Doc list item ───────────────────────────────────────────────────
function DocItem({ doc, active, onClick, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  return (
    <div className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${active ? 'bg-violet/8' : 'hover:bg-paper-dim'}`}
      onClick={onClick}>
      <span className="text-base shrink-0">{doc.emoji || '📄'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate font-medium ${active ? 'text-violet' : 'text-ink'}`}>{doc.title || 'Untitled'}</p>
        <p className="text-[10px] text-slate-muted">{fmtDate(doc.updated_at)}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center">
        {confirmDel ? (
          <>
            <button onClick={e => { e.stopPropagation(); onDelete(doc.id) }}
              className="text-[10px] text-red-500 hover:text-red-600 px-1">del</button>
            <button onClick={e => { e.stopPropagation(); setConfirmDel(false) }}
              className="text-[10px] text-slate-muted hover:text-ink px-1">×</button>
          </>
        ) : (
          <button onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
            className="text-slate-muted hover:text-red-400 transition-colors p-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 2.5h9M4 2.5V1.5h3v1M2 2.5l.7 7h5.6l.7-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Image preview (lazy signed URL) ────────────────────────────────
function ImagePreview({ storagePath, name, onClick }) {
  const [url,  setUrl]  = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    getDocFileUrl(storagePath).then(u => { setUrl(u); setDone(true) })
  }, [storagePath])

  if (!done) return (
    <div className="w-full h-28 bg-paper-dim rounded-xl animate-pulse" />
  )

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="relative w-full h-28 rounded-xl overflow-hidden cursor-pointer border border-black/6 bg-paper-dim group"
    >
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="4" width="18" height="14" rx="2" stroke="#8A8F98" strokeWidth="1.4" />
            <circle cx="7.5" cy="9" r="1.5" fill="#8A8F98" />
            <path d="M2 16l5-4 4 3 3-2 6 3" stroke="#8A8F98" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5" />
          <path d="M10 6v4M10 12.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </motion.div>
  )
}

// ── Image lightbox modal ────────────────────────────────────────────
function ImageModal({ url, name, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/85 z-60 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-61 flex flex-col items-center justify-center p-8 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-4xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/60 text-sm truncate">{name}</p>
            <div className="flex items-center gap-3">
              <a href={url} download={name}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-xl transition-colors">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v7M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M1 9v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Download
              </a>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <img src={url} alt={name}
            className="w-full rounded-2xl shadow-2xl ring-1 ring-white/8 object-contain"
            style={{ maxHeight: '75vh' }} />
          <p className="text-center text-white/20 text-[11px] mt-3">
            Press <kbd className="font-mono bg-white/8 px-1.5 py-0.5 rounded-md text-white/35">Esc</kbd> to close
          </p>
        </div>
      </motion.div>
    </>
  )
}

// ── File row (non-image) ────────────────────────────────────────────
function FileRow({ file, onDelete }) {
  const [url,        setUrl]        = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  useEffect(() => {
    getDocFileUrl(file.storage_path).then(setUrl)
  }, [file.storage_path])

  function ext(name) {
    return name.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete(file) } finally { setDeleting(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-paper-dim hover:bg-black/5 group transition-colors"
    >
      {/* Extension badge */}
      <div className="w-9 h-9 rounded-lg bg-violet/10 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-mono font-bold text-violet">{ext(file.name)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate font-medium">{file.name}</p>
        <p className="text-[10px] text-slate-muted">{fmtBytes(file.size_bytes)} · {fmtDate(file.created_at)}</p>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {url && (
          <a href={url} download={file.name}
            className="p-1.5 text-slate-muted hover:text-violet transition-colors" title="Download">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1.5v7M3.5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 10v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </a>
        )}
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={handleDelete} disabled={deleting}
              className="text-[10px] text-red-500 hover:text-red-600 px-1.5 py-0.5 rounded-lg hover:bg-red-50 transition-colors">
              {deleting ? '…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmDel(false)}
              className="text-[10px] text-slate-muted hover:text-ink px-1.5 py-0.5 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)}
            className="p-1.5 text-slate-muted hover:text-red-400 transition-colors" title="Delete">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 3h9M4.5 3V2h3v1M3 3l.5 7.5h5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Attachments section ─────────────────────────────────────────────
function AttachmentsSection({ docId, userId }) {
  const [files,     setFiles]     = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const [lightbox,  setLightbox]  = useState(null) // { url, name }
  const inputRef = useRef(null)

  useEffect(() => {
    getDocFiles(docId).then(setFiles).catch(() => {})
  }, [docId])

  async function handleUpload(fileList) {
    if (!fileList?.length) return
    setUploading(true)
    const results = []
    for (const file of Array.from(fileList)) {
      try {
        const rec = await uploadDocFile({ docId, userId, file })
        results.push(rec)
      } catch { /* skip failed files */ }
    }
    setFiles(prev => [...prev, ...results])
    setUploading(false)
  }

  async function handleDelete(file) {
    await deleteDocFile({ fileId: file.id, storagePath: file.storage_path })
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  async function openImage(file) {
    const url = await getDocFileUrl(file.storage_path)
    if (url) setLightbox({ url, name: file.name })
  }

  const images = files.filter(f => IMAGE_TYPES.includes(f.mime_type))
  const others = files.filter(f => !IMAGE_TYPES.includes(f.mime_type))

  return (
    <div className="mt-10 border-t border-black/6 pt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-muted">
            <path d="M8 1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M8 1l4 5M8 1v5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs font-semibold text-slate-muted uppercase tracking-wider font-mono">
            Attachments {files.length > 0 && `(${files.length})`}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs text-violet border border-violet/25 bg-violet/5 hover:bg-violet/10 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M10 5.5A4.5 4.5 0 1 1 5.5 1" stroke="#6E56CF" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </motion.div>
              Uploading…
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1v7M2.5 5l3-3 3 3" stroke="#6E56CF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 9h9" stroke="#6E56CF" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Upload
            </>
          )}
        </motion.button>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={e => handleUpload(e.target.files)} />
      </div>

      {/* Drop zone */}
      <motion.div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        animate={{ borderColor: dragOver ? '#6E56CF' : 'rgba(0,0,0,0.08)', backgroundColor: dragOver ? 'rgba(110,86,207,0.04)' : 'transparent' }}
        className="rounded-2xl border-2 border-dashed border-black/8 py-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors mb-5"
      >
        <motion.div animate={{ scale: dragOver ? 1.1 : 1 }} transition={{ duration: 0.15 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className={dragOver ? 'text-violet' : 'text-slate-muted'}>
            <path d="M11 2v12M6 7l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 16v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </motion.div>
        <p className={`text-xs ${dragOver ? 'text-violet' : 'text-slate-muted'} transition-colors`}>
          {dragOver ? 'Drop to upload' : 'Drop files here or click to browse'}
        </p>
        <p className="text-[10px] text-slate-muted/50">Images, PDFs, docs — up to 50 MB each</p>
      </motion.div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-2">Images</p>
          <div className="grid grid-cols-3 gap-2">
            <AnimatePresence>
              {images.map(f => (
                <motion.div key={f.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="relative group">
                  <ImagePreview storagePath={f.storage_path} name={f.name} onClick={() => openImage(f)} />
                  {/* Delete button overlay */}
                  <button
                    onClick={async e => { e.stopPropagation(); if (confirm(`Delete "${f.name}"?`)) await handleDelete(f) }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                  <p className="text-[10px] text-slate-muted mt-1 truncate">{f.name}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Other files */}
      {others.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-2">Files</p>
          <div className="space-y-1">
            <AnimatePresence>
              {others.map(f => (
                <FileRow key={f.id} file={f} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state (no files at all) */}
      {files.length === 0 && !uploading && (
        <p className="text-center text-xs text-slate-muted/50 py-2">No attachments yet</p>
      )}

      {/* Image lightbox */}
      <AnimatePresence>
        {lightbox && (
          <ImageModal url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────
export default function ProjectDocs() {
  const { projectId } = useParams()
  const { user } = useAuth()

  const [docs,      setDocs]      = useState([])
  const [activeDoc, setActiveDoc] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [showEmoji, setShowEmoji] = useState(false)

  const [title,   setTitle]   = useState('')
  const [body,    setBody]    = useState('')
  const [emoji,   setEmoji]   = useState('📄')
  const [preview, setPreview] = useState(false)

  const saveTimer = useRef(null)
  const bodyRef   = useRef(null)

  useEffect(() => { loadDocs() }, [projectId])

  async function loadDocs() {
    try {
      const data = await getProjectDocs(projectId)
      setDocs(data)
      if (data.length > 0 && !activeDoc) openDoc(data[0])
    } catch (err) {
      console.error('loadDocs error:', err)
    }
    setLoading(false)
  }

  async function openDoc(docMeta) {
    setEditing(false); setPreview(false)
    try {
      const full = await getProjectDoc(docMeta.id)
      setActiveDoc(full)
      setTitle(full.title || '')
      setBody(full.body  || '')
      setEmoji(full.emoji || '📄')
    } catch {}
  }

  async function handleCreate() {
    try {
      const doc = await createDoc({ projectId, userId: user.id })
      setDocs(prev => [doc, ...prev])
      setActiveDoc(doc)
      setTitle(doc.title); setBody(doc.body); setEmoji(doc.emoji)
      setEditing(true)
      setTimeout(() => bodyRef.current?.focus(), 50)
    } catch {}
  }

  const handleSave = useCallback(async (t = title, b = body, em = emoji) => {
    if (!activeDoc) return
    setSaving(true)
    try {
      const updated = await updateDoc({ docId: activeDoc.id, userId: user.id, title: t, body: b, emoji: em })
      setActiveDoc(updated)
      setDocs(prev => prev.map(d => d.id === updated.id
        ? { ...d, title: updated.title, emoji: updated.emoji, updated_at: updated.updated_at }
        : d))
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }, [activeDoc, user.id])

  function handleBodyChange(val) {
    setBody(val)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => handleSave(title, val, emoji), 1500)
  }

  function handleTitleChange(val) {
    setTitle(val)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => handleSave(val, body, emoji), 1500)
  }

  function handleEmojiChange(em) {
    setEmoji(em)
    handleSave(title, body, em)
  }

  async function handleDelete(docId) {
    await deleteDoc(docId)
    const remaining = docs.filter(d => d.id !== docId)
    setDocs(remaining)
    if (activeDoc?.id === docId) {
      if (remaining.length > 0) openDoc(remaining[0])
      else { setActiveDoc(null); setTitle(''); setBody(''); setEditing(false) }
    }
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') { e.preventDefault(); setEditing(p => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  const filteredDocs = search
    ? docs.filter(d => d.title?.toLowerCase().includes(search.toLowerCase()))
    : docs

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0

  function insertMarkdown(before, after = '') {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const sel   = body.slice(start, end)
    const newBody = body.slice(0, start) + before + sel + after + body.slice(end)
    setBody(newBody)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + sel.length)
    }, 0)
  }

  const toolbarBtns = [
    { label: 'B',  title: 'Bold',       action: () => insertMarkdown('**', '**') },
    { label: 'I',  title: 'Italic',     action: () => insertMarkdown('*', '*') },
    { label: '<>', title: 'Code',        action: () => insertMarkdown('`', '`') },
    { label: 'H2', title: 'Heading',    action: () => insertMarkdown('\n## ', '') },
    { label: '—',  title: 'Divider',    action: () => insertMarkdown('\n---\n', '') },
    { label: '•',  title: 'List item',  action: () => insertMarkdown('\n- ', '') },
    { label: '❝',  title: 'Blockquote', action: () => insertMarkdown('\n> ', '') },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
        className="font-mono text-xs uppercase tracking-wider text-slate-muted">Loading docs…</motion.p>
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden" onClick={() => setShowEmoji(false)}>

      {/* Sidebar */}
      <div className="w-56 border-r border-black/5 flex flex-col bg-white shrink-0">
        <div className="px-3 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink uppercase tracking-wider">Docs</h2>
          <button onClick={handleCreate}
            className="w-6 h-6 rounded-lg bg-violet text-white flex items-center justify-center hover:bg-violet/90 transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-muted pointer-events-none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7.5 7.5l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search docs…"
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-paper-dim rounded-lg border border-black/5 focus:outline-none focus:ring-1 focus:ring-violet/25 placeholder:text-slate-muted/40" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {filteredDocs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-slate-muted mb-2">{search ? 'No results' : 'No docs yet'}</p>
              {!search && (
                <button onClick={handleCreate} className="text-xs text-violet hover:opacity-70">Create one →</button>
              )}
            </div>
          )}
          {filteredDocs.map(doc => (
            <DocItem key={doc.id} doc={doc} active={activeDoc?.id === doc.id}
              onClick={() => openDoc(doc)} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {/* Editor / viewer */}
      {activeDoc ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-paper">
          {/* Toolbar */}
          <div className="bg-white border-b border-black/5 px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {editing && toolbarBtns.map(btn => (
                <button key={btn.label} title={btn.title} onClick={btn.action}
                  className="px-2 py-0.5 text-xs font-mono text-slate-muted hover:text-ink hover:bg-paper-dim rounded transition-colors">
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {editing && (
                <span className="text-[10px] font-mono text-slate-muted">{wordCount} words</span>
              )}
              <span className={`text-[10px] font-mono transition-colors ${saving ? 'text-amber-400' : saved ? 'text-sage' : 'text-slate-muted/40'}`}>
                {saving ? 'saving…' : saved ? '✓ saved' : '⌘S to save'}
              </span>
              <button onClick={() => setPreview(p => !p)} disabled={!editing}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${preview ? 'border-violet/30 bg-violet/8 text-violet' : 'border-black/8 text-slate-muted hover:text-ink'} disabled:opacity-30`}>
                {preview ? 'Edit' : 'Preview'}
              </button>
              <button onClick={() => { setEditing(p => { if (p) handleSave(); return !p }) }}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${editing ? 'bg-ink text-white border-ink' : 'border-black/8 text-slate-muted hover:text-ink'}`}>
                {editing ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-10">
              {/* Title row */}
              <div className="flex items-start gap-4 mb-8">
                <div className="relative shrink-0 mt-1">
                  <button onClick={e => { e.stopPropagation(); if (editing) setShowEmoji(p => !p) }}
                    className={`text-4xl leading-none ${editing ? 'hover:opacity-70 transition-opacity cursor-pointer' : 'cursor-default'}`}>
                    {emoji}
                  </button>
                  <AnimatePresence>
                    {showEmoji && editing && (
                      <EmojiPicker current={emoji} onChange={handleEmojiChange} onClose={() => setShowEmoji(false)} />
                    )}
                  </AnimatePresence>
                </div>
                {editing && !preview ? (
                  <input value={title} onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Untitled"
                    className="flex-1 text-3xl font-bold text-ink bg-transparent border-none outline-none resize-none placeholder:text-slate-muted/30 leading-tight" />
                ) : (
                  <h1 className="flex-1 text-3xl font-bold text-ink leading-tight">{title || 'Untitled'}</h1>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 mb-8 text-[11px] text-slate-muted font-mono">
                <span>Updated {fmtDate(activeDoc.updated_at)}</span>
                {activeDoc.profiles?.full_name && <><span>·</span><span>by {activeDoc.profiles.full_name}</span></>}
                {editing && <><span>·</span><span className="text-violet">editing</span></>}
              </div>

              {/* Body */}
              {editing && !preview ? (
                <textarea ref={bodyRef} value={body} onChange={e => handleBodyChange(e.target.value)}
                  placeholder={'Start writing…\n\nUse markdown: **bold**, *italic*, `code`, ## heading, - list, > quote'}
                  className="w-full min-h-[60vh] text-sm text-ink bg-transparent border-none outline-none resize-none leading-7 placeholder:text-slate-muted/30 font-mono"
                />
              ) : (
                <div className="prose-custom min-h-[40vh]">
                  {body ? (
                    <div
                      className="text-sm text-ink leading-7 space-y-1"
                      dangerouslySetInnerHTML={{ __html: '<p class="mb-3">' + renderMd(body) + '</p>' }}
                    />
                  ) : (
                    <p className="text-slate-muted/50 text-sm italic">
                      {editing ? '' : 'This doc is empty. Click Edit to start writing.'}
                    </p>
                  )}
                </div>
              )}

              {/* Attachments */}
              <AttachmentsSection docId={activeDoc.id} userId={user?.id} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-paper">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-base font-semibold text-ink mb-1">No document selected</p>
          <p className="text-sm text-slate-muted mb-5">Create a doc to capture specs, decisions, and runbooks.</p>
          <button onClick={handleCreate}
            className="bg-violet text-white text-sm rounded-xl px-4 py-2 hover:bg-violet/90 transition-colors">
            Create first doc
          </button>
        </div>
      )}
    </div>
  )
}
