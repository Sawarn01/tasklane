import { supabase } from './supabase'
import { redeemInvite } from './data'

export async function signUpWithNewOrg({ email, password, fullName, orgName }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) throw authError
  if (!authData.user) throw new Error('Signup succeeded but no user returned')

  const userId = authData.user.id

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: userId, full_name: fullName })
  if (profileError) throw profileError

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: orgName, created_by: userId, plan: 'free' })
    .select()
    .single()
  if (orgError) throw orgError

  const { error: memberError } = await supabase
    .from('org_members')
    .insert({ org_id: org.id, user_id: userId, role: 'owner' })
  if (memberError) throw memberError

  return { user: authData.user, org }
}

export async function signUpAndJoinOrg({ email, password, fullName, inviteToken }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) throw authError
  if (!authData.user) throw new Error('Signup succeeded but no user returned')

  const userId = authData.user.id

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: userId, full_name: fullName })
  if (profileError) throw profileError

  const { redeemInvite } = await import('./data')
  const result = await redeemInvite({ token: inviteToken, userId })

  return { user: authData.user, orgId: result.org_id }
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