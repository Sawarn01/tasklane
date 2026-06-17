import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getMyOrg, getMyProfile, updateMyProfile, uploadAvatar,
  updateUserEmail, updateUserPassword, getMyAssignedTasks, getMyProjects,
} from '../lib/data'

// ── Re-usable section card ────────────────────────────────────
function Section({ title, description, children, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
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

// ── Toast notification ────────────────────────────────────────
function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [])
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm shadow-lg ${
        type === 'success'
          ? 'bg-ink text-white'
          : 'bg-red-600 text-white'
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

// ── Spinning save button ──────────────────────────────────────
function SaveButton({ saving, label = 'Save changes', savedLabel = 'Saved!', disabled }) {
  return (
    <motion.button
      type="submit"
      disabled={saving || disabled}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2 bg-violet text-white text-sm rounded-xl px-5 py-2.5 hover:bg-violet/90 disabled:opacity-50 transition-colors font-medium"
    >
      {saving && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full block"
        />
      )}
      {saving ? 'Saving…' : label}
    </motion.button>
  )
}

export default function UserProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const avatarInputRef = useRef(null)

  const [profile, setProfile]     = useState(null)
  const [org, setOrg]             = useState(null)
  const [role, setRole]           = useState(null)
  const [projects, setProjects]   = useState([])
  const [myTasks, setMyTasks]     = useState([])
  const [loading, setLoading]     = useState(true)

  // Field states
  const [fullName, setFullName]   = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [newEmail, setNewEmail]   = useState('')
  const [newPass, setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)

  // Save states
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingEmail, setSavingEmail]     = useState(false)
  const [savingPass, setSavingPass]       = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Toast
  const [toasts, setToasts] = useState([])

  function addToast(message, type = 'success') {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }
  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [profileData, { org, role }, tasksData] = await Promise.all([
        getMyProfile(user.id),
        getMyOrg(),
        getMyAssignedTasks(user.id).catch(() => []),
      ])
      setProfile(profileData)
      setOrg(org)
      setRole(role)
      setMyTasks(tasksData)
      setFullName(profileData.full_name || '')
      setAvatarUrl(profileData.avatar_url || '')
      setNewEmail(user.email || '')

      const projectList = await getMyProjects(org.id).catch(() => [])
      setProjects(projectList)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      addToast('Please choose a JPG, PNG, WebP, or GIF image.', 'error')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast('Image must be under 2 MB.', 'error')
      return
    }
    // local preview
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)

    setUploadingAvatar(true)
    try {
      const url = await uploadAvatar({ userId: user.id, file })
      await updateMyProfile({ userId: user.id, fullName, avatarUrl: url })
      setAvatarUrl(url)
      setAvatarPreview(null)
      addToast('Avatar updated!')
    } catch (err) {
      setAvatarPreview(null)
      addToast(err.message || 'Avatar upload failed. Check that the "avatars" storage bucket exists.', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await updateMyProfile({ userId: user.id, fullName })
      setProfile((p) => ({ ...p, full_name: fullName }))
      addToast('Profile updated!')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSaveEmail(e) {
    e.preventDefault()
    if (newEmail === user.email) { addToast('No change detected.', 'error'); return }
    setSavingEmail(true)
    try {
      await updateUserEmail({ email: newEmail })
      addToast('Verification email sent. Check your inbox to confirm the change.')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault()
    if (newPass.length < 8) { addToast('Password must be at least 8 characters.', 'error'); return }
    if (newPass !== confirmPass) { addToast('Passwords do not match.', 'error'); return }
    setSavingPass(true)
    try {
      await updateUserPassword({ password: newPass })
      setNewPass('')
      setConfirmPass('')
      addToast('Password updated successfully!')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingPass(false)
    }
  }

  const doneTasks = myTasks.filter((t) => t.status === 'done').length
  const openTasks = myTasks.filter((t) => t.status !== 'done').length
  const displayAvatar = avatarPreview || avatarUrl
  const initials = (fullName || user?.email || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

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
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-muted">Loading profile…</p>
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
        <span className="text-sm font-medium text-ink">Profile</span>
      </motion.div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* ── Hero card ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl border border-black/5 p-6 flex items-center gap-6"
        >
          {/* Avatar */}
          <div className="relative shrink-0 group">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden cursor-pointer ring-2 ring-black/5 group-hover:ring-violet/30 transition-all"
              onClick={() => avatarInputRef.current?.click()}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={fullName}
                  className={`w-full h-full object-cover transition-opacity ${uploadingAvatar ? 'opacity-50' : 'opacity-100'}`}
                />
              ) : (
                <div className="w-full h-full bg-violet/15 flex items-center justify-center">
                  <span className="text-2xl font-bold text-violet">{initials}</span>
                </div>
              )}
              {/* Overlay */}
              <motion.div
                initial={false}
                className="absolute inset-0 bg-ink/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingAvatar ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M2 13.5L6 9.5l3 3 4-5 3 6H2z" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
                    <circle cx="5.5" cy="5.5" r="2" stroke="white" strokeWidth="1.3" />
                  </svg>
                )}
              </motion.div>
            </div>
            <input
              ref={avatarInputRef}
              type="file" accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
            {/* Camera badge */}
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-violet rounded-full flex items-center justify-center shadow-md pointer-events-none">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 3.5a1 1 0 0 1 1-1h.8l.7-1h3l.7 1h.8a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-4z" stroke="white" strokeWidth="1.1" fill="none" />
                <circle cx="5.5" cy="5.5" r="1.5" stroke="white" strokeWidth="1.1" />
              </svg>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-ink truncate">{profile?.full_name || 'Your name'}</h1>
            <p className="text-sm text-slate-muted truncate mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet/10 text-violet font-semibold">
                {role}
              </span>
              <span className="text-xs text-slate-muted">at {org?.name}</span>
            </div>
          </div>

          {/* Stats mini */}
          <div className="hidden sm:flex flex-col gap-2 shrink-0 text-right">
            <div>
              <p className="text-lg font-bold text-ink">{projects.length}</p>
              <p className="text-[10px] text-slate-muted">Projects</p>
            </div>
            <div>
              <p className="text-lg font-bold text-ink">{openTasks}</p>
              <p className="text-[10px] text-slate-muted">Open tasks</p>
            </div>
          </div>
        </motion.div>

        {/* ── Profile info ──────────────────────────────── */}
        <Section title="Profile information" description="Update your display name and avatar." index={1}>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1.5">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full text-sm rounded-xl border border-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1.5">Avatar</label>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-violet hover:opacity-70 transition-opacity"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 9.5l3.5-3.5 2.5 2.5 3-3.5 2.5 4.5H1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <circle cx="4.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {avatarUrl ? 'Change avatar' : 'Upload avatar'}
              </button>
              <p className="text-[10px] text-slate-muted mt-1">JPG, PNG or WebP · Max 2 MB · Click the avatar above to upload</p>
            </div>
            <SaveButton saving={savingProfile} />
          </form>
        </Section>

        {/* ── Account security ──────────────────────────── */}
        <Section title="Account security" description="Update your login email or password." index={2}>
          <div className="space-y-6">
            {/* Email */}
            <form onSubmit={handleSaveEmail} className="space-y-3">
              <p className="text-xs font-semibold text-ink">Email address</p>
              <div className="flex gap-3">
                <input
                  type="email" required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="flex-1 text-sm rounded-xl border border-black/10 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
                />
                <SaveButton saving={savingEmail} label="Update email" disabled={newEmail === user.email} />
              </div>
              <p className="text-[10px] text-slate-muted">You'll receive a verification email to confirm the change.</p>
            </form>

            <div className="border-t border-black/5 pt-6">
              <form onSubmit={handleSavePassword} className="space-y-3">
                <p className="text-xs font-semibold text-ink">Change password</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1.5">New password</label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'} minLength={8}
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full text-sm rounded-xl border border-black/10 px-3.5 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-violet/30 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-muted/50 hover:text-slate-muted"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          {showNewPass
                            ? <><path d="M1 6.5s2.4-4.5 5.5-4.5 5.5 4.5 5.5 4.5-2.4 4.5-5.5 4.5S1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2" /><path d="M2 2l9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></>
                            : <><path d="M1 6.5s2.4-4.5 5.5-4.5 5.5 4.5 5.5 4.5-2.4 4.5-5.5 4.5S1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2" /><circle cx="6.5" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.2" /></>
                          }
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-muted mb-1.5">Confirm password</label>
                    <input
                      type="password" minLength={8}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full text-sm rounded-xl border px-3.5 py-2.5 focus:outline-none focus:ring-2 transition-all ${
                        confirmPass && confirmPass !== newPass
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-black/10 focus:ring-violet/30'
                      }`}
                    />
                  </div>
                </div>
                {/* Strength indicator */}
                {newPass.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                    {[8, 12, 16].map((threshold, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          newPass.length >= threshold
                            ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-amber-400' : 'bg-sage'
                            : 'bg-black/8'
                        }`}
                      />
                    ))}
                    <span className="text-[10px] text-slate-muted font-mono">
                      {newPass.length < 8 ? 'Too short' : newPass.length < 12 ? 'Weak' : newPass.length < 16 ? 'Good' : 'Strong'}
                    </span>
                  </motion.div>
                )}
                <SaveButton
                  saving={savingPass}
                  label="Update password"
                  disabled={!newPass || !confirmPass || newPass !== confirmPass}
                />
              </form>
            </div>
          </div>
        </Section>

        {/* ── Your activity stats ───────────────────────── */}
        <Section title="Your activity" description="An overview of your contributions across all projects." index={3}>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Projects',
                value: projects.length,
                color: 'text-violet',
                bg: 'bg-violet/10',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1.5" fill="currentColor"/><rect x="9" y="2" width="5" height="5" rx="1.5" fill="currentColor"/><rect x="2" y="9" width="5" height="5" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="5" height="5" rx="1.5" fill="currentColor"/></svg>,
              },
              {
                label: 'Open tasks',
                value: openTasks,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
              },
              {
                label: 'Completed',
                value: doneTasks,
                color: 'text-green-700',
                bg: 'bg-sage/15',
                icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.07 }}
                className={`rounded-xl p-4 ${stat.bg} text-center`}
              >
                <div className={`flex justify-center mb-2 ${stat.color}`}>{stat.icon}</div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-muted mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── Workspace info ────────────────────────────── */}
        <Section title="Workspace" description="Your current organization membership." index={4}>
          <div className="flex items-center gap-4 p-4 bg-paper-dim rounded-xl">
            <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">
                {(org?.name || 'O')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink">{org?.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[9px] uppercase tracking-wide text-violet bg-violet/10 px-1.5 py-0.5 rounded">
                  {org?.plan}
                </span>
                <span className="text-xs text-slate-muted capitalize">Your role: {role}</span>
              </div>
            </div>
            {(role === 'owner' || role === 'admin') && (
              <button
                onClick={() => navigate('/org/settings')}
                className="text-xs text-violet hover:opacity-70 transition-opacity shrink-0"
              >
                Org settings →
              </button>
            )}
          </div>
        </Section>
      </div>

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
