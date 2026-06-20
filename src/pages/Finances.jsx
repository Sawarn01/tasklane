import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import { getMyOrg, getMyProfile, getProjectsWithStats } from '../lib/data'
import DashboardSidebar from '../components/DashboardSidebar'

// ── Demo data ──────────────────────────────────────────────────────────────────
const REVENUE_DATA = [
  { month: 'Jan', revenue: 98200,  expenses: 42100, profit: 56100 },
  { month: 'Feb', revenue: 104500, expenses: 38700, profit: 65800 },
  { month: 'Mar', revenue: 112800, expenses: 45200, profit: 67600 },
  { month: 'Apr', revenue: 108900, expenses: 41800, profit: 67100 },
  { month: 'May', revenue: 118400, expenses: 44300, profit: 74100 },
  { month: 'Jun', revenue: 121200, expenses: 46100, profit: 75100 },
  { month: 'Jul', revenue: 115800, expenses: 43500, profit: 72300 },
  { month: 'Aug', revenue: 119300, expenses: 45800, profit: 73500 },
  { month: 'Sep', revenue: 124700, expenses: 47200, profit: 77500 },
  { month: 'Oct', revenue: 122100, expenses: 46500, profit: 75600 },
  { month: 'Nov', revenue: 126800, expenses: 48100, profit: 78700 },
  { month: 'Dec', revenue: 127400, expenses: 49200, profit: 78200 },
]

const EXPENSE_CATEGORIES = [
  { label: 'Payroll',        amount: 28400, pct: 58, color: '#6E56CF' },
  { label: 'Infrastructure', amount: 7800,  pct: 16, color: '#36D399' },
  { label: 'Marketing',      amount: 5200,  pct: 11, color: '#F59E0B' },
  { label: 'Tools & SaaS',   amount: 3600,  pct:  7, color: '#3B82F6' },
  { label: 'Miscellaneous',  amount: 4200,  pct:  8, color: '#EC4899' },
]

const TOP_CLIENTS = [
  { name: 'Acme Corp',       revenue: 42000, invoices: 8,  growth: 12 },
  { name: 'Bright Labs',     revenue: 31500, invoices: 6,  growth: 24 },
  { name: 'Nova Systems',    revenue: 24800, invoices: 5,  growth: -3 },
  { name: 'Pinnacle Inc',    revenue: 18200, invoices: 4,  growth: 31 },
  { name: 'Stealth Studio',  revenue: 11900, invoices: 3,  growth: 8  },
]

const SAMPLE_INVOICES = [
  { id: 'INV-0041', client: 'Acme Corp',      email: 'billing@acme.com',     amount: 12400, status: 'paid',    date: '2026-06-01', due: '2026-06-15', items: 3 },
  { id: 'INV-0040', client: 'Bright Labs',    email: 'ap@brightlabs.io',     amount: 8750,  status: 'pending', date: '2026-06-05', due: '2026-07-05', items: 2 },
  { id: 'INV-0039', client: 'Nova Systems',   email: 'finance@nova.co',      amount: 22100, status: 'overdue', date: '2026-05-10', due: '2026-05-25', items: 5 },
  { id: 'INV-0038', client: 'Pinnacle Inc',   email: 'accounts@pinnacle.com',amount: 6300,  status: 'paid',    date: '2026-05-20', due: '2026-06-03', items: 2 },
  { id: 'INV-0037', client: 'Stealth Studio', email: 'pay@stealth.studio',   amount: 9800,  status: 'pending', date: '2026-06-10', due: '2026-07-10', items: 4 },
  { id: 'INV-0036', client: 'Acme Corp',      email: 'billing@acme.com',     amount: 14200, status: 'paid',    date: '2026-04-28', due: '2026-05-12', items: 3 },
  { id: 'INV-0035', client: 'Ridge Analytics',email: 'billing@ridge.ai',     amount: 5500,  status: 'draft',   date: '2026-06-15', due: '2026-07-15', items: 1 },
]

// ── Utilities ──────────────────────────────────────────────────────────────────
const fmt = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

const fmtShort = n => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`

function statusStyle(s) {
  return {
    paid:    'bg-sage/15 text-sage font-medium',
    pending: 'bg-amber-100 text-amber-700 font-medium',
    overdue: 'bg-red-100 text-red-600 font-medium',
    draft:   'bg-paper-dim text-slate-muted font-medium',
  }[s] || 'bg-paper-dim text-slate-muted'
}

// ── AnimatedCounter ────────────────────────────────────────────────────────────
function AnimatedCounter({ value, prefix = '', suffix = '', duration = 1.2 }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    let start = null
    const from = 0
    const to = value
    const step = ts => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / (duration * 1000), 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * ease))
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <span>{prefix}{display.toLocaleString()}{suffix}</span>
}

// ── Area / Revenue chart ───────────────────────────────────────────────────────
function RevenueChart({ data, showExpenses }) {
  const [tooltip, setTooltip] = useState(null)
  const [animated, setAnimated] = useState(false)
  const svgRef = useRef(null)

  useEffect(() => { requestAnimationFrame(() => setAnimated(true)) }, [])

  const W = 800, H = 200
  const PAD = { top: 20, right: 16, bottom: 32, left: 56 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom

  const allVals = data.flatMap(d => showExpenses ? [d.revenue, d.expenses] : [d.revenue])
  const maxV = Math.max(...allVals) * 1.08
  const minV = Math.min(...allVals) * 0.88

  const toX = i => PAD.left + (i / (data.length - 1)) * iW
  const toY = v => PAD.top + iH - ((v - minV) / (maxV - minV)) * iH

  function makePath(key) {
    return data.reduce((p, d, i) => {
      const x = toX(i), y = toY(d[key])
      if (i === 0) return `M ${x} ${y}`
      const px = toX(i - 1), py = toY(data[i - 1][key])
      const cpx = (px + x) / 2
      return `${p} C ${cpx} ${py} ${cpx} ${y} ${x} ${y}`
    }, '')
  }

  function makeArea(key, baseY) {
    const line = makePath(key)
    const last = toX(data.length - 1)
    const first = PAD.left
    return `${line} L ${last} ${baseY} L ${first} ${baseY} Z`
  }

  const baseY = PAD.top + iH
  const revPath = makePath('revenue')
  const expPath = makePath('expenses')
  const revArea = makeArea('revenue', baseY)
  const expArea = makeArea('expenses', baseY)

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: PAD.top + iH * (1 - t),
    label: fmtShort(minV + (maxV - minV) * t),
  }))

  return (
    <div className="relative w-full h-48">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6E56CF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6E56CF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="exp-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EC4899" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
          </linearGradient>
          <clipPath id="chart-clip">
            <rect x={PAD.left} y={PAD.top} width={iW} height={iH} />
          </clipPath>
        </defs>

        {/* Grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={g.y} x2={PAD.left + iW} y2={g.y}
              stroke="#E5E3DB" strokeWidth="1" strokeDasharray="4 4" />
            <text x={PAD.left - 6} y={g.y + 4} textAnchor="end"
              className="fill-current text-slate-muted" style={{ fontSize: 9, fill: '#8A8F98' }}>
              {g.label}
            </text>
          </g>
        ))}

        {/* Month labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={H - 8} textAnchor="middle"
            style={{ fontSize: 9, fill: '#8A8F98' }}>
            {d.month}
          </text>
        ))}

        {/* Areas */}
        <g clipPath="url(#chart-clip)">
          {showExpenses && <path d={expArea} fill="url(#exp-grad)" />}
          <path d={revArea} fill="url(#rev-grad)" />
        </g>

        {/* Lines */}
        <g clipPath="url(#chart-clip)">
          {showExpenses && (
            <motion.path
              d={expPath} fill="none" stroke="#EC4899" strokeWidth="1.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: animated ? 1 : 0 }}
              transition={{ duration: 1, delay: 0.1 }}
            />
          )}
          <motion.path
            d={revPath} fill="none" stroke="#6E56CF" strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: animated ? 1 : 0 }}
            transition={{ duration: 1.2 }}
          />
        </g>

        {/* Hover targets */}
        {data.map((d, i) => {
          const x = toX(i), ry = toY(d.revenue)
          return (
            <g key={i}
              onMouseEnter={e => setTooltip({ ...d, x, ry, i })}
              onMouseLeave={() => setTooltip(null)}>
              <rect x={x - 20} y={PAD.top} width={40} height={iH} fill="transparent" />
              <circle cx={x} cy={ry} r="3.5" fill="#6E56CF"
                opacity={tooltip?.i === i ? 1 : 0.5} />
              {showExpenses && (
                <circle cx={x} cy={toY(d.expenses)} r="3" fill="#EC4899"
                  opacity={tooltip?.i === i ? 1 : 0.4} />
              )}
              {tooltip?.i === i && (
                <line x1={x} y1={PAD.top} x2={x} y2={baseY}
                  stroke="#0F1115" strokeWidth="1" strokeOpacity="0.08" />
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-0 pointer-events-none z-10 bg-ink text-white rounded-xl px-3 py-2 text-xs shadow-xl"
            style={{ left: `${(tooltip.x / W) * 100}%`, transform: 'translateX(-50%)' }}>
            <p className="font-semibold mb-1">{tooltip.month}</p>
            <p className="text-white/80">Revenue <span className="text-white font-mono">{fmt(tooltip.revenue)}</span></p>
            {showExpenses && (
              <p className="text-white/80">Expenses <span className="text-pink-300 font-mono">{fmt(tooltip.expenses)}</span></p>
            )}
            <p className="text-sage/90">Profit <span className="font-mono">{fmt(tooltip.profit)}</span></p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Donut chart ────────────────────────────────────────────────────────────────
function DonutChart({ data }) {
  const [hovered, setHovered] = useState(null)
  const R = 70, r = 46, cx = 90, cy = 90

  let cumAngle = -90
  const slices = data.map(d => {
    const startAngle = cumAngle
    const sweep = (d.pct / 100) * 360
    cumAngle += sweep
    return { ...d, startAngle, endAngle: cumAngle }
  })

  function arc(start, end, outer, inner) {
    const toRad = a => (a * Math.PI) / 180
    const ox1 = cx + outer * Math.cos(toRad(start))
    const oy1 = cy + outer * Math.sin(toRad(start))
    const ox2 = cx + outer * Math.cos(toRad(end))
    const oy2 = cy + outer * Math.sin(toRad(end))
    const ix1 = cx + inner * Math.cos(toRad(end))
    const iy1 = cy + inner * Math.sin(toRad(end))
    const ix2 = cx + inner * Math.cos(toRad(start))
    const iy2 = cy + inner * Math.sin(toRad(start))
    const large = end - start > 180 ? 1 : 0
    return `M ${ox1} ${oy1} A ${outer} ${outer} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 0 ${ix2} ${iy2} Z`
  }

  const active = hovered != null ? data[hovered] : null

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 180 180" className="w-40 h-40 shrink-0">
        {slices.map((s, i) => (
          <motion.path
            key={s.label}
            d={arc(s.startAngle, s.endAngle, R + (hovered === i ? 6 : 0), r)}
            fill={s.color}
            opacity={hovered === null || hovered === i ? 1 : 0.4}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer transition-all"
            initial={{ opacity: 0 }} animate={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: '#0F1115' }}>
          {active ? `${active.pct}%` : '100%'}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 9, fill: '#8A8F98' }}>
          {active ? active.label : 'Total'}
        </text>
      </svg>
      <div className="flex-1 space-y-2">
        {data.map((d, i) => (
          <div key={d.label} className={`flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 transition-colors ${hovered === i ? 'bg-paper-dim' : ''}`}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-ink flex-1">{d.label}</span>
            <span className="font-mono text-xs text-slate-muted">{fmtShort(d.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.revenue))
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
          <motion.div
            initial={{ height: 0 }} animate={{ height: `${(d.revenue / max) * 100}%` }}
            transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
            className="w-full rounded-t-md bg-violet/20 group-hover:bg-violet/60 transition-colors relative"
            title={`${d.month}: ${fmt(d.revenue)}`}
          />
          <span className="text-[8px] text-slate-muted/60">{d.month.slice(0, 1)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Invoice generator ──────────────────────────────────────────────────────────
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']

function newItem() {
  return { id: Date.now(), description: '', qty: 1, rate: 0 }
}

function generateInvoiceHTML(inv, orgName) {
  const subtotal = inv.items.reduce((s, item) => s + item.qty * item.rate, 0)
  const taxAmt = subtotal * (inv.taxRate / 100)
  const discAmt = subtotal * (inv.discount / 100)
  const total = subtotal + taxAmt - discAmt

  const currFmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency }).format(n)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${inv.number}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #0F1115; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { max-width: 800px; margin: 0 auto; padding: 56px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 52px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-dot { width: 10px; height: 10px; background: #6E56CF; border-radius: 2px; display: inline-block; }
.brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0F1115; }
.inv-meta { text-align: right; }
.inv-meta h1 { font-size: 38px; font-weight: 900; color: #0F1115; letter-spacing: -1.5px; }
.inv-meta .num { font-size: 13px; color: #8A8F98; margin-top: 4px; font-family: monospace; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 44px; }
.party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #8A8F98; font-weight: 600; margin-bottom: 8px; }
.party-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.party-detail { font-size: 13px; color: #555; line-height: 1.6; }
.dates { display: flex; gap: 40px; margin-bottom: 44px; padding: 20px 24px; background: #FAFAF7; border-radius: 10px; }
.date-item .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #8A8F98; font-weight: 600; margin-bottom: 4px; }
.date-item .value { font-size: 14px; font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
thead tr { border-bottom: 2px solid #0F1115; }
thead th { padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #8A8F98; font-weight: 600; }
thead th:last-child { text-align: right; }
tbody tr { border-bottom: 1px solid #F0EEE8; }
tbody td { padding: 14px 12px; font-size: 14px; }
tbody td:last-child { text-align: right; font-family: monospace; font-size: 13px; }
.qty-rate { font-size: 12px; color: #8A8F98; margin-top: 2px; }
.totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
.totals-box { width: 280px; }
.totals-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; color: #555; border-bottom: 1px solid #F0EEE8; }
.totals-row:last-child { border-bottom: none; }
.totals-total { display: flex; justify-content: space-between; padding: 14px 18px; background: #0F1115; color: white; border-radius: 10px; margin-top: 10px; font-weight: 700; font-size: 16px; }
.notes { border-top: 1px solid #F0EEE8; padding-top: 24px; }
.notes-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #8A8F98; font-weight: 600; margin-bottom: 8px; }
.notes-text { font-size: 13px; color: #555; line-height: 1.6; }
.badge { display: inline-block; background: #EDE9FB; color: #6E56CF; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-top: 8px; }
@media print { body { padding: 0; } .page { padding: 40px; } }
</style>
</head>
<body><div class="page">
  <div class="header">
    <div class="brand"><span class="brand-dot"></span><span class="brand-name">${orgName || 'Tasklane'}</span></div>
    <div class="inv-meta"><h1>Invoice</h1><p class="num">${inv.number}</p><span class="badge">Professional</span></div>
  </div>
  <div class="parties">
    <div>
      <p class="party-label">Bill To</p>
      <p class="party-name">${inv.client.name || '—'}</p>
      <p class="party-detail">${inv.client.email || ''}<br>${inv.client.address || ''}<br>${inv.client.city || ''} ${inv.client.country || ''}</p>
    </div>
    <div>
      <p class="party-label">From</p>
      <p class="party-name">${orgName || 'Your Company'}</p>
    </div>
  </div>
  <div class="dates">
    <div class="date-item"><p class="label">Issue Date</p><p class="value">${inv.issueDate}</p></div>
    <div class="date-item"><p class="label">Due Date</p><p class="value">${inv.dueDate}</p></div>
    <div class="date-item"><p class="label">Currency</p><p class="value">${inv.currency}</p></div>
  </div>
  <table>
    <thead><tr>
      <th>Description</th><th style="text-align:right;width:80px">Qty</th>
      <th style="text-align:right;width:120px">Rate</th>
      <th style="text-align:right;width:130px">Amount</th>
    </tr></thead>
    <tbody>
      ${inv.items.map(item => `<tr>
        <td>${item.description || 'Service'}</td>
        <td style="text-align:right">${item.qty}</td>
        <td style="text-align:right;font-family:monospace;font-size:13px">${currFmt(item.rate)}</td>
        <td>${currFmt(item.qty * item.rate)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="totals"><div class="totals-box">
    <div class="totals-row"><span>Subtotal</span><span>${currFmt(subtotal)}</span></div>
    ${inv.taxRate > 0 ? `<div class="totals-row"><span>Tax (${inv.taxRate}%)</span><span>${currFmt(taxAmt)}</span></div>` : ''}
    ${inv.discount > 0 ? `<div class="totals-row"><span>Discount (${inv.discount}%)</span><span>−${currFmt(discAmt)}</span></div>` : ''}
    <div class="totals-total"><span>Total Due</span><span>${currFmt(total)}</span></div>
  </div></div>
  ${inv.notes ? `<div class="notes"><p class="notes-label">Notes</p><p class="notes-text">${inv.notes}</p></div>` : ''}
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`
}

function InvoiceGenerator({ onClose, orgName }) {
  const [inv, setInv] = useState({
    number: `INV-${String(Date.now()).slice(-4)}`,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    client: { name: '', email: '', address: '', city: '', country: '' },
    items: [{ id: 1, description: '', qty: 1, rate: 0 }],
    taxRate: 10,
    discount: 0,
    notes: '',
    currency: 'USD',
  })
  const [tab, setTab] = useState('details') // details | items | settings

  const setClient = patch => setInv(p => ({ ...p, client: { ...p.client, ...patch } }))
  const setItem = (id, patch) =>
    setInv(p => ({ ...p, items: p.items.map(it => it.id === id ? { ...it, ...patch } : it) }))
  const addItem = () => setInv(p => ({ ...p, items: [...p.items, newItem()] }))
  const removeItem = id => setInv(p => ({ ...p, items: p.items.filter(it => it.id !== id) }))

  const subtotal = inv.items.reduce((s, it) => s + it.qty * it.rate, 0)
  const taxAmt   = subtotal * (inv.taxRate / 100)
  const discAmt  = subtotal * (inv.discount / 100)
  const total    = subtotal + taxAmt - discAmt

  const currFmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency, maximumFractionDigits: 2 }).format(n)

  function handleDownload() {
    const html = generateInvoiceHTML(inv, orgName)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const inputCls = 'w-full text-sm bg-white border border-black/8 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/25 placeholder:text-slate-muted/40'
  const labelCls = 'block text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-1'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* ── Left: form ─────────────────────────────────── */}
        <div className="w-[42%] border-r border-black/6 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-ink">New Invoice</h2>
              <p className="text-[11px] text-slate-muted font-mono mt-0.5">{inv.number}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-paper-dim flex items-center justify-center text-slate-muted hover:text-ink transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 px-4 pt-3 pb-0">
            {[['details', 'Client'], ['items', 'Line Items'], ['settings', 'Settings']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${tab === id ? 'bg-paper-dim text-ink' : 'text-slate-muted hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
            <AnimatePresence mode="wait">
              {tab === 'details' && (
                <motion.div key="details" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Invoice #</label>
                      <input className={inputCls} value={inv.number}
                        onChange={e => setInv(p => ({ ...p, number: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Currency</label>
                      <select className={inputCls} value={inv.currency}
                        onChange={e => setInv(p => ({ ...p, currency: e.target.value }))}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Issue Date</label>
                      <input type="date" className={inputCls} value={inv.issueDate}
                        onChange={e => setInv(p => ({ ...p, issueDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Due Date</label>
                      <input type="date" className={inputCls} value={inv.dueDate}
                        onChange={e => setInv(p => ({ ...p, dueDate: e.target.value }))} />
                    </div>
                  </div>

                  <div className="border-t border-black/5 pt-4">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-muted mb-3">Client Information</p>
                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>Client Name</label>
                        <input className={inputCls} placeholder="Acme Corp"
                          value={inv.client.name} onChange={e => setClient({ name: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input type="email" className={inputCls} placeholder="billing@acme.com"
                          value={inv.client.email} onChange={e => setClient({ email: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>Address</label>
                        <input className={inputCls} placeholder="123 Main St"
                          value={inv.client.address} onChange={e => setClient({ address: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>City</label>
                          <input className={inputCls} placeholder="New York"
                            value={inv.client.city} onChange={e => setClient({ city: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelCls}>Country</label>
                          <input className={inputCls} placeholder="USA"
                            value={inv.client.country} onChange={e => setClient({ country: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === 'items' && (
                <motion.div key="items" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="space-y-3">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_60px_80px_32px] gap-2">
                    {['Description', 'Qty', 'Rate ($)', ''].map(h => (
                      <p key={h} className="text-[9px] font-mono uppercase tracking-wider text-slate-muted">{h}</p>
                    ))}
                  </div>

                  <AnimatePresence>
                    {inv.items.map((item, i) => (
                      <motion.div key={item.id}
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="grid grid-cols-[1fr_60px_80px_32px] gap-2 items-start">
                        <div>
                          <input className={inputCls} placeholder={`Service ${i + 1}`}
                            value={item.description} onChange={e => setItem(item.id, { description: e.target.value })} />
                          <p className="text-[10px] text-slate-muted mt-1 ml-1 font-mono">
                            {currFmt(item.qty * item.rate)}
                          </p>
                        </div>
                        <input type="number" min="1" className={inputCls} value={item.qty}
                          onChange={e => setItem(item.id, { qty: Number(e.target.value) })} />
                        <input type="number" min="0" className={inputCls} value={item.rate}
                          onChange={e => setItem(item.id, { rate: Number(e.target.value) })} />
                        <button onClick={() => removeItem(item.id)} disabled={inv.items.length === 1}
                          className="w-8 h-8 mt-0.5 rounded-lg flex items-center justify-center text-slate-muted hover:text-red-500 hover:bg-red-50 disabled:opacity-20 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <button onClick={addItem}
                    className="w-full flex items-center gap-2 py-2.5 rounded-xl border border-dashed border-black/10 text-slate-muted hover:text-violet hover:border-violet/30 transition-colors text-xs">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Add line item
                  </button>

                  {/* Totals preview in form */}
                  <div className="border-t border-black/5 pt-3 space-y-1.5">
                    {[
                      ['Subtotal', currFmt(subtotal), false],
                      inv.taxRate > 0 ? [`Tax (${inv.taxRate}%)`, currFmt(taxAmt), false] : null,
                      inv.discount > 0 ? [`Discount (${inv.discount}%)`, `−${currFmt(discAmt)}`, false] : null,
                    ].filter(Boolean).map(([label, val]) => (
                      <div key={label} className="flex justify-between text-xs text-slate-muted">
                        <span>{label}</span><span className="font-mono">{val}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold text-ink pt-1.5 border-t border-black/5">
                      <span>Total Due</span>
                      <span className="font-mono text-violet">{currFmt(total)}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Tax Rate (%)</label>
                      <input type="number" min="0" max="100" className={inputCls}
                        value={inv.taxRate} onChange={e => setInv(p => ({ ...p, taxRate: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Discount (%)</label>
                      <input type="number" min="0" max="100" className={inputCls}
                        value={inv.discount} onChange={e => setInv(p => ({ ...p, discount: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Notes / Payment Terms</label>
                    <textarea rows={4} className={inputCls + ' resize-none'} placeholder="Payment due within 30 days. Thank you for your business."
                      value={inv.notes} onChange={e => setInv(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer actions */}
          <div className="border-t border-black/5 px-6 py-4 flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 bg-violet text-white text-sm rounded-xl py-2.5 font-medium hover:bg-violet/90 transition-colors">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v8M3 6l3.5 3.5L10 6M1 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download PDF
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }}
              className="px-4 flex items-center gap-1.5 text-sm text-slate-muted hover:text-ink border border-black/8 rounded-xl transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 6l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save Draft
            </motion.button>
          </div>
        </div>

        {/* ── Right: live preview ────────────────────────── */}
        <div className="flex-1 bg-[#F5F4F0] overflow-y-auto p-8">
          <div className="bg-white rounded-2xl shadow-sm p-10 min-h-full font-sans">
            {/* Invoice header */}
            <div className="flex justify-between items-start mb-12">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-ink rounded-xl flex items-center justify-center">
                  <div className="w-4 h-4 bg-violet rounded-sm" />
                </div>
                <div>
                  <p className="font-bold text-ink text-lg leading-tight">{orgName || 'Your Company'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-ink tracking-tight">Invoice</p>
                <p className="font-mono text-sm text-slate-muted mt-1">{inv.number}</p>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-10 mb-8">
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-muted mb-2">Bill To</p>
                <p className="font-semibold text-ink">{inv.client.name || <span className="text-slate-muted/40">Client Name</span>}</p>
                <p className="text-sm text-slate-muted mt-1">{inv.client.email}</p>
                <p className="text-sm text-slate-muted">{inv.client.address}</p>
                <p className="text-sm text-slate-muted">{[inv.client.city, inv.client.country].filter(Boolean).join(', ')}</p>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-muted mb-2">Invoice Details</p>
                <div className="space-y-1">
                  {[['Issue Date', inv.issueDate], ['Due Date', inv.dueDate], ['Currency', inv.currency]].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-sm">
                      <span className="text-slate-muted">{l}</span>
                      <span className="font-medium text-ink">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items table */}
            <table className="w-full mb-6">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="pb-2 text-left text-[9px] font-mono uppercase tracking-wider text-slate-muted">Description</th>
                  <th className="pb-2 text-right text-[9px] font-mono uppercase tracking-wider text-slate-muted w-12">Qty</th>
                  <th className="pb-2 text-right text-[9px] font-mono uppercase tracking-wider text-slate-muted w-24">Rate</th>
                  <th className="pb-2 text-right text-[9px] font-mono uppercase tracking-wider text-slate-muted w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item, i) => (
                  <tr key={item.id} className="border-b border-black/5">
                    <td className="py-3 text-sm text-ink">{item.description || <span className="text-slate-muted/40">Service {i + 1}</span>}</td>
                    <td className="py-3 text-sm text-right text-slate-muted">{item.qty}</td>
                    <td className="py-3 text-sm text-right font-mono text-slate-muted">{currFmt(item.rate)}</td>
                    <td className="py-3 text-sm text-right font-mono font-medium">{currFmt(item.qty * item.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-60 space-y-1.5">
                {[
                  ['Subtotal', currFmt(subtotal)],
                  inv.taxRate > 0 ? [`Tax (${inv.taxRate}%)`, currFmt(taxAmt)] : null,
                  inv.discount > 0 ? [`Discount (${inv.discount}%)`, `−${currFmt(discAmt)}`] : null,
                ].filter(Boolean).map(([l, v]) => (
                  <div key={l} className="flex justify-between text-sm text-slate-muted border-b border-black/5 pb-1.5">
                    <span>{l}</span><span className="font-mono">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between bg-ink text-white rounded-xl px-4 py-3 mt-2">
                  <span className="font-semibold text-sm">Total Due</span>
                  <span className="font-bold font-mono">{currFmt(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {inv.notes && (
              <div className="border-t border-black/5 pt-6">
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-muted mb-2">Notes</p>
                <p className="text-sm text-slate-muted leading-relaxed">{inv.notes}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Invoice row ────────────────────────────────────────────────────────────────
function InvoiceRow({ inv, i }) {
  return (
    <motion.tr initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className="border-b border-black/4 hover:bg-paper-dim/50 transition-colors group">
      <td className="py-3 px-4">
        <p className="font-mono text-xs text-violet">{inv.id}</p>
      </td>
      <td className="py-3 px-3">
        <p className="text-sm font-medium text-ink">{inv.client}</p>
        <p className="text-[11px] text-slate-muted">{inv.email}</p>
      </td>
      <td className="py-3 px-3 text-sm font-mono text-ink">{fmt(inv.amount)}</td>
      <td className="py-3 px-3 text-[11px] text-slate-muted">{inv.date}</td>
      <td className="py-3 px-3 text-[11px] text-slate-muted">{inv.due}</td>
      <td className="py-3 px-3">
        <span className={`text-[10px] px-2.5 py-1 rounded-full capitalize ${statusStyle(inv.status)}`}>
          {inv.status}
        </span>
      </td>
      <td className="py-3 px-3 text-right">
        <button className="opacity-0 group-hover:opacity-100 text-[11px] text-slate-muted hover:text-violet transition-all px-2 py-1 rounded-lg hover:bg-violet/8">
          View
        </button>
      </td>
    </motion.tr>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Finances() {
  const { user }  = useAuth()
  const [org, setOrg]         = useState(null)
  const [role, setRole]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)

  const [showExpenses,  setShowExpenses]  = useState(false)
  const [invoiceFilter, setInvoiceFilter] = useState('all')
  const [showGenerator, setShowGenerator] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { org, role } = await getMyOrg()
      setOrg(org); setRole(role)
      const [pRes, profRes] = await Promise.allSettled([
        getProjectsWithStats(org.id),
        getMyProfile(user.id),
      ])
      if (pRes.status === 'fulfilled')    setProjects(pRes.value)
      if (profRes.status === 'fulfilled') setProfile(profRes.value)
    } catch {}
    finally { setLoading(false) }
  }

  const MRR = REVENUE_DATA[REVENUE_DATA.length - 1].revenue
  const ARR = MRR * 12
  const prevMRR = REVENUE_DATA[REVENUE_DATA.length - 2].revenue
  const mrrGrowth = ((MRR - prevMRR) / prevMRR * 100).toFixed(1)
  const totalRev = REVENUE_DATA.reduce((s, d) => s + d.revenue, 0)
  const totalExp = REVENUE_DATA.reduce((s, d) => s + d.expenses, 0)
  const netProfit = totalRev - totalExp
  const profitMargin = ((netProfit / totalRev) * 100).toFixed(1)

  const filteredInvoices = SAMPLE_INVOICES.filter(inv => {
    const matchStatus = invoiceFilter === 'all' || inv.status === invoiceFilter
    const matchSearch = !invoiceSearch || inv.client.toLowerCase().includes(invoiceSearch.toLowerCase()) || inv.id.toLowerCase().includes(invoiceSearch.toLowerCase())
    return matchStatus && matchSearch
  })

  const invoiceSummary = {
    all:     SAMPLE_INVOICES.length,
    paid:    SAMPLE_INVOICES.filter(i => i.status === 'paid').length,
    pending: SAMPLE_INVOICES.filter(i => i.status === 'pending').length,
    overdue: SAMPLE_INVOICES.filter(i => i.status === 'overdue').length,
    draft:   SAMPLE_INVOICES.filter(i => i.status === 'draft').length,
  }

  const paidTotal   = SAMPLE_INVOICES.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const pendingTotal = SAMPLE_INVOICES.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0)
  const overdueTotal = SAMPLE_INVOICES.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}
          className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 bg-ink rounded-xl flex items-center justify-center">
            <div className="w-3 h-3 bg-violet rounded-sm" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-muted">Loading finances…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <DashboardSidebar org={org} role={role} profile={profile} user={user} projects={projects} />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-black/5 px-8 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-ink">Finances</h1>
            <p className="text-[11px] text-slate-muted">{org?.name} · Fiscal 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 text-xs text-slate-muted border border-black/8 bg-white rounded-xl px-3 py-2 hover:text-ink transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v8M3 6l3 3 3-3M1 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowGenerator(true)}
              className="flex items-center gap-1.5 bg-violet text-white text-xs px-3.5 py-2 rounded-xl font-medium hover:bg-violet/90 transition-colors">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New Invoice
            </motion.button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* ── KPI cards ──────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'MRR', value: MRR, prefix: '$', display: fmtShort(MRR),
                sub: `${mrrGrowth > 0 ? '+' : ''}${mrrGrowth}% vs last month`,
                positive: mrrGrowth > 0, accent: 'violet',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l4-4 3 3 5-7" stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
              },
              {
                label: 'ARR', display: fmtShort(ARR),
                sub: 'Annualized revenue run-rate', positive: true, accent: 'ink',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#0F1115" strokeWidth="1.5" /><path d="M8 5v3l2 2" stroke="#0F1115" strokeWidth="1.4" strokeLinecap="round" /></svg>,
              },
              {
                label: 'Net Profit', display: fmtShort(netProfit),
                sub: `${profitMargin}% margin · FY2026`, positive: true, accent: 'sage',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M5 5.5C5 4.1 6.3 3 8 3s3 1.1 3 2.5c0 3-6 3-6 6 0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5" stroke="#36D399" strokeWidth="1.5" strokeLinecap="round" /></svg>,
              },
              {
                label: 'Receivables', display: fmtShort(pendingTotal + overdueTotal),
                sub: `${fmtShort(overdueTotal)} overdue`, positive: false, accent: 'amber',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="#F59E0B" strokeWidth="1.5" /><path d="M2 7h12" stroke="#F59E0B" strokeWidth="1.3" /></svg>,
              },
            ].map(({ label, display, sub, positive, accent, icon }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="bg-white rounded-2xl border border-black/5 px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-paper-dim flex items-center justify-center">
                    {icon}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${positive ? 'bg-sage/15 text-sage' : 'bg-amber-100 text-amber-700'}`}>
                    {positive ? '↑' : '↓'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-ink tracking-tight">{display}</p>
                <p className="text-[11px] text-slate-muted font-mono mt-0.5">{label}</p>
                <p className="text-[10px] text-slate-muted/70 mt-2 leading-snug">{sub}</p>
              </motion.div>
            ))}
          </div>

          {/* ── Revenue chart ────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-black/5 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-ink">Revenue overview</h2>
                <p className="text-[11px] text-slate-muted mt-0.5">Monthly revenue — Jan to Dec 2026</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-4 text-[11px] text-slate-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-violet rounded-full inline-block" />Revenue
                  </span>
                  {showExpenses && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-pink-400 rounded-full inline-block" />Expenses
                    </span>
                  )}
                </div>
                <button onClick={() => setShowExpenses(p => !p)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${showExpenses ? 'border-violet/30 bg-violet/8 text-violet' : 'border-black/8 text-slate-muted hover:text-ink'}`}>
                  {showExpenses ? 'Hide expenses' : 'Show expenses'}
                </button>
              </div>
            </div>
            <RevenueChart data={REVENUE_DATA} showExpenses={showExpenses} />
          </motion.div>

          {/* ── Analytics row ────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Expense breakdown */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl border border-black/5 p-6">
              <h3 className="font-semibold text-ink mb-1">Expense breakdown</h3>
              <p className="text-[11px] text-slate-muted mb-5">December 2026 · {fmt(totalExp / 12)}/mo avg</p>
              <DonutChart data={EXPENSE_CATEGORIES} />
            </motion.div>

            {/* Top clients */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl border border-black/5 p-6">
              <h3 className="font-semibold text-ink mb-1">Top clients</h3>
              <p className="text-[11px] text-slate-muted mb-4">By revenue · FY2026</p>
              <div className="space-y-3">
                {TOP_CLIENTS.map((c, i) => {
                  const max = TOP_CLIENTS[0].revenue
                  return (
                    <div key={c.name} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-muted/50 w-3">{i + 1}</span>
                          <span className="text-sm text-ink">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono ${c.growth > 0 ? 'text-sage' : 'text-red-500'}`}>
                            {c.growth > 0 ? '+' : ''}{c.growth}%
                          </span>
                          <span className="text-xs font-mono text-ink">{fmtShort(c.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-paper-dim rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(c.revenue / max) * 100}%` }}
                          transition={{ duration: 0.7, delay: 0.3 + i * 0.08 }}
                          className="h-full bg-violet/40 rounded-full group-hover:bg-violet/70 transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Monthly bars + summary */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="bg-white rounded-2xl border border-black/5 p-6 flex flex-col">
              <h3 className="font-semibold text-ink mb-1">Monthly revenue</h3>
              <p className="text-[11px] text-slate-muted mb-4">Trailing 12 months</p>
              <BarChart data={REVENUE_DATA} />
              <div className="mt-4 pt-4 border-t border-black/5 grid grid-cols-2 gap-3">
                {[
                  { label: 'Best month', value: fmtShort(Math.max(...REVENUE_DATA.map(d => d.revenue))), month: REVENUE_DATA.reduce((a, b) => a.revenue > b.revenue ? a : b).month },
                  { label: 'Avg monthly', value: fmtShort(Math.round(totalRev / REVENUE_DATA.length)), month: 'FY2026' },
                ].map(({ label, value, month }) => (
                  <div key={label} className="bg-paper-dim rounded-xl p-3">
                    <p className="text-[9px] text-slate-muted uppercase tracking-wider font-mono">{label}</p>
                    <p className="text-base font-bold text-ink mt-1">{value}</p>
                    <p className="text-[10px] text-slate-muted">{month}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Invoice summary row ───────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Collected', amount: paidTotal,   count: invoiceSummary.paid,    color: 'sage',  icon: '✓' },
              { label: 'Pending',   amount: pendingTotal, count: invoiceSummary.pending, color: 'amber', icon: '⏳' },
              { label: 'Overdue',   amount: overdueTotal, count: invoiceSummary.overdue, color: 'red',   icon: '!' },
            ].map(({ label, amount, count, color, icon }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className="bg-white rounded-2xl border border-black/5 px-5 py-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0 ${color === 'sage' ? 'bg-sage/15 text-sage' : color === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-500'}`}>
                  {icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-ink">{fmtShort(amount)}</p>
                  <p className="text-[11px] text-slate-muted">{label} · {count} invoice{count !== 1 ? 's' : ''}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Invoices table ────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="bg-white rounded-2xl border border-black/5 overflow-hidden">
            {/* Table header */}
            <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
              <h2 className="font-semibold text-ink">Invoices</h2>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-muted pointer-events-none">
                    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M8 8l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                    placeholder="Search invoices…"
                    className="text-xs pl-7 pr-3 py-1.5 bg-paper-dim border border-black/6 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/20 placeholder:text-slate-muted/50 w-44" />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowGenerator(true)}
                  className="flex items-center gap-1.5 bg-violet text-white text-xs px-3 py-1.5 rounded-xl hover:bg-violet/90 transition-colors">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  New Invoice
                </motion.button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-0.5 px-6 pt-3 border-b border-black/5">
              {[
                ['all', 'All', invoiceSummary.all],
                ['paid', 'Paid', invoiceSummary.paid],
                ['pending', 'Pending', invoiceSummary.pending],
                ['overdue', 'Overdue', invoiceSummary.overdue],
                ['draft', 'Draft', invoiceSummary.draft],
              ].map(([id, label, count]) => (
                <button key={id} onClick={() => setInvoiceFilter(id)}
                  className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${invoiceFilter === id ? 'border-violet text-violet' : 'border-transparent text-slate-muted hover:text-ink'}`}>
                  {label}
                  <span className={`text-[9px] px-1.5 rounded-full ${invoiceFilter === id ? 'bg-violet/10 text-violet' : 'bg-paper-dim text-slate-muted'}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-wider text-slate-muted/60">
                    {['Invoice', 'Client', 'Amount', 'Date', 'Due', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, i) => <InvoiceRow key={inv.id} inv={inv} i={i} />)}
                </tbody>
              </table>
              {filteredInvoices.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-slate-muted">No invoices match your filter.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Cash flow section ─────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl border border-black/5 p-6">
            <h2 className="font-semibold text-ink mb-1">Cash flow</h2>
            <p className="text-[11px] text-slate-muted mb-5">Inflows vs outflows · FY2026</p>
            <div className="space-y-3">
              {REVENUE_DATA.map((d, i) => {
                const maxFlow = Math.max(...REVENUE_DATA.map(r => r.revenue))
                const revPct = (d.revenue / maxFlow) * 100
                const expPct = (d.expenses / maxFlow) * 100
                return (
                  <div key={d.month} className="flex items-center gap-3">
                    <span className="w-8 text-[10px] text-slate-muted font-mono shrink-0">{d.month}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${revPct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.04 }}
                          className="h-2 bg-violet/50 rounded-full" />
                        <span className="text-[10px] font-mono text-slate-muted shrink-0">{fmtShort(d.revenue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${expPct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.04 + 0.05 }}
                          className="h-2 bg-pink-300/60 rounded-full" />
                        <span className="text-[10px] font-mono text-slate-muted shrink-0">{fmtShort(d.expenses)}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono w-16 text-right shrink-0 ${d.profit > 0 ? 'text-sage' : 'text-red-500'}`}>
                      +{fmtShort(d.profit)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-5 pt-4 border-t border-black/5 text-[11px] text-slate-muted">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-violet/50 rounded-full inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-pink-300/60 rounded-full inline-block" />Expenses</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-sage/60 rounded-full inline-block" />Net profit</span>
            </div>
          </motion.div>

        </div>
      </main>

      <AnimatePresence>
        {showGenerator && (
          <InvoiceGenerator onClose={() => setShowGenerator(false)} orgName={org?.name} />
        )}
      </AnimatePresence>
    </div>
  )
}
