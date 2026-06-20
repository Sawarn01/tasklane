import { useState } from 'react'
import { motion } from 'framer-motion'
import { createProject } from '../lib/data'

export default function CreateProjectModal({ orgId, userId, onCreated, onClose }) {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating]       = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      await createProject({ orgId, name: name.trim(), description: description.trim(), userId })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-ink mb-5">Create new project</h3>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Project name *</label>
            <input autoFocus required value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Marketing website"
              className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30" />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="What is this project about?"
              className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet/30" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={creating}
              className="flex-1 bg-violet text-white text-sm rounded-xl py-2.5 hover:bg-violet/90 disabled:opacity-50 transition-colors font-medium">
              {creating ? 'Creating…' : 'Create project'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 text-sm text-slate-muted hover:text-ink transition-colors">Cancel</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
