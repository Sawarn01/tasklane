import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  getTaskComments,
  addTaskComment,
  updateTaskAssignee,
  updateTaskDescription,
} from '../lib/data'
import { supabase } from '../lib/supabase'

export default function TaskDetailPanel({ task, members, onClose, onTaskUpdated }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [description, setDescription] = useState(task.description || '')
  const [savingDescription, setSavingDescription] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadComments()

    const channel = supabase
      .channel(`task-comments-${task.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task.id}` },
        () => {
          loadComments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [task.id])

  async function loadComments() {
    try {
      const data = await getTaskComments(task.id)
      setComments(data)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      await addTaskComment({ taskId: task.id, userId: user.id, body: newComment })
      setNewComment('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAssigneeChange(e) {
    const assigneeId = e.target.value || null
    try {
      await updateTaskAssignee({ taskId: task.id, assigneeId })
      onTaskUpdated()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDescriptionBlur() {
    if (description === task.description) return
    setSavingDescription(true)
    try {
      await updateTaskDescription({ taskId: task.id, description })
      onTaskUpdated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingDescription(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full shadow-xl overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Assignee</label>
          <select
            defaultValue={task.assignee_id || ''}
            onChange={handleAssigneeChange}
            className="w-full text-sm rounded-md border border-slate-300 px-2 py-1.5"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name || m.id}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            Description {savingDescription && '(saving...)'}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            rows={4}
            placeholder="Add a description..."
            className="w-full text-sm rounded-md border border-slate-300 px-2 py-1.5 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
            Comments
          </label>
          <div className="space-y-3 mb-3">
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <p className="font-medium text-slate-900">{c.profiles?.full_name || 'Unknown'}</p>
                <p className="text-slate-600">{c.body}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-slate-400">No comments yet</p>
            )}
          </div>
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 text-sm rounded-md border border-slate-300 px-2 py-1.5"
            />
            <button type="submit" className="text-sm bg-indigo-600 text-white rounded-md px-3">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}