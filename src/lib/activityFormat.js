export function formatActivity(entry) {
  const actor = entry.profiles?.full_name || 'Someone'
  const meta = entry.metadata || {}

  const statusLabel = (s) => s?.replace(/_/g, ' ') || s

  switch (entry.action) {
    case 'task_created':
      return `${actor} created "${meta.title}"`
    case 'task_moved':
      return `${actor} moved "${meta.title}" from ${statusLabel(meta.from)} to ${statusLabel(meta.to)}`
    case 'task_assigned':
      return `${actor} assigned "${meta.title}" to ${meta.assignee || 'someone'}`
    case 'task_unassigned':
      return `${actor} unassigned "${meta.title}"`
    case 'comment_added':
      return `${actor} commented on "${meta.title}"`
    case 'project_created':
      return `${actor} created the project "${meta.name}"`
    case 'sprint_created':
      return `${actor} created sprint "${meta.name}"`
    case 'sprint_started':
      return `${actor} started sprint "${meta.name}"`
    case 'sprint_completed':
      return `${actor} completed sprint "${meta.name}"`
    case 'task_sprint_changed':
      return meta.sprint_name
        ? `${actor} moved "${meta.title}" to sprint "${meta.sprint_name}"`
        : `${actor} moved "${meta.title}" to backlog`
    case 'task_priority_changed':
      return `${actor} changed priority of "${meta.title}" to ${meta.priority}`
    case 'task_type_changed':
      return `${actor} changed type of "${meta.title}" to ${meta.issue_type}`
    case 'task_estimate_changed':
      return `${actor} set estimate on "${meta.title}" to ${meta.story_points} pts`
    case 'task_linked':
      return `${actor} linked "${meta.title}" as ${meta.link_type?.replace(/_/g, ' ')} "${meta.linked_title}"`
    case 'version_created':
      return `${actor} created version "${meta.name}"`
    case 'version_released':
      return `${actor} released version "${meta.name}"`
    case 'task_version_changed':
      return `${actor} set fix version on "${meta.title}" to "${meta.version_name}"`
    case 'time_logged':
      return `${actor} logged ${meta.hours}h on "${meta.title}"`
    default:
      return `${actor} updated "${meta.title || entry.action}"`
  }
}

export function formatTimeAgo(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
