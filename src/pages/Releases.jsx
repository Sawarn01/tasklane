import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getProjectVersions, createVersion, updateVersion, deleteVersion, getTasks, getProject, getProjectKey } from '../lib/data'
import TaskDetailPanel from './TaskDetailPanel'
import { StatusBadge, IssueTypeIcon } from '../components/IssueIcons'

const VERSION_STATUSES = ['unreleased', 'released', 'archived']
const STATUS_STYLES = {
  unreleased: { label: 'Unreleased', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  released:   { label: 'Released',   className: 'bg-sage/15 text-green-700 border-green-200' },
  archived:   { label: 'Archived',   className: 'bg-paper-dim text-slate-muted border-black/10' },
}

function VersionForm({ version, onSave, onClose }) {
  const [name, setName] = useState(version?.name || '')
  const [description, setDescription] = useState(version?.description || '')
  const [releaseDate, setReleaseDate] = useState(version?.release_date || '')
  const [status, setStatus] = useState(version?.status || 'unreleased')

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave({ name, description, releaseDate, status })
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-ink mb-5">{version ? 'Edit release' : 'Create release'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Version name *</label>
            <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. v1.2.0" className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30" />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's included in this release?" className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Release date</label>
              <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet/30">
                {VERSION_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="flex-1 bg-violet text-white text-sm rounded-xl py-2.5 hover:bg-violet/90 transition-colors font-medium">
              {version ? 'Save' : 'Create release'}
            </button>
            <button type="button" onClick={onClose} className="px-4 text-sm text-slate-muted hover:text-ink">Cancel</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default function Releases() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [versions, setVersions] = useState([])
  const [tasks, setTasks] = useState([])
  const [project, setProject] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingVersion, setEditingVersion] = useState(null)
  const [expandedVersionId, setExpandedVersionId] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)

  useEffect(() => {
    loadAll()
  }, [projectId])

  async function loadAll() {
    setLoading(true)
    try {
      const [p, t] = await Promise.all([getProject(projectId), getTasks(projectId)])
      setProject(p)
      setTasks(t)
      try {
        const v = await getProjectVersions(projectId)
        setVersions(v)
        setDbError(false)
      } catch { setDbError(true) }
    } catch {}
    setLoading(false)
  }

  async function handleCreate({ name, description, releaseDate, status }) {
    try {
      await createVersion({ projectId, name, description, releaseDate, status })
      await loadAll()
    } catch (err) { alert(err.message) }
  }

  async function handleEdit({ name, description, releaseDate, status }) {
    try {
      await updateVersion({ versionId: editingVersion.id, name, description, releaseDate, status })
      setEditingVersion(null)
      await loadAll()
    } catch (err) { alert(err.message) }
  }

  async function handleDelete(versionId) {
    if (!confirm('Delete this release? Issues will be unlinked.')) return
    try { await deleteVersion(versionId); await loadAll() } catch (err) { alert(err.message) }
  }

  async function handleRelease(v) {
    try {
      await updateVersion({ versionId: v.id, name: v.name, description: v.description, releaseDate: v.release_date || new Date().toISOString().slice(0, 10), status: 'released' })
      await loadAll()
    } catch (err) { alert(err.message) }
  }

  const projectKey = project ? getProjectKey(project.name) : 'KEY'

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} className="font-mono text-xs uppercase tracking-wider text-slate-muted">
        Loading releases…
      </motion.p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">Releases</h2>
            <p className="text-sm text-slate-muted">Manage version releases and track what ships in each</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm bg-violet text-white rounded-xl px-4 py-2 hover:bg-violet/90 transition-colors font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Create release
          </button>
        </div>

        {/* DB error */}
        {dbError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M6.5 4v3M6.5 9v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            Releases require the <code className="bg-amber-100 px-1 rounded">versions</code> database table. Add the migration to enable full functionality.
          </motion.div>
        )}

        {/* Empty state */}
        {versions.length === 0 && !dbError && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-paper-dim rounded-2xl flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-slate-muted/50">
                <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 8v6l4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-ink mb-1">No releases yet</p>
              <p className="text-sm text-slate-muted">Create your first release to start tracking what ships.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="text-sm bg-violet text-white rounded-xl px-5 py-2.5 hover:bg-violet/90 transition-colors">
              Create first release
            </button>
          </motion.div>
        )}

        {/* Versions list */}
        <div className="space-y-3">
          <AnimatePresence>
            {versions.map((v, i) => {
              const versionTasks = tasks.filter((t) => t.fix_version_id === v.id)
              const doneTasks = versionTasks.filter((t) => t.status === 'done')
              const pct = versionTasks.length > 0 ? Math.round((doneTasks.length / versionTasks.length) * 100) : 0
              const style = STATUS_STYLES[v.status] || STATUS_STYLES.unreleased
              const isExpanded = expandedVersionId === v.id

              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden"
                >
                  {/* Version header */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-paper-dim/30 transition-colors"
                    onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}
                  >
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }} className="text-slate-muted shrink-0">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2l6 4-6 4V2z" fill="currentColor" /></svg>
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink">{v.name}</span>
                        <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border font-semibold ${style.className}`}>
                          {style.label}
                        </span>
                        {v.release_date && (
                          <span className="text-xs text-slate-muted">
                            {v.status === 'released' ? 'Released' : 'Due'}{' '}
                            {new Date(v.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {v.description && <p className="text-xs text-slate-muted mt-0.5 truncate">{v.description}</p>}
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-muted font-mono">{doneTasks.length}/{versionTasks.length} issues</span>
                      {versionTasks.length > 0 && (
                        <div className="w-20 h-1.5 bg-paper-dim rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-sage rounded-full"
                          />
                        </div>
                      )}
                      <span className="text-xs text-slate-muted">{pct}%</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {v.status === 'unreleased' && (
                        <button onClick={() => handleRelease(v)} className="text-[10px] bg-sage/80 text-white px-2.5 py-1 rounded-lg hover:bg-sage transition-colors font-medium">
                          Release
                        </button>
                      )}
                      <button onClick={() => setEditingVersion(v)} className="text-[10px] text-slate-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-paper-dim transition-colors">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="text-[10px] text-slate-muted hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Issues */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-black/5"
                      >
                        {versionTasks.length === 0 ? (
                          <div className="py-6 text-center">
                            <p className="text-sm text-slate-muted">No issues linked to this release.</p>
                            <p className="text-xs text-slate-muted/60 mt-1">Set the "Fix version" field on issues to link them here.</p>
                          </div>
                        ) : (
                          versionTasks.map((t, idx) => (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTask(t)}
                              className="flex items-center gap-3 px-5 py-2.5 hover:bg-paper-dim cursor-pointer border-b border-black/5 last:border-0"
                            >
                              <IssueTypeIcon type={t.issue_type || 'task'} size={13} />
                              <span className="font-mono text-[9px] text-slate-muted/50 w-16 shrink-0">{projectKey}-{idx + 1}</span>
                              <span className={`flex-1 text-sm text-ink truncate ${t.status === 'done' ? 'line-through text-slate-muted' : ''}`}>{t.title}</span>
                              <StatusBadge status={t.status} />
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && <VersionForm onSave={handleCreate} onClose={() => setShowForm(false)} />}
        {editingVersion && <VersionForm version={editingVersion} onSave={handleEdit} onClose={() => setEditingVersion(null)} />}
        {selectedTask && (
          <TaskDetailPanel
            key={selectedTask.id}
            task={selectedTask}
            members={members}
            orgPlan={null}
            projectKey={projectKey}
            onClose={() => setSelectedTask(null)}
            onTaskUpdated={loadAll}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
