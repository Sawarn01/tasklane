export function IssueTypeIcon({ type = 'task', size = 14 }) {
  const s = size
  switch (type) {
    case 'epic':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" title="Epic">
          <rect width="14" height="14" rx="3" fill="#8B5CF6" />
          <path d="M7 2.5L9.5 6.5H7.8L8.5 11.5L4.5 7.5H6.2L5.5 2.5H7Z" fill="white" />
        </svg>
      )
    case 'story':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" title="Story">
          <rect width="14" height="14" rx="3" fill="#36D399" />
          <path d="M4 3h6v1.5H4zM4 6h6v1.5H4zM4 9h4v1.5H4z" fill="white" />
        </svg>
      )
    case 'bug':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" title="Bug">
          <rect width="14" height="14" rx="3" fill="#EF4444" />
          <circle cx="7" cy="7.5" r="2.5" stroke="white" strokeWidth="1.2" fill="none" />
          <path d="M5 4.5c.5-.8 1.2-1.5 2-1.5s1.5.7 2 1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7 5V3M4.5 7.5H2.5M11.5 7.5H9.5M5 10l-1.5 1.5M9 10l1.5 1.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )
    case 'subtask':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" title="Subtask">
          <rect width="14" height="14" rx="3" fill="#6B7280" />
          <path d="M3 4h4v1.5H3zM7 7h4v1.5H7zM3 10h4v1.5H3z" fill="white" opacity="0.9" />
        </svg>
      )
    default: // task
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" title="Task">
          <rect width="14" height="14" rx="3" fill="#3B82F6" />
          <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

export function PriorityIcon({ priority = 'medium', size = 12 }) {
  const s = size
  const configs = {
    urgent: { color: '#EF4444', bars: [true, true, true, true] },
    high:   { color: '#F97316', bars: [true, true, true, false] },
    medium: { color: '#6E56CF', bars: [true, true, false, false] },
    low:    { color: '#8A8F98', bars: [true, false, false, false] },
  }
  const { color, bars } = configs[priority] || configs.medium
  return (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" title={priority}>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 3}
          y={12 - (i + 1) * 2.5}
          width={2}
          height={(i + 1) * 2.5}
          rx="0.5"
          fill={bars[i] ? color : '#E5E7EB'}
        />
      ))}
    </svg>
  )
}

export function StatusBadge({ status }) {
  const configs = {
    todo:        { label: 'To Do',       bg: 'bg-paper-dim',     text: 'text-slate-muted' },
    in_progress: { label: 'In Progress', bg: 'bg-violet/10',     text: 'text-violet' },
    review:      { label: 'In Review',   bg: 'bg-amber-50',      text: 'text-amber-600' },
    done:        { label: 'Done',        bg: 'bg-sage/15',       text: 'text-sage' },
  }
  const c = configs[status] || configs.todo
  return (
    <span className={`inline-flex items-center font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export const ISSUE_TYPES = ['task', 'bug', 'story', 'epic', 'subtask']
export const PRIORITIES = ['urgent', 'high', 'medium', 'low']
export const STATUSES = ['todo', 'in_progress', 'review', 'done']
