import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'

export default function ProjectLayout() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const isChatActive = location.pathname.endsWith('/chat')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 flex gap-4">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className={`py-3 text-sm font-medium border-b-2 ${
            !isChatActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
          }`}
        >
          Board
        </button>
        <button
          onClick={() => navigate(`/projects/${projectId}/chat`)}
          className={`py-3 text-sm font-medium border-b-2 ${
            isChatActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
          }`}
        >
          Chat
        </button>
      </div>
      <Outlet />
    </div>
  )
}