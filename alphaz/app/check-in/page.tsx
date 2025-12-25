"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useUser } from "@/hooks/useUser"
import { AppLayout } from "@/components/app-layout"
import { 
  Loader2, 
  Sparkles, 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff,
  CheckCircle2,
  AlertCircle,
  Volume2
} from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

type CallStatus = 'idle' | 'connecting' | 'active' | 'ending' | 'completed' | 'error'

interface InsightItem {
  title?: string
  summary?: string
  headline?: string
  description?: string
  angle?: string
  why_it_matters?: string
  suggested_angle?: string
}

interface CheckinRecord {
  id?: string
  key_insights: InsightItem[]
  content_ideas: InsightItem[]
  created_at?: string
  duration_seconds?: number | null
  user_name?: string
  model?: string
  transcript?: string
}

interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
  seq: number
}

export default function CheckInPage() {
  const { isPersonalProfile } = useOrganization()
  const { user, loading: userLoading } = useUser()

  // Call state
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [blocked, setBlocked] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  
  // Insights/results
  const [record, setRecord] = useState<CheckinRecord | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [nextAllowedAt, setNextAllowedAt] = useState<string | null>(null)
  const [history, setHistory] = useState<CheckinRecord[]>([])
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<CheckinRecord | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  
  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const callStartRef = useRef<number | null>(null)
  const autoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptSeqRef = useRef<number>(0)
  // Track conversation item order from OpenAI Realtime events
  const itemOrderRef = useRef<string[]>([])

  const clerkUserId = user?.clerk_user_id

  // Check status on mount
  useEffect(() => {
    if (!clerkUserId || !isPersonalProfile) return
    
    const checkStatus = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/checkin/status/${clerkUserId}`)
        const data = await resp.json()
        
        setRemaining(data.remaining ?? null)
        setNextAllowedAt(data.nextAllowedAt || data.nextAvailableAt || null)
        if (Array.isArray(data.recentCalls)) {
          setHistory(data.recentCalls)
        }
        if (data.latestCall) {
          setRecord(data.latestCall)
        }

        if (data.blocked) {
          setBlocked(true)
          setMessage(data.reason || "Daily limit reached. Try again later.")
          setCallStatus('completed')
        }
      } catch (err) {
        console.error('Failed to check status:', err)
      }
    }
    
    checkStatus()
  }, [clerkUserId, isPersonalProfile])

  // Default to most recent history item when available
  useEffect(() => {
    if (history.length > 0 && !selectedHistory) {
      setSelectedHistory(history[0])
    }
  }, [history, selectedHistory])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCall()
    }
  }, [])

  const cleanupCall = useCallback(() => {
    if (autoEndTimeoutRef.current) {
      clearTimeout(autoEndTimeoutRef.current)
      autoEndTimeoutRef.current = null
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null
    }
  }, [])

  const stopRealtimeSession = useCallback(() => {
    // Close local resources; Realtime auto-terminates when peer closes
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.close()
      } catch (err) {
        console.warn('Failed to close data channel', err)
      }
    }
  }, [])

  const saveInsights = useCallback(async () => {
    if (!clerkUserId) return false

    const transcriptText = transcript.map(t => `${t.role}: ${t.text}`).join('\n')
    const durationSeconds = callStartRef.current
      ? Math.max(1, Math.round((Date.now() - callStartRef.current) / 1000))
      : null

    try {
      const resp = await fetch(`${API_BASE_URL}/api/checkin/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId, transcript: transcriptText, durationSeconds })
      })

      const result = await resp.json()

      if (!resp.ok) {
        setMessage(result?.reason || result?.error || "Failed to save insights")
        if (result?.nextAllowedAt) setNextAllowedAt(result.nextAllowedAt)
        return false
      }

      setRecord(result.record)
      if (result.record) {
        setHistory(prev => {
          const filtered = prev.filter(r => r.id !== result.record.id)
          return [result.record, ...filtered].slice(0, 5)
        })
      }
      setRemaining(result.remaining ?? null)
      setNextAllowedAt(result.nextAllowedAt || null)
      setBlocked(result.remaining === 0)
      setCallStatus('completed')
      setMessage('Check-in saved. Here are your insights and ideas!')
      return true
    } catch (err: any) {
      setMessage(err?.message || "Failed to save insights")
      return false
    }
  }, [clerkUserId, transcript])

  const startCall = async () => {
    if (!clerkUserId) return
    
    setCallStatus('connecting')
    setMessage(null)
    setTranscript([])

    try {
      // Get ephemeral token from backend
      const tokenResp = await fetch(`${API_BASE_URL}/api/checkin/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId })
      })

      if (!tokenResp.ok) {
        const err = await tokenResp.json()
        if (err.blocked) {
          setBlocked(true)
          setCallStatus('completed')
          setMessage(err.reason || "Daily check-in limit reached.")
          return
        }
        throw new Error(err.error || 'Failed to get session token')
      }

      const { ephemeralKey, model } = await tokenResp.json()
      
      if (!ephemeralKey) {
        throw new Error('No ephemeral key received')
      }
      
      const realtimeModel = model || 'gpt-realtime-mini-2025-10-06'

      // Create peer connection
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          stopRealtimeSession()
          cleanupCall()
          if (callStatus !== 'completed') {
            setCallStatus('idle')
            setMessage('Call ended.')
          }
        }
      }

      // Set up audio element for AI voice
      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioElementRef.current = audioEl
      
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0]
        // Track when AI is speaking via audio activity
        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(e.streams[0])
        const analyser = audioContext.createAnalyser()
        source.connect(analyser)
        
        const checkAudio = () => {
          if (callStatus !== 'active') return
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setIsAISpeaking(average > 10)
          requestAnimationFrame(checkAudio)
        }
        checkAudio()
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      pc.addTrack(stream.getTracks()[0])

      // Set up data channel for events
      const dc = pc.createDataChannel('oai-events')
      dataChannelRef.current = dc

      dc.onopen = () => {
        console.log('Data channel open')
        // Send initial prompt (AI starts the convo proactively, calm pace, one question per turn)
        dc.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions: `Start the call yourself (user hasn't spoken yet). Keep it casual, calm, and unhurried. Ask EXACTLY ONE short question per turn—never stack or offer multiple choices in the same message. Open with: "I'll kick us off—share a quick highlight from today." After they answer, continue one-by-one: what made it stand out; any challenges or lessons; what they're excited to work on next; one LinkedIn-worthy idea. Brief acknowledgements only. Do NOT ask them to end the call—the system will wrap up.`
          }
        }))
      }

      // Reset item order tracking for new call
      itemOrderRef.current = []
      transcriptSeqRef.current = 0

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data)
        console.log('Realtime event:', event.type, event)

        switch (event.type) {
          case 'conversation.item.created':
            // A new conversation item (user or assistant) was created
            // This gives us the TRUE order of the conversation
            if (event.item?.id) {
              itemOrderRef.current.push(event.item.id)
              console.log('Item order updated:', itemOrderRef.current)
            }
            break

          case 'response.audio_transcript.delta':
            // AI speaking - update transcript
            break
            
          case 'response.audio_transcript.done':
            // AI finished speaking - use item_id for ordering
            if (event.transcript) {
              const itemId = event.item_id || `assistant-${Date.now()}`
              const order = itemOrderRef.current.indexOf(itemId)
              console.log('Assistant transcript done, item_id:', itemId, 'order:', order)
              setTranscript(prev => [...prev, {
                role: 'assistant',
                text: event.transcript,
                timestamp: new Date(),
                seq: order >= 0 ? order : 1000 + transcriptSeqRef.current++
              }])
            }
            break
            
          case 'conversation.item.input_audio_transcription.completed': {
            // User finished speaking - use item_id for ordering
            if (event.transcript) {
              const itemId = event.item_id || `user-${Date.now()}`
              const order = itemOrderRef.current.indexOf(itemId)
              console.log('User transcript done, item_id:', itemId, 'order:', order)
              setTranscript(prev => [...prev, {
                role: 'user',
                text: event.transcript,
                timestamp: new Date(),
                seq: order >= 0 ? order : 1000 + transcriptSeqRef.current++
              }])

              // Auto-end the call after a short pause (system ends, not user)
              if (autoEndTimeoutRef.current) clearTimeout(autoEndTimeoutRef.current)
              autoEndTimeoutRef.current = setTimeout(() => {
                if (callStatus === 'active') {
                  endCall()
                }
              }, 12000) // 12s of silence after user speech
            }
            break
          }

          case 'error':
            console.error('Realtime error:', event.error)
            setMessage(`Error: ${event.error?.message || 'Unknown error'}`)
            break
        }
      }

      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResp = await fetch(`https://api.openai.com/v1/realtime?model=${realtimeModel}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      })

      if (!sdpResp.ok) {
        throw new Error('Failed to establish WebRTC connection')
      }

      const answerSdp = await sdpResp.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      setCallStatus('active')

    } catch (err: any) {
      console.error('Call error:', err)
      setMessage(err?.message || 'Failed to start call')
      setCallStatus('error')
      cleanupCall()
    }
  }

  const endCall = async () => {
    setCallStatus('ending')
    stopRealtimeSession()
    await saveInsights()
    cleanupCall()
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const isLoading = userLoading
  const canStartCall = !isLoading && isPersonalProfile && !blocked && callStatus === 'idle'
  const orderedTranscript = useMemo(() => {
    return [...transcript].sort((a, b) => {
      if (a.seq !== undefined && b.seq !== undefined) return a.seq - b.seq
      const tDiff = a.timestamp.getTime() - b.timestamp.getTime()
      return tDiff !== 0 ? tDiff : 0
    })
  }, [transcript])

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-gradient-to-b from-orange-50 to-white dark:from-background dark:to-background">
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Voice Check-in</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Quick 4-minute chat to capture 3 key insights and 3 LinkedIn ideas
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="ml-auto inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 text-xs border border-blue-200 dark:border-blue-800"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              {history.length} previous check-in{history.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Personal profile guard */}
        {!isPersonalProfile && (
          <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>Switch to your personal profile to run check-in.</span>
            </div>
          </Card>
        )}

        {/* Status message */}
        {message && (
          <Card className={`p-4 ${
            callStatus === 'completed' 
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200'
              : callStatus === 'error'
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {callStatus === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span>{message}</span>
            </div>
          </Card>
        )}

        {/* Main call card */}
        <Card className="p-6 space-y-6 bg-white dark:bg-card border-gray-200 dark:border-border">
          {/* Call status indicator */}
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            {/* Avatar/Status visual */}
            <div className={`relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              callStatus === 'active' 
                ? isAISpeaking 
                  ? 'bg-orange-100 dark:bg-orange-900/40 ring-4 ring-orange-400 dark:ring-orange-500 ring-opacity-50 animate-pulse'
                  : 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-300 dark:ring-orange-700'
                : callStatus === 'connecting'
                ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-300 dark:ring-blue-700 animate-pulse'
                : callStatus === 'completed'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-300 dark:ring-emerald-700'
                : 'bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-200 dark:ring-gray-700'
            }`}>
              {callStatus === 'completed' ? (
                <CheckCircle2 className="h-16 w-16 text-emerald-500 dark:text-emerald-400" />
              ) : callStatus === 'active' ? (
                <Volume2 className={`h-16 w-16 text-orange-500 dark:text-orange-400 ${isAISpeaking ? 'animate-pulse' : ''}`} />
              ) : callStatus === 'connecting' ? (
                <Loader2 className="h-16 w-16 text-blue-500 dark:text-blue-400 animate-spin" />
              ) : (
                <Mic className="h-16 w-16 text-gray-400 dark:text-gray-500" />
              )}
            </div>

            {/* Status text */}
            <div className="text-center space-y-1">
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {callStatus === 'idle' && 'Ready to Start'}
                {callStatus === 'connecting' && 'Connecting...'}
                {callStatus === 'active' && (isAISpeaking ? 'AI is speaking...' : 'Listening...')}
                {callStatus === 'ending' && 'Ending call...'}
                {callStatus === 'completed' && 'Check-in Complete!'}
                {callStatus === 'error' && 'Connection Error'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {callStatus === 'idle' && "Click the button below to start your voice check-in"}
                {callStatus === 'active' && "Speak naturally - the AI will guide you; we'll end automatically"}
                {callStatus === 'completed' && "Insights and ideas are ready below"}
              </p>
            </div>

            {/* Call controls */}
            <div className="flex items-center gap-4">
              {callStatus === 'idle' && (
                <Button
                  size="lg"
                  onClick={startCall}
                  disabled={!canStartCall}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg rounded-full"
                >
                  <Phone className="h-6 w-6 mr-2" />
                  Start Check-in Call
                </Button>
              )}

              {callStatus === 'connecting' && (
                <Button
                  size="lg"
                  disabled
                  className="bg-blue-600 text-white px-8 py-6 text-lg rounded-full opacity-75"
                >
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                  Connecting...
                </Button>
              )}

              {callStatus === 'active' && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={toggleMute}
                    className={`px-6 py-6 rounded-full ${
                      isMuted 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400' 
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                  <Button
                    size="lg"
                    onClick={endCall}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-lg rounded-full"
                  >
                    <PhoneOff className="h-6 w-6 mr-2" />
                    End Call
                  </Button>
                </>
              )}

              {callStatus === 'error' && (
                <Button
                  size="lg"
                  onClick={() => setCallStatus('idle')}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-6 text-lg rounded-full"
                >
                  Try Again
                </Button>
              )}
            </div>
          </div>

          {/* Live transcript */}
          {transcript.length > 0 && callStatus !== 'completed' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Conversation</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {orderedTranscript.map((entry, idx) => (
                  <div 
                    key={idx}
                    className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      entry.role === 'user'
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}>
                      {entry.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
              {/* Results */}
              {record && callStatus === 'completed' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                  <div className="flex flex-col items-center text-center gap-2 py-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <Sparkles className="h-6 w-6 text-emerald-600" />
                    <div>
                      <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-100">Check-in Complete!</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-200">Great conversation! Here's what we captured from your check-in.</p>
                      {record.duration_seconds && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-100">
                          <span>⏱</span>
                          <span>{Math.floor(record.duration_seconds / 60)}:{String(record.duration_seconds % 60).padStart(2, '0')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">3 Key Insights</span>
                      </div>
                      <div className="space-y-2">
                        {record.key_insights?.map((item, idx) => (
                          <div key={idx} className="rounded-md bg-white dark:bg-emerald-900/40 p-2 border border-emerald-100 dark:border-emerald-800">
                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-50">{item.title}</p>
                            {item.summary && <p className="text-sm text-emerald-700 dark:text-emerald-200 mt-1">{item.summary}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-100">3 Content Ideas</span>
                      </div>
                      <div className="space-y-2">
                        {record.content_ideas?.map((item, idx) => (
                          <div key={idx} className="rounded-md bg-white dark:bg-blue-900/40 p-2 border border-blue-100 dark:border-blue-800">
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-50">{item.title || item.headline}</p>
                            <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">{item.description || item.why_it_matters}</p>
                            {(item.angle || item.suggested_angle) && (
                              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Angle: {item.angle || item.suggested_angle}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
        </Card>

        {/* History modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-semibold">H</div>
                <div className="flex-1">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">History</p>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Previous check-ins</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mr-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {history.length} record{history.length !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                  aria-label="Close history"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 max-h-[85vh] overflow-y-auto">
                  <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {history.map((record, index) => {
                      const isSelected = selectedHistory?.id === record.id || (!selectedHistory && index === 0)
                      return (
                        <li key={record.id || index}>
                          <button
                            onClick={() => setSelectedHistory(record)}
                            className={`w-full text-left px-5 py-4 flex items-start gap-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60 ${isSelected ? 'bg-neutral-50 dark:bg-neutral-800/60' : ''}`}
                          >
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-semibold">
                              {record.user_name ? record.user_name.charAt(0).toUpperCase() : 'H'}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-neutral-500 dark:text-neutral-400">{record.user_name || 'You'}</p>
                              <p className="text-sm text-neutral-900 dark:text-white">{record.created_at ? new Date(record.created_at).toLocaleString() : 'Previous call'}</p>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">#{history.length - index}</p>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                              {record.model || 'GPT-5.1'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="flex-1 max-h-[85vh] overflow-y-auto p-6">
                  {(() => {
                    const record = selectedHistory || history[0]
                    if (!record) return (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">No previous check-ins yet.</div>
                    )
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-semibold text-lg">
                            {record.user_name ? record.user_name.charAt(0).toUpperCase() : 'H'}
                          </div>
                          <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">{record.user_name || 'You'}</p>
                            <p className="text-base text-neutral-900 dark:text-white font-semibold">{record.created_at ? new Date(record.created_at).toLocaleString() : 'Previous call'}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Model: {record.model || 'GPT-5.1'} • Duration: {record.duration_seconds ? `${Math.floor(record.duration_seconds / 60)}:${String(record.duration_seconds % 60).padStart(2, '0')}` : '—'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-lg bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/70">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Insights</p>
                            </div>
                            <ul className="space-y-2 text-sm text-neutral-800 dark:text-neutral-200 list-disc list-inside">
                              {record.key_insights?.length ? (
                                record.key_insights.map((insight, idx) => (
                                  <li key={idx}>
                                    <div className="font-semibold text-neutral-900 dark:text-white">{insight.title}</div>
                                    {insight.summary && <div className="text-neutral-700 dark:text-neutral-300 text-sm">{insight.summary}</div>}
                                  </li>
                                ))
                              ) : (
                                <li className="list-none text-neutral-500 dark:text-neutral-400">No insights captured.</li>
                              )}
                            </ul>
                          </div>

                          <div className="p-4 rounded-lg bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/70">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="h-2 w-2 rounded-full bg-amber-500" />
                              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Ideas</p>
                            </div>
                            <ul className="space-y-2 text-sm text-neutral-800 dark:text-neutral-200 list-disc list-inside">
                              {record.content_ideas?.length ? (
                                record.content_ideas.map((idea, idx) => (
                                  <li key={idx}>
                                    <div className="font-semibold text-neutral-900 dark:text-white">{idea.title || idea.headline}</div>
                                    {(idea.description || idea.why_it_matters) && <div className="text-neutral-700 dark:text-neutral-300 text-sm">{idea.description || idea.why_it_matters}</div>}
                                    {(idea.angle || idea.suggested_angle) && <div className="text-xs text-neutral-600 dark:text-neutral-400">Angle: {idea.angle || idea.suggested_angle}</div>}
                                  </li>
                                ))
                              ) : (
                                <li className="list-none text-neutral-500 dark:text-neutral-400">No ideas captured.</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {record.transcript && (
                          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              Transcript
                            </div>
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{record.transcript}</p>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info section */}
        <Card className="p-4 bg-gray-50 dark:bg-card border-gray-200 dark:border-border">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">How it works</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Click "Start Check-in Call" for a short guided chat</li>
            <li>• The AI asks about wins, blockers, and ideas (under 4 minutes)</li>
            <li>• When you end the call, we extract 3 insights and 3 content ideas</li>
            <li>• Limit: 2 check-ins per 24 hours</li>
          </ul>
        </Card>
        </div>
      </div>
    </AppLayout>
  )
}
