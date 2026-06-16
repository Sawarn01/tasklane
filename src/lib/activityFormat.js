export function formatActivity(entry) {
  const actor = entry.profiles?.full_name || 'Someone'
  const meta = entry.metadata || {}

  switch (entry.action) {
    case 'task_created':
      return `${actor} created "${meta.title}"`
    case 'task_moved':
      return `${actor} moved "${meta.title}" from ${meta.from?.replace('_', ' ')} to ${meta.to?.replace('_', ' ')}`
    case 'task_assigned':
      return `${actor} assigned "${meta.title}" to ${meta.assignee || 'someone'}`
    case 'task_unassigned':
      return `${actor} unassigned "${meta.title}"`
    case 'comment_added':
      return `${actor} commented on "${meta.title}"`
    case 'project_created':
      return `${actor} created the project "${meta.name}"`
    default:
      return `${actor} did something (${entry.action})`
  }
}