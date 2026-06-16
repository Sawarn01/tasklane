import { supabase } from './supabase'

export async function getMyOrg() {
  const { data: membership, error } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(*)')
    .limit(1)
    .single()

  if (error) throw error
  return { org: membership.organizations, role: membership.role }
}

export async function getMyProjects(orgId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createProject({ orgId, name, description, userId }) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ org_id: orgId, name, description, created_by: userId })
    .select()
    .single()

  if (projectError) throw projectError

  const { error: memberError } = await supabase
    .from('project_members')
    .insert({ project_id: project.id, user_id: userId })

  if (memberError) throw memberError

  return project
}

export async function getProjectMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id, profiles(id, full_name, avatar_url)')
    .eq('project_id', projectId)

  if (error) throw error
  return data.map((m) => m.profiles)
}

export async function getTasks(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (error) throw error
  return data
}

export async function createTask({ projectId, title, userId, status = 'todo' }) {
  const { data: existing } = await supabase
    .from('tasks')
    .select('position')
    .eq('project_id', projectId)
    .eq('status', status)
    .order('position', { ascending: false })
    .limit(1)

  const newPosition = existing?.length ? existing[0].position + 1 : 1

  const { data, error } = await supabase
    .from('tasks')
    .insert({ project_id: projectId, title, created_by: userId, status, position: newPosition })
    .select()
    .single()

  if (error) throw error

  await logActivity({
    projectId,
    actorId: userId,
    action: 'task_created',
    metadata: { task_id: data.id, title },
  })

  return data
}

export async function updateTaskPosition({ taskId, status, position, userId, previousStatus, taskTitle, projectId }) {
  const { error } = await supabase
    .from('tasks')
    .update({ status, position, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw error

  if (previousStatus && previousStatus !== status) {
    await logActivity({
      projectId,
      actorId: userId,
      action: 'task_moved',
      metadata: { task_id: taskId, title: taskTitle, from: previousStatus, to: status },
    })
  }
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}

export async function getTaskComments(taskId) {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*, profiles(full_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function addTaskComment({ taskId, userId, body }) {
  const { error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: userId, body })

  if (error) throw error
}

export async function updateTaskAssignee({ taskId, assigneeId }) {
  const { error } = await supabase
    .from('tasks')
    .update({ assignee_id: assigneeId, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw error
}

export async function updateTaskDescription({ taskId, description }) {
  const { error } = await supabase
    .from('tasks')
    .update({ description, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw error
}
export async function getMessages(projectId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function sendMessage({ projectId, userId, body }) {
  const { error } = await supabase
    .from('messages')
    .insert({ project_id: projectId, user_id: userId, body })

  if (error) throw error
}

export async function createCheckoutSession({ plan, orgId, userEmail, userName }) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ plan, orgId, userEmail, userName }),
    }
  )

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to create checkout session')
  return data
}

export async function uploadFile({ projectId, taskId, file, userId }) {
  const fileId = crypto.randomUUID()
  const path = `${projectId}/${fileId}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('task-files')
    .upload(path, file)

  if (uploadError) throw uploadError

  const { error: dbError } = await supabase
    .from('files')
    .insert({
      task_id: taskId,
      project_id: projectId,
      uploaded_by: userId,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
    })

  if (dbError) throw dbError
}

export async function getTaskFiles(taskId) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getFileDownloadUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('task-files')
    .createSignedUrl(storagePath, 60) // valid for 60 seconds

  if (error) throw error
  return data.signedUrl
}

export async function deleteFile({ fileId, storagePath }) {
  const { error: storageError } = await supabase.storage
    .from('task-files')
    .remove([storagePath])

  if (storageError) throw storageError

  const { error: dbError } = await supabase.from('files').delete().eq('id', fileId)
  if (dbError) throw dbError
}

export async function updateTaskDueDate({ taskId, dueDate }) {
  const { error } = await supabase
    .from('tasks')
    .update({ due_date: dueDate, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw error
}

export async function logActivity({ projectId, actorId, action, metadata = {} }) {
  const { error } = await supabase
    .from('activity_log')
    .insert({ project_id: projectId, actor_id: actorId, action, metadata })

  if (error) console.error('Failed to log activity:', error)
  // deliberately not throwing — activity logging should never block the actual user action
}

export async function getProjectActivity(projectId) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return data
}

export async function getTaskActivity(projectId, taskId) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles(full_name)')
    .eq('project_id', projectId)
    .eq('metadata->>task_id', taskId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}