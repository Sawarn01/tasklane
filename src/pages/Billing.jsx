import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DodoPayments } from 'dodopayments-checkout'
import { useAuth } from '../lib/AuthContext'
import { getMyOrg, createCheckoutSession } from '../lib/data'

const PLANS = [
  { key: 'free', name: 'Free', price: '$0', features: ['1 project', '3 team members'] },
  { key: 'pro', name: 'Pro', price: '$10/mo', features: ['5 projects', '10 members per project', 'Team chat'] },
  { key: 'company', name: 'Company', price: '$29/mo', features: ['Unlimited projects', 'Unlimited members', 'Team chat', 'File uploads'] },
]

export default function Billing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    DodoPayments.Initialize({
      mode: 'live',
      displayType: 'overlay',
      onEvent: (event) => {
        console.log('Checkout event:', event)
        if (event.event_type === 'checkout.closed') {
          loadOrg()
        }
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
    return <div className="p-8 text-slate-muted font-mono text-xs uppercase tracking-wider">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-paper p-8">
      <button onClick={() => navigate('/dashboard')} className="text-sm text-slate-muted hover:text-ink mb-6 transition-colors">
        ← Back to dashboard
      </button>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <p className="font-mono text-xs uppercase tracking-wider text-violet mb-2">Billing</p>
        <h1 className="text-2xl font-semibold text-ink mb-2">Choose your plan</h1>
        <p className="text-slate-muted mb-8">
          Current plan: <span className="font-semibold text-ink capitalize">{org?.plan}</span>
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-md"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
        {PLANS.map((plan, i) => {
          const isCurrent = org?.plan === plan.key
          const isPro = plan.key === 'pro'
          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              whileHover={{ y: -2 }}
              className={`bg-white rounded-2xl p-6 relative ${
                isPro ? 'border-2 border-violet' : 'border border-black/10'
              }`}
            >
              {isPro && (
                <span className="absolute -top-3 left-6 bg-violet text-white text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded-full">
                  Most teams
                </span>
              )}
              <h3 className="font-semibold text-ink">{plan.name}</h3>
              <p className="text-2xl font-semibold text-ink my-2">{plan.price}</p>
              <ul className="text-sm text-slate-muted space-y-1.5 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-sage" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="text-sm text-center text-slate-muted py-2 font-mono uppercase tracking-wide text-[11px]">
                  Current plan
                </div>
              ) : plan.key === 'free' ? null : (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={upgrading === plan.key}
                  className={`w-full rounded-full py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    isPro
                      ? 'bg-violet text-white hover:bg-violet/90'
                      : 'border border-black/10 text-ink hover:bg-paper-dim'
                  }`}
                >
                  {upgrading === plan.key ? 'Loading...' : `Upgrade to ${plan.name}`}
                </motion.button>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}