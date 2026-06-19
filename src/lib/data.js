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

export async function createTask({ projectId, title, userId, status = 'todo', issueType, priority, assigneeId, sprintId, description }) {
  const { data: existing } = await supabase
    .from('tasks')
    .select('position')
    .eq('project_id', projectId)
    .eq('status', status)
    .order('position', { ascending: false })
    .limit(1)

  const newPosition = existing?.length ? existing[0].position + 1 : 1

  const insert = {
    project_id: projectId, title, created_by: userId, status, position: newPosition,
    ...(issueType   && { issue_type:   issueType }),
    ...(priority    && { priority }),
    ...(assigneeId  && { assignee_id:  assigneeId }),
    ...(sprintId    && { sprint_id:    sprintId }),
    ...(description && { description }),
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(insert)
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

// ==================== SPRINTS ====================

export async function getSprints(projectId) {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createSprint({ projectId, name, goal, startDate, endDate, userId }) {
  const { data, error } = await supabase
    .from('sprints')
    .insert({
      project_id: projectId,
      name,
      goal: goal || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: 'planning',
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSprint({ sprintId, name, goal, startDate, endDate }) {
  const { error } = await supabase
    .from('sprints')
    .update({ name, goal: goal || null, start_date: startDate || null, end_date: endDate || null })
    .eq('id', sprintId)
  if (error) throw error
}

export async function startSprint(sprintId) {
  const { error } = await supabase
    .from('sprints')
    .update({ status: 'active' })
    .eq('id', sprintId)
  if (error) throw error
}

export async function completeSprint(sprintId) {
  const { error } = await supabase
    .from('sprints')
    .update({ status: 'completed' })
    .eq('id', sprintId)
  if (error) throw error
}

// ==================== ISSUE TYPES & STORY POINTS ====================

export async function updateTaskIssueType({ taskId, issueType }) {
  const { error } = await supabase
    .from('tasks')
    .update({ issue_type: issueType, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
}

export async function updateTaskStoryPoints({ taskId, storyPoints }) {
  const { error } = await supabase
    .from('tasks')
    .update({ story_points: storyPoints === '' ? null : Number(storyPoints), updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
}

export async function updateTaskSprint({ taskId, sprintId }) {
  const { error } = await supabase
    .from('tasks')
    .update({ sprint_id: sprintId || null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
}

export async function updateTaskParent({ taskId, parentId }) {
  const { error } = await supabase
    .from('tasks')
    .update({ parent_id: parentId || null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
}

export async function getProject(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
  if (error) throw error
  return data
}

// ==================== ISSUE LINKS ====================

export async function getIssueLinks(taskId) {
  const { data, error } = await supabase
    .from('issue_links')
    .select('id, link_type, from_task_id, to_task_id')
    .or(`from_task_id.eq.${taskId},to_task_id.eq.${taskId}`)
  if (error) throw error
  return data
}

export async function addIssueLink({ fromTaskId, toTaskId, linkType }) {
  const { error } = await supabase
    .from('issue_links')
    .insert({ from_task_id: fromTaskId, to_task_id: toTaskId, link_type: linkType })
  if (error) throw error
}

export async function removeIssueLink(linkId) {
  const { error } = await supabase.from('issue_links').delete().eq('id', linkId)
  if (error) throw error
}

// ==================== COMPONENTS ====================

export async function getProjectComponents(projectId) {
  const { data, error } = await supabase
    .from('components')
    .select('*')
    .eq('project_id', projectId)
    .order('name')
  if (error) throw error
  return data
}

export async function createComponent({ projectId, name }) {
  const { data, error } = await supabase
    .from('components')
    .insert({ project_id: projectId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getTaskComponents(taskId) {
  const { data, error } = await supabase
    .from('task_components')
    .select('component_id, components(*)')
    .eq('task_id', taskId)
  if (error) throw error
  return data.map((tc) => tc.components)
}

export async function addComponentToTask({ taskId, componentId }) {
  const { error } = await supabase.from('task_components').insert({ task_id: taskId, component_id: componentId })
  if (error) throw error
}

export async function removeComponentFromTask({ taskId, componentId }) {
  const { error } = await supabase
    .from('task_components')
    .delete()
    .eq('task_id', taskId)
    .eq('component_id', componentId)
  if (error) throw error
}

// ==================== VERSIONS / RELEASES ====================

export async function getProjectVersions(projectId) {
  const { data, error } = await supabase
    .from('versions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function createVersion({ projectId, name, releaseDate, status = 'unreleased', description }) {
  const { data, error } = await supabase
    .from('versions')
    .insert({ project_id: projectId, name, release_date: releaseDate || null, status, description: description || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateVersion({ versionId, name, releaseDate, status, description }) {
  const { error } = await supabase
    .from('versions')
    .update({ name, release_date: releaseDate || null, status, description: description || null })
    .eq('id', versionId)
  if (error) throw error
}

export async function deleteVersion(versionId) {
  const { error } = await supabase.from('versions').delete().eq('id', versionId)
  if (error) throw error
}

export async function updateTaskVersion({ taskId, versionId }) {
  const { error } = await supabase
    .from('tasks')
    .update({ fix_version_id: versionId || null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
}

// ==================== GLOBAL SEARCH ====================

export async function searchIssues({ query, projectId }) {
  let q = supabase
    .from('tasks')
    .select('id, title, status, priority, project_id, created_at')
    .ilike('title', `%${query}%`)
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return data
}

// ==================== WATCHERS ====================

export async function getTaskWatchers(taskId) {
  const { data, error } = await supabase
    .from('task_watchers')
    .select('user_id, profiles(full_name)')
    .eq('task_id', taskId)
  if (error) throw error
  return data
}

export async function watchTask({ taskId, userId }) {
  const { error } = await supabase
    .from('task_watchers')
    .insert({ task_id: taskId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function unwatchTask({ taskId, userId }) {
  const { error } = await supabase
    .from('task_watchers')
    .delete()
    .eq('task_id', taskId)
    .eq('user_id', userId)
  if (error) throw error
}

// ==================== TIME TRACKING ====================

export async function logTime({ taskId, userId, minutes, description }) {
  const { error } = await supabase
    .from('time_logs')
    .insert({ task_id: taskId, user_id: userId, minutes, description: description || null })
  if (error) throw error
}

export async function getTaskTimeLogs(taskId) {
  const { data, error } = await supabase
    .from('time_logs')
    .select('*, profiles(full_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ==================== EPICS ====================

export async function getProjectEpics(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, priority, story_points')
    .eq('project_id', projectId)
    .eq('issue_type', 'epic')
    .order('created_at')
  if (error) throw error
  return data
}

export async function getChildIssues(parentId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_id', parentId)
    .order('position')
  if (error) throw error
  return data
}

// ==================== PROJECT MANAGEMENT ====================

export async function updateProject({ projectId, name, description }) {
  const { error } = await supabase
    .from('projects')
    .update({ name, description })
    .eq('id', projectId)
  if (error) throw error
}

export async function getOrgMembers(orgId) {
  const { data, error } = await supabase
    .from('org_members')
    .select('user_id, role, profiles(id, full_name, avatar_url)')
    .eq('org_id', orgId)
  if (error) throw error
  return data.map((m) => ({ ...m.profiles, role: m.role }))
}

export async function addProjectMember({ projectId, userId }) {
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function removeProjectMember({ projectId, userId }) {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)
  if (error) throw error
}

// ==================== HELPERS ====================

export function getProjectKey(projectName) {
  if (!projectName) return 'PROJ'
  const words = projectName.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase()
}

// ==================== USER PROFILE ====================

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updateMyProfile({ userId, fullName, avatarUrl }) {
  const updates = { full_name: fullName }
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw error
}

export async function uploadAvatar({ userId, file }) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function updateUserEmail({ email }) {
  const { error } = await supabase.auth.updateUser({ email })
  if (error) throw error
}

export async function updateUserPassword({ password }) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

// ==================== ORG SETTINGS ====================

export async function updateOrgName({ orgId, name }) {
  const { error } = await supabase
    .from('organizations')
    .update({ name })
    .eq('id', orgId)
  if (error) throw error
}

export async function updateOrgMemberRole({ orgId, userId, role }) {
  const { error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function removeOrgMember({ orgId, userId }) {
  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

// ==================== DASHBOARD ====================

export async function getProjectsWithStats(orgId) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, created_at, tasks(status)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((p) => {
    const tasks = p.tasks || []
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.created_at,
      totalTasks: tasks.length,
      doneTasks: tasks.filter((t) => t.status === 'done').length,
      inProgressTasks: tasks.filter((t) => t.status === 'in_progress').length,
      todoTasks: tasks.filter((t) => t.status === 'todo').length,
    }
  })
}

export async function getMyAssignedTasks(userId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, priority, issue_type, story_points, due_date, project_id, projects(name)')
    .eq('assignee_id', userId)
    .neq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(15)
  if (error) throw error
  return data
}

export async function getMyAllTasks(userId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, priority, issue_type, story_points, due_date, updated_at, project_id, projects(id, name)')
    .eq('assignee_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getMyOrgActivity() {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles(full_name), projects(name)')
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) throw error
  return data
}

export async function cloneTask(task, userId) {
  const { data: existing } = await supabase
    .from('tasks')
    .select('position')
    .eq('project_id', task.project_id)
    .eq('status', task.status)
    .order('position', { ascending: false })
    .limit(1)
  const position = existing?.length ? existing[0].position + 1 : 1

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id:   task.project_id,
      title:        `Copy of ${task.title}`,
      description:  task.description || null,
      status:       task.status,
      priority:     task.priority || null,
      issue_type:   task.issue_type || 'task',
      story_points: task.story_points || null,
      assignee_id:  task.assignee_id || null,
      sprint_id:    task.sprint_id || null,
      parent_id:    task.parent_id || null,
      created_by:   userId,
      position,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getWipLimits(projectId) {
  const { data } = await supabase
    .from('projects')
    .select('wip_limits')
    .eq('id', projectId)
    .single()
  return data?.wip_limits || {}
}

export async function saveWipLimits(projectId, wipLimits) {
  const { error } = await supabase
    .from('projects')
    .update({ wip_limits: wipLimits })
    .eq('id', projectId)
  if (error) throw error
}

// ==================== TASK ESTIMATE ====================

export async function updateTaskEstimate({ taskId, minutes }) {
  const { error } = await supabase
    .from('tasks')
    .update({ original_estimate: minutes || null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
}

// ==================== BULK OPERATIONS ====================

export async function bulkUpdateTasks(taskIds, patch) {
  if (!taskIds.length) return
  const { error } = await supabase
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in('id', taskIds)
  if (error) throw error
}

export async function bulkDeleteTasks(taskIds) {
  if (!taskIds.length) return
  const { error } = await supabase.from('tasks').delete().in('id', taskIds)
  if (error) throw error
}

// ==================== PROJECT OVERVIEW ====================

export async function getProjectOverview(projectId) {
  const [tasks, sprints, members, activity] = await Promise.all([
    getTasks(projectId),
    getSprints(projectId),
    getProjectMembers(projectId),
    getProjectActivity(projectId),
  ])
  return { tasks, sprints, members, activity: activity.slice(0, 15) }
}

// ── Meetings ────────────────────────────────────────────────────
export async function getMeetings(projectId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*, meeting_action_items(id, done)')
    .eq('project_id', projectId)
    .order('date', { ascending: false })
  if (error) return []
  return data
}

export async function getMeeting(meetingId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single()
  if (error) throw error
  return data
}

export async function createMeeting({ projectId, title, date, time, agenda, meetingUrl, attendeeIds = [], userId }) {
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      project_id: projectId, title, date, agenda,
      attendee_ids: attendeeIds, created_by: userId,
      notes: '', decisions: '',
      ...(time       && { meeting_time: time }),
      ...(meetingUrl && { meeting_url:  meetingUrl }),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function sendMeetingInvites({ meeting, hostName, projectName }) {
  if (!meeting.attendee_ids?.length) return
  const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY
  await fetch(`${supabaseUrl}/functions/v1/send-meeting-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      meeting_id:   meeting.id,
      title:        meeting.title,
      date:         meeting.date,
      time:         meeting.meeting_time,
      agenda:       meeting.agenda,
      meeting_url:  meeting.meeting_url,
      host_name:    hostName,
      project_name: projectName,
      attendee_ids: meeting.attendee_ids,
    }),
  })
}

export async function updateMeeting({ meetingId, title, date, time, agenda, meetingUrl, notes, decisions }) {
  const patch = {}
  if (title      !== undefined) patch.title        = title
  if (date       !== undefined) patch.date         = date
  if (time       !== undefined) patch.meeting_time = time || null
  if (agenda     !== undefined) patch.agenda       = agenda
  if (meetingUrl !== undefined) patch.meeting_url  = meetingUrl || null
  if (notes      !== undefined) patch.notes        = notes
  if (decisions  !== undefined) patch.decisions    = decisions
  const { data, error } = await supabase
    .from('meetings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', meetingId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMeeting(meetingId) {
  const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
  if (error) throw error
}

export async function getMeetingActionItems(meetingId) {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .select('*, profiles!meeting_action_items_assignee_id_fkey(full_name)')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data
}

export async function createActionItem({ meetingId, projectId, title, assigneeId, userId }) {
  const { data, error } = await supabase
    .from('meeting_action_items')
    .insert({ meeting_id: meetingId, project_id: projectId, title, assignee_id: assigneeId || null, created_by: userId, done: false })
    .select('*, profiles!meeting_action_items_assignee_id_fkey(full_name)')
    .single()
  if (error) throw error
  return data
}

export async function toggleActionItem({ itemId, done }) {
  const { error } = await supabase
    .from('meeting_action_items')
    .update({ done })
    .eq('id', itemId)
  if (error) throw error
}

export async function actionItemToTask({ item, projectId, userId }) {
  const task = await createTask({
    projectId,
    title: item.title,
    userId,
    status: 'todo',
    assigneeId: item.assignee_id,
  })
  await supabase
    .from('meeting_action_items')
    .update({ task_id: task.id })
    .eq('id', item.id)
  return task
}

// ── Team Pulse ──────────────────────────────────────────────────
export async function submitPulse({ userId, projectId, score }) {
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('team_pulse')
    .upsert({ user_id: userId, project_id: projectId, score, date: today }, { onConflict: 'user_id,project_id,date' })
  if (error) throw error
}

export async function getProjectPulse(projectId) {
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('team_pulse')
    .select('score, date')
    .eq('project_id', projectId)
    .gte('date', since)
    .order('date', { ascending: true })
  if (error) return []
  return data
}

export async function getTodaysPulse({ userId, projectId }) {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('team_pulse')
    .select('score')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('date', today)
    .single()
  return data?.score ?? null
}

// ── Subtasks (parent_task_id relationship) ──────────────────────
export async function getSubtasks(parentTaskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_task_id', parentTaskId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data
}

export async function createSubtask({ parentTaskId, projectId, title, userId, assigneeId }) {
  const { data: existing } = await supabase
    .from('tasks')
    .select('position')
    .eq('project_id', projectId)
    .eq('status', 'todo')
    .order('position', { ascending: false })
    .limit(1)
  const newPosition = existing?.length ? existing[0].position + 1 : 1
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: projectId,
      parent_task_id: parentTaskId,
      title,
      created_by: userId,
      status: 'todo',
      issue_type: 'subtask',
      position: newPosition,
      ...(assigneeId && { assignee_id: assigneeId }),
    })
    .select()
    .single()
  if (error) throw error
  return data
}