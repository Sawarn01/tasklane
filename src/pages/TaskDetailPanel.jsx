import { useEffect, useState, useRef, useCallback, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getTaskComments, addTaskComment, updateTaskAssignee, updateTaskDescription,
  getTaskFiles, uploadFile, getFileDownloadUrl, deleteFile, updateTaskDueDate,
  getTaskActivity, updateTaskPriority, getProjectLabels, createLabel, getTaskLabels,
  addLabelToTask, removeLabelFromTask, updateTaskIssueType, updateTaskStoryPoints,
  getSprints, updateTaskSprint, getProjectVersions, updateTaskVersion,
  getProjectComponents, getTaskComponents, addComponentToTask, removeComponentFromTask,
  getIssueLinks, addIssueLink, removeIssueLink, getTasks, getChildIssues,
  getTaskWatchers, watchTask, unwatchTask, logTime, getTaskTimeLogs, createTask, cloneTask,
  updateTaskEstimate,
} from '../lib/data'
import { supabase } from '../lib/supabase'
import { formatActivity, formatTimeAgo } from '../lib/activityFormat'
import { IssueTypeIcon, PriorityIcon, StatusBadge, ISSUE_TYPES, PRIORITIES, STATUSES } from '../components/IssueIcons'
import { useMentionState, MentionDropdown, renderWithMentions } from '../components/MentionInput'
import { MarkdownEditor, renderMarkdown } from '../components/MarkdownEditor'
import { useFocus } from '../components/FocusMode'

const LABEL_COLORS = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6']
const LINK_TYPES = ['blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by', 'clones', 'is_cloned_by']

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Chip({ children, onClick, active, color }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active ? 'border-violet bg-violet/10 text-violet' : 'border-black/10 text-slate-muted hover:border-black/20 hover:text-ink'
      }`}
      style={color ? { backgroundColor: `${color}15`, borderColor: `${color}40`, color } : {}}
    >
      {children}
    </button>
  )
}

export default function TaskDetailPanel({ task, members, orgPlan, projectKey, onClose, onTaskUpdated }) {
  const { user } = useAuth()
  const focus = useFocus()
  const [tab, setTab] = useState('all') // all | comments | history
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [description, setDescription] = useState(task.description || '')
  const [error, setError] = useState('')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [taskActivity, setTaskActivity] = useState([])
  const [priority, setPriority] = useState(task.priority || 'medium')
  const [issueType, setIssueType] = useState(task.issue_type || 'task')
  const [storyPoints, setStoryPoints] = useState(task.story_points ?? '')
  const [status, setStatus] = useState(task.status || 'todo')
  const [projectLabels, setProjectLabels] = useState([])
  const [taskLabelList, setTaskLabelList] = useState([])
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [sprints, setSprints] = useState([])
  const [sprintId, setSprintId] = useState(task.sprint_id || '')
  const [versions, setVersions] = useState([])
  const [versionId, setVersionId] = useState(task.fix_version_id || '')
  const [components, setComponents] = useState([])
  const [taskComponents, setTaskComponents] = useState([])
  const [issueLinks, setIssueLinks] = useState([])
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkResults, setLinkResults] = useState([])
  const [linkType, setLinkType] = useState('relates_to')
  const [childIssues, setChildIssues] = useState([])
  const [showAddChild, setShowAddChild] = useState(false)
  const [newChildTitle, setNewChildTitle] = useState('')
  const [watchers, setWatchers] = useState([])
  const [isWatching, setIsWatching] = useState(false)
  const [timeLogs, setTimeLogs] = useState([])
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [logMinutes, setLogMinutes] = useState('')
  const [logDesc, setLogDesc] = useState('')
  const [estimate, setEstimate] = useState(task.original_estimate ? String(Math.round(task.original_estimate / 60 * 10) / 10) : '')
  const [saving, setSaving] = useState({})
  const [title, setTitle] = useState(task.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const titleRef      = useRef(null)
  const commentRef    = useRef(null)
  const mention       = useMentionState(members)

  useEffect(() => {
    loadAll()

    const ch = supabase
      .channel(`task-detail-${task.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task.id}` }, loadComments)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [task.id])

  async function loadAll() {
    await Promise.allSettled([
      loadComments(),
      loadFiles(),
      loadActivity(),
      loadLabels(),
      loadSprints(),
      loadVersions(),
      loadComponents(),
      loadLinks(),
      loadChildIssues(),
      loadWatchers(),
      loadTimeLogs(),
    ])
  }

  async function loadComments() {
    try { setComments(await getTaskComments(task.id)) } catch {}
  }
  async function loadFiles() {
    try { setFiles(await getTaskFiles(task.id)) } catch {}
  }
  async function loadActivity() {
    try { setTaskActivity(await getTaskActivity(task.project_id, task.id)) } catch {}
  }
  async function loadLabels() {
    try {
      const [all, attached] = await Promise.all([getProjectLabels(task.project_id), getTaskLabels(task.id)])
      setProjectLabels(all)
      setTaskLabelList(attached)
    } catch {}
  }
  async function loadSprints() {
    try { setSprints(await getSprints(task.project_id)) } catch {}
  }
  async function loadVersions() {
    try { setVersions(await getProjectVersions(task.project_id)) } catch {}
  }
  async function loadComponents() {
    try {
      const [all, attached] = await Promise.all([getProjectComponents(task.project_id), getTaskComponents(task.id)])
      setComponents(all)
      setTaskComponents(attached)
    } catch {}
  }
  async function loadLinks() {
    try { setIssueLinks(await getIssueLinks(task.id)) } catch {}
  }
  async function loadChildIssues() {
    try { setChildIssues(await getChildIssues(task.id)) } catch {}
  }
  async function loadWatchers() {
    try {
      const data = await getTaskWatchers(task.id)
      setWatchers(data)
      setIsWatching(data.some((w) => w.user_id === user?.id))
    } catch {}
  }
  async function loadTimeLogs() {
    try { setTimeLogs(await getTaskTimeLogs(task.id)) } catch {}
  }

  async function save(key, fn) {
    setSaving((s) => ({ ...s, [key]: true }))
    try { await fn(); onTaskUpdated() } catch (err) { setError(err.message) }
    finally { setSaving((s) => ({ ...s, [key]: false })) }
  }

  async function handleTitleSave() {
    if (title === task.title) { setEditingTitle(false); return }
    await save('title', () =>
      supabase.from('tasks').update({ title, updated_at: new Date().toISOString() }).eq('id', task.id)
    )
    setEditingTitle(false)
  }

  async function handleStatusChange(newStatus) {
    setStatus(newStatus)
    await save('status', () =>
      supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id)
    )
  }

  async function handlePriorityChange(val) {
    setPriority(val)
    await save('priority', () => updateTaskPriority({ taskId: task.id, priority: val }))
  }

  async function handleIssueTypeChange(val) {
    setIssueType(val)
    await save('issueType', () => updateTaskIssueType({ taskId: task.id, issueType: val }))
  }

  async function handleStoryPointsBlur() {
    if (String(storyPoints) === String(task.story_points ?? '')) return
    await save('storyPoints', () => updateTaskStoryPoints({ taskId: task.id, storyPoints }))
  }

  async function handleAssigneeChange(e) {
    const assigneeId = e.target.value || null
    const assigneeName = members.find((m) => m.id === assigneeId)?.full_name
    await save('assignee', () => updateTaskAssignee({ taskId: task.id, assigneeId, projectId: task.project_id, actorId: user.id, taskTitle: title, assigneeName }))
  }

  async function handleDueDateChange(e) {
    setDueDate(e.target.value)
    await save('dueDate', () => updateTaskDueDate({ taskId: task.id, dueDate: e.target.value || null }))
  }

  async function handleDescriptionBlur() {
    if (description === task.description) return
    await save('description', () => updateTaskDescription({ taskId: task.id, description }))
  }

  async function handleEstimateBlur() {
    const hours = parseFloat(estimate)
    const minutes = isNaN(hours) ? null : Math.round(hours * 60)
    const existing = task.original_estimate ? Math.round(task.original_estimate / 60 * 10) / 10 : null
    if (String(hours) === String(existing)) return
    await save('estimate', () => updateTaskEstimate({ taskId: task.id, minutes }))
  }

  async function handleSprintChange(e) {
    setSprintId(e.target.value)
    await save('sprint', () => updateTaskSprint({ taskId: task.id, sprintId: e.target.value || null }))
  }

  async function handleVersionChange(e) {
    setVersionId(e.target.value)
    await save('version', () => updateTaskVersion({ taskId: task.id, versionId: e.target.value || null }))
  }

  async function handleToggleLabel(label) {
    const attached = taskLabelList.some((l) => l.id === label.id)
    try {
      if (attached) await removeLabelFromTask({ taskId: task.id, labelId: label.id })
      else await addLabelToTask({ taskId: task.id, labelId: label.id })
      await loadLabels()
      onTaskUpdated()
    } catch (err) { setError(err.message) }
  }

  async function handleCreateLabel(e) {
    e.preventDefault()
    if (!newLabelName.trim()) return
    try {
      const color = LABEL_COLORS[projectLabels.length % LABEL_COLORS.length]
      const label = await createLabel({ projectId: task.project_id, name: newLabelName, color })
      setNewLabelName('')
      await addLabelToTask({ taskId: task.id, labelId: label.id })
      await loadLabels()
    } catch (err) { setError(err.message) }
  }

  async function handleToggleComponent(comp) {
    const attached = taskComponents.some((c) => c.id === comp.id)
    try {
      if (attached) await removeComponentFromTask({ taskId: task.id, componentId: comp.id })
      else await addComponentToTask({ taskId: task.id, componentId: comp.id })
      await loadComponents()
    } catch {}
  }

  async function handleToggleWatch() {
    try {
      if (isWatching) await unwatchTask({ taskId: task.id, userId: user.id })
      else await watchTask({ taskId: task.id, userId: user.id })
      setIsWatching(!isWatching)
      await loadWatchers()
    } catch (err) { setError(err.message) }
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      await addTaskComment({ taskId: task.id, userId: user.id, body: newComment, projectId: task.project_id, taskTitle: title, taskAssigneeId: task.assignee_id, taskCreatedBy: task.created_by, members })
      setNewComment('')
    } catch (err) { setError(err.message) }
  }

  async function handleLogTime(e) {
    e.preventDefault()
    if (!logMinutes) return
    try {
      await logTime({ taskId: task.id, userId: user.id, minutes: Number(logMinutes), description: logDesc })
      setLogMinutes('')
      setLogDesc('')
      setShowTimeModal(false)
      await loadTimeLogs()
    } catch (err) { setError(err.message) }
  }

  async function handleAddChildIssue(e) {
    e.preventDefault()
    if (!newChildTitle.trim()) return
    try {
      await createTask({ projectId: task.project_id, title: newChildTitle, userId: user.id, status: 'todo' })
      setNewChildTitle('')
      setShowAddChild(false)
      await loadChildIssues()
    } catch (err) { setError(err.message) }
  }

  // Link search
  useEffect(() => {
    if (!linkQuery.trim()) { setLinkResults([]); return }
    const t = setTimeout(async () => {
      try {
        const data = await getTasks(task.project_id)
        setLinkResults(data.filter((t2) => t2.id !== task.id && t2.title.toLowerCase().includes(linkQuery.toLowerCase())).slice(0, 8))
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [linkQuery])

  async function handleAddLink(targetTask) {
    try {
      await addIssueLink({ fromTaskId: task.id, toTaskId: targetTask.id, linkType })
      setShowLinkModal(false)
      setLinkQuery('')
      setLinkResults([])
      await loadLinks()
    } catch (err) { setError(err.message) }
  }

  async function handleRemoveLink(linkId) {
    try { await removeIssueLink(linkId); await loadLinks() } catch (err) { setError(err.message) }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try { await uploadFile({ projectId: task.project_id, taskId: task.id, file, userId: user.id }); await loadFiles() }
    catch (err) { setError(err.message) }
    finally { setUploading(false) }
  }

  async function handleClone() {
    try {
      await cloneTask(task, user.id)
      onTaskUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  const totalTimeLogged = timeLogs.reduce((sum, l) => sum + (l.minutes || 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 16, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-black/5 shrink-0">
          <IssueTypeIcon type={issueType} size={16} />
          <span className="font-mono text-xs text-slate-muted">{projectKey}-{task.id.slice(-4).toUpperCase()}</span>
          <div className="flex-1" />
          <button
            onClick={handleToggleWatch}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              isWatching ? 'bg-violet/10 border-violet/30 text-violet' : 'border-black/10 text-slate-muted hover:text-ink'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2C3 2 1 6 1 6s2 4 5 4 5-4 5-4-2-4-5-4z" stroke="currentColor" strokeWidth="1.2" fill={isWatching ? 'currentColor' : 'none'} />
              <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {isWatching ? 'Watching' : 'Watch'}
          </button>
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-black/10 text-slate-muted hover:text-ink transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 7.5l3-3M2.5 5.5l-1 1a2.12 2.12 0 000 3h0a2.12 2.12 0 003 0l1-1M7.5 6.5l1-1a2.12 2.12 0 000-3h0a2.12 2.12 0 00-3 0l-1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            Link
          </button>
          {focus && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => focus.start(task)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium ${
                focus.active && focus.task?.id === task.id
                  ? 'bg-violet text-white border-violet'
                  : 'border-violet/30 text-violet hover:bg-violet/10'
              }`}
              title="Start a focus session on this task"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="5.5" cy="5.5" r="2" fill="currentColor" />
              </svg>
              {focus.active && focus.task?.id === task.id ? 'Focusing…' : 'Focus'}
            </motion.button>
          )}
          <button
            onClick={handleClone}
            title="Clone issue"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-black/10 text-slate-muted hover:text-ink transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Clone
          </button>
          <button onClick={onClose} className="text-slate-muted hover:text-ink transition-colors p-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — main content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-w-0">
            {/* Title */}
            <div className="mb-5">
              {editingTitle ? (
                <textarea
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTitleSave() } if (e.key === 'Escape') { setTitle(task.title); setEditingTitle(false) } }}
                  autoFocus
                  rows={2}
                  className="w-full text-xl font-semibold text-ink resize-none focus:outline-none border-b-2 border-violet pb-1 bg-transparent"
                />
              ) : (
                <h1
                  onClick={() => setEditingTitle(true)}
                  className="text-xl font-semibold text-ink cursor-text hover:text-violet/80 transition-colors leading-snug"
                >
                  {title}
                </h1>
              )}
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full font-semibold transition-all ${
                    status === s
                      ? s === 'todo' ? 'bg-slate-200 text-slate-600'
                        : s === 'in_progress' ? 'bg-violet text-white'
                        : s === 'review' ? 'bg-amber-500 text-white'
                        : 'bg-sage text-white'
                      : 'bg-paper-dim text-slate-muted hover:bg-paper-dim/80'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
              {saving.status && <span className="text-[10px] text-violet font-mono animate-pulse">saving…</span>}
            </div>

            {/* Description */}
            <Field label="Description">
              <MarkdownEditor
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                minRows={4}
              />
              {saving.description && <p className="text-[10px] text-violet font-mono mt-1 animate-pulse">saving…</p>}
            </Field>

            {/* Child issues */}
            <Field label={`Child issues (${childIssues.length})`}>
              <div className="space-y-1.5">
                {childIssues.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-paper-dim border border-black/5">
                    <IssueTypeIcon type={c.issue_type || 'subtask'} size={12} />
                    <span className="text-ink truncate flex-1">{c.title}</span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
                {showAddChild ? (
                  <form onSubmit={handleAddChildIssue} className="flex gap-2 mt-1">
                    <input
                      autoFocus
                      value={newChildTitle}
                      onChange={(e) => setNewChildTitle(e.target.value)}
                      placeholder="Child issue title"
                      className="flex-1 text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30"
                    />
                    <button type="submit" className="text-xs bg-violet text-white rounded-lg px-3 hover:bg-violet/90">Add</button>
                    <button type="button" onClick={() => setShowAddChild(false)} className="text-xs text-slate-muted hover:text-ink">Cancel</button>
                  </form>
                ) : (
                  <button onClick={() => setShowAddChild(true)} className="text-xs text-slate-muted hover:text-ink flex items-center gap-1 mt-1">
                    <span>+</span> Add child issue
                  </button>
                )}
              </div>
            </Field>

            {/* Issue links */}
            {issueLinks.length > 0 && (
              <Field label={`Issue links (${issueLinks.length})`}>
                <div className="space-y-1.5">
                  {issueLinks.map((link) => {
                    const isFrom = link.from_task_id === task.id
                    const related = isFrom ? link.to_task_id : link.from_task_id
                    return (
                      <div key={link.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-paper-dim border border-black/5">
                        <span className="font-mono text-[9px] text-slate-muted uppercase shrink-0">{link.link_type?.replace(/_/g, ' ')}</span>
                        <span className="text-ink truncate flex-1">{related?.slice(-8)}</span>
                        <button onClick={() => handleRemoveLink(link.id)} className="text-slate-muted hover:text-red-500 transition-colors">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </Field>
            )}

            {/* Attachments */}
            <Field label="Attachments">
              {orgPlan === 'company' ? (
                <label className="flex items-center gap-2 text-xs text-violet hover:opacity-80 cursor-pointer transition-opacity">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v9M2.5 6.5l4-4 4 4M1 11h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {uploading ? 'Uploading…' : 'Attach file'}
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              ) : (
                <p className="text-xs text-slate-muted">File uploads available on Company plan.</p>
              )}
              <AnimatePresence>
                {files.map((f) => (
                  <motion.div key={f.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-between text-sm bg-paper-dim rounded-lg px-3 py-2 mt-2 border border-black/5">
                    <button onClick={async () => { const url = await getFileDownloadUrl(f.storage_path); window.open(url, '_blank') }} className="text-violet hover:underline truncate text-xs">
                      {f.file_name}
                    </button>
                    <button onClick={async () => { await deleteFile({ fileId: f.id, storagePath: f.storage_path }); await loadFiles() }} className="text-slate-muted hover:text-red-500 ml-2 transition-colors">✕</button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Field>

            {/* Time tracking */}
            <Field label={`Time tracking${totalTimeLogged > 0 ? ` · ${Math.round(totalTimeLogged / 60 * 10) / 10}h logged` : ''}`}>
              {/* Estimate row */}
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] font-mono text-slate-muted uppercase tracking-wide w-16 shrink-0">Estimate</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  onBlur={handleEstimateBlur}
                  placeholder="0"
                  className="w-16 text-xs border border-black/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet/30 font-mono text-center"
                />
                <span className="text-[10px] text-slate-muted">hours</span>
                {saving.estimate && <span className="text-[9px] text-violet font-mono animate-pulse">saving…</span>}
              </div>
              {/* Progress bar if both estimate and logged */}
              {estimate && totalTimeLogged > 0 && (
                <div className="mb-2">
                  <div className="h-1.5 bg-paper-dim rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((totalTimeLogged / (parseFloat(estimate) * 60)) * 100, 100)}%`,
                        backgroundColor: totalTimeLogged > parseFloat(estimate) * 60 ? '#EF4444' : '#36D399',
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-muted font-mono mt-0.5">
                    {Math.round(totalTimeLogged / 60 * 10) / 10}h / {estimate}h
                    {totalTimeLogged > parseFloat(estimate) * 60 && <span className="text-red-500 ml-1">over estimate</span>}
                  </p>
                </div>
              )}
              <button onClick={() => setShowTimeModal(true)} className="text-xs text-violet hover:opacity-80 flex items-center gap-1 mb-2">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" /><path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                Log time
              </button>
              {timeLogs.slice(0, 3).map((log) => (
                <div key={log.id} className="text-xs text-slate-muted flex items-center gap-2 mb-1">
                  <span className="font-semibold text-ink">{Math.round(log.minutes / 60 * 10) / 10}h</span>
                  <span>{log.profiles?.full_name || 'Unknown'}</span>
                  <span className="opacity-50">{formatTimeAgo(log.created_at)}</span>
                  {log.description && <span className="italic">· {log.description}</span>}
                </div>
              ))}
            </Field>

            {/* Activity */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider">Activity</p>
                {['all', 'comments', 'history'].map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`text-xs capitalize px-2 py-0.5 rounded-md transition-colors ${tab === t ? 'bg-violet/10 text-violet font-medium' : 'text-slate-muted hover:text-ink'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Comment input */}
              {(tab === 'all' || tab === 'comments') && (
                <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <AnimatePresence>
                      {mention.isOpen && (
                        <MentionDropdown
                          members={mention.filtered}
                          pickerIdx={mention.pickerIdx}
                          onSelect={(m) => mention.doInsert(m, newComment, commentRef, setNewComment)}
                        />
                      )}
                    </AnimatePresence>
                    <input
                      ref={commentRef}
                      type="text"
                      value={newComment}
                      onChange={(e) => {
                        setNewComment(e.target.value)
                        mention.detect(e.target.value, e.target.selectionStart)
                      }}
                      onKeyDown={(e) => {
                        const handled = mention.onPickerKeyDown(e, newComment, commentRef, setNewComment)
                        if (!handled && e.key === 'Enter') handleAddComment(e)
                      }}
                      placeholder="Add a comment… type @ to mention"
                      className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30"
                    />
                  </div>
                  <button type="submit" disabled={!newComment.trim()} className="text-sm bg-violet text-white rounded-xl px-4 hover:bg-violet/90 disabled:opacity-50 transition-colors">
                    Save
                  </button>
                </form>
              )}

              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {/* Comments */}
                  {(tab === 'all' || tab === 'comments') && comments.map((c) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                      <div className="w-7 h-7 bg-violet/20 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-violet">{(c.profiles?.full_name || 'U')[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-ink">{c.profiles?.full_name || 'Unknown'}</span>
                          <span className="text-[10px] text-slate-muted">{formatTimeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-ink bg-paper-dim rounded-xl px-3 py-2 leading-relaxed">{renderWithMentions(c.body, members)}</p>
                      </div>
                    </motion.div>
                  ))}

                  {/* History */}
                  {(tab === 'all' || tab === 'history') && taskActivity.map((entry) => (
                    <motion.div key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-muted/40 rounded-full ml-2.5 shrink-0" />
                      <p className="text-xs text-slate-muted">
                        {formatActivity(entry)} <span className="opacity-60">· {formatTimeAgo(entry.created_at)}</span>
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {tab === 'comments' && comments.length === 0 && (
                  <p className="text-sm text-slate-muted py-4 text-center">No comments yet. Be the first!</p>
                )}
              </div>
            </div>
          </div>

          {/* Right — metadata sidebar */}
          <div className="w-64 shrink-0 border-l border-black/5 overflow-y-auto px-4 py-5 bg-paper">
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                {error}
              </motion.div>
            )}

            {/* Issue type */}
            <Field label="Type">
              <div className="flex flex-wrap gap-1.5">
                {ISSUE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleIssueTypeChange(t)}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors capitalize ${
                      issueType === t ? 'border-violet bg-violet/10 text-violet' : 'border-black/10 text-slate-muted hover:text-ink'
                    }`}
                  >
                    <IssueTypeIcon type={t} size={11} /> {t}
                  </button>
                ))}
              </div>
            </Field>

            {/* Assignee */}
            <Field label="Assignee">
              <select
                defaultValue={task.assignee_id || ''}
                onChange={handleAssigneeChange}
                className="w-full text-xs rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
              >
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.id}</option>)}
              </select>
            </Field>

            {/* Reporter */}
            <Field label="Reporter">
              <p className="text-xs text-ink">
                {members.find((m) => m.id === task.created_by)?.full_name || 'Unknown'}
              </p>
            </Field>

            {/* Priority */}
            <Field label="Priority">
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors capitalize ${
                      priority === p ? 'border-violet bg-violet/10 text-violet' : 'border-black/10 text-slate-muted hover:text-ink'
                    }`}
                  >
                    <PriorityIcon priority={p} size={10} /> {p}
                  </button>
                ))}
              </div>
            </Field>

            {/* Story points */}
            <Field label="Story points">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  onBlur={handleStoryPointsBlur}
                  placeholder="—"
                  className="w-20 text-xs rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
                />
                {saving.storyPoints && <span className="text-[10px] text-violet animate-pulse">saving…</span>}
              </div>
            </Field>

            {/* Labels */}
            <Field label="Labels">
              <div className="flex flex-wrap gap-1.5 mb-1">
                {taskLabelList.map((label) => (
                  <button key={label.id} onClick={() => handleToggleLabel(label)} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium" style={{ backgroundColor: `${label.color}20`, color: label.color }}>
                    {label.name} ✕
                  </button>
                ))}
                <button onClick={() => setShowLabelPicker(!showLabelPicker)} className="text-[10px] px-2 py-0.5 rounded-full border border-black/10 text-slate-muted hover:text-ink">
                  + Add
                </button>
              </div>
              <AnimatePresence>
                {showLabelPicker && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-white rounded-lg p-2 border border-black/5 overflow-hidden">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {projectLabels.filter((l) => !taskLabelList.some((tl) => tl.id === l.id)).map((label) => (
                        <button key={label.id} onClick={() => handleToggleLabel(label)} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${label.color}20`, color: label.color }}>
                          {label.name}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={handleCreateLabel} className="flex gap-1">
                      <input type="text" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="New label" className="flex-1 text-[10px] rounded border border-black/10 px-1.5 py-1 bg-paper-dim" />
                      <button type="submit" className="text-[10px] bg-violet text-white rounded px-2 hover:bg-violet/90">+</button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </Field>

            {/* Sprint */}
            <Field label="Sprint">
              <select value={sprintId} onChange={handleSprintChange} className="w-full text-xs rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white">
                <option value="">No sprint (backlog)</option>
                {sprints.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
              </select>
            </Field>

            {/* Fix version */}
            <Field label="Fix version">
              <select value={versionId} onChange={handleVersionChange} className="w-full text-xs rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white">
                <option value="">None</option>
                {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>

            {/* Components */}
            {components.length > 0 && (
              <Field label="Components">
                <div className="flex flex-wrap gap-1">
                  {components.map((c) => {
                    const attached = taskComponents.some((tc) => tc.id === c.id)
                    return (
                      <button key={c.id} onClick={() => handleToggleComponent(c)} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${attached ? 'bg-violet/10 border-violet text-violet' : 'border-black/10 text-slate-muted hover:text-ink'}`}>
                        {c.name} {attached && '✓'}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}

            {/* Due date */}
            <Field label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={handleDueDateChange}
                className="w-full text-xs rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
              />
            </Field>

            {/* Watchers */}
            <Field label={`Watchers (${watchers.length})`}>
              <div className="flex flex-wrap gap-1">
                {watchers.map((w) => (
                  <span key={w.user_id} className="text-[10px] bg-paper-dim px-2 py-0.5 rounded-full text-slate-muted">
                    {w.profiles?.full_name || 'Unknown'}
                  </span>
                ))}
              </div>
            </Field>

            {/* Meta */}
            <div className="mt-4 pt-4 border-t border-black/5 space-y-1">
              <p className="text-[10px] text-slate-muted">
                Created {formatTimeAgo(task.created_at)}
              </p>
              <p className="text-[10px] text-slate-muted">
                Updated {formatTimeAgo(task.updated_at || task.created_at)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Link issue modal */}
      <AnimatePresence>
        {showLinkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/50 z-60 flex items-center justify-center p-4"
            onClick={() => setShowLinkModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-ink mb-4">Link issue</h3>
              <div className="mb-3">
                <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">Link type</label>
                <select value={linkType} onChange={(e) => setLinkType(e.target.value)} className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 bg-white">
                  {LINK_TYPES.map((lt) => <option key={lt} value={lt}>{lt.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">Search issues</label>
                <input
                  autoFocus
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                  placeholder="Type to search…"
                  className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30"
                />
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {linkResults.map((r) => (
                    <button key={r.id} onClick={() => handleAddLink(r)} className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-paper-dim text-sm">
                      <IssueTypeIcon type={r.issue_type || 'task'} size={12} />
                      <span className="truncate text-ink">{r.title}</span>
                      <StatusBadge status={r.status} />
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowLinkModal(false)} className="w-full text-sm text-slate-muted hover:text-ink">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log time modal */}
      <AnimatePresence>
        {showTimeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/50 z-60 flex items-center justify-center p-4"
            onClick={() => setShowTimeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-ink mb-4">Log time</h3>
              <form onSubmit={handleLogTime} className="space-y-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">Minutes spent</label>
                  <input
                    autoFocus
                    type="number"
                    min="1"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(e.target.value)}
                    placeholder="60"
                    className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">Description (optional)</label>
                  <input
                    value={logDesc}
                    onChange={(e) => setLogDesc(e.target.value)}
                    placeholder="What did you work on?"
                    className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 bg-violet text-white text-sm rounded-lg py-2 hover:bg-violet/90">Log time</button>
                  <button type="button" onClick={() => setShowTimeModal(false)} className="px-4 text-sm text-slate-muted hover:text-ink">Cancel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
