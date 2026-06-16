import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function ProjectLayout() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const isChatActive = location.pathname.endsWith('/chat')

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-black/5 bg-white px-6 flex gap-4">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="relative py-3 text-sm font-medium text-ink"
        >
          Board
          {!isChatActive && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet" />
          )}
        </button>
        <button
          onClick={() => navigate(`/projects/${projectId}/chat`)}
          className="relative py-3 text-sm font-medium text-ink"
        >
          Chat
          {isChatActive && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet" />
          )}
        </button>
      </div>
      <Outlet />
    </div>
  )
}