import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from 'framer-motion'

// ─── Design tokens ─────────────────────────────────────────────────────────
const V = '#6E56CF'      // violet
const INK = '#0F1115'    // ink
const MUTED = '#8A8F98'  // slate-muted
const SAGE = '#36D399'   // sage
const PAPER = '#FAFAF7'
const DIM = '#F1EFE7'

const TYPE_META = {
  epic:    { color: '#8B5CF6', label: 'Epic' },
  story:   { color: '#36D399', label: 'Story' },
  task:    { color: '#3B82F6', label: 'Task' },
  bug:     { color: '#EF4444', label: 'Bug' },
  subtask: { color: '#8A8F98', label: 'Subtask' },
}
const PRI_COLOR = { urgent: '#EF4444', high: '#F97316', medium: V, low: MUTED }

// ─── Interactive Kanban demo ────────────────────────────────────────────────

const INIT_CARDS = [
  { id: 1, type: 'bug',   title: 'Fix auth session expiry',  priority: 'urgent', pts: 3,  col: 0 },
  { id: 2, type: 'story', title: 'Design new onboarding',    priority: 'high',   pts: 5,  col: 0 },
  { id: 3, type: 'task',  title: 'Sprint planning workflow', priority: 'high',   pts: 3,  col: 1 },
  { id: 4, type: 'task',  title: 'Realtime chat sync',       priority: 'medium', pts: 1,  col: 1 },
  { id: 5, type: 'epic',  title: 'Q3 Mobile Revamp',         priority: 'high',   pts: 13, col: 2 },
  { id: 6, type: 'task',  title: 'Ship landing page',        priority: 'low',    pts: 2,  col: 2 },
  { id: 7, type: 'story', title: 'Notification centre',      priority: 'medium', pts: 3,  col: 3 },
]

const COLS = ['To Do', 'In Progress', 'In Review', 'Done']

function InteractiveKanban() {
  const [cards, setCards] = useState(INIT_CARDS)
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [justMoved, setJustMoved] = useState(null)

  function startDrag(e, id) {
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(id)
  }
  function onDragOver(e, col) {
    e.preventDefault()
    setOverCol(col)
  }
  function onDrop(col) {
    if (draggingId === null) return
    setCards(prev => prev.map(c => c.id === draggingId ? { ...c, col } : c))
    setJustMoved(draggingId)
    setTimeout(() => setJustMoved(null), 700)
    setDraggingId(null)
    setOverCol(null)
  }
  function onDragEnd() {
    setDraggingId(null)
    setOverCol(null)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {COLS.map((col, ci) => {
        const colCards = cards.filter(c => c.col === ci)
        const isOver = overCol === ci
        const accent = ['#8A8F98', '#6E56CF', '#F59E0B', '#36D399'][ci]
        return (
          <div
            key={col}
            onDragOver={(e) => onDragOver(e, ci)}
            onDrop={() => onDrop(ci)}
            className={`flex-shrink-0 w-44 rounded-xl p-2 transition-colors duration-150 ${isOver ? 'bg-violet/10 ring-1 ring-violet/30' : 'bg-[#F1EFE7]'}`}
          >
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
              <p className="font-mono text-[9px] uppercase tracking-wider text-[#8A8F98]">{col}</p>
              <span className="font-mono text-[9px] text-[#8A8F98]/60 ml-auto">{colCards.length}</span>
            </div>
            <div className="space-y-1.5 min-h-[40px]">
              <AnimatePresence>
                {colCards.map((card) => {
                  const tm = TYPE_META[card.type]
                  const isDragging = draggingId === card.id
                  const wasJustMoved = justMoved === card.id
                  return (
                    <motion.div
                      key={card.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: isDragging ? 0.4 : 1, scale: wasJustMoved ? [1, 1.04, 1] : 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.18 }}
                      draggable
                      onDragStart={(e) => startDrag(e, card.id)}
                      onDragEnd={onDragEnd}
                      className="bg-white rounded-lg p-2 shadow-sm border border-black/5 cursor-grab active:cursor-grabbing select-none hover:shadow-md hover:border-black/10 transition-shadow"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: tm.color }} />
                        <span className="font-mono text-[7px] uppercase tracking-wide" style={{ color: tm.color }}>{tm.label}</span>
                      </div>
                      <p className="text-[10px] text-[#0F1115] font-medium leading-snug">{card.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-mono text-[8px]" style={{ color: PRI_COLOR[card.priority] }}>{card.priority}</span>
                        <span className="font-mono text-[8px] bg-[#F1EFE7] text-[#8A8F98] px-1 rounded">{card.pts}p</span>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              {isOver && draggingId !== null && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-10 rounded-lg border-2 border-dashed border-violet/40 bg-violet/5"
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini Backlog ───────────────────────────────────────────────────────────

const SPRINT_DATA = [
  {
    name: 'Sprint 12', status: 'active', pts: 18, done: 11,
    issues: [
      { title: 'Auth session fix',    type: 'bug',   pts: 3, done: true  },
      { title: 'Dashboard redesign',  type: 'story', pts: 5, done: true  },
      { title: 'Realtime chat',       type: 'task',  pts: 3, done: false },
      { title: 'Mobile sync',         type: 'task',  pts: 2, done: false },
    ],
  },
  {
    name: 'Sprint 13', status: 'planning', pts: 21, done: 0,
    issues: [
      { title: 'Notification centre', type: 'story', pts: 5, done: false },
      { title: 'Dark mode',           type: 'task',  pts: 3, done: false },
    ],
  },
]

function InteractiveBacklog() {
  const [expanded, setExpanded] = useState({ 0: true })
  const [checked, setChecked] = useState({})

  return (
    <div className="space-y-2">
      {SPRINT_DATA.map((sprint, si) => (
        <div key={sprint.name} className="bg-white rounded-xl border border-black/5 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded(p => ({ ...p, [si]: !p[si] }))}
            className="w-full flex items-center gap-2 px-3 py-2 bg-[#F1EFE7] hover:bg-[#E9E7DF] transition-colors text-left"
          >
            <motion.svg
              animate={{ rotate: expanded[si] ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              width="8" height="8" viewBox="0 0 8 8" fill="none" className="shrink-0"
            >
              <path d="M2 1l3 3-3 3" stroke={MUTED} strokeWidth="1.3" strokeLinecap="round" />
            </motion.svg>
            <span className="text-[10px] font-semibold text-[#0F1115] flex-1">{sprint.name}</span>
            <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${sprint.status === 'active' ? 'bg-violet/15 text-violet' : 'bg-black/5 text-[#8A8F98]'}`}>
              {sprint.status}
            </span>
            <span className="font-mono text-[8px] text-[#8A8F98] ml-1">{sprint.done}/{sprint.pts}p</span>
          </button>
          <AnimatePresence>
            {expanded[si] && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden"
              >
                {sprint.issues.map((issue, ii) => {
                  const key = `${si}-${ii}`
                  const isDone = checked[key] !== undefined ? checked[key] : issue.done
                  const tm = TYPE_META[issue.type]
                  return (
                    <motion.div
                      key={ii}
                      animate={{ opacity: isDone ? 0.55 : 1 }}
                      className="flex items-center gap-2 px-3 py-1.5 border-b border-black/5 last:border-0 hover:bg-[#FAFAF7] transition-colors cursor-pointer"
                      onClick={() => setChecked(p => ({ ...p, [key]: !isDone }))}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-sage border-sage' : 'border-black/20'}`}>
                        {isDone && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: tm.color }} />
                      <span className={`text-[10px] text-[#0F1115] flex-1 ${isDone ? 'line-through text-[#8A8F98]' : ''}`}>{issue.title}</span>
                      <span className="font-mono text-[8px] text-[#8A8F98]">{issue.pts}p</span>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <div className="bg-[#F1EFE7] rounded-xl px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-[#8A8F98]">Backlog · 14 issues</span>
        <span className="font-mono text-[8px] text-[#8A8F98]">34p total</span>
      </div>
    </div>
  )
}

// ─── Mini Timeline ──────────────────────────────────────────────────────────

const TL_BARS = [
  { label: 'Q3 Mobile Revamp', color: '#8B5CF6', left: 0,  width: 62, status: 'on track' },
  { label: 'Auth overhaul',    color: '#3B82F6', left: 8,  width: 38, status: 'on track' },
  { label: 'Dashboard v2',     color: '#36D399', left: 33, width: 48, status: 'completed' },
  { label: 'API v3',           color: '#F59E0B', left: 55, width: 32, status: 'at risk'   },
  { label: 'Notifications',    color: V,         left: 72, width: 22, status: 'planning'  },
]

const ZOOMS = ['Month', 'Quarter']

function InteractiveTimeline() {
  const [zoom, setZoom] = useState(0)
  const labels = zoom === 0
    ? ['Jun', 'Jul', 'Aug', 'Sep', 'Oct']
    : ['Q2', 'Q3', 'Q4']

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-0.5 bg-[#F1EFE7] rounded-lg p-0.5">
          {ZOOMS.map((z, i) => (
            <button key={z} onClick={() => setZoom(i)}
              className={`text-[9px] font-mono px-2 py-1 rounded-md transition-colors ${zoom === i ? 'bg-white text-ink shadow-sm' : 'text-[#8A8F98]'}`}
            >{z}</button>
          ))}
        </div>
        <span className="font-mono text-[8px] text-[#8A8F98]">5 epics</span>
      </div>
      <div className="flex text-[8px] font-mono uppercase tracking-wider text-[#8A8F98] mb-1.5">
        {labels.map((m) => <span key={m} className="flex-1">{m}</span>)}
      </div>
      {TL_BARS.map((b, i) => (
        <motion.div key={i} className="flex items-center gap-2 h-6 mb-1.5"
          initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }} viewport={{ once: true }}
        >
          <span className="text-[9px] text-[#8A8F98] w-20 shrink-0 truncate">{b.label}</span>
          <div className="flex-1 relative h-4">
            <motion.div
              initial={{ width: 0 }} whileInView={{ width: `${b.width}%` }}
              transition={{ duration: 0.5, delay: i * 0.08 }} viewport={{ once: true }}
              whileHover={{ scaleY: 1.2, opacity: 1 }}
              style={{ left: `${b.left}%`, backgroundColor: `${b.color}25`, borderLeft: `2.5px solid ${b.color}` }}
              className="absolute h-full rounded-r-md cursor-pointer group"
            >
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] font-medium opacity-70 group-hover:opacity-100 hidden group-hover:block whitespace-nowrap" style={{ color: b.color }}>{b.status}</span>
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Mini Reports ────────────────────────────────────────────────────────────

const VELOCITY = [22, 28, 31, 35, 30, 42]
const BURNDOWN_IDEAL = [40, 35, 30, 25, 20, 15, 10, 5, 0]
const BURNDOWN_ACTUAL = [40, 37, 32, 29, 24, 22, 17, 14, null]

function InteractiveReport() {
  const [view, setView] = useState('velocity')

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[9px] uppercase tracking-wider text-[#8A8F98]">
          {view === 'velocity' ? 'Sprint velocity' : 'Sprint burndown'}
        </p>
        <div className="flex gap-0.5 bg-[#F1EFE7] rounded-lg p-0.5">
          {['velocity', 'burndown'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[9px] font-mono capitalize px-2 py-0.5 rounded-md transition-colors ${view === v ? 'bg-white text-ink shadow-sm' : 'text-[#8A8F98]'}`}
            >{v}</button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'velocity' ? (
          <motion.div key="vel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-end gap-2 h-20"
          >
            {VELOCITY.map((v, i) => {
              const max = Math.max(...VELOCITY)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] font-mono text-[#8A8F98]">{v}</span>
                  <motion.div
                    initial={{ height: 0 }} whileInView={{ height: `${(v / max) * 60}px` }}
                    transition={{ duration: 0.4, delay: i * 0.06 }} viewport={{ once: true }}
                    whileHover={{ opacity: 1 }}
                    className="w-full rounded-t-md cursor-pointer"
                    style={{ backgroundColor: i === VELOCITY.length - 1 ? V : `${V}50` }}
                  />
                  <span className="text-[7px] font-mono text-[#8A8F98]">S{i + 1}</span>
                </div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div key="burn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-20 relative"
          >
            <svg viewBox="0 0 200 80" className="w-full h-full" preserveAspectRatio="none">
              {/* Ideal */}
              <polyline
                points={BURNDOWN_IDEAL.map((v, i) => `${(i / (BURNDOWN_IDEAL.length - 1)) * 200},${(v / 40) * 75 + 2}`).join(' ')}
                fill="none" stroke={`${V}30`} strokeWidth="1.5" strokeDasharray="4 3"
              />
              {/* Actual */}
              <polyline
                points={BURNDOWN_ACTUAL.filter(v => v !== null).map((v, i) => `${(i / (BURNDOWN_IDEAL.length - 1)) * 200},${(v / 40) * 75 + 2}`).join(' ')}
                fill="none" stroke={V} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            <div className="absolute bottom-0 right-0 flex items-center gap-3 text-[7px] font-mono text-[#8A8F98]">
              <span className="flex items-center gap-1"><span style={{ background: V, width: 8, height: 2, display: 'inline-block', borderRadius: 2 }} />Actual</span>
              <span className="flex items-center gap-1"><span style={{ background: `${V}50`, width: 8, height: 2, display: 'inline-block', borderRadius: 2, borderStyle: 'dashed' }} />Ideal</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Feature section ─────────────────────────────────────────────────────────

const FEATURES = [
  {
    tag: 'Board',
    title: 'Kanban built for engineers',
    body: 'Epics, stories, tasks, bugs — all draggable across status columns. Group by assignee, priority, or epic. Set WIP limits. Clone issues in one click.',
    demo: <InteractiveKanban />,
    hint: 'Try dragging a card →',
  },
  {
    tag: 'Backlog',
    title: 'Sprint planning built in',
    body: 'Create sprints, set goals and dates, drag issues from the backlog. Start, track, and complete sprints without leaving the app.',
    demo: <InteractiveBacklog />,
    hint: 'Click a sprint to expand →',
  },
  {
    tag: 'Timeline',
    title: 'Roadmap at a glance',
    body: "Visualize your project on a Gantt chart. Zoom from months to quarters, spot scheduling conflicts, and see what's at risk — before it's too late.",
    demo: <InteractiveTimeline />,
    hint: 'Switch zoom levels →',
  },
  {
    tag: 'Reports',
    title: 'Sprint analytics that matter',
    body: 'Burndown charts, velocity graphs, team workload heatmap, and issue distribution — everything you need to run a tight retrospective.',
    demo: <InteractiveReport />,
    hint: 'Toggle chart type →',
  },
]

function FeatureCard({ feature, index }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: (index % 2) * 0.12 }}
      className="bg-white rounded-2xl border border-black/8 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="p-6">
        <span className="font-mono text-[10px] uppercase tracking-wider text-violet mb-2 block">{feature.tag}</span>
        <h3 className="text-base font-semibold text-ink mb-2">{feature.title}</h3>
        <p className="text-sm text-[#8A8F98] leading-relaxed mb-5">{feature.body}</p>
        <div className="bg-[#FAFAF7] rounded-xl p-3 border border-black/5">
          {feature.demo}
        </div>
        <p className="text-[9px] font-mono text-[#8A8F98]/70 mt-2 text-center">{feature.hint}</p>
      </div>
    </motion.div>
  )
}

// ─── Animated stat ─────────────────────────────────────────────────────────

function AnimatedStat({ value, suffix = '', label, icon }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return
    const target = parseInt(value)
    let start = 0
    const step = Math.ceil(target / 40)
    const timer = setInterval(() => {
      start = Math.min(start + step, target)
      setCount(start)
      if (start >= target) clearInterval(timer)
    }, 35)
    return () => clearInterval(timer)
  }, [inView, value])

  return (
    <div ref={ref} className="text-center">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <p className="text-3xl sm:text-4xl font-bold text-ink mb-1 tabular-nums">{count}{suffix}</p>
      <p className="text-sm text-[#8A8F98]">{label}</p>
    </div>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "We replaced Jira and three separate tools with Tasklane. The sprint board alone saved us two hours every standup.",
    author: 'Marcus Reyes',
    title: 'Engineering Lead · Vertix',
    color: '#6E56CF',
  },
  {
    quote: "The UI is the first project management tool our designers actually wanted to use. The timeline view is 🤌.",
    author: 'Anika Patel',
    title: 'Head of Product · Lumio',
    color: '#36D399',
  },
  {
    quote: "Set up in 15 minutes, migrated our entire backlog in an afternoon. Real-time updates across the whole team instantly.",
    author: 'Tom Fischer',
    title: 'CTO · NordStack',
    color: '#3B82F6',
  },
]

// ─── FAQ ───────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How is Tasklane different from Jira?',
    a: "Tasklane has the same core features — sprints, epics, backlogs, timelines, reports — but with a UI your team will actually enjoy using. Setup takes minutes, not an IT ticket. No configuration hell.",
  },
  {
    q: 'Can I import from Jira or Trello?',
    a: 'Import from Jira (via CSV export) is on the roadmap for Q3. Trello import is available now — export your board as JSON and we\'ll walk you through the import.',
  },
  {
    q: 'What does "per workspace" pricing mean?',
    a: 'You pay per workspace (your company or org), not per person. Invite your whole team on the Pro plan for $10/month — no per-seat surcharges.',
  },
  {
    q: 'Is there a self-hosted option?',
    a: "Not yet. Tasklane is currently cloud-only. Self-hosted Enterprise is on the roadmap — join the waitlist via the Contact form.",
  },
  {
    q: 'How does the Free plan work?',
    a: 'Free forever — 1 project, up to 3 team members, full Kanban board and sprint backlog. No time limit, no credit card required.',
  },
  {
    q: 'What support options are available?',
    a: 'Free plan: community forum. Pro: email support with a 48h SLA. Company: priority email and Slack Connect with 4h SLA during business hours.',
  },
]

function FaqItem({ q, a, index }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      viewport={{ once: true }}
      className="border-b border-black/8 last:border-0"
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className="text-sm font-medium text-ink group-hover:text-violet transition-colors">{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}
          className="text-[#8A8F98] text-xl leading-none shrink-0 group-hover:text-violet transition-colors"
        >+</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden text-sm text-[#8A8F98] leading-relaxed pb-4"
          >{a}</motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Contact form ─────────────────────────────────────────────────────────

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', type: 'general', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | done
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.name.trim())    e.name = 'Name is required'
    if (!form.email.includes('@')) e.email = 'Valid email required'
    if (!form.message.trim()) e.message = 'Message is required'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    setErrors({})
    setStatus('sending')
    setTimeout(() => setStatus('done'), 1400)
  }

  const field = 'w-full text-sm rounded-xl border border-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white placeholder:text-[#8A8F98]/60 transition-all'

  if (status === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center text-center py-12 gap-4"
      >
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-14 h-14 bg-sage/15 rounded-2xl flex items-center justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#36D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <h3 className="font-semibold text-ink text-lg">Message received!</h3>
        <p className="text-sm text-[#8A8F98] max-w-xs">We'll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
        <button onClick={() => { setStatus('idle'); setForm({ name: '', email: '', type: 'general', message: '' }) }}
          className="text-xs text-violet hover:opacity-70 mt-2 transition-opacity"
        >Send another message</button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Your name" className={`${field} ${errors.name ? 'border-red-400 ring-1 ring-red-400/30' : ''}`} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="you@company.com" className={`${field} ${errors.email ? 'border-red-400 ring-1 ring-red-400/30' : ''}`} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>
      </div>
      <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className={field}>
        <option value="general">General inquiry</option>
        <option value="sales">Sales / pricing</option>
        <option value="support">Technical support</option>
        <option value="enterprise">Enterprise / self-hosted</option>
        <option value="partnership">Partnership</option>
      </select>
      <div>
        <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          placeholder="Tell us what's on your mind…" rows={4}
          className={`${field} resize-none ${errors.message ? 'border-red-400 ring-1 ring-red-400/30' : ''}`} />
        {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="submit"
        disabled={status === 'sending'}
        className="w-full py-3 bg-ink text-white text-sm font-medium rounded-xl hover:bg-ink/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {status === 'sending' ? (
          <>
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
            />
            Sending…
          </>
        ) : 'Send message'}
      </motion.button>
    </form>
  )
}

// ─── Floating cursor glow ──────────────────────────────────────────────────

function CursorGlow() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 80, damping: 20 })
  const sy = useSpring(y, { stiffness: 80, damping: 20 })

  useEffect(() => {
    const move = (e) => { x.set(e.clientX); y.set(e.clientY) }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [x, y])

  return (
    <motion.div
      style={{ left: sx, top: sy, background: `radial-gradient(circle, ${V}40 0%, transparent 70%)` }}
      className="fixed pointer-events-none w-64 h-64 rounded-full -translate-x-1/2 -translate-y-1/2 z-0"
      animate={{ opacity: [0.04, 0.07, 0.04] }}
      transition={{ duration: 4, repeat: Infinity }}
    />
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [annual, setAnnual] = useState(false)
  const [activeNav, setActiveNav] = useState('')

  // Highlight nav on scroll
  useEffect(() => {
    const handler = () => {
      const sections = ['features', 'how-it-works', 'pricing', 'contact']
      for (const id of sections.reverse()) {
        const el = document.getElementById(id)
        if (el && window.scrollY >= el.offsetTop - 120) { setActiveNav(id); return }
      }
      setActiveNav('')
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const NAV_LINKS = [
    { href: '#features',      label: 'Features' },
    { href: '#how-it-works',  label: 'How it works' },
    { href: '#pricing',       label: 'Pricing' },
    { href: '#contact',       label: 'Contact' },
  ]

  return (
    <div className="bg-[#FAFAF7] text-[#0F1115] min-h-screen overflow-x-hidden relative">
      <CursorGlow />

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#FAFAF7]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#0F1115] rounded-md flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-[#6E56CF] rounded-sm" />
            </div>
            <span className="font-semibold text-base tracking-tight">Tasklane</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const id = href.slice(1)
              return (
                <a key={href} href={href}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${activeNav === id ? 'text-violet bg-violet/8 font-medium' : 'text-[#8A8F98] hover:text-[#0F1115] hover:bg-black/[0.04]'}`}
                >{label}</a>
              )
            })}
          </nav>
          <div className="hidden sm:flex items-center gap-2">
            <Link to="/login" className="text-sm text-[#8A8F98] hover:text-[#0F1115] transition-colors px-3 py-1.5 rounded-lg hover:bg-black/[0.04]">Log in</Link>
            <Link to="/signup" className="text-sm bg-[#0F1115] text-white rounded-full px-4 py-2 hover:bg-[#0F1115]/90 transition-colors font-medium">
              Get started free
            </Link>
          </div>
          <button className="sm:hidden text-[#8A8F98] p-1" onClick={() => setMobileOpen(v => !v)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d={mobileOpen ? 'M4 4l12 12M16 4L4 16' : 'M3 6h14M3 10h14M3 14h14'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="sm:hidden border-t border-black/5 bg-[#FAFAF7] overflow-hidden"
            >
              <div className="px-6 py-4 space-y-3">
                {NAV_LINKS.map(({ href, label }) => (
                  <a key={href} href={href} onClick={() => setMobileOpen(false)} className="block text-sm text-[#8A8F98]">{label}</a>
                ))}
                <Link to="/login" className="block text-sm text-[#8A8F98]">Log in</Link>
                <Link to="/signup" className="block text-center text-sm bg-[#6E56CF] text-white rounded-full px-4 py-2.5 font-medium">Get started free</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-20 relative">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#0F1115 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-14 relative"
        >
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 bg-[#6E56CF]/10 text-[#6E56CF] rounded-full px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider mb-6"
          >
            <span className="w-1.5 h-1.5 bg-[#6E56CF] rounded-full animate-pulse" />
            Jira features · delightful design
          </motion.div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
            The project tool your
            <br className="hidden sm:block" />
            <span className="text-[#6E56CF]"> team actually uses.</span>
          </h1>
          <p className="text-base sm:text-lg text-[#8A8F98] leading-relaxed max-w-xl mx-auto mb-8">
            Kanban boards, sprint backlogs, timelines, reports, team chat — every Jira workflow, with a UI your team will love. Up and running in 5 minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup"
              className="bg-[#6E56CF] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-[#6E56CF]/90 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5"
            >
              Start for free →
            </Link>
            <a href="#features" className="text-sm text-[#0F1115] border border-black/15 rounded-full px-6 py-3 hover:bg-black/[0.04] transition-colors">
              See all features
            </a>
          </div>
          <p className="text-xs text-[#8A8F98] mt-4">No credit card · 3 members free, forever · Set up in 5 min</p>
        </motion.div>

        {/* App window preview */}
        <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-3xl border border-black/8 shadow-2xl shadow-black/8 overflow-hidden"
        >
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-black/5 bg-[#F1EFE7]">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
            <div className="flex items-center gap-2 ml-4">
              <div className="w-4 h-4 bg-[#0F1115] rounded-sm flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-[#6E56CF] rounded-sm" />
              </div>
              <span className="text-xs text-[#8A8F98] font-mono">tasklane.app / projects / frontend-revamp / board</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-5 w-16 bg-black/5 rounded-lg" />
              <div className="h-5 w-5 bg-black/5 rounded-lg" />
            </div>
          </div>
          <div className="flex">
            {/* Mini sidebar */}
            <div className="w-44 border-r border-black/5 p-3 hidden sm:block shrink-0">
              <div className="flex items-center gap-2 px-2 py-1.5 mb-3">
                <div className="w-5 h-5 bg-violet/15 rounded flex items-center justify-center">
                  <span className="text-[7px] font-bold text-violet">FE</span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-ink">Frontend revamp</p>
                  <p className="text-[8px] text-slate-muted font-mono">Pro plan</p>
                </div>
              </div>
              <div className="mb-3">
                <p className="font-mono text-[8px] uppercase tracking-wider text-[#8A8F98] px-2 mb-1">Planning</p>
                {['Board', 'Backlog', 'Timeline'].map((item, i) => (
                  <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs mb-0.5 ${i === 0 ? 'bg-[#6E56CF]/10 text-[#6E56CF] font-medium' : 'text-[#8A8F98]'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    {item}
                  </div>
                ))}
              </div>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-wider text-[#8A8F98] px-2 mb-1">Collaborate</p>
                {['Chat', 'Activity'].map((item) => (
                  <div key={item} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[#8A8F98] mb-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            {/* Board content */}
            <div className="flex-1 p-4 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-ink">Sprint 12 · Active</span>
                <span className="font-mono text-[9px] bg-violet/10 text-violet px-2 py-0.5 rounded-full">8d left</span>
                <div className="flex-1 h-1.5 bg-[#F1EFE7] rounded-full overflow-hidden">
                  <div className="h-full bg-sage rounded-full" style={{ width: '62%' }} />
                </div>
                <span className="font-mono text-[9px] text-[#8A8F98]">62%</span>
              </div>
              <InteractiveKanban />
              <p className="text-[9px] text-center text-[#8A8F98]/60 font-mono mt-2">↑ Drag cards between columns</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Logo bar ──────────────────────────────────────────────────────── */}
      <section className="border-y border-black/5 py-8 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs text-[#8A8F98] font-mono uppercase tracking-widest mb-6">Used by engineering teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {['Vertix', 'NordStack', 'Lumio', 'Archway', 'Stackr', 'Pulsar', 'Meridian'].map((name) => (
              <span key={name} className="font-semibold text-[#0F1115]/25 text-sm tracking-tight hover:text-[#0F1115]/50 transition-colors cursor-default select-none">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="py-14">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <AnimatedStat value="18" suffix="+" label="Jira features built in" icon="⚡" />
          <AnimatedStat value="4"        label="Project views" icon="📐" />
          <AnimatedStat value="5"        label="Issue types" icon="🏷" />
          <AnimatedStat value="100" suffix="%" label="Real-time sync" icon="🔄" />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">Features</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Everything your team needs.</h2>
          <p className="text-sm sm:text-base text-[#8A8F98] max-w-lg mx-auto">
            From sprint planning to roadmaps and reports — all the tools that make Jira essential, redesigned to be enjoyable.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => <FeatureCard key={f.tag} feature={f} index={i} />)}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-[#F1EFE7]/50 border-y border-black/5 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Up and running in minutes.</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 relative">
            {/* Connector line */}
            <div className="absolute top-10 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent hidden sm:block" />
            {[
              {
                step: '01',
                title: 'Create your workspace',
                body: 'Sign up in 30 seconds. Create your org, invite your team, and set up your first project — no config wizard, no IT ticket.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="8" height="8" rx="2" fill={`${V}25`} stroke={V} strokeWidth="1.5" />
                    <rect x="13" y="3" width="8" height="8" rx="2" fill={`${V}15`} stroke={V} strokeWidth="1.5" />
                    <rect x="3" y="13" width="8" height="8" rx="2" fill={`${V}10`} stroke={V} strokeWidth="1.5" />
                    <path d="M17 13v8M13 17h8" stroke={V} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Plan your sprints',
                body: 'Create issues, organize the backlog, set sprint goals and dates. Drag issues into sprints. Hit Start Sprint and go.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="2" rx="1" fill={V} opacity="0.9" />
                    <rect x="3" y="9" width="14" height="2" rx="1" fill={V} opacity="0.6" />
                    <rect x="3" y="14" width="10" height="2" rx="1" fill={V} opacity="0.4" />
                    <path d="M18 13l3 3-3 3" stroke={SAGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Ship and iterate',
                body: 'Track progress on the board, spot blockers on the timeline, review velocity in reports, and plan the next sprint with real data.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M3 17l5-5 4 4 9-10" stroke={SAGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="20" cy="5" r="2" fill={SAGE} />
                  </svg>
                ),
              },
            ].map((step, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm relative"
              >
                <div className="w-12 h-12 bg-[#F1EFE7] rounded-2xl flex items-center justify-center mb-4">
                  {step.icon}
                </div>
                <span className="font-mono text-[10px] text-[#6E56CF] uppercase tracking-widest mb-2 block">{step.step}</span>
                <h3 className="font-semibold text-ink mb-2">{step.title}</h3>
                <p className="text-sm text-[#8A8F98] leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dark feature grid ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-[#0F1115] rounded-3xl p-8 sm:p-12 text-white">
          <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-2">And more</p>
              <h2 className="text-xl sm:text-2xl font-bold">Every workflow. One place.</h2>
            </div>
            <Link to="/signup" className="text-sm bg-[#6E56CF] text-white rounded-full px-5 py-2.5 hover:bg-[#6E56CF]/90 transition-colors font-medium shrink-0">
              Start building free →
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-x-8 gap-y-7">
            {[
              { icon: '⚡', title: 'Issue types', body: 'Epics, stories, tasks, bugs, and subtasks — each with the right fields and workflow.' },
              { icon: '🔗', title: 'Issue linking', body: 'Block, duplicate, relate, or clone issues across the project.' },
              { icon: '👁', title: 'Watchers', body: 'Subscribe to any issue and get notified on every update.' },
              { icon: '⏱', title: 'Time tracking', body: 'Log time against issues and compare estimates to actuals.' },
              { icon: '💬', title: 'Team chat', body: 'Per-project messaging so conversations live next to the work.' },
              { icon: '🔔', title: 'Smart notifications', body: '@mention teammates, get assigned, comment — stay in the loop.' },
              { icon: '🏷', title: 'Labels & components', body: 'Organize issues with flexible labels and reusable components.' },
              { icon: '📁', title: 'File attachments', body: 'Attach designs, screenshots, and specs to any issue. In context.' },
              { icon: '⌘', title: 'Global search', body: 'Cmd+K search across all issues instantly, from anywhere in the app.' },
              { icon: '🚀', title: 'Releases', body: 'Track fix versions, release progress, and ship notes per release.' },
              { icon: '🎯', title: 'WIP limits', body: 'Set max issues per column. Stay focused, avoid context switching.' },
              { icon: '📊', title: 'Velocity charts', body: 'See sprint-over-sprint velocity and burndown at a glance.' },
            ].map((item) => (
              <motion.div key={item.title}
                whileHover={{ x: 2 }}
                className="flex items-start gap-3"
              >
                <span className="text-lg mt-0.5 shrink-0">{item.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-white mb-0.5">{item.title}</p>
                  <p className="text-xs text-white/45 leading-relaxed">{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Real-time section ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-2 gap-10 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">Real-time</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Built for teams<br className="hidden sm:block" /> who move fast.</h2>
            <p className="text-sm sm:text-base text-[#8A8F98] leading-relaxed mb-6">
              Every change — moving a card, adding a comment, starting a sprint — is pushed to everyone instantly. No page reloads. No "did you see my update?" Slack messages.
            </p>
            <ul className="space-y-3">
              {[
                'Drag-and-drop board with live updates',
                'Real-time sprint burndown tracking',
                'Instant @mention notifications',
                'Live team chat alongside your board',
                'Activity feed updates without refresh',
              ].map((item, i) => (
                <motion.li key={item}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-2.5 text-sm text-ink"
                >
                  <div className="w-4 h-4 rounded-full bg-violet/10 flex items-center justify-center shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2.5 2.5L7 1.5" stroke={V} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
          {/* Animated activity feed */}
          <LiveActivityFeed />
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="border-t border-black/5 bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">Testimonials</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Teams love Tasklane.</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -3 }}
                className="bg-[#FAFAF7] rounded-2xl p-6 border border-black/5 shadow-sm cursor-default"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="12" height="12" viewBox="0 0 12 12" fill="#F59E0B"><path d="M6 1l1.2 3.7H11L8.1 6.9l1 3.6L6 8.7 2.9 10.5l1-3.6L1 4.7h3.8z" /></svg>
                  ))}
                </div>
                <p className="text-sm text-[#0F1115] leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: t.color }}>
                    {t.author[0]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink">{t.author}</p>
                    <p className="text-[10px] text-[#8A8F98]">{t.title}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-black/5 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">Pricing</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Simple, honest pricing.</h2>
            <p className="text-sm text-[#8A8F98] mb-6">Per workspace. Not per seat. Scale your team, not your bill.</p>
            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 bg-[#F1EFE7] rounded-full p-1">
              <button onClick={() => setAnnual(false)}
                className={`text-xs px-4 py-2 rounded-full transition-all ${!annual ? 'bg-white text-ink font-medium shadow-sm' : 'text-[#8A8F98]'}`}
              >Monthly</button>
              <button onClick={() => setAnnual(true)}
                className={`text-xs px-4 py-2 rounded-full transition-all flex items-center gap-1.5 ${annual ? 'bg-white text-ink font-medium shadow-sm' : 'text-[#8A8F98]'}`}
              >
                Annual
                <span className="bg-sage/20 text-sage font-mono text-[9px] px-1.5 py-0.5 rounded-full">–20%</span>
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              {
                name: 'Free', price: 0, annualPrice: 0, sub: 'Forever, no card needed',
                color: MUTED, cta: 'Start free', ctaClass: 'border border-black/10 hover:bg-black/[0.03]',
                features: ['1 project', '3 team members', 'Kanban board', 'Sprint backlog', 'Activity feed'],
                check: '#36D399',
              },
              {
                name: 'Pro', price: 10, annualPrice: 8, sub: 'Per workspace · billed monthly',
                color: V, cta: 'Start with Pro', ctaClass: 'bg-[#6E56CF] text-white hover:bg-[#6E56CF]/90', popular: true,
                features: ['5 projects', '10 members per project', 'Timeline & Reports', 'Sprint management', 'Team chat', 'Releases', 'Keyboard shortcuts'],
                check: V,
              },
              {
                name: 'Company', price: 29, annualPrice: 23, sub: 'Per workspace · everything',
                color: SAGE, cta: 'Start with Company', ctaClass: 'border border-black/10 hover:bg-black/[0.03]',
                features: ['Unlimited projects', 'Unlimited members', 'File uploads', 'Priority support', 'Everything in Pro'],
                check: SAGE,
              },
            ].map((plan) => (
              <motion.div key={plan.name}
                whileHover={{ y: -3 }}
                className={`rounded-2xl p-6 bg-white relative transition-shadow ${plan.popular ? 'border-2 border-[#6E56CF] shadow-lg shadow-violet-500/10' : 'border border-black/10 shadow-sm hover:shadow-md'}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-6 bg-[#6E56CF] text-white text-[10px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full">Most popular</span>
                )}
                <p className="font-medium text-[#8A8F98] mb-1">{plan.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <AnimatePresence mode="wait">
                    <motion.p key={annual ? 'a' : 'm'} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="text-3xl font-bold"
                    >
                      ${annual ? plan.annualPrice : plan.price}
                    </motion.p>
                  </AnimatePresence>
                  {plan.price > 0 && <span className="text-sm text-[#8A8F98] mb-1">/mo</span>}
                </div>
                <p className="text-xs text-[#8A8F98] mb-5">{plan.sub}</p>
                <ul className="text-sm text-[#8A8F98] space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke={plan.check} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center text-sm rounded-full py-2.5 transition-colors font-medium ${plan.ctaClass}`}>
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-[#8A8F98] mt-6">All plans include 14-day free trial of Pro features. No credit card required.</p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-black/5 py-20">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Common questions.</h2>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm px-6 py-2">
            {FAQS.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────── */}
      <section id="contact" className="border-t border-black/5 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 gap-12 items-start">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">Contact</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Get in touch.</h2>
              <p className="text-[#8A8F98] text-sm leading-relaxed mb-8">
                Questions about pricing, enterprise features, or a custom integration? We respond to every message within 24 hours.
              </p>
              <div className="space-y-5">
                {[
                  { icon: '✉️', label: 'Email us', value: 'hello@tasklane.app' },
                  { icon: '🕐', label: 'Response time', value: 'Within 24 hours' },
                  { icon: '💼', label: 'Enterprise', value: 'Custom plans available' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wide text-[#8A8F98]">{item.label}</p>
                      <p className="text-sm text-ink font-medium">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-black/8 p-6 shadow-sm">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center bg-[#0F1115] rounded-3xl px-8 py-16 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ backgroundImage: `radial-gradient(${V} 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
          <div className="relative">
            <p className="font-mono text-xs uppercase tracking-wider text-[#6E56CF] mb-3">Get started</p>
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">Ship more. Stress less.</h2>
            <p className="text-sm text-white/50 mb-8 max-w-md mx-auto">
              Join engineering teams who replaced spreadsheets and over-engineered tools with something that just works.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup"
                className="inline-block bg-[#6E56CF] text-white rounded-full px-8 py-3 text-sm font-medium hover:bg-[#6E56CF]/90 transition-all hover:-translate-y-0.5 shadow-lg shadow-violet-500/30"
              >
                Start building for free →
              </Link>
              <a href="#contact"
                className="inline-block border border-white/20 text-white/80 rounded-full px-8 py-3 text-sm hover:bg-white/10 transition-colors"
              >
                Talk to us
              </a>
            </div>
            <p className="text-xs text-white/30 mt-5">No credit card · 3 members free forever · Cancel any time</p>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 bg-white py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid sm:grid-cols-5 gap-10 mb-12">
            {/* Brand */}
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-[#0F1115] rounded-md flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-[#6E56CF] rounded-sm" />
                </div>
                <span className="font-semibold">Tasklane</span>
              </div>
              <p className="text-xs text-[#8A8F98] leading-relaxed max-w-xs">
                Project management built for modern engineering teams. Jira-powerful. Notion-beautiful.
              </p>
              <div className="flex gap-3 mt-5">
                {['Twitter', 'GitHub', 'LinkedIn'].map((s) => (
                  <a key={s} href="#" className="text-[10px] text-[#8A8F98] hover:text-ink transition-colors">{s}</a>
                ))}
              </div>
            </div>
            {/* Links */}
            {[
              {
                title: 'Product',
                links: ['Features', 'Pricing', 'Changelog', 'Roadmap', 'Status'],
              },
              {
                title: 'Compare',
                links: ['vs Jira', 'vs Linear', 'vs Asana', 'vs Trello', 'vs Notion'],
              },
              {
                title: 'Company',
                links: ['About', 'Blog', 'Careers', 'Press', 'Contact'],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98] mb-3">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-xs text-[#8A8F98] hover:text-ink transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-black/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#8A8F98]">© {new Date().getFullYear()} Tasklane. All rights reserved.</span>
            <div className="flex gap-4">
              {['Privacy policy', 'Terms of service', 'Cookie settings'].map((l) => (
                <a key={l} href="#" className="text-xs text-[#8A8F98] hover:text-ink transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Live activity feed (extracted for clarity) ────────────────────────────

function LiveActivityFeed() {
  const ACTIVITIES = [
    { user: 'Priya',  action: 'moved "Fix auth bug" to In Review',    time: '2s ago',  color: V },
    { user: 'Daniel', action: 'started Sprint 12',                     time: '1m ago',  color: SAGE },
    { user: 'Sara',   action: 'commented on "Dashboard redesign"',     time: '4m ago',  color: '#F59E0B' },
    { user: 'Alex',   action: 'assigned "API v3" to themselves',       time: '9m ago',  color: '#3B82F6' },
    { user: 'Mia',    action: 'logged 2h on "Mobile sync"',            time: '12m ago', color: '#8B5CF6' },
    { user: 'James',  action: 'created epic "Q4 Redesign"',            time: '18m ago', color: '#EF4444' },
  ]

  const [highlighted, setHighlighted] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setHighlighted(i => (i + 1) % ACTIVITIES.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-black/8 p-5 shadow-sm space-y-2.5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A8F98]">Live activity</p>
      </div>
      {ACTIVITIES.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          viewport={{ once: true }}
          animate={{ backgroundColor: highlighted === i ? '#6E56CF08' : '#ffffff' }}
          className="flex items-start gap-3 rounded-xl px-2 py-1.5 transition-colors"
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5"
            style={{ backgroundColor: item.color }}>
            {item.user[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink">
              <span className="font-semibold">{item.user}</span>{' '}
              <span className="text-[#8A8F98]">{item.action}</span>
            </p>
            <p className="font-mono text-[9px] text-[#8A8F98] mt-0.5">{item.time}</p>
          </div>
          {highlighted === i && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-1.5 h-1.5 rounded-full bg-sage mt-1.5 shrink-0" />
          )}
        </motion.div>
      ))}
    </div>
  )
}
