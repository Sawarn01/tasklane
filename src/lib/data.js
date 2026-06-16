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