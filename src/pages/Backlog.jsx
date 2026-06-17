import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getTasks, createTask, getSprints, createSprint, updateSprint,
  startSprint, completeSprint, updateTaskSprint, getProjectMembers,
  getAllTaskLabels, getProjectKey, getProject,
} from '../lib/data'
import { supabase } from '../lib/supabase'
import { IssueTypeIcon, PriorityIcon, StatusBadge } from '../components/IssueIcons'
import TaskDetailPanel from './TaskDetailPanel'

function SprintModal({ sprint, onSave, onClose }) {
  const [name, setName] = useState(sprint?.name || `Sprint ${Date.now()}`)
  const [goal, setGoal] = useState(sprint?.goal || '')
  const [startDate, setStartDate] = useState(sprint?.start_date || '')
  const [endDate, setEndDate] = useState(sprint?.end_date || '')

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave({ name, goal, startDate, endDate })
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
        <h3 className="font-semibold text-ink mb-4">{sprint ? 'Edit sprint' : 'Create sprint'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">Sprint name *</label>
            <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30" />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">Sprint goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="What do we want to achieve?" className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted block mb-1">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="flex-1 bg-violet text-white text-sm rounded-xl py-2.5 hover:bg-violet/90 transition-colors font-medium">
              {sprint ? 'Save changes' : 'Create sprint'}
            </button>
            <button type="button" onClick={onClose} className="px-4 text-sm text-slate-muted hover:text-ink">Cancel</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

const STATUS_BADGE = {
  planning:  { label: 'Planning',   className: 'bg-slate-100 text-slate-600' },
  active:    { label: 'Active',     className: 'bg-violet/15 text-violet' },
  completed: { label: 'Completed',  className: 'bg-sage/20 text-green-700' },
}

function IssueRow({ task, index, projectKey, onSelect, onMoveToSprint, sprints, onMoveToBacklog }) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper-dim/60 border-b border-black/5 last:border-0 group cursor-pointer"
      onClick={() => onSelect(task)}
    >
      <IssueTypeIcon type={task.issue_type || 'task'} size={13} />
      <span className="font-mono text-[9px] text-slate-muted/50 w-16 shrink-0">{projectKey}-{index + 1}</span>
      <span className={`flex-1 text-sm text-ink min-w-0 truncate ${task.status === 'done' ? 'line-through text-slate-muted' : ''}`}>
        {task.title}
      </span>
      {task.story_points != null && (
        <span className="font-mono text-[10px] bg-paper-dim text-slate-muted px-1.5 py-0.5 rounded shrink-0">{task.story_points}p</span>
      )}
      {task.due_date && (
        <span className={`font-mono text-[9px] uppercase tracking-wide shrink-0 ${isOverdue ? 'text-red-500' : 'text-slate-muted'}`}>
          {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      <PriorityIcon priority={task.priority || 'medium'} size={11} />
      <StatusBadge status={task.status} />

      {/* Move menu */}
      <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu) }}
          className="text-slate-muted hover:text-ink p-1"
          title="Move to sprint"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5h11M7.5 2l4 4.5-4 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <AnimatePresence>
          {showMoveMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              className="absolute right-0 top-7 z-20 bg-white rounded-xl shadow-xl border border-black/8 py-1 min-w-[160px]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-mono text-[9px] uppercase tracking-wider text-slate-muted px-3 pt-1 pb-1.5">Move to sprint</p>
              {sprints.filter((s) => s.status !== 'completed').map((s) => (
                <button key={s.id} onClick={() => { onMoveToSprint(task.id, s.id); setShowMoveMenu(false) }} className="w-full text-left text-xs px-3 py-1.5 hover:bg-paper-dim text-ink">
                  {s.name}
                  <span className={`ml-2 text-[9px] font-mono ${s.status === 'active' ? 'text-violet' : 'text-slate-muted'}`}>({s.status})</span>
                </button>
              ))}
              {task.sprint_id && (
                <button onClick={() => { onMoveToBacklog(task.id); setShowMoveMenu(false) }} className="w-full text-left text-xs px-3 py-1.5 hover:bg-paper-dim text-slate-muted border-t border-black/5 mt-1">
                  → Move to backlog
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function SprintSection({ sprint, tasks, projectKey, members, onSelect, onMoveToSprint, sprints, onMoveToBacklog, onStartSprint, onCompleteSprint, onEditSprint, index }) {
  const [expanded, setExpanded] = useState(sprint.status !== 'completed')
  const totalPoints = tasks.reduce((s, t) => s + (t.story_points || 0), 0)
  const donePoints = tasks.filter((t) => t.status === 'done').reduce((s, t) => s + (t.story_points || 0), 0)
  const badge = STATUS_BADGE[sprint.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="mb-4 bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm"
    >
      {/* Sprint header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-paper-dim/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }} className="text-slate-muted">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2l6 4-6 4V2z" fill="currentColor" /></svg>
        </motion.span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-ink">{sprint.name}</span>
            <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-semibold ${badge.className}`}>{badge.label}</span>
            {sprint.start_date && sprint.end_date && (
              <span className="text-[10px] text-slate-muted">
                {new Date(sprint.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                {new Date(sprint.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          {sprint.goal && <p className="text-xs text-slate-muted mt-0.5 truncate">{sprint.goal}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-muted font-mono">{tasks.length} issues</span>
          {totalPoints > 0 && (
            <span className="text-xs text-slate-muted font-mono">{donePoints}/{totalPoints}p</span>
          )}
          {/* Progress bar */}
          {totalPoints > 0 && (
            <div className="w-16 h-1.5 bg-paper-dim rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(donePoints / totalPoints) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-sage rounded-full"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onEditSprint(sprint)} className="text-[10px] text-slate-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-paper-dim transition-colors">Edit</button>
          {sprint.status === 'planning' && tasks.length > 0 && (
            <button onClick={() => onStartSprint(sprint.id)} className="text-[10px] bg-violet text-white px-2.5 py-1 rounded-lg hover:bg-violet/90 transition-colors font-medium">
              Start sprint
            </button>
          )}
          {sprint.status === 'active' && (
            <button onClick={() => onCompleteSprint(sprint.id)} className="text-[10px] bg-sage/80 text-white px-2.5 py-1 rounded-lg hover:bg-sage transition-colors font-medium">
              Complete sprint
            </button>
          )}
        </div>
      </div>

      {/* Issues */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-black/5">
            {tasks.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-muted">No issues in this sprint.</p>
                <p className="text-xs text-slate-muted/60 mt-1">Drag issues from the backlog or use the move menu.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {tasks.map((task, i) => (
                  <IssueRow
                    key={task.id}
                    task={task}
                    index={i}
                    projectKey={projectKey}
                    onSelect={onSelect}
                    onMoveToSprint={onMoveToSprint}
                    sprints={sprints}
                    onMoveToBacklog={onMoveToBacklog}
                    members={members}
                  />
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Backlog() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  const [taskLabels, setTaskLabels] = useState({})
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sprintsError, setSprintsError] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showSprintModal, setShowSprintModal] = useState(false)
  const [editingSprint, setEditingSprint] = useState(null)
  const [newIssueTitle, setNewIssueTitle] = useState('')
  const [addingIssue, setAddingIssue] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    loadAll()

    const ch = supabase
      .channel(`backlog-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, loadTasks)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [projectId])

  async function loadAll() {
    setLoading(true)
    await Promise.allSettled([loadTasks(), loadSprints(), loadMeta()])
    setLoading(false)
  }

  async function loadTasks() {
    try { setTasks(await getTasks(projectId)) } catch {}
  }

  async function loadSprints() {
    try {
      setSprints(await getSprints(projectId))
      setSprintsError(false)
    } catch {
      setSprintsError(true)
    }
  }

  async function loadMeta() {
    try {
      const [p, m, labels] = await Promise.all([
        getProject(projectId),
        getProjectMembers(projectId),
        getAllTaskLabels(projectId),
      ])
      setProject(p)
      setMembers(m)
      setTaskLabels(labels)
    } catch {}
  }

  async function handleCreateSprint({ name, goal, startDate, endDate }) {
    try {
      await createSprint({ projectId, name, goal, startDate, endDate, userId: user.id })
      await loadSprints()
    } catch (err) { alert(err.message) }
  }

  async function handleEditSprint({ name, goal, startDate, endDate }) {
    try {
      await updateSprint({ sprintId: editingSprint.id, name, goal, startDate, endDate })
      await loadSprints()
      setEditingSprint(null)
    } catch (err) { alert(err.message) }
  }

  async function handleStartSprint(sprintId) {
    try { await startSprint(sprintId); await loadSprints() } catch (err) { alert(err.message) }
  }

  async function handleCompleteSprint(sprintId) {
    try { await completeSprint(sprintId); await loadSprints() } catch (err) { alert(err.message) }
  }

  async function handleMoveToSprint(taskId, sprintId) {
    try { await updateTaskSprint({ taskId, sprintId }); await loadTasks() } catch (err) { alert(err.message) }
  }

  async function handleMoveToBacklog(taskId) {
    try { await updateTaskSprint({ taskId, sprintId: null }); await loadTasks() } catch (err) { alert(err.message) }
  }

  async function handleAddBacklogIssue(e) {
    e.preventDefault()
    if (!newIssueTitle.trim()) return
    try {
      await createTask({ projectId, title: newIssueTitle, userId: user.id, status: 'todo' })
      setNewIssueTitle('')
      setAddingIssue(false)
      await loadTasks()
    } catch (err) { alert(err.message) }
  }

  function matchesFilter(task) {
    if (filterQuery && !task.title.toLowerCase().includes(filterQuery.toLowerCase())) return false
    if (filterAssignee && task.assignee_id !== filterAssignee) return false
    if (filterType && (task.issue_type || 'task') !== filterType) return false
    return true
  }

  const projectKey = project ? getProjectKey(project.name) : 'KEY'
  const backlogTasks = tasks.filter((t) => !t.sprint_id).filter(matchesFilter)
  const activeSprint = sprints.find((s) => s.status === 'active')

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} className="font-mono text-xs uppercase tracking-wider text-slate-muted">
        Loading backlog…
      </motion.p>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-black/5 bg-white flex items-center gap-3 shrink-0 flex-wrap">
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Search backlog…"
          className="text-xs rounded-lg border border-black/10 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/30 w-52"
        />
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white">
          <option value="">All assignees</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white">
          <option value="">All types</option>
          <option value="epic">Epic</option>
          <option value="story">Story</option>
          <option value="task">Task</option>
          <option value="bug">Bug</option>
          <option value="subtask">Subtask</option>
        </select>
        <div className="ml-auto">
          <button
            onClick={() => setShowSprintModal(true)}
            className="flex items-center gap-1.5 text-xs bg-violet text-white rounded-lg px-3 py-1.5 hover:bg-violet/90 transition-colors font-medium"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Create sprint
          </button>
        </div>
      </div>

      {/* DB migration notice */}
      {sprintsError && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mx-5 mt-3 flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="M6.5 4v3M6.5 9v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          Sprint features require a database migration. Add the <code className="bg-amber-100 px-1 rounded">sprints</code> table to enable sprint management.
        </motion.div>
      )}

      {/* Active sprint callout */}
      {activeSprint && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-5 mt-3 flex items-center gap-2 bg-violet/5 border border-violet/20 rounded-xl px-4 py-2.5">
          <div className="w-2 h-2 bg-violet rounded-full animate-pulse" />
          <span className="text-sm font-medium text-violet">{activeSprint.name} is active</span>
          {activeSprint.end_date && (
            <span className="text-xs text-violet/70">
              · Ends {new Date(activeSprint.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span className="text-xs text-violet/70 ml-auto">
            {tasks.filter((t) => t.sprint_id === activeSprint.id).length} issues in sprint
          </span>
        </motion.div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Sprint sections */}
        {sprints.map((sprint, i) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            tasks={tasks.filter((t) => t.sprint_id === sprint.id).filter(matchesFilter)}
            projectKey={projectKey}
            members={members}
            onSelect={setSelectedTask}
            onMoveToSprint={handleMoveToSprint}
            sprints={sprints}
            onMoveToBacklog={handleMoveToBacklog}
            onStartSprint={handleStartSprint}
            onCompleteSprint={handleCompleteSprint}
            onEditSprint={(s) => setEditingSprint(s)}
            index={i}
          />
        ))}

        {/* Backlog section */}
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5">
            <span className="font-semibold text-sm text-ink">Backlog</span>
            <span className="font-mono text-[10px] bg-paper-dim text-slate-muted px-1.5 py-0.5 rounded-full">{backlogTasks.length}</span>
            <span className="text-xs text-slate-muted">issues not assigned to a sprint</span>
          </div>

          {backlogTasks.length > 0 ? (
            <AnimatePresence initial={false}>
              {backlogTasks.map((task, i) => (
                <IssueRow
                  key={task.id}
                  task={task}
                  index={i}
                  projectKey={projectKey}
                  onSelect={setSelectedTask}
                  onMoveToSprint={handleMoveToSprint}
                  sprints={sprints}
                  onMoveToBacklog={handleMoveToBacklog}
                  members={members}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-muted">Backlog is empty.</p>
              <p className="text-xs text-slate-muted/60 mt-1">All issues are assigned to sprints, or no issues exist yet.</p>
            </div>
          )}

          {/* Add issue */}
          <div className="px-4 py-3 border-t border-black/5">
            <AnimatePresence mode="wait">
              {addingIssue ? (
                <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleAddBacklogIssue} className="flex gap-2">
                  <input
                    autoFocus
                    value={newIssueTitle}
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setAddingIssue(false)}
                    placeholder="Issue summary"
                    className="flex-1 text-sm rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30"
                  />
                  <button type="submit" className="text-xs bg-violet text-white rounded-xl px-4 hover:bg-violet/90 transition-colors">Create</button>
                  <button type="button" onClick={() => setAddingIssue(false)} className="text-xs text-slate-muted hover:text-ink px-2">Cancel</button>
                </motion.form>
              ) : (
                <motion.button key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setAddingIssue(true)} className="text-xs text-slate-muted hover:text-ink flex items-center gap-1.5 transition-colors">
                  <span className="text-base leading-none">+</span> Create issue
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showSprintModal && (
          <SprintModal onSave={handleCreateSprint} onClose={() => setShowSprintModal(false)} />
        )}
        {editingSprint && (
          <SprintModal sprint={editingSprint} onSave={handleEditSprint} onClose={() => setEditingSprint(null)} />
        )}
        {selectedTask && (
          <TaskDetailPanel
            key={selectedTask.id}
            task={selectedTask}
            members={members}
            orgPlan={null}
            projectKey={projectKey}
            onClose={() => setSelectedTask(null)}
            onTaskUpdated={loadTasks}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
