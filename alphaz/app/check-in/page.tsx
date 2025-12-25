"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useUser } from "@/hooks/useUser"
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

interface PersonaData {
  writingStyle?: string
  audience?: string
  contentThemes?: string[]
  summary?: string
}

interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
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
  
  // Collected persona data
  const [personaData, setPersonaData] = useState<PersonaData | null>(null)
  const [existingPersona, setExistingPersona] = useState<any>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  
  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  const clerkUserId = user?.clerk_user_id

  // Check status on mount
  useEffect(() => {
    if (!clerkUserId || !isPersonalProfile) return
    
    const checkStatus = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/checkin/status/${clerkUserId}`)
        const data = await resp.json()
        
        if (data.blocked) {
          setBlocked(true)
          setMessage("Your persona has already been captured. Check-in is complete!")
          setCallStatus('completed')
          if (data.persona) {
            setExistingPersona(data.persona)
          }
        }
      } catch (err) {
        console.error('Failed to check status:', err)
      }
    }
    
    checkStatus()
  }, [clerkUserId, isPersonalProfile])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCall()
    }
  }, [])

  const cleanupCall = useCallback(() => {
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

  const savePersona = useCallback(async (data: PersonaData) => {
    if (!clerkUserId) return
    
    try {
      const resp = await fetch(`${API_BASE_URL}/api/checkin/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkUserId,
          writingStyle: data.writingStyle,
          audience: data.audience,
          contentThemes: data.contentThemes,
          summary: data.summary,
          rawTranscript: transcript.map(t => `${t.role}: ${t.text}`).join('\n')
        }),
      })

      const result = await resp.json()

      if (!resp.ok) {
        setMessage(result?.reason || result?.error || "Failed to save persona")
        return false
      }

      setBlocked(true)
      setCallStatus('completed')
      setMessage("Your persona has been captured successfully!")
      return true
    } catch (err: any) {
      setMessage(err?.message || "Failed to save persona")
      return false
    }
  }, [clerkUserId, transcript])

  const handleFunctionCall = useCallback(async (functionName: string, args: any) => {
    if (functionName === 'save_persona') {
      console.log('Saving persona:', args)
      const data: PersonaData = {
        writingStyle: args.writing_style,
        audience: args.audience,
        contentThemes: args.content_themes,
        summary: args.summary
      }
      setPersonaData(data)
      await savePersona(data)
      
      // Send function result back
      if (dataChannelRef.current?.readyState === 'open') {
        dataChannelRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: args.call_id,
            output: JSON.stringify({ success: true, message: 'Persona saved successfully' })
          }
        }))
      }
    }
  }, [savePersona])

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
          setMessage("Your persona has already been captured.")
          return
        }
        throw new Error(err.error || 'Failed to get session token')
      }

      const { ephemeralKey } = await tokenResp.json()
      
      if (!ephemeralKey) {
        throw new Error('No ephemeral key received')
      }

      // Create peer connection
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

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
        // Send initial greeting trigger
        dc.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions: 'Greet the user warmly and introduce yourself. Then ask your first question about their writing style preferences.'
          }
        }))
      }

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data)
        console.log('Realtime event:', event.type, event)

        switch (event.type) {
          case 'response.audio_transcript.delta':
            // AI speaking - update transcript
            break
            
          case 'response.audio_transcript.done':
            // AI finished speaking
            if (event.transcript) {
              setTranscript(prev => [...prev, {
                role: 'assistant',
                text: event.transcript,
                timestamp: new Date()
              }])
            }
            break
            
          case 'conversation.item.input_audio_transcription.completed':
            // User finished speaking
            if (event.transcript) {
              setTranscript(prev => [...prev, {
                role: 'user',
                text: event.transcript,
                timestamp: new Date()
              }])
            }
            break

          case 'response.function_call_arguments.done':
            // Function call completed
            if (event.name && event.arguments) {
              try {
                const args = JSON.parse(event.arguments)
                args.call_id = event.call_id
                handleFunctionCall(event.name, args)
              } catch (err) {
                console.error('Failed to parse function args:', err)
              }
            }
            break

          case 'error':
            console.error('Realtime error:', event.error)
            setMessage(`Error: ${event.error?.message || 'Unknown error'}`)
            break
        }
      }

      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResp = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
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
    
    // If we have persona data already, it's saved
    // Otherwise just cleanup
    cleanupCall()
    
    if (!personaData) {
      setCallStatus('idle')
      setMessage('Call ended. Start again to complete your check-in.')
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-background dark:to-background">
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Personal Check-in</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Have a voice conversation with AI to capture your writing persona
            </p>
          </div>
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
                {callStatus === 'active' && "Speak naturally - the AI will guide you"}
                {callStatus === 'completed' && "Your writing persona has been saved"}
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
                {transcript.map((entry, idx) => (
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

          {/* Captured persona preview - from current session or existing data */}
          {(personaData || existingPersona) && callStatus === 'completed' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Captured Persona</h3>
              
              {(personaData?.writingStyle || existingPersona?.writing_style) && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Writing Style</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{personaData?.writingStyle || existingPersona?.writing_style}</p>
                </div>
              )}
              
              {(personaData?.audience || existingPersona?.audience) && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Target Audience</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{personaData?.audience || existingPersona?.audience}</p>
                </div>
              )}
              
              {((personaData?.contentThemes && personaData.contentThemes.length > 0) || existingPersona?.content_themes) && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Content Themes</label>
                  <ul className="mt-1 space-y-1">
                    {(personaData?.contentThemes || existingPersona?.content_themes?.split('\n') || []).map((theme: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-900 dark:text-gray-100 flex items-start gap-2">
                        <span className="text-orange-500">•</span>
                        {theme}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {existingPersona?.raw_persona?.summary && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Summary</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{existingPersona.raw_persona.summary}</p>
                </div>
              )}

              {existingPersona?.created_at && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Captured on {new Date(existingPersona.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Info section */}
        <Card className="p-4 bg-gray-50 dark:bg-card border-gray-200 dark:border-border">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">How it works</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Click "Start Check-in Call" to begin a voice conversation</li>
            <li>• The AI will ask about your writing style, audience, and content themes</li>
            <li>• Speak naturally - the AI will guide the conversation</li>
            <li>• Your persona is automatically saved when the conversation ends</li>
            <li>• This is a one-time check-in per user</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
