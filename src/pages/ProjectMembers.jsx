import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'
import {
  getProjectMembers, getTasks, removeProjectMember,
  getMyOrg, getOrgMembers, addProjectMember, createInvite,
} from '../lib/data'

const MEMBER_COLORS = ['#6E56CF', '#36D399', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6']

export default function ProjectMembers() {
  const { projectId } = useParams()
  const { user } = useAuth()

  const [members, setMembers]         = useState([])
  const [tasks, setTasks]             = useState([])
  const [orgMembers, setOrgMembers]   = useState([])
  const [org, setOrg]                 = useState(null)
  const [loading, setLoading]         = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showAddModal, setShowAddModal]       = useState(false)
  const [inviteLink, setInviteLink]           = useState('')
  const [generatingLink, setGeneratingLink]   = useState(false)
  const [removingId, setRemovingId]           = useState(null)
  const [addingId, setAddingId]               = useState(null)
  const [search, setSearch]                   = useState('')

  useEffect(() => { loadAll() }, [projectId])

  async function loadAll() {
    try {
      const [mem, tsk, o] = await Promise.all([
        getProjectMembers(projectId),
        getTasks(projectId),
        getMyOrg(),
      ])
      const org = o?.org ?? o        // getMyOrg returns { org, role }
      setMembers(mem)
      setTasks(tsk)
      setOrg(org)
      if (org?.id) {
        const om = await getOrgMembers(org.id)
        setOrgMembers(om)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(memberId) {
    if (memberId === user.id) return
    setRemovingId(memberId)
    try {
      await removeProjectMember({ projectId, userId: memberId })
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (e) {
      alert(e.message)
    } finally {
      setRemovingId(null)
    }
  }

  async function handleAdd(memberId) {
    setAddingId(memberId)
    try {
      await addProjectMember({ projectId, userId: memberId })
      await loadAll()
      setShowAddModal(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setAddingId(null)
    }
  }

  async function handleGenerateInvite() {
    if (!org) return
    setGeneratingLink(true)
    try {
      const invite = await createInvite({ orgId: org.id, createdBy: user.id, maxUses: 10, expiresInDays: 7 })
      const link = `${window.location.origin}/signup?invite=${invite.token}`
      setInviteLink(link)
    } catch (e) {
      alert(e.message)
    } finally {
      setGeneratingLink(false)
    }
  }

  const memberIds = new Set(members.map(m => m.id))
  const addable   = orgMembers.filter(m =>
    !memberIds.has(m.id) &&
    (m.full_name?.toLowerCase().includes(search.toLowerCase()) || m.id === search)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
          className="font-mono text-xs uppercase tracking-wider text-[#8A8F98]">Loading…</motion.p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAF7] px-6 py-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-ink">Team Members</h1>
            <p className="text-xs text-[#8A8F98] mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''} in this project</p>
          </div>
          <div className="flex gap-2">
            {orgMembers.length > members.length && (
              <button
                onClick={() => { setShowAddModal(true); setSearch('') }}
                className="text-xs border border-black/10 rounded-xl px-3 py-2 hover:bg-black/[0.03] transition-colors text-[#8A8F98] hover:text-ink"
              >
                Add member
              </button>
            )}
            <button
              onClick={() => { setShowInviteModal(true); setInviteLink('') }}
              className="text-xs bg-ink text-white rounded-xl px-3 py-2 hover:bg-ink/90 transition-colors"
            >
              Invite to org →
            </button>
          </div>
        </div>

        {/* Member list */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-black/5 bg-[#FAFAF7]">
            <div className="col-span-5 font-mono text-[9px] uppercase tracking-wider text-[#8A8F98]">Member</div>
            <div className="col-span-2 font-mono text-[9px] uppercase tracking-wider text-[#8A8F98] text-center">Open</div>
            <div className="col-span-2 font-mono text-[9px] uppercase tracking-wider text-[#8A8F98] text-center">Done</div>
            <div className="col-span-3 font-mono text-[9px] uppercase tracking-wider text-[#8A8F98]">Status</div>
          </div>

          {members.map((m, i) => {
            const color = MEMBER_COLORS[i % MEMBER_COLORS.length]
            const open  = tasks.filter(t => t.assignee_id === m.id && t.status !== 'done').length
            const done  = tasks.filter(t => t.assignee_id === m.id && t.status === 'done').length
            const total = open + done
            const isMe  = m.id === user.id
            const isRemoving = removingId === m.id

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-black/5 last:border-0 hover:bg-[#FAFAF7] transition-colors group items-center"
              >
                {/* Name */}
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: color }}>
                    {(m.full_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{m.full_name || 'Unknown'}</p>
                    {m.avatar_url && <p className="text-[10px] text-[#8A8F98] truncate">Member</p>}
                  </div>
                </div>

                {/* Open */}
                <div className="col-span-2 text-center">
                  <span className={`font-mono text-sm font-semibold ${open > 0 ? 'text-violet' : 'text-[#8A8F98]'}`}>{open}</span>
                </div>

                {/* Done */}
                <div className="col-span-2 text-center">
                  <span className="font-mono text-sm font-semibold text-[#36D399]">{done}</span>
                </div>

                {/* Actions */}
                <div className="col-span-3 flex items-center gap-2">
                  {isMe && <span className="font-mono text-[9px] bg-[#F1EFE7] text-[#8A8F98] px-2 py-0.5 rounded-full">you</span>}
                  {total > 0 && (
                    <div className="flex-1 h-1 bg-[#F1EFE7] rounded-full overflow-hidden max-w-[60px]">
                      <div className="h-full bg-sage rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
                    </div>
                  )}
                  {!isMe && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={isRemoving}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-red-500/60 hover:text-red-500 transition-all px-2 py-1 rounded-lg hover:bg-red-50 ml-auto"
                    >
                      {isRemoving ? '…' : 'Remove'}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {members.length === 0 && (
          <div className="text-center py-12 text-sm text-[#8A8F98]">No members yet.</div>
        )}
      </div>

      {/* ── Add member modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-xl border border-black/5 w-full max-w-sm p-5">
                <h2 className="font-semibold text-ink mb-1">Add org member</h2>
                <p className="text-xs text-[#8A8F98] mb-3">Add someone from your organisation to this project.</p>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full text-sm border border-black/10 rounded-xl px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-violet/30"
                />
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {addable.length === 0 ? (
                    <p className="text-xs text-[#8A8F98] text-center py-4 italic">
                      {orgMembers.length === members.length ? 'All org members are already in this project.' : 'No matches.'}
                    </p>
                  ) : (
                    addable.map((m, i) => (
                      <div key={m.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F1EFE7] transition-colors cursor-pointer"
                        onClick={() => handleAdd(m.id)}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                          {(m.full_name || '?')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink font-medium truncate">{m.full_name || 'Unknown'}</p>
                          <p className="text-[10px] text-[#8A8F98] capitalize">{m.role}</p>
                        </div>
                        {addingId === m.id ? (
                          <span className="text-[10px] text-violet font-mono">Adding…</span>
                        ) : (
                          <span className="text-[10px] text-violet opacity-0 group-hover:opacity-100">Add →</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <button onClick={() => setShowAddModal(false)}
                  className="mt-3 w-full text-xs text-[#8A8F98] py-2 hover:text-ink transition-colors">Cancel</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Invite link modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showInviteModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
              onClick={() => setShowInviteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-xl border border-black/5 w-full max-w-sm p-5">
                <h2 className="font-semibold text-ink mb-1">Invite to organisation</h2>
                <p className="text-xs text-[#8A8F98] mb-4">Generate a link anyone can use to join your org. Valid for 7 days.</p>

                {!inviteLink ? (
                  <button
                    onClick={handleGenerateInvite}
                    disabled={generatingLink}
                    className="w-full py-2.5 bg-ink text-white rounded-xl text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
                  >
                    {generatingLink ? 'Generating…' : 'Generate invite link'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-[#F1EFE7] rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <p className="text-xs text-ink font-mono flex-1 truncate">{inviteLink}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(inviteLink)}
                        className="text-[10px] text-violet bg-violet/10 px-2 py-1 rounded-lg hover:bg-violet/20 transition-colors shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-[10px] text-[#8A8F98] text-center">
                      Up to 10 uses · expires in 7 days
                    </p>
                  </div>
                )}

                <button onClick={() => setShowInviteModal(false)}
                  className="mt-3 w-full text-xs text-[#8A8F98] py-2 hover:text-ink transition-colors">Close</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
