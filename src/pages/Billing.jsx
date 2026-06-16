import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DodoPayments } from 'dodopayments-checkout'
import { useAuth } from '../lib/AuthContext'
import { getMyOrg } from '../lib/data'
import { createCheckoutSession } from '../lib/data'

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
          // refresh org data in case the payment went through
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

  if (loading) return <div className="p-8 text-slate-500">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <button onClick={() => navigate('/dashboard')} className="text-sm text-slate-500 mb-6">
        ← Back to dashboard
      </button>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Billing</h1>
      <p className="text-slate-500 mb-8">
        Current plan: <span className="font-semibold capitalize">{org?.plan}</span>
      </p>

      {error && (
        <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 max-w-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
        {PLANS.map((plan) => (
          <div key={plan.key} className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900">{plan.name}</h3>
            <p className="text-2xl font-bold text-slate-900 my-2">{plan.price}</p>
            <ul className="text-sm text-slate-600 space-y-1 mb-4">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {org?.plan === plan.key ? (
              <div className="text-sm text-center text-slate-400 py-2">Current plan</div>
            ) : plan.key === 'free' ? null : (
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={upgrading === plan.key}
                className="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {upgrading === plan.key ? 'Loading...' : `Upgrade to ${plan.name}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}