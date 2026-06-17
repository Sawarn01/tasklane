import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from '../lib/auth'

const DEMO_FEATURES = [
  'Sprint planning & backlog',
  'Timeline / Gantt view',
  'Real-time team chat',
  'Burndown & velocity reports',
  'Release management',
  'Cmd+K global search',
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn({ email, password })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-paper">
      {/* ── Left brand panel ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-[480px] bg-ink flex-col justify-between p-10 relative overflow-hidden shrink-0"
      >
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Floating orbs */}
        <motion.div
          animate={{ y: [0, -12, 0], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-24 right-8 w-48 h-48 rounded-full bg-violet blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 10, 0], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-32 left-4 w-36 h-36 rounded-full bg-violet blur-3xl"
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
              <div className="w-3.5 h-3.5 bg-violet rounded-sm" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">Tasklane</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            Ship faster,<br />together.
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            The project management tool built for modern engineering teams.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-3">
          {DEMO_FEATURES.map((f, i) => (
            <motion.div
              key={f}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.35 }}
              className="flex items-center gap-3"
            >
              <div className="w-5 h-5 rounded-lg bg-violet/20 flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-white/70 text-sm">{f}</span>
            </motion.div>
          ))}
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-white/25 text-xs font-mono">
          Tasklane — Project management, reimagined.
        </p>
      </motion.div>

      {/* ── Right form panel ──────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-violet rounded-sm" />
            </div>
            <span className="font-bold text-ink text-base">Tasklane</span>
          </div>

          <h1 className="text-2xl font-bold text-ink mb-1">Welcome back</h1>
          <p className="text-slate-muted text-sm mb-8">Log in to your workspace.</p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1.5">
                Email
              </label>
              <input
                type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-muted/50 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet/40 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wider text-slate-muted">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm text-ink pr-10 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet/40 transition-all"
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
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-violet text-white rounded-xl py-2.5 text-sm font-medium hover:bg-violet/90 disabled:opacity-50 transition-colors mt-1 relative overflow-hidden"
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
                    Signing in…
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    Log in
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          <p className="text-sm text-slate-muted mt-6 text-center">
            Don't have an account?{' '}
            <Link to="/signup" className="text-violet font-medium hover:opacity-70 transition-opacity">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
