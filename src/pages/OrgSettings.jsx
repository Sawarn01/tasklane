import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getMyOrg, getOrgMembers, updateOrgName, updateOrgMemberRole,
  removeOrgMember, createInvite,
} from '../lib/data'

const ROLES = ['member', 'admin', 'owner']
const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const ROLE_COLORS = {
  owner: 'bg-violet/10 text-violet',
  admin: 'bg-amber-50 text-amber-600',
  member: 'bg-paper-dim text-slate-muted',
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [])
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm shadow-lg ${
        type === 'success' ? 'bg-ink text-white' : 'bg-red-600 text-white'
      }`}
    >
      {type === 'success' ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6.5" fill="white" fillOpacity="0.2" />
          <path d="M4.5 7l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6.5" fill="white" fillOpacity="0.2" />
          <path d="M7 4.5v3M7 9.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {message}
    </motion.div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────
function ConfirmModal({ title, description, confirmLabel, confirmClass, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-ink mb-2">{title}</h3>
        <p className="text-sm text-slate-muted mb-6 leading-relaxed">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 text-sm rounded-xl py-2.5 font-medium transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="px-5 text-sm text-slate-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, description, children, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="bg-white rounded-2xl border border-black/5 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-black/5">
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="text-xs text-slate-muted mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  )
}

// ── Member row ────────────────────────────────────────────────
function MemberRow({ member, currentUserId, isCurrentOwner, orgId, onRoleChange, onRemove }) {
  const [roleOpen, setRoleOpen]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [removing, setRemoving]   = useState(false)
  const isSelf = member.id === currentUserId
  const isOwner = member.role === 'owner'
  const initials = (member.full_name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  async function handleRoleChange(newRole) {
    setRoleOpen(false)
    if (newRole === member.role) return
    setSaving(true)
    try {
      await updateOrgMemberRole({ orgId, userId: member.id, role: newRole })
      onRoleChange(member.id, newRole)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeOrgMember({ orgId, userId: member.id })
      onRemove(member.id)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3 py-3 border-b border-black/5 last:border-0"
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-violet/15 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-violet">{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">
          {member.full_name || 'Unknown'}
          {isSelf && <span className="text-[10px] text-slate-muted ml-1.5 font-mono">(you)</span>}
        </p>
      </div>

      {/* Role badge / picker */}
      <div className="relative shrink-0">
        {isOwner || !isCurrentOwner ? (
          <span className={`text-[10px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full font-semibold ${ROLE_COLORS[member.role]}`}>
            {ROLE_LABELS[member.role]}
          </span>
        ) : (
          <>
            <button
              onClick={() => setRoleOpen((v) => !v)}
              disabled={saving}
              className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full font-semibold transition-opacity ${ROLE_COLORS[member.role]} ${saving ? 'opacity-50' : 'hover:opacity-70'}`}
            >
              {saving ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full"
                />
              ) : ROLE_LABELS[member.role]}
              {!saving && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <AnimatePresence>
              {roleOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-8 bg-white rounded-xl border border-black/8 shadow-lg z-20 overflow-hidden min-w-28"
                >
                  {['member', 'admin'].map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(r)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-paper-dim transition-colors flex items-center gap-2 ${member.role === r ? 'text-violet font-semibold' : 'text-ink'}`}
                    >
                      {member.role === r && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <span className={member.role === r ? '' : 'ml-3.5'}>{ROLE_LABELS[r]}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Remove */}
      {!isSelf && !isOwner && isCurrentOwner && (
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-xs text-slate-muted hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 shrink-0 disabled:opacity-50"
        >
          {removing ? '…' : 'Remove'}
        </button>
      )}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function OrgSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [org, setOrg]           = useState(null)
  const [role, setRole]         = useState(null)
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  // Form state
  const [orgName, setOrgName]     = useState('')
  const [savingName, setSavingName] = useState(false)

  // Invite
  const [inviteLink, setInviteLink]       = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copySuccess, setCopySuccess]     = useState(false)

  // Confirm modals
  const [removeConfirm, setRemoveConfirm] = useState(null) // { memberId }
  const [dangerConfirm, setDangerConfirm] = useState(false)
  const [dangerText, setDangerText]       = useState('')

  // Toasts
  const [toasts, setToasts] = useState([])

  function addToast(message, type = 'success') {
    const id = Date.now()
    setToasts((p) => [...p, { id, message, type }])
  }
  function removeToast(id) {
    setToasts((p) => p.filter((t) => t.id !== id))
  }

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { org, role } = await getMyOrg()
      if (role !== 'owner' && role !== 'admin') {
        setAccessDenied(true)
        setLoading(false)
        return
      }
      setOrg(org)
      setRole(role)
      setOrgName(org.name)
      const m = await getOrgMembers(org.id)
      setMembers(m)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveName(e) {
    e.preventDefault()
    if (!orgName.trim()) return
    setSavingName(true)
    try {
      await updateOrgName({ orgId: org.id, name: orgName.trim() })
      setOrg((o) => ({ ...o, name: orgName.trim() }))
      addToast('Organization name updated!')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingName(false)
    }
  }

  async function handleGenerateInvite() {
    setGeneratingInvite(true)
    try {
      const invite = await createInvite({ orgId: org.id, createdBy: user.id })
      setInviteLink(`${window.location.origin}/signup?invite=${invite.token}`)
      setCopySuccess(false)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setGeneratingInvite(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  function handleRoleChange(memberId, newRole) {
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m))
    addToast(`Role updated to ${ROLE_LABELS[newRole]}.`)
  }

  function handleRemoveMember(memberId) {
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    addToast('Member removed from organization.')
  }

  const isOwner = role === 'owner'
  const memberCount = members.length
  const adminCount  = members.filter((m) => m.role === 'admin').length

  // ── Access denied ──────────────────────────────────────────
  if (!loading && accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#EF4444" strokeWidth="1.5" />
              <path d="M9 9l10 10M19 9L9 19" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-ink mb-2">Access Denied</h2>
          <p className="text-sm text-slate-muted mb-6">
            Organization settings are only accessible to owners and admins.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-violet text-white text-sm rounded-xl px-5 py-2.5 hover:bg-violet/90 transition-colors"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-7 h-7 bg-ink rounded-xl flex items-center justify-center">
            <div className="w-3 h-3 bg-violet rounded-sm" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-muted">Loading org settings…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-black/5 px-8 py-3.5 flex items-center gap-3"
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-muted hover:text-ink transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dashboard
        </button>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4 2l4 4-4 4" stroke="#8A8F98" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-medium text-ink">Organization Settings</span>

        {/* Admin-only badge */}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1l1.5 3H10L7 6l1 3.5L5 7.5 2 9.5 3 6 0 4h3.5z" fill="currentColor" />
          </svg>
          {ROLE_LABELS[role]} only
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* ── Org hero ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl border border-black/5 p-6 flex items-center gap-5"
        >
          <div className="w-16 h-16 bg-ink rounded-2xl flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-2xl">{(org?.name || 'O')[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-ink truncate">{org?.name}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wide text-violet bg-violet/10 px-2 py-0.5 rounded">
                {org?.plan}
              </span>
              <span className="text-xs text-slate-muted">{memberCount} members · {adminCount} admins</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/billing')}
            className="text-xs text-violet hover:opacity-70 transition-opacity shrink-0"
          >
            Manage plan →
          </button>
        </motion.div>

        {/* ── General ───────────────────────────────────── */}
        <Section title="General" description="Update your organization's display name." index={1}>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1.5">Organization name</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Inc"
                className="w-full text-sm rounded-xl border border-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
              />
            </div>
            <motion.button
              type="submit"
              disabled={savingName || orgName.trim() === org?.name}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 bg-violet text-white text-sm rounded-xl px-5 py-2.5 hover:bg-violet/90 disabled:opacity-50 transition-colors font-medium"
            >
              {savingName && (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full block"
                />
              )}
              {savingName ? 'Saving…' : 'Save changes'}
            </motion.button>
          </form>
        </Section>

        {/* ── Members ───────────────────────────────────── */}
        <Section
          title="Members"
          description={`${memberCount} ${memberCount === 1 ? 'member' : 'members'} in this organization${isOwner ? ' · Click a role badge to change it' : ''}`}
          index={2}
        >
          <AnimatePresence>
            {members.length === 0 ? (
              <p className="text-sm text-slate-muted">No members found.</p>
            ) : (
              <div>
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    currentUserId={user.id}
                    isCurrentOwner={isOwner}
                    orgId={org.id}
                    onRoleChange={handleRoleChange}
                    onRemove={(id) => setRemoveConfirm({ memberId: id, name: m.full_name })}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </Section>

        {/* ── Invite ────────────────────────────────────── */}
        <Section title="Invite people" description="Generate a single-use invite link to share with a new team member." index={3}>
          {!inviteLink ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGenerateInvite}
              disabled={generatingInvite}
              className="flex items-center gap-2 text-sm bg-violet text-white rounded-xl px-5 py-2.5 hover:bg-violet/90 disabled:opacity-50 transition-colors font-medium"
            >
              {generatingInvite ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                    className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M3.5 8.5a2 2 0 0 1 0-3l1-1a2 2 0 0 1 2.8 2.8l-.5.5M9.5 4.5a2 2 0 0 1 0 3l-1 1a2 2 0 0 1-2.8-2.8l.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Generate invite link
                </>
              )}
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <input
                  readOnly value={inviteLink}
                  onClick={(e) => e.target.select()}
                  className="flex-1 text-xs bg-paper-dim rounded-xl border border-black/8 px-3.5 py-2.5 focus:outline-none text-ink truncate"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-sm bg-violet text-white rounded-xl px-4 py-2.5 hover:bg-violet/90 transition-colors shrink-0 font-medium"
                >
                  {copySuccess ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.2" />
                        <path d="M2 9V2h7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      Copy
                    </>
                  )}
                </motion.button>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-muted bg-amber-50 rounded-xl px-3.5 py-2.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5 text-amber-500">
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M6 4v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                This link can be used <strong className="text-ink">once</strong> and expires in 7 days. Generate a new link for each person you invite.
              </div>
              <button
                onClick={() => setInviteLink('')}
                className="text-xs text-slate-muted hover:text-ink transition-colors"
              >
                Generate another link
              </button>
            </motion.div>
          )}
        </Section>

        {/* ── Stats overview ────────────────────────────── */}
        <Section title="Organization overview" description="At-a-glance stats for your workspace." index={4}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total members', value: memberCount, color: 'text-violet', bg: 'bg-violet/10' },
              { label: 'Admins', value: adminCount, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Current plan', value: (org?.plan || 'free').toUpperCase(), color: 'text-green-700', bg: 'bg-sage/15', isText: true },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.07 }}
                className={`rounded-xl p-4 text-center ${stat.bg}`}
              >
                <p className={`${stat.isText ? 'text-lg' : 'text-2xl'} font-bold ${stat.color} mt-1`}>{stat.value}</p>
                <p className="text-xs text-slate-muted mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── Danger zone (owner only) ──────────────────── */}
        {isOwner && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="bg-white rounded-2xl border border-red-100 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-red-50">
              <p className="font-semibold text-red-600">Danger zone</p>
              <p className="text-xs text-slate-muted mt-0.5">These actions are permanent and cannot be undone.</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">Delete organization</p>
                  <p className="text-xs text-slate-muted mt-0.5">
                    Permanently deletes <strong>{org?.name}</strong>, all projects, and all data. This is irreversible.
                  </p>
                </div>
                <button
                  onClick={() => setDangerConfirm(true)}
                  className="shrink-0 ml-4 text-sm text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors font-medium"
                >
                  Delete org
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────── */}
      <AnimatePresence>
        {removeConfirm && (
          <ConfirmModal
            title={`Remove ${removeConfirm.name}?`}
            description={`${removeConfirm.name} will lose access to all projects in ${org?.name}. You can re-invite them later.`}
            confirmLabel="Remove member"
            confirmClass="bg-red-600 text-white hover:bg-red-700 transition-colors"
            onConfirm={() => {
              handleRemoveMember(removeConfirm.memberId)
              setRemoveConfirm(null)
            }}
            onCancel={() => setRemoveConfirm(null)}
          />
        )}

        {dangerConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4"
            onClick={() => { setDangerConfirm(false); setDangerText('') }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 4v7M11 14v1" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 2h4M3 20h16L11 4 3 20z" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-bold text-ink mb-2">Delete organization?</h3>
              <p className="text-sm text-slate-muted mb-4 leading-relaxed">
                This will permanently delete <strong className="text-ink">{org?.name}</strong>, including all projects, tasks, members, and data. There is no going back.
              </p>
              <p className="text-xs text-slate-muted mb-2">
                Type <strong className="text-ink font-mono">{org?.name}</strong> to confirm:
              </p>
              <input
                value={dangerText}
                onChange={(e) => setDangerText(e.target.value)}
                placeholder={org?.name}
                className="w-full text-sm rounded-xl border border-red-200 px-3.5 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-red-300 transition-all"
              />
              <div className="flex gap-3">
                <button
                  disabled={dangerText !== org?.name}
                  onClick={() => {
                    // Actual deletion not implemented — requires CASCADE on DB level
                    addToast('Organization deletion is disabled in this demo.', 'error')
                    setDangerConfirm(false)
                    setDangerText('')
                  }}
                  className="flex-1 bg-red-600 text-white text-sm rounded-xl py-2.5 font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Delete forever
                </button>
                <button
                  onClick={() => { setDangerConfirm(false); setDangerText('') }}
                  className="px-4 text-sm text-slate-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        <AnimatePresence>
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
