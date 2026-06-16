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

  await logActivity({
    projectId: project.id,
    actorId: userId,
    action: 'project_created',
    metadata: { name },
  })

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

export async function addTaskComment({ taskId, userId, body, projectId, taskTitle, taskAssigneeId, taskCreatedBy, members }) {
  const { error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: userId, body })

  if (error) throw error

  await logActivity({
    projectId,
    actorId: userId,
    action: 'comment_added',
    metadata: { task_id: taskId, title: taskTitle },
  })

  // notify the assignee and the task creator (if not the commenter, and not duplicated)
  const notifyTargets = new Set([taskAssigneeId, taskCreatedBy].filter((id) => id && id !== userId))

  for (const targetId of notifyTargets) {
    await createNotification({
      userId: targetId,
      projectId,
      taskId,
      actorId: userId,
      type: 'comment',
      message: `commented on "${taskTitle}"`,
    })
  }

  // notify anyone @mentioned in the comment text, if not already notified above
  const mentioned = extractMentions(body, members || [])
  for (const member of mentioned) {
    if (!notifyTargets.has(member.id) && member.id !== userId) {
      await createNotification({
        userId: member.id,
        projectId,
        taskId,
        actorId: userId,
        type: 'mention',
        message: `mentioned you in a comment on "${taskTitle}"`,
      })
    }
  }
}

export async function updateTaskAssignee({ taskId, assigneeId, projectId, actorId, taskTitle, assigneeName }) {
  const { error } = await supabase
    .from('tasks')
    .update({ assignee_id: assigneeId, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw error

  await logActivity({
    projectId,
    actorId,
    action: assigneeId ? 'task_assigned' : 'task_unassigned',
    metadata: { task_id: taskId, title: taskTitle, assignee: assigneeName || null },
  })

  if (assigneeId) {
    await createNotification({
      userId: assigneeId,
      projectId,
      taskId,
      actorId,
      type: 'assigned',
      message: `assigned you to "${taskTitle}"`,
    })
  }
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

export function extractMentions(text, members) {
  const mentioned = []
  for (const member of members) {
    if (!member.full_name) continue
    const pattern = new RegExp(`@${member.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(text)) {
      mentioned.push(member)
    }
  }
  return mentioned
}

export async function createNotification({ userId, projectId, taskId, actorId, type, message }) {
  if (userId === actorId) return // never notify yourself about your own action

  const { error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, project_id: projectId, task_id: taskId, actor_id: actorId, type, message })

  if (error) console.error('Failed to create notification:', error)
}

export async function getMyNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, profiles!notifications_actor_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data
}

export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)

  if (error) throw error
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false)

  if (error) throw error
}

export async function createInvite({ orgId, createdBy, role = 'member', maxUses = 1, expiresInDays = 7 }) {
  const token = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { data, error } = await supabase
    .from('invites')
    .insert({ org_id: orgId, token, created_by: createdBy, role, max_uses: maxUses, expires_at: expiresAt })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function redeemInvite({ token, userId }) {
  const { data, error } = await supabase.rpc('redeem_invite', {
    invite_token: token,
    redeeming_user_id: userId,
  })

  if (error) throw error
  if (!data.success) throw new Error(data.error)
  return data
}


export async function updateTaskPriority({ taskId, priority }) {
  const { error } = await supabase
    .from('tasks')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw error
}

export async function getProjectLabels(projectId) {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function createLabel({ projectId, name, color }) {
  const { data, error } = await supabase
    .from('labels')
    .insert({ project_id: projectId, name, color })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getTaskLabels(taskId) {
  const { data, error } = await supabase
    .from('task_labels')
    .select('label_id, labels(*)')
    .eq('task_id', taskId)

  if (error) throw error
  return data.map((tl) => tl.labels)
}

export async function getAllTaskLabels(projectId) {
  // fetch label assignments for every task in a project at once, for showing labels on board cards
  const { data, error } = await supabase
    .from('task_labels')
    .select('task_id, labels(*)')
    .in('task_id', (await supabase.from('tasks').select('id').eq('project_id', projectId)).data?.map((t) => t.id) || [])

  if (error) throw error

  const byTask = {}
  for (const row of data) {
    if (!byTask[row.task_id]) byTask[row.task_id] = []
    byTask[row.task_id].push(row.labels)
  }
  return byTask
}

export async function addLabelToTask({ taskId, labelId }) {
  const { error } = await supabase.from('task_labels').insert({ task_id: taskId, label_id: labelId })
  if (error) throw error
}

export async function removeLabelFromTask({ taskId, labelId }) {
  const { error } = await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId)
  if (error) throw error
}