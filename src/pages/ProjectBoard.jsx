import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors, useDroppable, DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskDetailPanel from './TaskDetailPanel'
import {
  getMyOrg, getTasks, createTask, updateTaskPosition, getProjectMembers,
  getAllTaskLabels, getProjectLabels, getProjectKey,
  getSprints, completeSprint, getProjectEpics, getWipLimits,
  updateTaskSprint, bulkUpdateTasks, bulkDeleteTasks,
} from '../lib/data'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { IssueTypeIcon, PriorityIcon } from '../components/IssueIcons'

const COLUMNS = [
  { key: 'todo',        label: 'To Do',      accent: '#8A8F98' },
  { key: 'in_progress', label: 'In Progress', accent: '#6E56CF' },
  { key: 'review',      label: 'In Review',   accent: '#F59E0B' },
  { key: 'done',        label: 'Done',        accent: '#36D399' },
]

// Deterministic hue from a string so each member gets a consistent color
function memberColor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 55%, 68%)`
}

function AssigneeAvatar({ assigneeId, members, size = 20 }) {
  const member = members.find((m) => m.id === assigneeId)
  const initial = (member?.full_name || member?.email || '?')[0].toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: memberColor(assigneeId),
        fontSize: size * 0.42,
        color: '#fff',
      }}
      title={member?.full_name || assigneeId}
    >
      {initial}
    </div>
  )
}

const PRIORITY_STRIPE = { urgent: '#EF4444', high: '#F59E0B', medium: '#6E56CF', low: '#8A8F9840' }

function TaskCard({ task, onClick, labels, projectKey, index, members, isSelected, onToggleSelect, anySelected, compact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())
  const stripeColor = PRIORITY_STRIPE[task.priority] || PRIORITY_STRIPE.medium

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout={!isDragging}
      transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
      onClick={() => { if (anySelected) { onToggleSelect(task.id) } else { onClick(task) } }}
      className={`bg-white border rounded-xl overflow-hidden relative cursor-grab active:cursor-grabbing group transition-all hover:shadow-md ${
        compact ? 'px-2.5 py-1.5 mb-1 shadow-none' : 'p-3 mb-2 shadow-sm'
      } ${isDragging ? 'shadow-xl -rotate-1' : ''} ${task.status === 'done' ? 'opacity-70' : ''} ${
        isSelected ? 'border-violet/50 ring-1 ring-violet/20 bg-violet/2' : 'border-black/5 hover:border-black/10'
      }`}
    >
      {/* Priority stripe */}
      <div className="absolute left-0 top-2 bottom-2 w-0.75 rounded-full" style={{ backgroundColor: stripeColor }} />

      {compact ? (
        /* ── Compact layout ── */
        <div className="flex items-center gap-1.5 pl-2">
          <div
            className={`shrink-0 transition-opacity ${anySelected || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleSelect(task.id, e) }}
          >
            <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${
              isSelected ? 'bg-violet border-violet' : 'border-black/20 hover:border-violet/60'
            }`}>
              {isSelected && <svg width="6" height="6" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          </div>
          <IssueTypeIcon type={task.issue_type || 'task'} size={11} />
          <span className={`text-xs text-ink flex-1 truncate ${task.status === 'done' ? 'line-through text-slate-muted' : ''}`}>
            {task.title}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {task.story_points != null && <span className="font-mono text-[9px] text-slate-muted">{task.story_points}p</span>}
            {task.assignee_id && <AssigneeAvatar assigneeId={task.assignee_id} members={members} size={16} />}
          </div>
        </div>
      ) : (
        /* ── Normal layout ── */
        <div className="flex items-start gap-2">
          <div
            className={`mt-0.5 shrink-0 transition-opacity ${anySelected || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleSelect(task.id, e) }}
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
              isSelected ? 'bg-violet border-violet' : 'border-black/20 hover:border-violet/60'
            }`}>
              {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {labels && labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {labels.map((label) => (
                  <span key={label.id}
                    className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: `${label.color}20`, color: label.color }}
                  >{label.name}</span>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2">
              <IssueTypeIcon type={task.issue_type || 'task'} size={13} />
              <p className={`text-sm font-medium text-ink leading-snug flex-1 ${task.status === 'done' ? 'line-through text-slate-muted' : ''}`}>
                {task.title}
              </p>
              {task.story_points != null && (
                <span className="shrink-0 font-mono text-[10px] bg-paper-dim text-slate-muted px-1.5 py-0.5 rounded ml-1">
                  {task.story_points}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-slate-muted/50 uppercase tracking-wider">{projectKey}-{index + 1}</span>
                {task.due_date && (
                  <span className={`font-mono text-[9px] uppercase tracking-wide ${isOverdue ? 'text-red-500' : 'text-slate-muted/60'}`}>
                    {isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <PriorityIcon priority={task.priority || 'medium'} size={11} />
                {task.assignee_id && <AssigneeAvatar assigneeId={task.assignee_id} members={members} size={20} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function Column({ column, tasks, onTaskClick, taskLabels, projectKey, members, onQuickAdd, collapsed, onToggleCollapse, wipLimit, selected, onToggleSelect, compact }) {
  const { setNodeRef } = useDroppable({ id: column.key })
  const overWip = wipLimit && tasks.length > wipLimit

  return (
    <div className={`bg-paper-dim rounded-2xl flex flex-col flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-14 p-2' : 'w-72 p-3'} ${overWip ? 'ring-1 ring-red-400/40' : ''}`}>
      {/* Column header */}
      <div className={`flex items-center mb-3 ${collapsed ? 'flex-col gap-2' : 'justify-between px-1'}`}>
        {collapsed ? (
          <>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.accent }} />
            <button
              onClick={onToggleCollapse}
              title={`Expand ${column.label}`}
              className="writing-vertical text-[9px] font-mono font-semibold text-slate-muted uppercase tracking-wider hover:text-ink transition-colors"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {column.label}
            </button>
            <span className="font-mono text-[9px] text-slate-muted/60 bg-white px-1 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.accent }} />
              <p className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider">
                {column.label}
              </p>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${overWip ? 'bg-red-100 text-red-600 font-bold' : 'text-slate-muted/60 bg-white'}`}>
                {tasks.length}{wipLimit ? `/${wipLimit}` : ''}
              </span>
              {overWip && (
                <span className="text-[9px] text-red-500 font-mono">WIP exceeded</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Quick-add in header */}
              <button
                onClick={onQuickAdd}
                title="Add issue"
                className="w-5 h-5 rounded-md flex items-center justify-center text-slate-muted/50 hover:text-ink hover:bg-white transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
              {/* Collapse toggle */}
              <button
                onClick={onToggleCollapse}
                title="Collapse column"
                className="w-5 h-5 rounded-md flex items-center justify-center text-slate-muted/40 hover:text-ink hover:bg-white transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 1v8M1 3l2-2 2 2M1 7l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cards */}
      {!collapsed && (
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="flex-1 min-h-[120px]">
            <AnimatePresence initial={false} mode="popLayout">
              {tasks.map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  labels={taskLabels[task.id]}
                  projectKey={projectKey}
                  index={i}
                  members={members}
                  isSelected={selected?.has(task.id)}
                  onToggleSelect={onToggleSelect}
                  anySelected={selected?.size > 0}
                  compact={compact}
                />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// ── Group-by helpers ─────────────────────────────────────────────

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low']
const PRIORITY_ACCENTS = { urgent: '#EF4444', high: '#F59E0B', medium: '#6E56CF', low: '#8A8F98' }

function SwimLaneRow({ label, color, tasks, column, onTaskClick, taskLabels, projectKey, members, selected, onToggleSelect, compact }) {
  const [collapsed, setCollapsed] = useState(false)
  const { setNodeRef } = useDroppable({ id: `${column.key}__${label}` })

  return (
    <div className="mb-2">
      {/* Lane header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 w-full text-left mb-1.5 group"
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-slate-muted group-hover:text-ink transition-colors">
          {label}
        </span>
        <span className="text-[9px] font-mono text-slate-muted/50">{tasks.length}</span>
        <motion.svg
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: 0.15 }}
          width="8" height="8" viewBox="0 0 8 8" fill="none"
          className="text-slate-muted/40 ml-0.5"
        >
          <path d="M1 2l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div ref={setNodeRef} className="min-h-[40px]">
              <AnimatePresence initial={false} mode="popLayout">
                {tasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    labels={taskLabels[task.id]}
                    projectKey={projectKey}
                    index={i}
                    members={members}
                    isSelected={selected?.has(task.id)}
                    onToggleSelect={onToggleSelect}
                    anySelected={selected?.size > 0}
                    compact={compact}
                  />
                ))}
              </AnimatePresence>
              {tasks.length === 0 && (
                <div className="h-10 border-2 border-dashed border-black/5 rounded-xl flex items-center justify-center">
                  <span className="text-[10px] text-slate-muted/40">Drop here</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Board ────────────────────────────────────────────────────
export default function ProjectBoard() {
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()

  const [tasks, setTasks]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTo, setAddingTo]         = useState(null)
  const [members, setMembers]           = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [orgPlan, setOrgPlan]           = useState(null)
  const [activeDragTask, setActiveDragTask] = useState(null)
  const [taskLabels, setTaskLabels]     = useState({})
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterLabel, setFilterLabel]   = useState('')
  const [filterType, setFilterType]     = useState('')
  const [showFilters, setShowFilters]   = useState(false)
  const [projectLabels, setProjectLabels] = useState([])
  const [project, setProject]           = useState(null)
  const [newTaskType, setNewTaskType]   = useState('task')
  const [groupBy, setGroupBy]           = useState('none')  // 'none' | 'assignee' | 'priority' | 'epic'
  const [collapsedCols, setCollapsedCols] = useState({})
  const [activeSprint, setActiveSprint] = useState(null)
  const [epics, setEpics]               = useState([])
  const [wipLimits, setWipLimits]       = useState({})
  const [filterMine, setFilterMine]     = useState(false)
  const [filterUnassigned, setFilterUnassigned] = useState(false)
  const [completingSprint, setCompletingSprint] = useState(false)
  const [boardSearch, setBoardSearch]   = useState('')
  const [selected, setSelected]         = useState(new Set()) // selected task IDs for bulk ops
  const [bulkWorking, setBulkWorking]   = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [incompleteDisposition, setIncompleteDisposition] = useState({}) // taskId → 'backlog' | sprintId
  const [allSprints, setAllSprints]     = useState([])
  const [compact, setCompact]           = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    loadBoard()
    getProjectMembers(projectId).then(setMembers).catch(() => {})
    getMyOrg().then(({ org }) => setOrgPlan(org.plan)).catch(() => {})
    getAllTaskLabels(projectId).then(setTaskLabels).catch(() => {})
    getProjectLabels(projectId).then(setProjectLabels).catch(() => {})
    getSprints(projectId).then((sprints) => {
      setAllSprints(sprints)
      setActiveSprint(sprints.find((s) => s.status === 'active') || null)
    }).catch(() => {})
    getProjectEpics(projectId).then(setEpics).catch(() => {})
    getWipLimits(projectId).then(setWipLimits).catch(() => {})
    import('../lib/data').then(({ getProject }) => getProject(projectId).then(setProject).catch(() => {}))

    const channel = supabase
      .channel(`board-${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}`,
      }, () => loadBoard())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [projectId])

  // Auto-open a task when ?task=<id> is present (e.g. arriving from a notification click)
  useEffect(() => {
    const taskId = searchParams.get('task')
    if (!taskId || !tasks.length) return
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      setSelectedTask(task)
      setSearchParams((prev) => { prev.delete('task'); return prev }, { replace: true })
    }
  }, [tasks, searchParams])

  async function loadBoard() {
    try {
      setTasks(await getTasks(projectId))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddTask(status, groupKey) {
    if (!newTaskTitle.trim()) return
    try {
      await createTask({ projectId, title: newTaskTitle, userId: user.id, status })
      setNewTaskTitle('')
      setAddingTo(null)
      await loadBoard()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDragStart(event) {
    setActiveDragTask(tasks.find((t) => t.id === event.active.id))
  }

  async function handleDragEnd(event) {
    setActiveDragTask(null)
    const { active, over } = event
    if (!over) return
    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return

    // Support swimlane drop targets like "in_progress__Alice"
    const overId = typeof over.id === 'string' && over.id.includes('__')
      ? over.id.split('__')[0]
      : over.id

    const isColumnDrop = COLUMNS.some((c) => c.key === overId)
    const overTask     = isColumnDrop ? null : tasks.find((t) => t.id === over.id)
    const targetStatus = isColumnDrop ? overId : overTask?.status
    if (!targetStatus) return

    const columnTasks = tasks
      .filter((t) => t.status === targetStatus && t.id !== activeTask.id)
      .sort((a, b) => a.position - b.position)
    const overIndex = overTask ? columnTasks.findIndex((t) => t.id === overTask.id) : columnTasks.length

    let newPosition
    if (columnTasks.length === 0)            newPosition = 1
    else if (overIndex === 0)                newPosition = columnTasks[0].position / 2
    else if (overIndex >= columnTasks.length) newPosition = columnTasks[columnTasks.length - 1].position + 1
    else newPosition = (columnTasks[overIndex - 1].position + columnTasks[overIndex].position) / 2

    setTasks((prev) =>
      prev.map((t) => t.id === activeTask.id ? { ...t, status: targetStatus, position: newPosition } : t)
    )

    try {
      await updateTaskPosition({
        taskId: activeTask.id, status: targetStatus, position: newPosition,
        userId: user.id, previousStatus: activeTask.status,
        taskTitle: activeTask.title, projectId,
      })
    } catch (err) {
      setError(err.message)
      await loadBoard()
    }
  }

  // Opens the sprint completion modal and initialises default disposition (backlog)
  function openCompleteModal() {
    if (!activeSprint) return
    const incomplete = tasks.filter(t => t.sprint_id === activeSprint.id && t.status !== 'done')
    const defaults = {}
    incomplete.forEach(t => { defaults[t.id] = 'backlog' })
    setIncompleteDisposition(defaults)
    setShowCompleteModal(true)
  }

  async function handleCompleteSprint() {
    if (!activeSprint || completingSprint) return
    setCompletingSprint(true)
    try {
      // Move incomplete issues per user choice
      const incomplete = tasks.filter(t => t.sprint_id === activeSprint.id && t.status !== 'done')
      for (const task of incomplete) {
        const dest = incompleteDisposition[task.id]
        await updateTaskSprint({ taskId: task.id, sprintId: dest === 'backlog' ? null : dest })
      }
      await completeSprint(activeSprint.id)
      setActiveSprint(null)
      setShowCompleteModal(false)
      await loadBoard()
    } catch (err) {
      setError(err.message)
    } finally {
      setCompletingSprint(false)
    }
  }

  // ── Bulk selection helpers ──────────────────────────────────────
  function toggleSelect(taskId, e) {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(taskId) ? next.delete(taskId) : next.add(taskId)
      return next
    })
  }

  function clearSelection() { setSelected(new Set()) }

  async function bulkAction(patch) {
    if (!selected.size || bulkWorking) return
    setBulkWorking(true)
    try {
      await bulkUpdateTasks([...selected], patch)
      clearSelection()
      await loadBoard()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkWorking(false)
    }
  }

  async function bulkDelete() {
    if (!selected.size || bulkWorking) return
    if (!confirm(`Delete ${selected.size} issue${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setBulkWorking(true)
    try {
      await bulkDeleteTasks([...selected])
      clearSelection()
      await loadBoard()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkWorking(false)
    }
  }

  function matchesFilters(task) {
    if (boardSearch && !task.title.toLowerCase().includes(boardSearch.toLowerCase())) return false
    if (filterMine && task.assignee_id !== user.id) return false
    if (filterUnassigned && task.assignee_id) return false
    if (filterAssignee && task.assignee_id !== filterAssignee) return false
    if (filterPriority && task.priority !== filterPriority)   return false
    if (filterType && (task.issue_type || 'task') !== filterType) return false
    if (filterLabel) {
      const labels = taskLabels[task.id] || []
      if (!labels.some((l) => l.id === filterLabel)) return false
    }
    return true
  }

  function toggleColCollapse(key) {
    setCollapsedCols((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const hasFilters  = filterAssignee || filterPriority || filterLabel || filterType || filterMine || filterUnassigned
  const projectKey  = project ? getProjectKey(project.name) : 'KEY'

  // ── Group-by logic ───────────────────────────────────────────
  function getGroups(columnKey) {
    if (groupBy === 'assignee') {
      const unassigned = { key: 'unassigned', label: 'Unassigned', color: '#8A8F98' }
      const memberGroups = members.map((m) => ({
        key: m.id,
        label: m.full_name || m.email || 'Unknown',
        color: memberColor(m.id),
      }))
      return [unassigned, ...memberGroups]
    }
    if (groupBy === 'priority') {
      return PRIORITY_ORDER.map((p) => ({
        key: p,
        label: p.charAt(0).toUpperCase() + p.slice(1),
        color: PRIORITY_ACCENTS[p],
      }))
    }
    if (groupBy === 'epic') {
      const noEpic = { key: 'no_epic', label: 'No Epic', color: '#8A8F98' }
      const epicGroups = epics.map((e) => ({ key: e.id, label: e.title, color: '#6E56CF' }))
      return [noEpic, ...epicGroups]
    }
    return null
  }

  function getGroupTasks(columnKey, groupKey) {
    const base = tasks
      .filter((t) => t.status === columnKey)
      .filter(matchesFilters)
      .sort((a, b) => a.position - b.position)

    if (groupBy === 'assignee') {
      return groupKey === 'unassigned'
        ? base.filter((t) => !t.assignee_id)
        : base.filter((t) => t.assignee_id === groupKey)
    }
    if (groupBy === 'priority') {
      return base.filter((t) => (t.priority || 'medium') === groupKey)
    }
    if (groupBy === 'epic') {
      return groupKey === 'no_epic'
        ? base.filter((t) => !t.parent_id)
        : base.filter((t) => t.parent_id === groupKey)
    }
    return base
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="font-mono text-xs uppercase tracking-wider text-slate-muted"
      >
        Loading board...
      </motion.p>
    </div>
  )

  return (
    <div className="h-full flex flex-col">

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-black/5 bg-white flex items-center gap-3 flex-shrink-0 flex-wrap">
        {/* Board search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-muted pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8.5 8.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={boardSearch}
            onChange={e => setBoardSearch(e.target.value)}
            placeholder="Search board…"
            className="text-xs pl-7 pr-3 py-1.5 rounded-lg border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-violet/30 w-40 placeholder:text-slate-muted/60"
          />
          {boardSearch && (
            <button onClick={() => setBoardSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-muted hover:text-ink text-xs">✕</button>
          )}
        </div>

        {/* Filters button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border transition-colors ${
            hasFilters
              ? 'bg-violet text-white border-violet'
              : 'border-black/10 text-slate-muted hover:text-ink hover:border-black/20'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Filters{hasFilters ? ' ·' : ''}
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-2 flex-wrap"
            >
              <select value={filterType}     onChange={(e) => setFilterType(e.target.value)}     className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white">
                <option value="">All types</option>
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="story">Story</option>
                <option value="epic">Epic</option>
                <option value="subtask">Subtask</option>
              </select>
              <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white">
                <option value="">All assignees</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.id}</option>)}
              </select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white">
                <option value="">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select value={filterLabel}    onChange={(e) => setFilterLabel(e.target.value)}    className="text-xs rounded-lg border border-black/10 px-2 py-1.5 bg-white">
                <option value="">All labels</option>
                {projectLabels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {hasFilters && (
                <button
                  onClick={() => { setFilterAssignee(''); setFilterPriority(''); setFilterLabel(''); setFilterType(''); setFilterMine(false); setFilterUnassigned(false) }}
                  className="text-xs text-slate-muted hover:text-ink"
                >
                  Clear
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="h-4 w-px bg-black/8" />

        {/* Quick filters */}
        <button
          onClick={() => { setFilterMine((v) => !v); setFilterUnassigned(false) }}
          className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
            filterMine ? 'bg-violet text-white border-violet' : 'border-black/10 text-slate-muted hover:text-ink hover:border-black/20'
          }`}
        >
          Only Mine
        </button>
        <button
          onClick={() => { setFilterUnassigned((v) => !v); setFilterMine(false) }}
          className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
            filterUnassigned ? 'bg-ink text-white border-ink' : 'border-black/10 text-slate-muted hover:text-ink hover:border-black/20'
          }`}
        >
          Unassigned
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-black/8" />

        {/* Group by */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-muted uppercase tracking-wider">Group</span>
          <div className="flex items-center bg-paper-dim rounded-lg p-0.5">
            {[
              { key: 'none',     label: 'None' },
              { key: 'assignee', label: 'Assignee' },
              { key: 'priority', label: 'Priority' },
              { key: 'epic',     label: 'Epic' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  groupBy === opt.key ? 'bg-white text-ink shadow-sm font-medium' : 'text-slate-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compact toggle */}
        <button
          onClick={() => setCompact(v => !v)}
          title={compact ? 'Normal view' : 'Compact view'}
          className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors ${
            compact ? 'bg-ink text-white border-ink' : 'border-black/10 text-slate-muted hover:text-ink hover:border-black/20'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1.5" width="10" height="1.2" rx="0.6" fill="currentColor" />
            <rect x="1" y="4.5" width="10" height="1.2" rx="0.6" fill="currentColor" opacity="0.7" />
            <rect x="1" y="7.5" width="10" height="1.2" rx="0.6" fill="currentColor" opacity="0.5" />
            <rect x="1" y="10" width="7"  height="1.2" rx="0.6" fill="currentColor" opacity="0.3" />
          </svg>
          {compact ? 'Compact' : 'Normal'}
        </button>

        {/* Member filter avatars */}
        <div className="ml-auto flex items-center gap-1">
          {members.slice(0, 6).map((m) => (
            <button
              key={m.id}
              onClick={() => setFilterAssignee(filterAssignee === m.id ? '' : m.id)}
              title={m.full_name}
              className={`transition-all ${
                filterAssignee === m.id
                  ? 'ring-2 ring-violet ring-offset-1 rounded-full'
                  : 'hover:ring-2 hover:ring-black/20 hover:ring-offset-1 rounded-full'
              }`}
            >
              <AssigneeAvatar assigneeId={m.id} members={members} size={26} />
            </button>
          ))}
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </motion.div>
      )}

      {/* ── Active Sprint Banner ────────────────────────────────── */}
      <AnimatePresence>
        {activeSprint && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-5 mt-3 bg-white border border-black/5 rounded-2xl px-4 py-3 flex items-center gap-4 shrink-0"
          >
            {/* Sprint name + goal */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
                <p className="text-xs font-semibold text-ink">{activeSprint.name}</p>
                {activeSprint.end_date && (() => {
                  const daysLeft = Math.ceil((new Date(activeSprint.end_date) - new Date()) / 86400000)
                  return (
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full ${
                      daysLeft < 0 ? 'bg-red-100 text-red-600' : daysLeft <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-paper-dim text-slate-muted'
                    }`}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                    </span>
                  )
                })()}
              </div>
              {activeSprint.goal && (
                <p className="text-[10px] text-slate-muted truncate max-w-xs">{activeSprint.goal}</p>
              )}
            </div>

            {/* Progress */}
            <div className="flex-1 min-w-0 max-w-xs">
              {(() => {
                const sprintTasks = tasks.filter((t) => t.sprint_id === activeSprint.id)
                const done = sprintTasks.filter((t) => t.status === 'done').length
                const total = sprintTasks.length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[9px] text-slate-muted">{done}/{total} issues done</span>
                      <span className="font-mono text-[9px] text-slate-muted">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-paper-dim rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full bg-sage rounded-full"
                      />
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Date range */}
            {activeSprint.start_date && activeSprint.end_date && (
              <p className="font-mono text-[9px] text-slate-muted shrink-0">
                {new Date(activeSprint.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(activeSprint.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}

            {/* Complete sprint */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={openCompleteModal}
              disabled={completingSprint}
              className="shrink-0 text-xs px-3 py-1.5 rounded-xl bg-sage/15 text-sage hover:bg-sage/25 transition-colors disabled:opacity-50 font-medium"
            >
              Complete Sprint
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Board ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 items-start">
            {COLUMNS.map((column, colIdx) => {
              const isCollapsed = collapsedCols[column.key]
              const groups      = getGroups(column.key)

              return (
                <motion.div
                  key={column.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: colIdx * 0.06 }}
                  className="flex flex-col"
                >
                  {groups ? (
                    /* ── Grouped view ── */
                    <div className="bg-paper-dim rounded-2xl p-3 w-72 flex-shrink-0 flex flex-col">
                      {/* Column header */}
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.accent }} />
                          <p className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider">
                            {column.label}
                          </p>
                          <span className="font-mono text-[10px] text-slate-muted/60 bg-white px-1.5 py-0.5 rounded-full">
                            {tasks.filter((t) => t.status === column.key).filter(matchesFilters).length}
                          </span>
                        </div>
                        <button
                          onClick={() => setAddingTo(column.key)}
                          title="Add issue"
                          className="w-5 h-5 rounded-md flex items-center justify-center text-slate-muted/50 hover:text-ink hover:bg-white transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>

                      {/* Swim lanes */}
                      {groups.map((group) => (
                        <SwimLaneRow
                          key={group.key}
                          label={group.label}
                          color={group.color}
                          tasks={getGroupTasks(column.key, group.key)}
                          column={column}
                          onTaskClick={setSelectedTask}
                          taskLabels={taskLabels}
                          projectKey={projectKey}
                          members={members}
                          selected={selected}
                          onToggleSelect={toggleSelect}
                          compact={compact}
                        />
                      ))}
                    </div>
                  ) : (
                    /* ── Standard column view ── */
                    <Column
                      column={column}
                      tasks={tasks.filter((t) => t.status === column.key).filter(matchesFilters).sort((a, b) => a.position - b.position)}
                      onTaskClick={setSelectedTask}
                      taskLabels={taskLabels}
                      projectKey={projectKey}
                      members={members}
                      onQuickAdd={() => setAddingTo(column.key)}
                      collapsed={isCollapsed}
                      onToggleCollapse={() => toggleColCollapse(column.key)}
                      wipLimit={wipLimits[column.key] || null}
                      selected={selected}
                      onToggleSelect={toggleSelect}
                      compact={compact}
                    />
                  )}

                  {/* Add task form */}
                  {!isCollapsed && !groups && (
                    <div className="w-72 mt-2">
                      <AnimatePresence mode="wait">
                        {addingTo === column.key ? (
                          <motion.div
                            key="form"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="bg-white rounded-xl border border-black/5 p-3 shadow-sm"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <select
                                value={newTaskType}
                                onChange={(e) => setNewTaskType(e.target.value)}
                                className="text-xs border border-black/10 rounded-lg px-1.5 py-1 bg-white"
                              >
                                <option value="task">Task</option>
                                <option value="bug">Bug</option>
                                <option value="story">Story</option>
                                <option value="epic">Epic</option>
                              </select>
                            </div>
                            <input
                              autoFocus
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')  handleAddTask(column.key)
                                if (e.key === 'Escape') { setAddingTo(null); setNewTaskTitle('') }
                              }}
                              placeholder="Issue summary"
                              className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-violet/40"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddTask(column.key)}
                                className="flex-1 text-xs bg-violet text-white rounded-lg px-3 py-1.5 hover:bg-violet/90 transition-colors"
                              >
                                Create issue
                              </button>
                              <button
                                onClick={() => { setAddingTo(null); setNewTaskTitle('') }}
                                className="text-xs text-slate-muted hover:text-ink px-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="btn"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => setAddingTo(column.key)}
                            className="w-full text-xs text-slate-muted hover:text-ink hover:bg-paper-dim rounded-lg px-3 py-2 flex items-center gap-1.5 transition-colors"
                          >
                            <span className="text-base leading-none">+</span> Create issue
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Grouped add task */}
                  {groups && addingTo === column.key && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="w-72 mt-2 bg-white rounded-xl border border-black/5 p-3 shadow-sm"
                    >
                      <input
                        autoFocus
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')  handleAddTask(column.key)
                          if (e.key === 'Escape') { setAddingTo(null); setNewTaskTitle('') }
                        }}
                        placeholder="Issue summary"
                        className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-violet/40"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleAddTask(column.key)} className="flex-1 text-xs bg-violet text-white rounded-lg px-3 py-1.5 hover:bg-violet/90 transition-colors">
                          Create
                        </button>
                        <button onClick={() => { setAddingTo(null); setNewTaskTitle('') }} className="text-xs text-slate-muted hover:text-ink px-2">
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
            {activeDragTask ? (
              <div className="bg-white border border-black/5 rounded-xl p-3 shadow-2xl rotate-[-1.5deg] w-72">
                <div className="flex items-center gap-2">
                  <IssueTypeIcon type={activeDragTask.issue_type || 'task'} size={13} />
                  <p className="text-sm font-medium text-ink truncate">{activeDragTask.title}</p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task detail panel */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailPanel
            key={selectedTask.id}
            task={selectedTask}
            members={members}
            orgPlan={orgPlan}
            projectKey={projectKey}
            onClose={() => setSelectedTask(null)}
            onTaskUpdated={loadBoard}
          />
        )}
      </AnimatePresence>

      {/* ── Bulk action bar ────────────────────────────────────── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
          >
            <span className="font-mono text-[11px] text-white/60 pr-2 border-r border-white/10">
              {selected.size} selected
            </span>

            {/* Status */}
            <select
              disabled={bulkWorking}
              onChange={e => e.target.value && bulkAction({ status: e.target.value })}
              defaultValue=""
              className="text-xs bg-white/10 text-white rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none cursor-pointer hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <option value="" disabled>Set status…</option>
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>

            {/* Assignee */}
            <select
              disabled={bulkWorking}
              onChange={e => bulkAction({ assignee_id: e.target.value || null })}
              defaultValue=""
              className="text-xs bg-white/10 text-white rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none cursor-pointer hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <option value="" disabled>Assign to…</option>
              <option value="">Unassign</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name || 'Unknown'}</option>)}
            </select>

            {/* Priority */}
            <select
              disabled={bulkWorking}
              onChange={e => e.target.value && bulkAction({ priority: e.target.value })}
              defaultValue=""
              className="text-xs bg-white/10 text-white rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none cursor-pointer hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <option value="" disabled>Set priority…</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Delete */}
            <button
              onClick={bulkDelete}
              disabled={bulkWorking}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Delete
            </button>

            <div className="w-px h-4 bg-white/10" />

            <button onClick={clearSelection} className="text-xs text-white/40 hover:text-white transition-colors px-1">
              ✕ Clear
            </button>

            {bulkWorking && (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-[10px] font-mono text-white/50 ml-1"
              >
                Updating…
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sprint completion modal ────────────────────────────── */}
      <AnimatePresence>
        {showCompleteModal && activeSprint && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
              onClick={() => !completingSprint && setShowCompleteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-black/5 w-full max-w-md pointer-events-auto">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-black/5">
                  <h2 className="text-base font-bold text-ink">Complete Sprint</h2>
                  <p className="text-xs text-slate-muted mt-0.5">{activeSprint.name}</p>
                </div>

                {/* Stats */}
                {(() => {
                  const sprintTasks = tasks.filter(t => t.sprint_id === activeSprint.id)
                  const done = sprintTasks.filter(t => t.status === 'done')
                  const incomplete = sprintTasks.filter(t => t.status !== 'done')
                  const nextSprints = allSprints.filter(s => s.status === 'planning' && s.id !== activeSprint.id)

                  return (
                    <div className="px-6 py-4 space-y-4">
                      {/* Summary row */}
                      <div className="flex gap-3">
                        <div className="flex-1 bg-sage/10 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-sage">{done.length}</p>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-sage/70 mt-0.5">Completed</p>
                        </div>
                        <div className="flex-1 bg-amber-50 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-amber-500">{incomplete.length}</p>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-amber-500/70 mt-0.5">Incomplete</p>
                        </div>
                      </div>

                      {/* Incomplete issue list */}
                      {incomplete.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-ink mb-2">Where should incomplete issues go?</p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {incomplete.map(task => (
                              <div key={task.id} className="flex items-center gap-3 bg-paper-dim rounded-xl px-3 py-2.5">
                                <IssueTypeIcon type={task.issue_type || 'task'} size={13} />
                                <span className="text-xs text-ink flex-1 truncate">{task.title}</span>
                                <select
                                  value={incompleteDisposition[task.id] || 'backlog'}
                                  onChange={e => setIncompleteDisposition(prev => ({ ...prev, [task.id]: e.target.value }))}
                                  className="text-[10px] border border-black/10 rounded-lg px-1.5 py-1 bg-white shrink-0 focus:outline-none focus:ring-1 focus:ring-violet/30"
                                >
                                  <option value="backlog">→ Backlog</option>
                                  {nextSprints.map(s => (
                                    <option key={s.id} value={s.id}>→ {s.name}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {incomplete.length === 0 && (
                        <p className="text-sm text-sage font-medium text-center py-2">
                          All {done.length} issues are done.
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                  <button
                    onClick={() => setShowCompleteModal(false)}
                    disabled={completingSprint}
                    className="flex-1 text-sm border border-black/10 rounded-xl py-2.5 text-slate-muted hover:text-ink hover:border-black/20 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCompleteSprint}
                    disabled={completingSprint}
                    className="flex-1 text-sm bg-sage text-white rounded-xl py-2.5 font-medium hover:bg-sage/90 transition-colors disabled:opacity-50"
                  >
                    {completingSprint ? 'Completing…' : 'Complete Sprint'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
