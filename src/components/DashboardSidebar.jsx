import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createInvite } from '../lib/data'

export default function DashboardSidebar({
  org, role, profile, user,
  projects = [],
  onNewProject,
}) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const activePath = location.pathname

  const [inviteLink,       setInviteLink]       = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copySuccess,      setCopySuccess]      = useState(false)

  async function handleGenerateInvite() {
    setGeneratingInvite(true)
    try {
      const invite = await createInvite({ orgId: org.id, createdBy: user.id })
      setInviteLink(`${window.location.origin}/signup?invite=${invite.token}`)
      setCopySuccess(false)
    } catch {}
    finally { setGeneratingInvite(false) }
  }

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(inviteLink)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const isAdmin = role === 'owner' || role === 'admin'

  const NAV_ITEMS = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1.2" fill="currentColor" />
          <rect x="8" y="1" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.5" />
          <rect x="1" y="8" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.5" />
          <rect x="8" y="8" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.3" />
        </svg>
      ),
    },
    {
      href: '/projects',
      label: 'Projects',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      ),
      badge: projects.length > 0 ? projects.length : null,
    },
    {
      href: '/my-work',
      label: 'My Work',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="3" width="12" height="1.5" rx="0.75" fill="currentColor" />
          <rect x="1" y="6.25" width="9" height="1.5" rx="0.75" fill="currentColor" opacity="0.6" />
          <rect x="1" y="9.5" width="6" height="1.5" rx="0.75" fill="currentColor" opacity="0.35" />
        </svg>
      ),
    },
    {
      href: '/notifications',
      label: 'Notifications',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1a4.5 4.5 0 0 1 4.5 4.5V9l1.3 1.5H1.2L2.5 9V5.5A4.5 4.5 0 0 1 7 1z" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <path d="M5.5 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/finances',
      label: 'Finances',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5v11M4 4.5C4 3.1 5.3 2 7 2s3 1.1 3 2.5c0 3-6 3-6 6 0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  return (
    <motion.aside initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-56 bg-white border-r border-black/5 flex flex-col shrink-0 h-screen sticky top-0">

      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center shrink-0">
            <div className="w-3 h-3 bg-violet rounded-sm" />
          </div>
          <span className="font-bold text-ink text-[15px] tracking-tight">Tasklane</span>
        </div>
      </div>

      {/* Workspace block */}
      <div className="mx-3 mb-3">
        <button onClick={() => isAdmin && navigate('/org/settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-paper-dim transition-colors text-left group ${isAdmin ? 'hover:bg-paper-dim/80 cursor-pointer' : 'cursor-default'}`}>
          <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">{(org?.name || 'W')[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate leading-tight">{org?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-violet">{org?.plan}</span>
              <span className="text-slate-muted/40 text-[9px]">·</span>
              <span className="text-[9px] text-slate-muted capitalize">{role}</span>
            </div>
          </div>
          {isAdmin && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              className="text-slate-muted/30 group-hover:text-slate-muted/60 transition-colors shrink-0">
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      <div className="mx-5 border-t border-black/5 mb-3" />

      {/* Main nav */}
      <div className="px-3 mb-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon, badge }) => {
          const active = activePath === href
          return (
            <button key={href} onClick={() => navigate(href)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-left ${active ? 'bg-violet/8 text-violet' : 'text-slate-muted hover:text-ink hover:bg-paper-dim'}`}>
              <span className={active ? 'text-violet' : ''}>{icon}</span>
              <span className={`flex-1 text-[13px] font-medium ${active ? 'text-violet' : ''}`}>{label}</span>
              {badge && (
                <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full ${active ? 'bg-violet/15 text-violet' : 'bg-paper-dim text-slate-muted'}`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mx-5 border-t border-black/5 mb-3" />

      {/* Invite (admin/owner only) */}
      {isAdmin && (
        <div className="px-3 mb-1">
          {!inviteLink ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleGenerateInvite} disabled={generatingInvite}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-muted hover:text-ink hover:bg-paper-dim transition-colors disabled:opacity-50 text-left">
              <div className="w-5 h-5 rounded-md bg-paper-dim flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="4" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7.5 6.5l2 2M7 5h2.5M8.2 3.8v2.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              </div>
              {generatingInvite ? 'Generating…' : 'Invite teammate'}
            </motion.button>
          ) : (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-violet/5 border border-violet/10 rounded-xl p-2.5">
              <p className="font-mono text-[9px] text-violet/70 uppercase tracking-wide mb-1.5">Invite link · 1 use</p>
              <div className="flex gap-1.5">
                <input readOnly value={inviteLink} onClick={e => e.target.select()}
                  className="flex-1 text-[10px] bg-white rounded-lg px-2 py-1.5 border border-black/5 truncate focus:outline-none text-ink" />
                <button onClick={handleCopyInvite}
                  className="text-[10px] bg-violet text-white rounded-lg px-2 py-1.5 shrink-0 hover:bg-violet/90 transition-colors font-medium">
                  {copySuccess ? '✓' : 'Copy'}
                </button>
              </div>
              <button onClick={() => setInviteLink('')}
                className="text-[9px] text-slate-muted hover:text-ink mt-1.5 transition-colors">Generate new link</button>
            </motion.div>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* User footer */}
      <div className="border-t border-black/5 px-3 py-3">
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-paper-dim transition-colors text-left group">
          <div className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-black/6 shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-violet/15 flex items-center justify-center">
                <span className="text-[10px] font-bold text-violet">
                  {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-ink truncate leading-tight">{profile?.full_name || user?.email}</p>
            <p className="text-[10px] text-slate-muted truncate">{user?.email}</p>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className="text-slate-muted/30 group-hover:text-slate-muted/60 transition-colors shrink-0">
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </motion.button>
      </div>
    </motion.aside>
  )
}
