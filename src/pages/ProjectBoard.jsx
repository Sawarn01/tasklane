import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskDetailPanel from './TaskDetailPanel'
import { getMyOrg, getTasks, createTask, updateTaskPosition, getProjectMembers } from '../lib/data'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

function TaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout={!isDragging}
      transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
      onClick={() => onClick(task)}
      className={`bg-white border border-black/5 rounded-xl p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        task.status === 'done' ? 'border-l-2 border-l-sage' : ''
      }`}
    >
      <p className="text-sm font-medium text-ink">{task.title}</p>
      {task.due_date && (
        <p className={`font-mono text-[10px] uppercase tracking-wide mt-1.5 ${isOverdue ? 'text-red-600' : 'text-slate-muted'}`}>
          {isOverdue ? 'Overdue · ' : 'Due '}
          {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}
    </motion.div>
  )
}

function Column({ column, tasks, onTaskClick }) {
  const { setNodeRef } = useDroppable({ id: column.key })

  return (
    <div className="bg-paper-dim rounded-2xl p-3 w-72 flex-shrink-0">
      <p className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider mb-3 px-1">
        {column.label} · {tasks.length}
      </p>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-[200px]">
          <AnimatePresence initial={false} mode="popLayout">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={onTaskClick} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </div>
  )
}

export default function ProjectBoard() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTo, setAddingTo] = useState(null)
  const [members, setMembers] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [orgPlan, setOrgPlan] = useState(null)
  const [activeDragTask, setActiveDragTask] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    loadTasks()
    getProjectMembers(projectId).then(setMembers).catch((err) => setError(err.message))
    getMyOrg().then(({ org }) => setOrgPlan(org.plan)).catch((err) => setError(err.message))

    const channel = supabase
      .channel(`tasks-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, () => {
        loadTasks()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  async function loadTasks() {
    try {
      const data = await getTasks(projectId)
      setTasks(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddTask(status) {
    if (!newTaskTitle.trim()) return
    try {
      await createTask({ projectId, title: newTaskTitle, userId: user.id, status })
      setNewTaskTitle('')
      setAddingTo(null)
      await loadTasks()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDragStart(event) {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveDragTask(task)
  }

  async function handleDragEnd(event) {
    setActiveDragTask(null)

    const { active, over } = event
    if (!over) return

    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return

    const isColumnDrop = COLUMNS.some((c) => c.key === over.id)
    const overTask = isColumnDrop ? null : tasks.find((t) => t.id === over.id)
    const targetStatus = isColumnDrop ? over.id : overTask?.status

    if (!targetStatus) return

    const columnTasks = tasks
      .filter((t) => t.status === targetStatus && t.id !== activeTask.id)
      .sort((a, b) => a.position - b.position)

    const overIndex = overTask ? columnTasks.findIndex((t) => t.id === overTask.id) : columnTasks.length

    let newPosition
    if (columnTasks.length === 0) {
      newPosition = 1
    } else if (overIndex === 0) {
      newPosition = columnTasks[0].position / 2
    } else if (overIndex >= columnTasks.length) {
      newPosition = columnTasks[columnTasks.length - 1].position + 1
    } else {
      newPosition = (columnTasks[overIndex - 1].position + columnTasks[overIndex].position) / 2
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === activeTask.id ? { ...t, status: targetStatus, position: newPosition } : t))
    )

    try {
      await updateTaskPosition({ taskId: activeTask.id, status: targetStatus, position: newPosition })
    } catch (err) {
      setError(err.message)
      await loadTasks()
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-slate-muted font-mono text-xs uppercase tracking-wider">Loading board...</div>
    )
  }

  return (
    <div className="min-h-screen bg-paper p-6">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </motion.div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto">
          {COLUMNS.map((column, colIdx) => {
            const columnTasks = tasks
              .filter((t) => t.status === column.key)
              .sort((a, b) => a.position - b.position)

            return (
              <motion.div
                key={column.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: colIdx * 0.06 }}
              >
                <Column column={column} tasks={columnTasks} onTaskClick={setSelectedTask} />
                <div className="w-72 mt-2">
                  {addingTo === column.key ? (
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask(column.key)}
                        placeholder="Task title"
                        className="flex-1 text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/40"
                      />
                      <button
                        onClick={() => handleAddTask(column.key)}
                        className="text-sm bg-violet text-white rounded-lg px-3 hover:bg-violet/90 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(column.key)}
                      className="text-sm text-slate-muted hover:text-ink px-1 transition-colors"
                    >
                      + Add task
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {activeDragTask ? (
            <div className="bg-white border border-black/5 rounded-xl p-3 shadow-lg rotate-[-1.5deg]">
              <p className="text-sm font-medium text-ink">{activeDragTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            members={members}
            orgPlan={orgPlan}
            onClose={() => setSelectedTask(null)}
            onTaskUpdated={loadTasks}
          />
        )}
      </AnimatePresence>
    </div>
  )
}