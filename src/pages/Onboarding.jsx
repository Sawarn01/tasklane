import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'

// ── Illustrations ─────────────────────────────────────────────────────────────

function WelcomeIllustration() {
  return (
    <svg viewBox="0 0 360 280" fill="none" className="w-full h-full">
      {/* Background circles */}
      <motion.circle cx="180" cy="140" r="110" fill="#6E56CF" fillOpacity="0.06"
        animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.circle cx="180" cy="140" r="78" fill="#6E56CF" fillOpacity="0.08"
        animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }} />

      {/* Central T logo */}
      <motion.rect x="156" y="104" width="48" height="8" rx="4" fill="#6E56CF"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2, duration: 0.5, ease: [0.16,1,0.3,1] }} />
      <motion.rect x="176" y="108" width="8" height="52" rx="4" fill="#6E56CF"
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.4, duration: 0.5, ease: [0.16,1,0.3,1] }} style={{ transformOrigin: '180px 108px' }} />

      {/* Orbiting dots */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        const x = 180 + 96 * Math.cos(rad)
        const y = 140 + 96 * Math.sin(rad)
        const colors = ['#6E56CF', '#36D399', '#F59E0B', '#6E56CF', '#36D399', '#EF4444']
        return (
          <motion.circle key={i} cx={x} cy={y} r={i % 2 === 0 ? 6 : 4}
            fill={colors[i]} fillOpacity={0.7}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            transition={{ delay: 0.5 + i * 0.08, duration: 0.4, ease: [0.16,1,0.3,1] }}
          />
        )
      })}

      {/* Sparkle lines */}
      {[[60, 60], [300, 60], [60, 220], [300, 220]].map(([x, y], i) => (
        <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 0.4, scale: 1 }}
          transition={{ delay: 0.8 + i * 0.1 }} style={{ transformOrigin: `${x}px ${y}px` }}>
          <line x1={x} y1={y - 8} x2={x} y2={y + 8} stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={x - 8} y1={y} x2={x + 8} y2={y} stroke="#6E56CF" strokeWidth="1.5" strokeLinecap="round" />
        </motion.g>
      ))}

      {/* Confetti */}
      {[
        [90, 80, '#36D399'], [260, 70, '#F59E0B'], [310, 150, '#6E56CF'],
        [70, 190, '#EF4444'], [290, 200, '#36D399'], [130, 230, '#6E56CF'],
      ].map(([x, y, color], i) => (
        <motion.rect key={i} x={x} y={y} width="8" height="8" rx="2" fill={color} fillOpacity="0.6"
          initial={{ opacity: 0, y: -10, rotate: 0 }} animate={{ opacity: 0.6, y: 0, rotate: 45 }}
          transition={{ delay: 0.6 + i * 0.1, duration: 0.5, ease: [0.16,1,0.3,1] }} />
      ))}
    </svg>
  )
}

function BoardIllustration() {
  const cols = [
    { label: 'To Do', color: '#8A8F98', cards: ['User auth flow', 'API design', 'DB schema'] },
    { label: 'In Progress', color: '#6E56CF', cards: ['Dashboard UI', 'Sprint board'] },
    { label: 'Done', color: '#36D399', cards: ['Project setup', 'CI pipeline'] },
  ]
  return (
    <svg viewBox="0 0 360 280" fill="none" className="w-full h-full">
      {cols.map((col, ci) => {
        const x = 20 + ci * 115
        return (
          <motion.g key={ci} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + ci * 0.12, duration: 0.5, ease: [0.16,1,0.3,1] }}>
            {/* Column header */}
            <rect x={x} y={24} width={105} height={20} rx="6" fill={col.color} fillOpacity="0.12" />
            <circle cx={x + 12} cy={34} r={4} fill={col.color} />
            <rect x={x + 22} y={29} width={55} height={10} rx="3" fill={col.color} fillOpacity="0.5" />
            <rect x={x + 85} y={29} width={14} height={10} rx="3" fill={col.color} fillOpacity="0.3" />

            {/* Cards */}
            {col.cards.map((card, ki) => (
              <motion.g key={ki} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + ci * 0.12 + ki * 0.08, duration: 0.4, ease: [0.16,1,0.3,1] }}>
                <rect x={x} y={52 + ki * 56} width={105} height={48} rx="8"
                  fill="white" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
                {/* Priority stripe */}
                <rect x={x} y={52 + ki * 56} width={3} height={48} rx="2"
                  fill={col.color} fillOpacity="0.7" />
                {/* Title line */}
                <rect x={x + 12} y={64 + ki * 56} width={70} height={7} rx="3.5"
                  fill="#0F1115" fillOpacity="0.7" />
                {/* Meta row */}
                <rect x={x + 12} y={76 + ki * 56} width={40} height={5} rx="2.5"
                  fill="#8A8F98" fillOpacity="0.4" />
                {/* Avatar */}
                <circle cx={x + 90} cy={80 + ki * 56} r={7}
                  fill={col.color} fillOpacity="0.3" />
                <circle cx={x + 90} cy={80 + ki * 56} r={7}
                  stroke={col.color} strokeWidth="1" fillOpacity="0" />
              </motion.g>
            ))}
          </motion.g>
        )
      })}

      {/* Animated moving card */}
      <motion.rect x={135} y={164} width={105} height={48} rx="8"
        fill="#6E56CF" fillOpacity="0.08" stroke="#6E56CF" strokeWidth="1.5" strokeDasharray="4 3"
        animate={{ x: [135, 250, 135] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
    </svg>
  )
}

function TaskIllustration() {
  return (
    <svg viewBox="0 0 360 280" fill="none" className="w-full h-full">
      {/* Main task card */}
      <motion.rect x={40} y={20} width={280} height={240} rx="16"
        fill="white" stroke="rgba(0,0,0,0.07)" strokeWidth="1"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }} />

      {/* Header */}
      <motion.rect x={40} y={20} width={280} height={44} rx="16" fill="#6E56CF" fillOpacity="0.06"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} />
      <motion.rect x={40} y={50} width={280} height={14} rx="0" fill="#6E56CF" fillOpacity="0.06"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} />

      {/* Issue type badge */}
      <motion.rect x={56} y={32} width={36} height={16} rx="5" fill="#6E56CF" fillOpacity="0.15"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2, duration: 0.3 }}
        style={{ transformOrigin: '56px 40px' }} />
      <motion.rect x={60} y={37} width={28} height={6} rx="3" fill="#6E56CF" fillOpacity="0.6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} />

      {/* Priority chip */}
      <motion.rect x={100} y={32} width={44} height={16} rx="5" fill="#F59E0B" fillOpacity="0.12"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.25, duration: 0.3 }}
        style={{ transformOrigin: '100px 40px' }} />
      <motion.rect x={104} y={37} width={36} height={6} rx="3" fill="#F59E0B" fillOpacity="0.7"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} />

      {/* Title */}
      <motion.rect x={56} y={72} width={200} height={11} rx="5.5" fill="#0F1115" fillOpacity="0.75"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
        style={{ transformOrigin: '56px 77px' }} />
      <motion.rect x={56} y={90} width={140} height={8} rx="4" fill="#0F1115" fillOpacity="0.3"
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4, duration: 0.4 }}
        style={{ transformOrigin: '56px 94px' }} />

      {/* Fields */}
      {[
        { label: 'Assignee', y: 120, val: 56, valW: 60, hasAvatar: true },
        { label: 'Due date', y: 148, val: 56, valW: 72 },
        { label: 'Story pts', y: 176, val: 56, valW: 24 },
        { label: 'Sprint',    y: 204, val: 56, valW: 80 },
      ].map(({ label, y, val, valW, hasAvatar }, i) => (
        <motion.g key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 + i * 0.07, duration: 0.3 }}>
          <rect x={56} y={y} width={52} height={7} rx="3.5" fill="#8A8F98" fillOpacity="0.35" />
          {hasAvatar && <circle cx={val + 120} cy={y + 3.5} r={7} fill="#6E56CF" fillOpacity="0.2" />}
          <rect x={val + (hasAvatar ? 132 : 118)} y={y} width={valW} height={7} rx="3.5"
            fill="#0F1115" fillOpacity="0.5" />
        </motion.g>
      ))}

      {/* Subtasks */}
      <motion.rect x={56} y={228} width={50} height={6} rx="3" fill="#8A8F98" fillOpacity="0.4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.82 }} />
      {[0, 1].map(i => (
        <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.88 + i * 0.06 }}>
          <circle cx={64} cy={248 - i * 0} r={4} stroke="#36D399" strokeWidth="1.3" fill={i === 0 ? '#36D399' : 'none'} cy={248} />
          <rect x={74} y={244} width={80 - i * 20} height={6} rx="3" fill="#0F1115" fillOpacity="0.4" />
        </motion.g>
      ))}
    </svg>
  )
}

function CollaborateIllustration() {
  return (
    <svg viewBox="0 0 360 280" fill="none" className="w-full h-full">
      {/* 2x2 video grid */}
      {[[30, 20], [195, 20], [30, 155], [195, 155]].map(([x, y], i) => {
        const colors = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444']
        const names  = ['Alex', 'Sam', 'Jordan', 'Riley']
        const speaking = i === 0
        return (
          <motion.g key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.5, ease: [0.16,1,0.3,1] }}>
            <rect x={x} y={y} width={155} height={120} rx="12"
              fill="#1a1c2e" stroke={speaking ? '#6E56CF' : 'rgba(255,255,255,0.06)'} strokeWidth={speaking ? 2 : 1} />

            {/* Avatar */}
            <circle cx={x + 77} cy={y + 52} r={28} fill={colors[i]} fillOpacity="0.2" />
            <rect x={x + 63} y={y + 42} width={28} height={9} rx="4" fill={colors[i]} fillOpacity="0.6" />

            {/* Name bar */}
            <rect x={x + 8} y={y + 98} width={139} height={14} rx="4"
              fill="rgba(0,0,0,0.5)" />
            {speaking && <circle cx={x + 17} cy={y + 105} r={3.5} fill="#36D399" />}
            <rect x={x + (speaking ? 26 : 16)} y={y + 101} width={36} height={6} rx="3"
              fill="white" fillOpacity="0.7" />
          </motion.g>
        )
      })}

      {/* Chat bubble */}
      <motion.g initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <rect x={235} y={192} width={110} height={70} rx="12"
          fill="white" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
        <rect x={245} y={206} width={90} height={7} rx="3.5" fill="#6E56CF" fillOpacity="0.7" />
        <rect x={245} y={219} width={70} height={7} rx="3.5" fill="#0F1115" fillOpacity="0.25" />
        <rect x={245} y={232} width={50} height={7} rx="3.5" fill="#0F1115" fillOpacity="0.15" />
        {/* Send button */}
        <rect x={290} y={245} width={40} height={14} rx="7" fill="#6E56CF" />
        <path d="M300 252l6 0M303 249l3 3-3 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>

      {/* Pulse emoji */}
      <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: 'spring', damping: 12, stiffness: 200 }}>
        <rect x={30} y={192} width={95} height={70} rx="12"
          fill="white" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
        <rect x={40} y={204} width={55} height={7} rx="3.5" fill="#8A8F98" fillOpacity="0.5" />
        <text x={40} y={236} fontSize="22" fontFamily="sans-serif">🚀</text>
        <text x={68} y={236} fontSize="22" fontFamily="sans-serif" opacity="0.4">😐</text>
        <text x={96} y={236} fontSize="22" fontFamily="sans-serif" opacity="0.25">😕</text>
      </motion.g>
    </svg>
  )
}

function SmartToolsIllustration() {
  const C = 2 * Math.PI * 36
  return (
    <svg viewBox="0 0 360 280" fill="none" className="w-full h-full">
      {/* Focus Mode timer */}
      <motion.g initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <rect x={16} y={20} width={160} height={130} rx="16"
          fill="#0F1115" />
        <text x={96} y={52} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="rgba(255,255,255,0.3)" letterSpacing="1">FOCUSING ON</text>
        <rect x={36} y={58} width={120} height={7} rx="3.5" fill="rgba(255,255,255,0.15)" />

        {/* Ring */}
        <circle cx={96} cy={105} r={36} stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <motion.circle cx={96} cy={105} r={36} stroke="#6E56CF" strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          animate={{ strokeDashoffset: [C * 0.15, C * 0.65, C * 0.15] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          transform="rotate(-90 96 105)" />
        <text x={96} y={109} textAnchor="middle" fontSize="13" fontFamily="monospace" fontWeight="700" fill="white">24:13</text>
        <text x={96} y={122} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="rgba(255,255,255,0.3)" letterSpacing="1">FOCUSING</text>
      </motion.g>

      {/* Sprint Health card */}
      <motion.g initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <rect x={186} y={20} width={160} height={130} rx="16"
          fill="white" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
        <rect x={200} y={34} width={72} height={7} rx="3.5" fill="#0F1115" fillOpacity="0.6" />
        <rect x={280} y={30} width={52} height={16} rx="5" fill="#36D399" fillOpacity="0.12" />
        <rect x={284} y={35} width={44} height={6} rx="3" fill="#36D399" fillOpacity="0.8" />

        {/* Score ring */}
        <circle cx={220} cy={96} r={28} stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
        <motion.circle cx={220} cy={96} r={28} stroke="#36D399" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 28}`}
          animate={{ strokeDashoffset: [`${2*Math.PI*28*0.2}`, `${2*Math.PI*28*0.15}`, `${2*Math.PI*28*0.2}`] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          transform="rotate(-90 220 96)" />
        <text x={220} y={100} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0F1115">87</text>

        {/* Mini sparkline */}
        <polyline points="264,118 276,108 288,112 300,100 312,104 324,92 336,96"
          stroke="#6E56CF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {[264, 276, 288, 300, 312, 324, 336].map((x, i) => {
          const ys = [118, 108, 112, 100, 104, 92, 96]
          return <circle key={i} cx={x} cy={ys[i]} r="2.5" fill="#6E56CF" />
        })}
      </motion.g>

      {/* Standup Generator */}
      <motion.g initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <rect x={16} y={162} width={330} height={100} rx="16"
          fill="white" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
        <rect x={30} y={176} width={70} height={7} rx="3.5" fill="#0F1115" fillOpacity="0.6" />
        <rect x={288} y={172} width={44} height={16} rx="5" fill="#6E56CF" fillOpacity="0.1" />
        <rect x={292} y={177} width={36} height={6} rx="3" fill="#6E56CF" fillOpacity="0.7" />

        {['✅ Done: Shipped auth redesign', '🔄 Today: Sprint review prep', '✓ No blockers'].map((line, i) => (
          <motion.g key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.1 }}>
            <rect x={30} y={196 + i * 20} width={[190, 170, 110][i]} height={7} rx="3.5"
              fill={i === 0 ? '#36D399' : i === 1 ? '#6E56CF' : '#8A8F98'}
              fillOpacity={[0.5, 0.4, 0.3][i]} />
          </motion.g>
        ))}
      </motion.g>
    </svg>
  )
}

function ReadyIllustration() {
  return (
    <svg viewBox="0 0 360 280" fill="none" className="w-full h-full">
      {/* Background ring */}
      <motion.circle cx="180" cy="130" r="100" stroke="#6E56CF" strokeWidth="1" strokeOpacity="0.1"
        strokeDasharray="8 6"
        animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '180px 130px' }} />
      <motion.circle cx="180" cy="130" r="72" stroke="#36D399" strokeWidth="1" strokeOpacity="0.1"
        strokeDasharray="6 8"
        animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '180px 130px' }} />

      {/* Checkmark circle */}
      <motion.circle cx="180" cy="130" r="52" fill="#36D399" fillOpacity="0.1"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', damping: 14, stiffness: 180 }} />
      <motion.circle cx="180" cy="130" r="52" stroke="#36D399" strokeWidth="2"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', damping: 14, stiffness: 180 }} />

      {/* Checkmark */}
      <motion.path d="M158 130l14 14 28-28" stroke="#36D399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.16,1,0.3,1] }} />

      {/* Feature chips floating around */}
      {[
        { x: 60,  y: 50,  label: 'Boards',    color: '#6E56CF', delay: 0.7 },
        { x: 240, y: 45,  label: 'Meetings',  color: '#F59E0B', delay: 0.8 },
        { x: 32,  y: 175, label: 'Focus Mode',color: '#EF4444', delay: 0.9 },
        { x: 252, y: 185, label: 'Chat',       color: '#36D399', delay: 1.0 },
        { x: 115, y: 230, label: 'Sprints',   color: '#6E56CF', delay: 1.1 },
        { x: 220, y: 235, label: 'Analytics', color: '#8B5CF6', delay: 1.2 },
      ].map(({ x, y, label, color, delay }, i) => (
        <motion.g key={i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay, type: 'spring', damping: 14, stiffness: 200 }}>
          <rect x={x - 4} y={y - 4} width={label.length * 6.5 + 8} height={20} rx="10"
            fill={color} fillOpacity="0.12" stroke={color} strokeOpacity="0.3" strokeWidth="1" />
          <text x={x} y={y + 8} fontSize="9" fontFamily="sans-serif" fill={color} fontWeight="600">{label}</text>
        </motion.g>
      ))}
    </svg>
  )
}

// ── Step data ─────────────────────────────────────────────────────────────────
function buildSteps(name, mode) {
  const first = name?.split(' ')[0] || 'there'
  return [
    {
      eyebrow: "You're in!",
      title: `Welcome to Tasklane, ${first}! 🎉`,
      body: mode === 'join'
        ? "You've joined your team's workspace. Let's take 60 seconds to show you around."
        : "Your workspace is ready. Let's take 60 seconds to show you what Tasklane can do.",
      illustration: WelcomeIllustration,
      features: [],
    },
    {
      eyebrow: 'Plan & ship',
      title: 'Visualise work with Boards & Sprints',
      body: 'Drag tasks through a Kanban board, plan sprints from the Backlog, and track timelines — all in one place.',
      illustration: BoardIllustration,
      features: [
        { icon: '⬛', label: 'Kanban Board', desc: 'Drag-and-drop across status columns' },
        { icon: '🏃', label: 'Sprint Planning', desc: 'Time-box work with start & end dates' },
        { icon: '📋', label: 'Backlog', desc: 'Prioritise and groom unprioritised work' },
        { icon: '📅', label: 'Timeline', desc: 'Gantt-style roadmap for your project' },
      ],
    },
    {
      eyebrow: 'Track everything',
      title: 'Rich issues with full context',
      body: 'Every task holds everything your team needs — type, priority, story points, assignees, subtasks, attachments, and a full activity history.',
      illustration: TaskIllustration,
      features: [
        { icon: '⚡', label: 'Issue Types', desc: 'Epic, Story, Task, Bug, Subtask' },
        { icon: '🎯', label: 'Priority & Points', desc: 'Signal urgency and estimate effort' },
        { icon: '⏱️', label: 'Time Logging', desc: 'Log hours directly on any task' },
        { icon: '🔗', label: 'Task Breakdown', desc: 'Split any task into subtasks instantly' },
      ],
    },
    {
      eyebrow: 'Work together',
      title: 'Built-in collaboration tools',
      body: "Chat, meet, and check in — all without leaving the platform. No more switching between ten different apps.",
      illustration: CollaborateIllustration,
      features: [
        { icon: '📹', label: 'Video Rooms', desc: 'Built-in WebRTC video calls, no plugins' },
        { icon: '💬', label: 'Project Chat', desc: 'Real-time messaging per project' },
        { icon: '📝', label: 'Meeting Notes', desc: 'Agenda, decisions, and action items' },
        { icon: '💛', label: 'Team Pulse', desc: 'Anonymous daily mood check-in' },
      ],
    },
    {
      eyebrow: 'Work smarter',
      title: 'Unique tools you won\'t find elsewhere',
      body: 'Tasklane ships features no other PM tool offers — built for the real needs of engineering teams.',
      illustration: SmartToolsIllustration,
      features: [
        { icon: '🎯', label: 'Focus Mode', desc: 'Pomodoro timer that auto-logs time' },
        { icon: '📢', label: 'Standup Generator', desc: 'One-click daily standup from activity' },
        { icon: '📊', label: 'Sprint Health Score', desc: 'Predicts if you\'ll finish on time' },
        { icon: '⌨️', label: 'Quick Breakdown', desc: 'Bulk-create subtasks keyboard-first' },
      ],
    },
    {
      eyebrow: "You're all set",
      title: "Let's build something great",
      body: "Everything is ready. Explore your workspace, invite your team, and start shipping.",
      illustration: ReadyIllustration,
      features: [],
      isFinal: true,
    },
  ]
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'create' // 'create' | 'join'

  const [step, setStep]   = useState(0)
  const [dir,  setDir]    = useState(1)   // 1 = forward, -1 = backward

  // Resolve display name
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const steps = buildSteps(name, mode)
  const current = steps[step]
  const Illustration = current.illustration

  // Already onboarded → skip
  useEffect(() => {
    if (user && localStorage.getItem(`tl_ob_${user.id}`)) navigate('/dashboard', { replace: true })
  }, [user])

  function complete() {
    if (user) localStorage.setItem(`tl_ob_${user.id}`, '1')
    navigate('/dashboard', { replace: true })
  }

  function go(n) {
    setDir(n > step ? 1 : -1)
    setStep(n)
  }

  function next() { step < steps.length - 1 ? go(step + 1) : complete() }
  function back() { if (step > 0) go(step - 1) }

  const slideVariants = {
    enter:  d => ({ x: d > 0 ? 60  : -60,  opacity: 0 }),
    center: ()  => ({ x: 0, opacity: 1 }),
    exit:   d => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  }

  const progress = ((step) / (steps.length - 1)) * 100

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-8 overflow-hidden">

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet" />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-violet" />
      </div>

      {/* Logo + skip */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-ink rounded-xl flex items-center justify-center">
            <div className="w-3 h-3 bg-violet rounded-sm" />
          </div>
          <span className="font-bold text-ink text-sm tracking-tight">Tasklane</span>
        </div>
        <button onClick={complete}
          className="text-xs text-slate-muted hover:text-ink transition-colors font-medium">
          Skip tour →
        </button>
      </div>

      {/* Card */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-black/5 overflow-hidden relative z-10"
        style={{ minHeight: 520 }}>

        {/* Progress bar */}
        <div className="h-1 bg-paper-dim">
          <motion.div className="h-full bg-violet rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }} />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-0">
          {steps.map((_, i) => (
            <motion.button key={i} onClick={() => go(i)}
              className={`rounded-full transition-all ${i === step ? 'w-5 h-2 bg-violet' : 'w-2 h-2 bg-black/10 hover:bg-black/20'}`}
              animate={{ width: i === step ? 20 : 8, backgroundColor: i === step ? '#6E56CF' : i < step ? '#36D399' : 'rgba(0,0,0,0.1)' }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-2 gap-0 min-h-[460px]">

          {/* Left — text */}
          <div className="flex flex-col justify-center px-10 py-8">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={step}
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}
              >
                {/* Eyebrow */}
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="font-mono text-[10px] uppercase tracking-widest text-violet mb-3"
                >
                  {current.eyebrow}
                </motion.p>

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="font-bold text-ink text-2xl leading-tight mb-3"
                >
                  {current.title}
                </motion.h1>

                {/* Body */}
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-slate-muted text-sm leading-relaxed mb-6"
                >
                  {current.body}
                </motion.p>

                {/* Features */}
                {current.features?.length > 0 && (
                  <div className="space-y-2.5">
                    {current.features.map((f, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.07, duration: 0.35, ease: [0.16,1,0.3,1] }}
                        className="flex items-start gap-3"
                      >
                        <span className="text-base shrink-0 mt-0.5">{f.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-ink leading-none mb-0.5">{f.label}</p>
                          <p className="text-[11px] text-slate-muted leading-snug">{f.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Final step quick actions */}
                {current.isFinal && (
                  <motion.div className="grid grid-cols-2 gap-2.5 mt-2"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                    {[
                      { label: '📋 Open your board', desc: 'See your first project' },
                      { label: '👥 Invite teammates', desc: 'Grow your workspace' },
                      { label: '📅 Schedule a meeting', desc: 'Get the team together' },
                      { label: '🎯 Start Focus Mode', desc: 'Deep work, tracked' },
                    ].map((a, i) => (
                      <motion.button key={i} onClick={complete}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                        whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                        className="text-left p-3 rounded-xl border border-black/8 hover:border-violet/30 hover:bg-violet/3 transition-all">
                        <p className="text-xs font-semibold text-ink mb-0.5">{a.label}</p>
                        <p className="text-[10px] text-slate-muted">{a.desc}</p>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Nav buttons */}
            <div className="flex items-center gap-3 mt-8">
              {step > 0 && (
                <motion.button onClick={back} whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-1.5 text-sm text-slate-muted hover:text-ink transition-colors border border-black/10 rounded-xl px-4 py-2.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </motion.button>
              )}
              <motion.button onClick={next} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 text-sm bg-ink text-white rounded-xl px-5 py-2.5 font-medium hover:bg-ink/90 transition-colors">
                {current.isFinal ? (
                  <>
                    Let's go
                    <span className="text-base">🚀</span>
                  </>
                ) : (
                  <>
                    Next
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Right — illustration */}
          <div className="hidden md:flex items-center justify-center bg-paper-dim/40 p-8 border-l border-black/5">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={step}
                custom={dir}
                variants={{
                  enter:  d => ({ x: d > 0 ? 40 : -40, opacity: 0, scale: 0.97 }),
                  center: ()  => ({ x: 0, opacity: 1, scale: 1 }),
                  exit:   d => ({ x: d > 0 ? -40 : 40, opacity: 0, scale: 0.97 }),
                }}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.38, ease: [0.16,1,0.3,1] }}
                className="w-full max-w-xs"
              >
                <Illustration />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Step counter */}
      <p className="mt-5 text-[11px] text-slate-muted z-10">
        Step {step + 1} of {steps.length}
      </p>
    </div>
  )
}
