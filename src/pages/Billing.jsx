import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DodoPayments } from 'dodopayments-checkout'
import { useAuth } from '../lib/AuthContext'
import { getMyOrg, createCheckoutSession } from '../lib/data'

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
      <circle cx="6.5" cy="6.5" r="6.5" fill="#36D399" fillOpacity="0.15" />
      <path d="M4 6.5l2 2 3.5-3.5" stroke="#36D399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
      <circle cx="6.5" cy="6.5" r="6.5" fill="#0F1115" fillOpacity="0.05" />
      <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="#8A8F98" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

const PLANS = [
  {
    key: 'free',
    name: 'Starter',
    price: { monthly: '$0', annual: '$0' },
    description: 'Perfect for solo builders and small experiments.',
    badge: null,
    features: [
      { label: '1 project', available: true },
      { label: 'Up to 3 team members', available: true },
      { label: 'Kanban board', available: true },
      { label: 'Basic backlog', available: true },
      { label: 'Team chat', available: false },
      { label: 'File uploads', available: false },
      { label: 'Sprint planning', available: false },
      { label: 'Timeline view', available: false },
      { label: 'Reports & analytics', available: false },
      { label: 'Priority support', available: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: { monthly: '$10', annual: '$8' },
    description: 'Everything a growing team needs to ship confidently.',
    badge: 'Most popular',
    features: [
      { label: 'Up to 5 projects', available: true },
      { label: 'Up to 10 team members', available: true },
      { label: 'Kanban board', available: true },
      { label: 'Sprint planning + backlog', available: true },
      { label: 'Team chat', available: true },
      { label: 'File uploads (5 GB)', available: true },
      { label: 'Timeline / Gantt view', available: true },
      { label: 'Reports & velocity charts', available: true },
      { label: 'Release management', available: false },
      { label: 'Priority support', available: false },
    ],
  },
  {
    key: 'company',
    name: 'Company',
    price: { monthly: '$29', annual: '$23' },
    description: 'Unlimited scale for serious engineering organizations.',
    badge: null,
    features: [
      { label: 'Unlimited projects', available: true },
      { label: 'Unlimited team members', available: true },
      { label: 'Kanban board', available: true },
      { label: 'Sprint planning + backlog', available: true },
      { label: 'Team chat', available: true },
      { label: 'File uploads (50 GB)', available: true },
      { label: 'Timeline / Gantt view', available: true },
      { label: 'Reports & velocity charts', available: true },
      { label: 'Release management', available: true },
      { label: 'Priority support', available: true },
    ],
  },
]

export default function Billing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(null)
  const [error, setError] = useState('')
  const [annual, setAnnual] = useState(false)

  useEffect(() => {
    DodoPayments.Initialize({
      mode: 'live',
      displayType: 'overlay',
      onEvent: (event) => {
        if (event.event_type === 'checkout.closed') loadOrg()
      },
    })
    loadOrg()
  }, [])

  async function loadOrg() {
    try {
      const { org } = await getMyOrg()
      setOrg(org)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade(plan) {
    setUpgrading(plan)
    setError('')
    try {
      const { checkoutUrl } = await createCheckoutSession({
        plan,
        orgId: org.id,
        userEmail: user.email,
        userName: user.user_metadata?.full_name || user.email,
      })
      DodoPayments.Checkout.open({ checkoutUrl })
    } catch (err) {
      setError(err.message)
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="font-mono text-xs uppercase tracking-wider text-slate-muted"
        >
          Loading…
        </motion.p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <div className="border-b border-black/5 bg-white px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-muted hover:text-ink transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dashboard
        </button>
        <span className="text-black/10">/</span>
        <span className="text-sm font-medium text-ink">Billing</span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-10"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet mb-2">Plans & Billing</p>
          <h1 className="text-3xl font-bold text-ink mb-3">Choose the right plan</h1>
          <p className="text-slate-muted max-w-md mx-auto">
            Current plan:{' '}
            <span className="font-semibold text-ink capitalize">{org?.plan || 'free'}</span>
          </p>

          {/* Annual / Monthly toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm transition-colors ${!annual ? 'text-ink font-medium' : 'text-slate-muted'}`}>Monthly</span>
            <button
              onClick={() => setAnnual((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${annual ? 'bg-violet' : 'bg-black/15'}`}
            >
              <motion.div
                animate={{ x: annual ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
            <span className={`text-sm transition-colors ${annual ? 'text-ink font-medium' : 'text-slate-muted'}`}>
              Annual
              <AnimatePresence>
                {annual && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="ml-1.5 text-[10px] font-mono uppercase tracking-wide text-sage bg-sage/15 px-1.5 py-0.5 rounded-full"
                  >
                    Save 20%
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-lg mx-auto"
          >
            {error}
          </motion.div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
          {PLANS.map((plan, i) => {
            const isCurrent = org?.plan === plan.key
            const isPro = plan.key === 'pro'
            const price = annual ? plan.price.annual : plan.price.monthly

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -4, transition: { duration: 0.15 } }}
                className={`relative bg-white rounded-2xl p-6 flex flex-col ${
                  isPro
                    ? 'border-2 border-violet shadow-lg shadow-violet/10'
                    : 'border border-black/5'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet text-white text-[10px] font-mono uppercase tracking-wide px-3 py-1 rounded-full whitespace-nowrap">
                      Most popular
                    </span>
                  </div>
                )}
                {isCurrent && !isPro && (
                  <div className="absolute -top-3 left-5">
                    <span className="bg-sage text-white text-[10px] font-mono uppercase tracking-wide px-3 py-1 rounded-full">
                      Current
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="font-bold text-ink text-lg mb-1">{plan.name}</h3>
                  <p className="text-slate-muted text-xs leading-relaxed mb-4">{plan.description}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-ink">{price}</span>
                    {plan.key !== 'free' && (
                      <span className="text-sm text-slate-muted mb-1">/mo</span>
                    )}
                  </div>
                  {annual && plan.key !== 'free' && (
                    <p className="text-[10px] text-slate-muted mt-1">Billed annually</p>
                  )}
                </div>

                {/* CTA */}
                <div className="mb-6">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl border border-black/10 text-center text-sm text-slate-muted font-mono uppercase tracking-wide text-[11px]">
                      Current plan
                    </div>
                  ) : plan.key === 'free' ? (
                    <div className="w-full py-2.5 rounded-xl border border-black/8 text-center text-xs text-slate-muted/60">
                      Free forever
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={upgrading === plan.key}
                      className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        isPro
                          ? 'bg-violet text-white hover:bg-violet/90'
                          : 'border border-black/10 text-ink hover:bg-paper-dim'
                      }`}
                    >
                      {upgrading === plan.key ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            className={`w-3.5 h-3.5 border-2 rounded-full block ${isPro ? 'border-white/30 border-t-white' : 'border-ink/20 border-t-ink'}`}
                          />
                          Loading…
                        </span>
                      ) : `Upgrade to ${plan.name}`}
                    </motion.button>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <div key={f.label} className="flex items-center gap-2.5">
                      {f.available ? <CheckIcon /> : <CrossIcon />}
                      <span className={`text-xs ${f.available ? 'text-ink' : 'text-slate-muted/60'}`}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-black/5 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-black/5">
            <h3 className="font-semibold text-ink">Full feature comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5">
                  <th className="text-left px-6 py-3 text-slate-muted font-mono text-[10px] uppercase tracking-wide">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.key} className={`px-4 py-3 text-center font-semibold text-xs ${p.key === 'pro' ? 'text-violet' : 'text-ink'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {[
                  { label: 'Projects', values: ['1', '5', 'Unlimited'] },
                  { label: 'Team members', values: ['3', '10', 'Unlimited'] },
                  { label: 'Storage', values: ['—', '5 GB', '50 GB'] },
                  { label: 'Kanban board', values: [true, true, true] },
                  { label: 'Sprint planning', values: [false, true, true] },
                  { label: 'Backlog', values: [false, true, true] },
                  { label: 'Timeline / Gantt', values: [false, true, true] },
                  { label: 'Burndown charts', values: [false, true, true] },
                  { label: 'Team chat', values: [false, true, true] },
                  { label: 'File uploads', values: [false, true, true] },
                  { label: 'Release management', values: [false, false, true] },
                  { label: 'Priority support', values: [false, false, true] },
                ].map(({ label, values }) => (
                  <tr key={label} className="hover:bg-paper-dim/30 transition-colors">
                    <td className="px-6 py-3 text-ink text-sm">{label}</td>
                    {values.map((v, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {typeof v === 'boolean' ? (
                          v ? <CheckIcon /> : <CrossIcon />
                        ) : (
                          <span className={`text-xs font-mono ${v === '—' ? 'text-slate-muted/40' : 'text-ink'}`}>{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center"
        >
          <p className="text-sm text-slate-muted">
            Questions about pricing?{' '}
            <a href="mailto:support@tasklane.app" className="text-violet hover:opacity-70 transition-opacity">
              Contact us
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
