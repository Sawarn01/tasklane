import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

// Detect audio level from a stream (returns a cleanup fn)
export function watchAudioLevel(stream, onLevel) {
  if (!stream?.getAudioTracks().length) return () => {}
  let ctx, raf
  try {
    ctx = new AudioContext()
    const src      = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    function tick() {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      onLevel(avg)
      raf = requestAnimationFrame(tick)
    }
    tick()
  } catch {}
  return () => {
    cancelAnimationFrame(raf)
    ctx?.close().catch(() => {})
  }
}

export function useWebRTC({ meetingId, userId, displayName, enabled = true }) {
  const [localStream,   setLocalStream]   = useState(null)
  const [peers,         setPeers]         = useState({})  // peerId → { stream, displayName }
  const [audioEnabled,  setAudioEnabled]  = useState(true)
  const [videoEnabled,  setVideoEnabled]  = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [status,        setStatus]        = useState('connecting') // connecting | connected | error
  const [mediaError,    setMediaError]    = useState(null)

  const pcs         = useRef({})  // peerId → RTCPeerConnection
  const localRef    = useRef(null)
  const channelRef  = useRef(null)
  const iceBuf      = useRef({})  // peerId → RTCIceCandidateInit[]  (buffered before remoteDesc)
  const origTrack   = useRef(null) // camera track saved during screen share
  const mounted     = useRef(true)

  function send(event, payload) {
    channelRef.current?.send({ type: 'broadcast', event, payload })
  }

  function updatePeer(peerId, patch) {
    setPeers(prev => {
      if (!prev[peerId] && !patch) return prev
      return { ...prev, [peerId]: { ...prev[peerId], ...patch } }
    })
  }

  function removePeer(peerId) {
    setPeers(prev => {
      const next = { ...prev }
      delete next[peerId]
      return next
    })
  }

  function closePC(peerId) {
    pcs.current[peerId]?.close()
    delete pcs.current[peerId]
    delete iceBuf.current[peerId]
    removePeer(peerId)
  }

  function createPC(peerId) {
    if (pcs.current[peerId]) return pcs.current[peerId]

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcs.current[peerId] = pc

    // Add local tracks to this connection
    if (localRef.current) {
      localRef.current.getTracks().forEach(t => pc.addTrack(t, localRef.current))
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        send('ice', { from: userId, to: peerId, candidate: candidate.toJSON() })
      }
    }

    pc.ontrack = ({ streams }) => {
      if (!mounted.current) return
      updatePeer(peerId, { stream: streams[0] })
    }

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) closePC(peerId)
    }

    pc.onsignalingstatechange = () => {
      // Flush buffered ICE candidates when remote description has been set
      if (pc.signalingState !== 'stable') return
      const buf = iceBuf.current[peerId] || []
      buf.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}))
      delete iceBuf.current[peerId]
    }

    return pc
  }

  async function initiateOffer(peerId) {
    const pc = createPC(peerId)
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send('offer', { from: userId, to: peerId, sdp: pc.localDescription })
    } catch {}
  }

  useEffect(() => {
    if (!enabled || !meetingId || !userId) return
    mounted.current = true

    async function init() {
      // Acquire camera + mic
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch {
        try {
          // Fallback: audio only
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          setMediaError('camera')
        } catch {
          setStatus('error')
          setMediaError('both')
          return
        }
      }

      if (!mounted.current) { stream.getTracks().forEach(t => t.stop()); return }
      localRef.current = stream
      setLocalStream(stream)

      // Set up Supabase Realtime channel
      const ch = supabase.channel(`meeting-room-${meetingId}`, {
        config: {
          presence:  { key: userId },
          broadcast: { self: false, ack: false },
        },
      })
      channelRef.current = ch

      // ── Presence: who's in the room ──
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState()
        Object.entries(state).forEach(([pid, presences]) => {
          if (pid === userId) return
          const p = presences[0]
          updatePeer(pid, { displayName: p?.displayName || 'Guest' })
        })
      })

      ch.on('presence', { event: 'join' }, ({ key: peerId, newPresences }) => {
        if (peerId === userId) return
        const p = newPresences[0]
        updatePeer(peerId, { displayName: p?.displayName || 'Guest' })
        // Higher userId initiates (consistent tie-break, avoids double-offer)
        if (userId > peerId) initiateOffer(peerId)
      })

      ch.on('presence', { event: 'leave' }, ({ key: peerId }) => {
        closePC(peerId)
      })

      // ── Signaling: offer / answer / ICE ──
      ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== userId) return
        const { from, sdp } = payload
        const pc = createPC(from)
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          send('answer', { from: userId, to: from, sdp: pc.localDescription })
        } catch {}
      })

      ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to !== userId) return
        const pc = pcs.current[payload.from]
        if (!pc) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        } catch {}
      })

      ch.on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.to !== userId) return
        const pc = pcs.current[payload.from]
        if (!pc || !pc.remoteDescription) {
          // Buffer until remote description is set
          iceBuf.current[payload.from] = [
            ...(iceBuf.current[payload.from] || []),
            payload.candidate,
          ]
          return
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch {}
      })

      await ch.subscribe(async (state) => {
        if (state === 'SUBSCRIBED') {
          await ch.track({ userId, displayName })
          if (mounted.current) setStatus('connected')
        }
      })
    }

    init()

    return () => {
      mounted.current = false
      Object.keys(pcs.current).forEach(id => { pcs.current[id]?.close() })
      pcs.current  = {}
      iceBuf.current = {}
      localRef.current?.getTracks().forEach(t => t.stop())
      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {})
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [meetingId, userId, enabled])

  // ── Controls ──────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setAudioEnabled(track.enabled)
  }, [])

  const toggleVideo = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setVideoEnabled(track.enabled)
  }, [])

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack  = screenStream.getVideoTracks()[0]
      const cameraTrack  = localRef.current?.getVideoTracks()[0]

      origTrack.current = cameraTrack

      // Replace the video track in every peer connection
      Object.values(pcs.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        sender?.replaceTrack(screenTrack).catch(() => {})
      })

      // Swap in local stream copy so the preview updates
      if (localRef.current && cameraTrack) {
        localRef.current.removeTrack(cameraTrack)
        localRef.current.addTrack(screenTrack)
        setLocalStream(new MediaStream(localRef.current.getTracks()))
      }

      screenTrack.addEventListener('ended', () => stopScreenShare(), { once: true })
      setScreenSharing(true)
    } catch {
      // User cancelled the picker
    }
  }, [])

  const stopScreenShare = useCallback(async () => {
    const cameraTrack = origTrack.current
    if (!cameraTrack) return

    const screenTrack = localRef.current?.getVideoTracks()[0]
    screenTrack?.stop()

    Object.values(pcs.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video')
      sender?.replaceTrack(cameraTrack).catch(() => {})
    })

    if (localRef.current && screenTrack) {
      localRef.current.removeTrack(screenTrack)
      localRef.current.addTrack(cameraTrack)
      setLocalStream(new MediaStream(localRef.current.getTracks()))
    }

    origTrack.current = null
    setScreenSharing(false)
  }, [])

  const leave = useCallback(() => {
    Object.keys(pcs.current).forEach(id => { pcs.current[id]?.close() })
    pcs.current = {}
    localRef.current?.getTracks().forEach(t => t.stop())
    channelRef.current?.untrack().catch(() => {})
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }, [])

  return {
    localStream, peers, audioEnabled, videoEnabled, screenSharing,
    status, mediaError,
    toggleAudio, toggleVideo, startScreenShare, stopScreenShare, leave,
  }
}
