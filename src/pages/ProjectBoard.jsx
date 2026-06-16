import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../lib/AuthContext'
import { getTasks, createTask, updateTaskPosition, getProjectMembers } from '../lib/data'
import { supabase } from '../lib/supabase'

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-slate-200 rounded-lg p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-slate-900">{task.title}</p>
    </div>
  )
}

function Column({ column, tasks }) {
  const { setNodeRef } = useDroppable({ id: column.key })

  return (
    <div className="bg-slate-100 rounded-lg p-3 w-72 flex-shrink-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {column.label} · {tasks.length}
      </p>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-[200px]">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    loadTasks()

    // realtime: refresh when any task in this project changes
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

  async function handleDragEnd(event) {
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

  if (loading) return <div className="p-8 text-slate-500">Loading board...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          {COLUMNS.map((column) => {
            const columnTasks = tasks
              .filter((t) => t.status === column.key)
              .sort((a, b) => a.position - b.position)

            return (
              <div key={column.key}>
                <Column column={column} tasks={columnTasks} />
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
                        className="flex-1 text-sm rounded-md border border-slate-300 px-2 py-1.5"
                      />
                      <button
                        onClick={() => handleAddTask(column.key)}
                        className="text-sm bg-indigo-600 text-white rounded-md px-3"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(column.key)}
                      className="text-sm text-slate-500 hover:text-slate-800 px-1"
                    >
                      + Add task
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}