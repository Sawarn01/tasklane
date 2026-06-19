import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [showPass, setShowPass] = useState(false)
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
      navigate(`/onboarding?mode=${mode}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const field = (label, children) => (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1.5">{label}</label>
      {children}
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-violet"
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.02, 0.05, 0.02] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-violet"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2.5 mb-7"
        >
          <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
            <div className="w-3 h-3 bg-violet rounded-sm" />
          </div>
          <span className="font-bold text-ink text-base">Tasklane</span>
        </motion.div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-7 pt-7 pb-5">
            <h1 className="text-xl font-bold text-ink mb-1">Create your account</h1>
            <p className="text-slate-muted text-sm">Start organizing your team's work.</p>
          </div>

          {/* Mode tabs */}
          <div className="px-7 pb-5">
            <div className="flex gap-1 bg-paper-dim rounded-xl p-1">
              {[
                { value: 'create', label: 'New workspace' },
                { value: 'join',   label: 'Join with invite' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setMode(tab.value)}
                  className={`flex-1 text-sm py-1.5 rounded-lg transition-all duration-150 font-medium relative ${
                    mode === tab.value ? 'text-ink' : 'text-slate-muted hover:text-ink/70'
                  }`}
                >
                  {mode === tab.value && (
                    <motion.div
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-white rounded-lg shadow-sm"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="px-7 pb-7">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              {field('Your name',
                <input
                  type="text" required
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
                />
              )}

              <AnimatePresence mode="wait">
                {mode === 'create' ? (
                  <motion.div
                    key="org"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {field('Workspace name',
                      <input
                        type="text" required
                        value={orgName} onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g. Acme Inc"
                        className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
                      />
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="invite"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {field('Invite code',
                      <input
                        type="text" required
                        value={inviteToken} onChange={(e) => setInviteToken(e.target.value)}
                        placeholder="Paste your invite code"
                        className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {field('Email',
                <input
                  type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
                />
              )}

              {field('Password',
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} required minLength={6}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm text-ink pr-10 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-muted/50 hover:text-slate-muted transition-colors"
                  >
                    {showPass ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M2 2l10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.3" />
                        <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              <motion.button
                type="submit" disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-violet text-white rounded-xl py-2.5 text-sm font-medium hover:bg-violet/90 disabled:opacity-50 transition-colors mt-1"
              >
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full block"
                      />
                      Creating account…
                    </motion.span>
                  ) : (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {mode === 'create' ? 'Create workspace' : 'Join workspace'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </form>

            <p className="text-sm text-slate-muted mt-5 text-center">
              Already have an account?{' '}
              <Link to="/login" className="text-violet font-medium hover:opacity-70 transition-opacity">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
