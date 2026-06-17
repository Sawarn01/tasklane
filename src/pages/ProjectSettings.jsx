import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getProject, updateProject, getProjectMembers, getOrgMembers, getMyOrg,
  addProjectMember, removeProjectMember, getProjectComponents, createComponent,
  getProjectLabels, createLabel, getWipLimits, saveWipLimits,
} from '../lib/data'

function Section({ title, description, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-black/5">
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="text-xs text-slate-muted mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  )
}

const TABS = ['General', 'Members', 'Components', 'Labels', 'Board']

export default function ProjectSettings() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('General')
  const [project, setProject] = useState(null)
  const [org, setOrg] = useState(null)
  const [orgMembers, setOrgMembers] = useState([])
  const [projectMembers, setProjectMembers] = useState([])
  const [components, setComponents] = useState([])
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // General form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Add member
  const [addMemberId, setAddMemberId] = useState('')

  // Add component
  const [newCompName, setNewCompName] = useState('')

  // Add label
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#6E56CF')

  // WIP limits
  const [wipLimits, setWipLimits] = useState({})
  const [wipDraft, setWipDraft] = useState({})
  const [savingWip, setSavingWip] = useState(false)

  useEffect(() => {
    loadAll()
  }, [projectId])

  async function loadAll() {
    setLoading(true)
    try {
      const [p, { org }, pm] = await Promise.all([
        getProject(projectId),
        getMyOrg(),
        getProjectMembers(projectId),
      ])
      setProject(p)
      setOrg(org)
      setProjectMembers(pm)
      setName(p.name)
      setDescription(p.description || '')
      const wip = await getWipLimits(projectId).catch(() => ({}))
      setWipLimits(wip); setWipDraft(wip)
      try {
        const om = await getOrgMembers(org.id)
        setOrgMembers(om)
      } catch {}
      try { setComponents(await getProjectComponents(projectId)) } catch {}
      try { setLabels(await getProjectLabels(projectId)) } catch {}
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function handleSaveGeneral(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProject({ projectId, name, description })
      setProject((p) => ({ ...p, name, description }))
      setSuccess('Project updated successfully.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!addMemberId) return
    try {
      await addProjectMember({ projectId, userId: addMemberId })
      setAddMemberId('')
      setProjectMembers(await getProjectMembers(projectId))
    } catch (err) { setError(err.message) }
  }

  async function handleRemoveMember(memberId) {
    if (memberId === user.id) { setError("You can't remove yourself."); return }
    try {
      await removeProjectMember({ projectId, userId: memberId })
      setProjectMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch (err) { setError(err.message) }
  }

  async function handleAddComponent(e) {
    e.preventDefault()
    if (!newCompName.trim()) return
    try {
      await createComponent({ projectId, name: newCompName })
      setNewCompName('')
      setComponents(await getProjectComponents(projectId))
    } catch (err) { setError(err.message) }
  }

  async function handleAddLabel(e) {
    e.preventDefault()
    if (!newLabelName.trim()) return
    try {
      await createLabel({ projectId, name: newLabelName, color: newLabelColor })
      setNewLabelName('')
      setLabels(await getProjectLabels(projectId))
    } catch (err) { setError(err.message) }
  }

  const nonMembers = orgMembers.filter((om) => !projectMembers.some((pm) => pm.id === om.id))

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} className="font-mono text-xs uppercase tracking-wider text-slate-muted">
        Loading settings…
      </motion.p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink">Project settings</h2>
          <p className="text-sm text-slate-muted">{project?.name}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-paper-dim rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-muted hover:text-ink'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {/* GENERAL */}
          {tab === 'General' && (
            <Section title="General" description="Update the project name and description.">
              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Project name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1.5">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="What is this project about?"
                    className="w-full text-sm rounded-xl border border-black/10 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet/30"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="text-sm bg-violet text-white rounded-xl px-5 py-2.5 hover:bg-violet/90 disabled:opacity-50 transition-colors font-medium">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
              <div className="mt-8 pt-6 border-t border-black/5">
                <p className="font-semibold text-red-600 text-sm mb-1">Danger zone</p>
                <p className="text-xs text-slate-muted mb-3">These actions are irreversible. Please be certain.</p>
                <button className="text-sm text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors">
                  Archive project
                </button>
              </div>
            </Section>
          )}

          {/* MEMBERS */}
          {tab === 'Members' && (
            <Section title="Members" description="Manage who has access to this project.">
              {/* Current members */}
              <div className="space-y-2 mb-5">
                {projectMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-paper-dim rounded-xl">
                    <div className="w-8 h-8 bg-violet/20 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-violet">{(m.full_name || 'U')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{m.full_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-muted">{m.id === user.id ? 'You' : 'Member'}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="text-xs text-slate-muted hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      disabled={m.id === user.id}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Add member */}
              {nonMembers.length > 0 && (
                <form onSubmit={handleAddMember} className="flex gap-2">
                  <select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className="flex-1 text-sm rounded-xl border border-black/10 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet/30">
                    <option value="">Select a team member to add…</option>
                    {nonMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  <button type="submit" disabled={!addMemberId} className="text-sm bg-violet text-white rounded-xl px-4 py-2 hover:bg-violet/90 disabled:opacity-50 transition-colors">
                    Add
                  </button>
                </form>
              )}
              {nonMembers.length === 0 && orgMembers.length > 0 && (
                <p className="text-xs text-slate-muted">All organization members are already in this project.</p>
              )}
              {orgMembers.length === 0 && (
                <p className="text-xs text-slate-muted">No other org members found. Invite teammates from the Dashboard.</p>
              )}
            </Section>
          )}

          {/* COMPONENTS */}
          {tab === 'Components' && (
            <Section title="Components" description="Components group related issues within the project (e.g. Backend, Frontend, Infra).">
              <div className="space-y-2 mb-4">
                {components.length === 0 && (
                  <p className="text-sm text-slate-muted">No components yet. Create one below.</p>
                )}
                {components.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-paper-dim rounded-lg">
                    <span className="text-sm text-ink flex-1">{c.name}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComponent} className="flex gap-2">
                <input
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="Component name (e.g. Backend)"
                  className="flex-1 text-sm rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30"
                />
                <button type="submit" className="text-sm bg-violet text-white rounded-xl px-4 py-2 hover:bg-violet/90 transition-colors">
                  Add
                </button>
              </form>
            </Section>
          )}

          {/* LABELS */}
          {tab === 'Labels' && (
            <Section title="Labels" description="Labels help categorize and filter issues across the project.">
              <div className="flex flex-wrap gap-2 mb-4">
                {labels.length === 0 && <p className="text-sm text-slate-muted">No labels yet.</p>}
                {labels.map((l) => (
                  <span key={l.id} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `${l.color}20`, color: l.color }}>
                    {l.name}
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddLabel} className="flex gap-2 items-center">
                <input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name"
                  className="flex-1 text-sm rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30"
                />
                <div className="flex items-center gap-1.5">
                  <input type="color" value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-black/10" />
                  <span className="text-xs text-slate-muted">Color</span>
                </div>
                <button type="submit" className="text-sm bg-violet text-white rounded-xl px-4 py-2 hover:bg-violet/90 transition-colors">Add</button>
              </form>
            </Section>
          )}

          {/* BOARD */}
          {tab === 'Board' && (
            <Section title="WIP Limits" description="Set a maximum number of issues per column. The column turns red when the limit is exceeded.">
              <div className="space-y-2">
                {[
                  { key: 'todo',        label: 'To Do',       color: '#8A8F98' },
                  { key: 'in_progress', label: 'In Progress', color: '#6E56CF' },
                  { key: 'review',      label: 'In Review',   color: '#F59E0B' },
                  { key: 'done',        label: 'Done',        color: '#36D399' },
                ].map((col) => (
                  <div key={col.key} className="flex items-center gap-3 px-4 py-3 bg-paper-dim rounded-xl">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <p className="text-sm font-medium text-ink flex-1">{col.label}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="No limit"
                        value={wipDraft[col.key] || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                          setWipDraft((prev) => {
                            const next = { ...prev }
                            if (val) next[col.key] = val
                            else delete next[col.key]
                            return next
                          })
                        }}
                        className="w-24 text-sm rounded-lg border border-black/10 px-3 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
                      />
                      <span className="text-xs text-slate-muted">max issues</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={async () => {
                    setSavingWip(true)
                    try {
                      await saveWipLimits(projectId, wipDraft)
                      setWipLimits(wipDraft)
                      setSuccess('WIP limits saved.')
                      setTimeout(() => setSuccess(''), 3000)
                    } catch (err) { setError(err.message) }
                    finally { setSavingWip(false) }
                  }}
                  disabled={savingWip}
                  className="text-sm bg-violet text-white rounded-xl px-4 py-2 hover:bg-violet/90 transition-colors disabled:opacity-50"
                >
                  {savingWip ? 'Saving…' : 'Save WIP Limits'}
                </button>
                {Object.keys(wipLimits).length > 0 && (
                  <button
                    onClick={async () => {
                      await saveWipLimits(projectId, {})
                      setWipLimits({}); setWipDraft({})
                    }}
                    className="text-sm text-slate-muted hover:text-ink transition-colors"
                  >
                    Clear all limits
                  </button>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
