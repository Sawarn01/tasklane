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

  // creator automatically becomes a project member
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
  // find the max position in this status column, put new task at the end
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
  return data
}

export async function updateTaskPosition({ taskId, status, position }) {
  const { error } = await supabase
    .from('tasks')
    .update({ status, position, updated_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) throw error
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}