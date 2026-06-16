import { supabase } from './supabase'

export async function signUp({ email, password, fullName, orgName }) {
  // Step 1: create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) throw authError
  if (!authData.user) throw new Error('Signup succeeded but no user returned')

  const userId = authData.user.id

  // Step 2: create the profile row
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: userId, full_name: fullName })

  if (profileError) throw profileError

  // Step 3: create the organization
  const { data: org, error: orgError } = await supabase
  .from('organizations')
  .insert({ name: orgName, created_by: userId, plan: 'free' })
  .select()
  .single()

  if (orgError) throw orgError

  // Step 4: add user as owner of that org
  const { error: memberError } = await supabase
    .from('org_members')
    .insert({ org_id: org.id, user_id: userId, role: 'owner' })

  if (memberError) throw memberError

  return { user: authData.user, org }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}