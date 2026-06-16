import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getTaskComments,
  addTaskComment,
  updateTaskAssignee,
  updateTaskDescription,
  getTaskFiles,
  uploadFile,
  getFileDownloadUrl,
  deleteFile,
} from '../lib/data'
import { supabase } from '../lib/supabase'
import { updateTaskDueDate } from '../lib/data'

export default function TaskDetailPanel({ task, members, orgPlan, onClose, onTaskUpdated }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [description, setDescription] = useState(task.description || '')
  const [savingDescription, setSavingDescription] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [savingDueDate, setSavingDueDate] = useState(false)


  useEffect(() => {
    loadComments()
    loadFiles()

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

  async function loadFiles() {
    try {
      const data = await getTaskFiles(task.id)
      setFiles(data)
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

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadFile({ projectId: task.project_id, taskId: task.id, file, userId: user.id })
      await loadFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(file) {
    try {
      const url = await getFileDownloadUrl(file.storage_path)
      window.open(url, '_blank')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteFile(file) {
    try {
      await deleteFile({ fileId: file.id, storagePath: file.storage_path })
      await loadFiles()
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

  async function handleDueDateChange(e) {
  const value = e.target.value
  setDueDate(value)
  setSavingDueDate(true)
  try {
    await updateTaskDueDate({ taskId: task.id, dueDate: value || null })
    onTaskUpdated()
  } catch (err) {
    setError(err.message)
  } finally {
    setSavingDueDate(false)
  }
}

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-ink/30 flex justify-end z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="bg-paper w-full max-w-md h-full shadow-xl overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-ink">{task.title}</h2>
          <button onClick={onClose} className="text-slate-muted hover:text-ink transition-colors">✕</button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-4">
          <label className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider mb-1.5 block">
            Assignee
          </label>
          <select
            defaultValue={task.assignee_id || ''}
            onChange={handleAssigneeChange}
            className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/40 bg-white"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name || m.id}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
            <label className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider mb-1.5 block">
                Due date {savingDueDate && <span className="text-violet">· saving</span>}
            </label>
            <input
            type="date"
            value={dueDate}
            onChange={handleDueDateChange}
            className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/40 bg-white"
            />
        </div>

        <div className="mb-6">
          <label className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider mb-1.5 block">
            Description {savingDescription && <span className="text-violet">· saving</span>}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            rows={4}
            placeholder="Add a description..."
            className="w-full text-sm rounded-lg border border-black/10 px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet/40 bg-white"
          />
        </div>

        <div className="mb-6">
          <label className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider mb-2 block">
            Files
          </label>

          {orgPlan === 'company' ? (
            <>
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="text-sm mb-3"
              />
              {uploading && (
                <motion.p
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-sm text-slate-muted"
                >
                  Uploading...
                </motion.p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-muted mb-3">
              File uploads are available on the Company plan.
            </p>
          )}

          <div className="space-y-2">
            <AnimatePresence>
              {files.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-black/5 overflow-hidden"
                >
                  <button onClick={() => handleDownload(f)} className="text-violet hover:underline truncate">
                    {f.file_name}
                  </button>
                  <button onClick={() => handleDeleteFile(f)} className="text-slate-muted hover:text-red-600 ml-2 transition-colors">
                    ✕
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] font-semibold text-slate-muted uppercase tracking-wider mb-2 block">
            Comments
          </label>
          <div className="space-y-3 mb-3">
            <AnimatePresence initial={false}>
              {comments.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm"
                >
                  <p className="font-medium text-ink">{c.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-slate-muted">{c.body}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {comments.length === 0 && (
              <p className="text-sm text-slate-muted">No comments yet</p>
            )}
          </div>
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 text-sm rounded-lg border border-black/10 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet/40 bg-white"
            />
            <button type="submit" className="text-sm bg-violet text-white rounded-lg px-3 hover:bg-violet/90 transition-colors">
              Send
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  )
}