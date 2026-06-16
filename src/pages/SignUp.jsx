import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { signUpWithNewOrg, signUpAndJoinOrg } from '../lib/auth'

export default function SignUp() {
  const [searchParams] = useSearchParams()
  const inviteFromUrl = searchParams.get('invite') || ''

  const [mode, setMode] = useState(inviteFromUrl ? 'join' : 'create')
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [inviteToken, setInviteToken] = useState(inviteFromUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'create') {
        await signUpWithNewOrg({ email, password, fullName, orgName })
      } else {
        await signUpAndJoinOrg({ email, password, fullName, inviteToken: inviteToken.trim() })
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-black/10">
        <h1 className="text-2xl font-bold text-ink mb-1">Create your account</h1>
        <p className="text-slate-muted text-sm mb-5">Start organizing your team's work.</p>

        <div className="flex gap-1 mb-6 bg-paper-dim rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
              mode === 'create' ? 'bg-white shadow-sm text-ink font-medium' : 'text-slate-muted'
            }`}
          >
            New workspace
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
              mode === 'join' ? 'bg-white shadow-sm text-ink font-medium' : 'text-slate-muted'
            }`}
          >
            Join with invite
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Your name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
            />
          </div>

          {mode === 'create' ? (
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Workspace name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Inc"
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Invite code</label>
              <input
                type="text"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Paste your invite code"
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet text-white rounded-lg py-2 text-sm font-medium hover:bg-violet/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : mode === 'create' ? 'Create workspace' : 'Join workspace'}
          </button>
        </form>

        <p className="text-sm text-slate-muted mt-4 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-violet font-medium">Log in</Link>
        </p>
      </div>
    </div>
  )
}