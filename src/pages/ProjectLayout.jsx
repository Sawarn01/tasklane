import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function ProjectLayout() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const isChatActive = location.pathname.endsWith('/chat')
  const isActivityActive = location.pathname.endsWith('/activity')
  const isBoardActive = !isChatActive && !isActivityActive

  const tabs = [
    { key: 'board', label: 'Board', path: '', active: isBoardActive },
    { key: 'chat', label: 'Chat', path: '/chat', active: isChatActive },
    { key: 'activity', label: 'Activity', path: '/activity', active: isActivityActive },
  ]

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-black/5 bg-white px-6 flex gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => navigate(`/projects/${projectId}${tab.path}`)}
            className="relative py-3 text-sm font-medium text-ink"
          >
            {tab.label}
            {tab.active && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet" />
            )}
          </button>
        ))}
      </div>
      <Outlet />
    </div>
  )
}