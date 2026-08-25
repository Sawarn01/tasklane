import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Room, RoomEvent, Track, VideoPresets,
  createLocalAudioTrack, createLocalVideoTrack,
} from 'livekit-client'
import { getLiveKitToken } from '../lib/data'

// ── Audio level monitor ───────────────────────────────────────────────────────
// 5fps (200ms) keeps CPU flat regardless of participant count.
export function watchAudioLevel(stream, onLevel) {
  if (!stream?.getAudioTracks().length) return () => {}
  let ctx, interval
  try {
    ctx = new AudioContext()
    const src     = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    interval = setInterval(() => {
      analyser.getByteFrequencyData(buf)
      onLevel(buf.reduce((a, b) => a + b, 0) / buf.length)
    }, 200)
  } catch {}
  return () => { clearInterval(interval); ctx?.close().catch(() => {}) }
}

export const QUALITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low', AUDIO: 'audio' }

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useWebRTC({ meetingId, userId, displayName, enabled = true }) {
  const [localStream,   setLocalStream]   = useState(null)
  const [peers,         setPeers]         = useState({})
  const [audioEnabled,  setAudioEnabled]  = useState(true)
  const [videoEnabled,  setVideoEnabled]  = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [status,        setStatus]        = useState('connecting')
  const [mediaError,    setMediaError]    = useState(null)

  const roomRef    = useRef(null)
  const mounted    = useRef(true)
  // Stable MediaStream per remote participant — mutated in place so the
  // video element never needs to reinitialize (eliminates the delay/flash).
  const streamMap  = useRef({})

  function getOrCreateStream(identity) {
    if (!streamMap.current[identity]) {
      streamMap.current[identity] = new MediaStream()
    }
    return streamMap.current[identity]
  }

  useEffect(() => {
    if (!enabled || !meetingId || !userId) return
    mounted.current = true

    async function init() {
      let token
      try {
        token = await getLiveKitToken({ roomName: meetingId, displayName })
      } catch (err) {
        console.error('LiveKit token error:', err)
        if (mounted.current) { setStatus('error'); setMediaError('both') }
        return
      }

      const room = new Room({
        // adaptiveStream needs LiveKit React components to observe element sizes.
        // dynacast needs adaptiveStream to know which quality layer to pick.
        // Both disabled → single stream at the explicit bitrate below.
        adaptiveStream: false,
        dynacast:       false,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
          facingMode: 'user',
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
        publishDefaults: {
          videoCodec: 'vp8',
          videoEncoding: {
            maxBitrate:   2_500_000,  // 2.5 Mbps — crisp 720p
            maxFramerate: 30,
          },
          audioEncoding: {
            maxBitrate: 64_000,       // 64 kbps — clear voice
          },
          dtx:                true,   // silence → minimal audio bandwidth
          red:                true,   // audio packet-loss redundancy
          stopMicTrackOnMute: false,
        },
      })
      roomRef.current = room

      // ── Track events: mutate the stable MediaStream, don't replace it ────────
      // Replacing stream causes VideoTile to re-set srcObject which stalls the
      // decoder for ~200-400ms. Mutating tracks is invisible to the video element.
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return
        const ms = getOrCreateStream(participant.identity)
        try { ms.addTrack(track.mediaStreamTrack) } catch {}
        if (!mounted.current) return
        setPeers(prev => ({
          ...prev,
          [participant.identity]: {
            ...prev[participant.identity],
            stream:       ms,
            displayName:  participant.name || participant.identity,
            videoEnabled: participant.isCameraEnabled,
            audioEnabled: participant.isMicrophoneEnabled,
          },
        }))
      })

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        const ms = streamMap.current[participant.identity]
        if (ms) try { ms.removeTrack(track.mediaStreamTrack) } catch {}
        if (!mounted.current) return
        setPeers(prev => ({
          ...prev,
          [participant.identity]: {
            ...prev[participant.identity],
            videoEnabled: participant.isCameraEnabled,
            audioEnabled: participant.isMicrophoneEnabled,
          },
        }))
      })

      room.on(RoomEvent.TrackMuted, (_pub, participant) => {
        if (!mounted.current) return
        setPeers(prev => ({
          ...prev,
          [participant.identity]: {
            ...prev[participant.identity],
            videoEnabled: participant.isCameraEnabled,
            audioEnabled: participant.isMicrophoneEnabled,
          },
        }))
      })

      room.on(RoomEvent.TrackUnmuted, (_pub, participant) => {
        if (!mounted.current) return
        setPeers(prev => ({
          ...prev,
          [participant.identity]: {
            ...prev[participant.identity],
            videoEnabled: participant.isCameraEnabled,
            audioEnabled: participant.isMicrophoneEnabled,
          },
        }))
      })

      room.on(RoomEvent.ParticipantConnected, participant => {
        if (!mounted.current) return
        setPeers(prev => ({
          ...prev,
          [participant.identity]: {
            ...prev[participant.identity],
            stream:       getOrCreateStream(participant.identity),
            displayName:  participant.name || participant.identity,
            videoEnabled: true,
            audioEnabled: true,
          },
        }))
      })

      room.on(RoomEvent.ParticipantDisconnected, participant => {
        delete streamMap.current[participant.identity]
        if (!mounted.current) return
        setPeers(prev => { const n = { ...prev }; delete n[participant.identity]; return n })
      })

      room.on(RoomEvent.Disconnected, () => {
        if (mounted.current) setStatus('error')
      })

      try {
        await room.connect(import.meta.env.VITE_LIVEKIT_URL, token)
      } catch (err) {
        console.error('LiveKit connect error:', err)
        if (mounted.current) { setStatus('error'); setMediaError('both') }
        return
      }

      // Publish local tracks
      const [audioResult, videoResult] = await Promise.allSettled([
        createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 }),
        createLocalVideoTrack({ resolution: VideoPresets.h720.resolution, facingMode: 'user' }),
      ])

      if (audioResult.status === 'fulfilled') {
        await room.localParticipant.publishTrack(audioResult.value).catch(() => {})
      }
      if (videoResult.status === 'fulfilled') {
        await room.localParticipant.publishTrack(videoResult.value).catch(() => {})
      } else {
        if (mounted.current) setMediaError('camera')
      }

      if (!mounted.current) { room.disconnect(); return }

      // Build local stream from LiveKit's published track references
      const localMs = new MediaStream()
      room.localParticipant.trackPublications.forEach(pub => {
        if (pub.track && (pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio)) {
          try { localMs.addTrack(pub.track.mediaStreamTrack) } catch {}
        }
      })

      // Snapshot existing remote participants
      room.remoteParticipants.forEach((p, identity) => {
        const ms = getOrCreateStream(identity)
        p.trackPublications.forEach(pub => {
          if (pub.isSubscribed && pub.track &&
              (pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio)) {
            try { ms.addTrack(pub.track.mediaStreamTrack) } catch {}
          }
        })
        setPeers(prev => ({
          ...prev,
          [identity]: {
            stream:       ms.getTracks().length ? ms : null,
            displayName:  p.name || identity,
            videoEnabled: p.isCameraEnabled,
            audioEnabled: p.isMicrophoneEnabled,
          },
        }))
      })

      setLocalStream(localMs.getTracks().length ? localMs : null)
      setStatus('connected')
    }

    init()

    return () => {
      mounted.current = false
      streamMap.current = {}
      roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [meetingId, userId, enabled])

  // ── Controls ───────────────────────────────────────────────────────────────
  const toggleAudio = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isMicrophoneEnabled
    await room.localParticipant.setMicrophoneEnabled(next).catch(() => {})
    if (mounted.current) setAudioEnabled(next)
  }, [])

  const toggleVideo = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isCameraEnabled
    await room.localParticipant.setCameraEnabled(next).catch(() => {})
    if (mounted.current) {
      setVideoEnabled(next)
      // Rebuild localStream so VideoTile reflects the toggled track state
      const ms = new MediaStream()
      room.localParticipant.trackPublications.forEach(pub => {
        if (pub.track && (pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio)) {
          try { ms.addTrack(pub.track.mediaStreamTrack) } catch {}
        }
      })
      setLocalStream(ms.getTracks().length ? ms : null)
    }
  }, [])

  const startScreenShare = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      await room.localParticipant.setScreenShareEnabled(true)
      if (mounted.current) setScreenSharing(true)
    } catch {}
  }, [])

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    await room.localParticipant.setScreenShareEnabled(false).catch(() => {})
    if (mounted.current) setScreenSharing(false)
  }, [])

  const leave = useCallback(() => {
    streamMap.current = {}
    roomRef.current?.disconnect()
    roomRef.current = null
  }, [])

  const setTxQuality       = useCallback(() => {}, [])
  const requestQualityFrom = useCallback(() => {}, [])

  return {
    localStream, peers, audioEnabled, videoEnabled, screenSharing, status, mediaError,
    toggleAudio, toggleVideo, startScreenShare, stopScreenShare, leave,
    setTxQuality, requestQualityFrom, QUALITY,
  }
}
