"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUser } from "@/hooks/useUser"
import { useLinkedInGate } from "@/components/linkedin-gate"
import { Mic, MicOff, Volume2, Loader2, SkipForward, ChevronRight, CheckCircle2, Pencil, X, Check } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

interface Question {
  id: number
  category: string
  question: string
}

type InterviewState = 'ready' | 'idle' | 'loading' | 'ai-speaking' | 'listening' | 'processing' | 'completed'

export default function PersonaInterviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const retakeQuestionId = searchParams.get('retake')
  const { user, loading: userLoading } = useUser()
  const { requireLinkedIn, isLinkedInConnected } = useLinkedInGate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionQueue, setQuestionQueue] = useState<number[]>([]) // Queue of question IDs to ask
  const [interviewState, setInterviewState] = useState<InterviewState>('ready')
  const [userAnswers, setUserAnswers] = useState<Record<number, { question: string; category: string; answer: string }>>({})
  const [skippedQuestions, setSkippedQuestions] = useState<Set<number>>(new Set())
  const [isRecording, setIsRecording] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [userContext, setUserContext] = useState<any>(null)
  const [loadingContext, setLoadingContext] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playedQuestionIdRef = useRef<number>(-1)

  const clerkUserId = user?.clerk_user_id
  // Current question is the first in the queue
  const currentQuestionId = questionQueue[0]
  const currentQuestion = questions.find(q => q.id === currentQuestionId)
  
  // Calculate progress - only count answered (not skipped)
  const answeredCount = Object.keys(userAnswers).length
  const remainingCount = questions.length - answeredCount
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

  // Load questions on mount (but don't start TTS yet)
  useEffect(() => {
    if (!clerkUserId || !isLinkedInConnected) return

    const loadQuestions = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/persona/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clerkUserId })
        })

        const data = await resp.json()
        const loadedQuestions = data.questions || []
        setQuestions(loadedQuestions)
        
        // Load existing answers from user_profile
        const userProfile = data.persona?.user_profile || {}
        const loadedAnswers: Record<number, { question: string; category: string; answer: string }> = {}
        let loadedSkipped: number[] = []
        const answeredIds = new Set<number>()
        
        Object.entries(userProfile).forEach(([key, value]: [string, any]) => {
          const match = key.match(/^question_(\d+)$/)
          if (match && value) {
            const qId = parseInt(match[1])
            if (value.skipped) {
              loadedSkipped.push(qId)
            } else if (value.answer) {
              loadedAnswers[qId] = {
                question: value.question,
                category: value.category,
                answer: value.answer
              }
              answeredIds.add(qId)
            }
          }
        })
        
        // If retaking a specific question, remove it from answers
        if (retakeQuestionId) {
          const retakeId = parseInt(retakeQuestionId)
          delete loadedAnswers[retakeId]
          loadedSkipped = loadedSkipped.filter((id: number) => id !== retakeId)
        }

        setUserAnswers(loadedAnswers)
        setSkippedQuestions(new Set(loadedSkipped))
        
        // Build question queue: skipped questions first, then remaining unanswered
        const allQuestionIds = loadedQuestions.map((q: Question) => q.id)
        const unansweredIds = allQuestionIds.filter((id: number) => 
          !answeredIds.has(id) && !loadedSkipped.includes(id)
        )
        
        // If retaking a question, put it at the front of the queue
        let queue: number[]
        if (retakeQuestionId) {
          const retakeId = parseInt(retakeQuestionId)
          queue = [retakeId, ...loadedSkipped.filter((id: number) => id !== retakeId).sort((a, b) => a - b), ...unansweredIds.filter((id: number) => id !== retakeId)]
        } else {
          // Priority: skipped first (sorted by id), then unanswered (sorted by id)
          queue = [...loadedSkipped.sort((a, b) => a - b), ...unansweredIds]
        }
        
        setQuestionQueue(queue)
        
        // If retaking, auto-start the interview
        if (retakeQuestionId && queue.length > 0) {
          setInterviewState('idle')
        }
        
      } catch (err) {
        console.error('Failed to load questions:', err)
      }
    }

    loadQuestions()
  }, [clerkUserId, retakeQuestionId, isLinkedInConnected])

  // Fetch user context when we have 6+ answered questions
  useEffect(() => {
    if (!clerkUserId || answeredCount < 6 || !isLinkedInConnected) return

    const fetchContext = async () => {
      try {
        setLoadingContext(true)
        const resp = await fetch(`${API_BASE_URL}/api/persona/context/${clerkUserId}`)
        const data = await resp.json()
        if (data.exists && data.context?.user_profile_summary) {
          setUserContext(data.context.user_profile_summary)
        }
      } catch (err) {
        console.error('Failed to fetch user context:', err)
      } finally {
        setLoadingContext(false)
      }
    }

    fetchContext()
  }, [clerkUserId, answeredCount, isLinkedInConnected])

  // Play AI question when question changes (only after interview started)
  useEffect(() => {
    // Only play if: we have a question, state is idle, and we haven't played this question yet
    if (currentQuestion && interviewState === 'idle' && playedQuestionIdRef.current !== currentQuestionId) {
      playedQuestionIdRef.current = currentQuestionId
      playQuestion()
    }
  }, [currentQuestion, interviewState, currentQuestionId])

  const playQuestion = async () => {
    if (!currentQuestion) return

    try {
      setInterviewState('ai-speaking')
      
      const resp = await fetch(`${API_BASE_URL}/api/persona/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentQuestion.question })
      })

      const data = await resp.json()
      
      // Convert base64 to audio and play
      const audioBlob = base64ToBlob(data.audioBase64, 'audio/mpeg')
      const audioUrl = URL.createObjectURL(audioBlob)
      
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      
      audio.onended = () => {
        setInterviewState('idle')
      }
      
      await audio.play()
    } catch (err) {
      console.error('Failed to play question:', err)
      setInterviewState('idle')
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await transcribeAndSave(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setInterviewState('listening')
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setInterviewState('processing')
    }
  }

  const transcribeAndSave = async (audioBlob: Blob) => {
    try {
      console.log('Transcribing audio blob, size:', audioBlob.size)
      
      // Convert blob to base64
      const base64Audio = await blobToBase64(audioBlob)

      // Transcribe
      const transcribeResp = await fetch(`${API_BASE_URL}/api/persona/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64Audio.split(',')[1] })
      })

      if (!transcribeResp.ok) {
        const errorData = await transcribeResp.json()
        throw new Error(errorData.error || 'Transcription failed')
      }

      const { transcription } = await transcribeResp.json()
      console.log('Transcription result:', transcription)

      if (!transcription || transcription.trim() === '') {
        console.warn('Empty transcription received')
        alert('Could not transcribe audio. Please try again or skip.')
        setInterviewState('idle')
        return
      }

      // Save answer
      if (currentQuestion) {
        await saveAnswer(currentQuestion.id, transcription, false)
      }

      // Move to next question
      nextQuestion()
    } catch (err: any) {
      console.error('Failed to transcribe:', err)
      alert(`Error: ${err.message || 'Failed to process audio'}`)
      setInterviewState('idle')
    }
  }

  const saveAnswer = async (questionId: number, answer: string, skipped: boolean) => {
    try {
      console.log('Saving answer:', { questionId, answerLength: answer?.length, skipped })
      
      const resp = await fetch(`${API_BASE_URL}/api/persona/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId,
          questionId,
          answer: skipped ? null : answer,
          skipped
        })
      })

      if (!resp.ok) {
        const errorData = await resp.json()
        throw new Error(errorData.error || 'Failed to save answer')
      }

      const result = await resp.json()
      console.log('Answer saved successfully. Progress:', result.progress)

      if (!skipped && currentQuestion) {
        setUserAnswers(prev => ({ 
          ...prev, 
          [questionId]: {
            question: currentQuestion.question,
            category: currentQuestion.category,
            answer
          }
        }))
      } else if (skipped) {
        setSkippedQuestions(prev => new Set(prev).add(questionId))
      }
    } catch (err: any) {
      console.error('Failed to save answer:', err)
      alert(`Error saving answer: ${err.message}`)
    }
  }

  const skipQuestion = async () => {
    if (currentQuestion) {
      await saveAnswer(currentQuestion.id, '', true)
      nextQuestion()
    }
  }

  const nextQuestion = () => {
    // Remove current question from queue
    setQuestionQueue(prev => {
      const newQueue = prev.slice(1)
      if (newQueue.length === 0) {
        // Go back to ready state which will show profile summary if 6+ answers
        setInterviewState('ready')
      } else {
        setInterviewState('idle')
      }
      return newQueue
    })
  }

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const startEditingAnswer = (questionId: number, currentAnswer: string) => {
    setEditingQuestionId(questionId)
    setEditText(currentAnswer)
  }

  const cancelEditing = () => {
    setEditingQuestionId(null)
    setEditText('')
  }

  const saveEditedAnswer = async (questionId: number) => {
    if (!editText.trim() || !clerkUserId) return

    try {
      setIsSavingEdit(true)
      
      const resp = await fetch(`${API_BASE_URL}/api/persona/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId,
          questionId,
          answer: editText.trim(),
          skipped: false
        })
      })

      if (!resp.ok) {
        throw new Error('Failed to save edited answer')
      }

      // Update local state
      const question = questions.find(q => q.id === questionId)
      if (question) {
        setUserAnswers(prev => ({
          ...prev,
          [questionId]: {
            question: question.question,
            category: question.category,
            answer: editText.trim()
          }
        }))
      }

      // Remove from skipped if it was skipped
      setSkippedQuestions(prev => {
        const newSet = new Set(prev)
        newSet.delete(questionId)
        return newSet
      })

      setEditingQuestionId(null)
      setEditText('')

      // Refresh context after editing (if we have 6+ answers)
      if (answeredCount >= 6) {
        fetch(`${API_BASE_URL}/api/persona/context/${clerkUserId}`)
          .then(res => res.json())
          .then(data => {
            if (data.exists && data.context?.user_profile_summary) {
              setUserContext(data.context.user_profile_summary)
            }
          })
          .catch(err => console.error('Failed to refresh context:', err))
      }
    } catch (err: any) {
      console.error('Failed to save edit:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const retakeQuestion = (questionId: number) => {
    // Remove the answer from local state
    setUserAnswers(prev => {
      const newAnswers = { ...prev }
      delete newAnswers[questionId]
      return newAnswers
    })
    
    // Add to beginning of question queue and start interview
    setQuestionQueue(prev => [questionId, ...prev.filter(id => id !== questionId)])
    setInterviewState('idle')
    playedQuestionIdRef.current = -1 // Reset to allow playing this question
  }

  // Start the interview (user clicks button, unlocking audio autoplay)
  const startInterviewInternal = () => {
    setInterviewState('idle')  // This triggers the useEffect to play first question
  }

  // Wrap with LinkedIn requirement check
  const startInterview = () => {
    requireLinkedIn(startInterviewInternal)
  }

  if (userLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      </AppLayout>
    )
  }

  // Ready screen - user must click to start (unlocks audio autoplay)
  if (interviewState === 'ready') {
    const allAnswered = questionQueue.length === 0 && answeredCount > 0
    const showSummary = answeredCount >= 6 && userContext
    
    // If we have 6+ answers and summary, show summary page with retake interview button
    if (showSummary) {
      return (
        <AppLayout>
          <div className="flex-1 overflow-auto bg-gradient-to-b from-green-50 via-white to-white dark:from-background dark:via-background dark:to-background">
            <div className="max-w-4xl mx-auto py-8 px-4">
              {/* Header with completion message */}
              <div className="mb-8 text-center bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Interview Complete!
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-1">
                  Thank you for sharing. Alphaz has generated your
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  personalized profile based on our conversation.
                </p>
              </div>

              {/* Profile Summary Card */}
              <Card className="p-8 space-y-6 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="h-7 w-7 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Your Profile Summary</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Generated by Alphaz</p>
                  </div>
                </div>

                {/* Summary Content */}
                <div className="space-y-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                  {/* Main Summary Text */}
                  {userContext.raw_summary && (
                    <div className="space-y-2">
                      <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                        {userContext.raw_summary}
                      </p>
                    </div>
                  )}

                  {/* Additional context paragraphs */}
                  {userContext.professional_background && (
                    <div className="space-y-2">
                      <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                        {userContext.professional_background}
                      </p>
                    </div>
                  )}

                  {userContext.communication_style && (
                    <div className="space-y-2">
                      <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                        {userContext.communication_style}
                      </p>
                    </div>
                  )}

                  {userContext.goals_and_impact && (
                    <div className="space-y-2">
                      <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                        {userContext.goals_and_impact}
                      </p>
                    </div>
                  )}
                </div>

                {/* Tags Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personality Traits */}
                  {userContext.personality_traits && userContext.personality_traits.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Personality Traits</h4>
                      <div className="flex flex-wrap gap-2">
                        {userContext.personality_traits.map((trait: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Core Passions */}
                  {userContext.content_themes && userContext.content_themes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Core Passions</h4>
                      <div className="flex flex-wrap gap-2">
                        {userContext.content_themes.map((theme: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-full"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Core Values - Full Width */}
                {userContext.core_values && userContext.core_values.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Core Values</h4>
                    <div className="flex flex-wrap gap-2">
                      {userContext.core_values.map((value: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium rounded-full"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interests & Passions */}
                {userContext.interests_and_passions && userContext.interests_and_passions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Interests & Passions</h4>
                    <div className="flex flex-wrap gap-2">
                      {userContext.interests_and_passions.map((interest: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm font-medium rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Differentiators */}
                {userContext.key_differentiators && userContext.key_differentiators.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Key Differentiators</h4>
                    <div className="flex flex-wrap gap-2">
                      {userContext.key_differentiators.map((diff: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full"
                        >
                          {diff}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unique Perspective */}
                {userContext.unique_perspective && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">Unique Perspective</h4>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {userContext.unique_perspective}
                    </p>
                  </div>
                )}

                {/* Success message */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                        Profile Updated Successfully
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Alphaz will now use this information to create personalized content that authentically represents your voice and perspective.
                      </p>
                    </div>
                  </div>
                </div>

              </Card>

              {/* Add spacing for floating buttons */}
              <div className="h-24"></div>
            </div>

            {/* Floating Action Buttons at Bottom - accounting for sidebar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-[calc(50%+100px)] lg:-translate-x-1/2 z-50">
              <div className="flex gap-3 bg-white dark:bg-gray-900 rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 p-2">
                <Button
                  onClick={() => router.push('/personalization/interview/edit')}
                  variant="outline"
                  className="rounded-full border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 px-6"
                  size="lg"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retake Interview
                </Button>
                <Button
                  onClick={() => router.push('/personalization')}
                  className="rounded-full bg-orange-600 hover:bg-orange-700 text-white px-6"
                  size="lg"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </AppLayout>
      )
    }
    
    // Default ready screen (for <6 answers)
    return (
      <AppLayout>
        <div className="flex-1 overflow-auto p-4 bg-gradient-to-b from-blue-50 to-white dark:from-background dark:via-background dark:to-background">
          <div className="max-w-2xl mx-auto space-y-6 py-8">
            <Card className="p-8 text-center space-y-6">
              <div className={`h-20 w-20 mx-auto rounded-full flex items-center justify-center ${
                allAnswered 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                  : 'bg-orange-100 dark:bg-orange-900/30'
              }`}>
                {allAnswered ? (
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                ) : (
                  <Mic className="h-10 w-10 text-orange-600" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  {allAnswered ? 'All Questions Answered!' : 'User Profile Interview'}
                </h2>
                {allAnswered ? (
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    You've answered all {answeredCount} questions. Generating your profile summary...
                  </p>
                ) : (
                  <>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {answeredCount > 0 
                        ? `You've answered ${answeredCount} of ${questions.length} questions. ${questionQueue.length} remaining.`
                        : `Alphaz will ask you ${questions.length || 8} questions to understand your background and goals.`
                      }
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {answeredCount > 0 ? 'Continue where you left off.' : 'This takes about 5-10 minutes.'}
                    </p>
                  </>
                )}
              </div>
              
              {!allAnswered && (
                <Button
                  onClick={startInterview}
                  size="lg"
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8"
                  disabled={questions.length === 0 || questionQueue.length === 0}
                >
                  {questions.length === 0 ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading...</>
                  ) : answeredCount > 0 ? (
                    <>Continue Interview <ChevronRight className="h-5 w-5 ml-2" /></>
                  ) : (
                    <>Start Interview <ChevronRight className="h-5 w-5 ml-2" /></>
                  )}
                </Button>
              )}
              
              {allAnswered && loadingContext && (
                <div className="flex items-center justify-center gap-2 text-orange-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Generating your profile...</span>
                </div>
              )}
            </Card>

            {/* Show answered questions (for <6 answers) */}
            {answeredCount > 0 && answeredCount < 6 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Your Answers ({answeredCount}/{questions.length})
                </h3>
                <div className="space-y-3">
                  {questions.map((q) => {
                    const answer = userAnswers[q.id]
                    const isSkipped = skippedQuestions.has(q.id)
                    const isAnswered = !!answer
                    
                    return (
                      <Card 
                        key={q.id} 
                        className={`p-4 ${
                          isAnswered 
                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                            : isSkipped
                            ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                            : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {isAnswered ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          ) : isSkipped ? (
                            <SkipForward className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                isAnswered
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : isSkipped
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                                {q.category}
                              </span>
                              {isSkipped && (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400">Skipped</span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {q.question}
                            </p>
                            {isAnswered && (
                              <div className="mt-2">
                                {editingQuestionId === q.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="w-full min-h-[100px] p-3 text-sm border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                      placeholder="Type your answer here..."
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => saveEditedAnswer(q.id)}
                                        disabled={isSavingEdit || !editText.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                      >
                                        {isSavingEdit ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Check className="h-4 w-4" />
                                        )}
                                        <span className="ml-1">Save</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelEditing}
                                        disabled={isSavingEdit}
                                      >
                                        <X className="h-4 w-4" />
                                        <span className="ml-1">Cancel</span>
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 italic pr-8">
                                      "{answer.answer}"
                                    </p>
                                    <button
                                      onClick={() => startEditingAnswer(q.id, answer.answer)}
                                      className="absolute top-0 right-0 p-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
                                      title="Edit answer"
                                    >
                                      <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    )
  }

  if (interviewState === 'completed') {
    return (
      <AppLayout>
        <div className="flex-1 overflow-auto p-4 bg-gradient-to-b from-emerald-50 to-white dark:from-background dark:via-background dark:to-background">
          <div className="max-w-2xl mx-auto space-y-6 py-8">
            <Card className="p-8 text-center space-y-6">
              <div className="h-20 w-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Interview Complete!
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Thank you for sharing your story. You answered {answeredCount} of {questions.length} questions.
                  Alphaz now understands you better and will create more personalized content.
                </p>
              </div>
              <Button
                onClick={() => router.push('/personalization')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Back to Personalization
              </Button>
            </Card>

            {/* Show all answers */}
            {answeredCount > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Your Answers ({answeredCount}/{questions.length})
                </h3>
                <div className="space-y-3">
                  {questions.map((q) => {
                    const answer = userAnswers[q.id]
                    const isSkipped = skippedQuestions.has(q.id)
                    
                    return (
                      <Card 
                        key={q.id} 
                        className={`p-4 ${
                          answer 
                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                            : 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {answer ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <SkipForward className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                answer
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                              }`}>
                                {q.category}
                              </span>
                              {isSkipped && (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400">Skipped</span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {q.question}
                            </p>
                            {answer && (
                              <div className="mt-2">
                                {editingQuestionId === q.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="w-full min-h-[100px] p-3 text-sm border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                      placeholder="Type your answer here..."
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => saveEditedAnswer(q.id)}
                                        disabled={isSavingEdit || !editText.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                      >
                                        {isSavingEdit ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Check className="h-4 w-4" />
                                        )}
                                        <span className="ml-1">Save</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelEditing}
                                        disabled={isSavingEdit}
                                      >
                                        <X className="h-4 w-4" />
                                        <span className="ml-1">Cancel</span>
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 italic pr-8">
                                      "{answer.answer}"
                                    </p>
                                    <button
                                      onClick={() => startEditingAnswer(q.id, answer.answer)}
                                      className="absolute top-0 right-0 p-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
                                      title="Edit answer"
                                    >
                                      <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-gradient-to-b from-blue-50 to-white dark:from-background dark:via-background dark:to-background">
        <div className="max-w-4xl mx-auto py-8 px-4">
          {/* Progress Stats */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Answered: {answeredCount}/{questions.length}
                </span>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Remaining: {remainingCount}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Question {questions.length - questionQueue.length + 1} of {questions.length}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Main Interview Card */}
          <Card className="p-8 space-y-8">
            {/* Visual Status */}
            <div className="flex flex-col items-center space-y-6">
              {/* Avatar */}
              <div className={`relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                interviewState === 'ai-speaking'
                  ? 'bg-orange-100 dark:bg-orange-900/40 ring-4 ring-orange-400 dark:ring-orange-500 ring-opacity-50'
                  : interviewState === 'listening'
                  ? 'bg-blue-100 dark:bg-blue-900/40 ring-4 ring-blue-400 dark:ring-blue-500 ring-opacity-50 animate-pulse'
                  : interviewState === 'processing'
                  ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-400 dark:ring-purple-500'
                  : 'bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-300 dark:ring-gray-700'
              }`}>
                {interviewState === 'ai-speaking' && (
                  <Volume2 className="h-16 w-16 text-orange-500 dark:text-orange-400 animate-pulse" />
                )}
                {interviewState === 'listening' && (
                  <Mic className="h-16 w-16 text-blue-500 dark:text-blue-400" />
                )}
                {interviewState === 'processing' && (
                  <Loader2 className="h-16 w-16 text-purple-500 dark:text-purple-400 animate-spin" />
                )}
                {interviewState === 'idle' && (
                  <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>

              {/* Status Text */}
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  {interviewState === 'ai-speaking' && 'Alphaz is asking...'}
                  {interviewState === 'listening' && 'Listening to your response...'}
                  {interviewState === 'processing' && 'Processing your answer...'}
                  {interviewState === 'idle' && 'Ready for your response'}
                </p>
                {interviewState === 'ai-speaking' && (
                  <div className="flex items-center justify-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1 w-1 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1 w-1 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Question */}
            {currentQuestion && (
              <div className="text-center space-y-3">
                <div className="inline-block px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm font-medium">
                  {currentQuestion.category}
                </div>
                <p className="text-xl text-gray-800 dark:text-gray-200 leading-relaxed">
                  {currentQuestion.question}
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
              <Button
                variant="outline"
                size="lg"
                onClick={skipQuestion}
                disabled={interviewState !== 'idle'}
                className="px-6"
              >
                <SkipForward className="h-5 w-5 mr-2" />
                Skip
              </Button>

              {!isRecording ? (
                <Button
                  size="lg"
                  onClick={startRecording}
                  disabled={interviewState !== 'idle'}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                >
                  <Mic className="h-5 w-5 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={stopRecording}
                  className="bg-red-600 hover:bg-red-700 text-white px-8"
                >
                  <MicOff className="h-5 w-5 mr-2" />
                  Stop & Save
                </Button>
              )}
            </div>

            {/* Helper Text */}
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              {interviewState === 'idle' && "Speak naturally and take your time. Click 'Stop & Save' when you're done."}
              {interviewState === 'listening' && "We're recording your response..."}
              {interviewState === 'processing' && "Converting your speech to text..."}
            </p>
          </Card>

          {/* Answered Questions Section */}
          {answeredCount > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Your Answers ({answeredCount})
              </h3>
              <div className="space-y-3">
                {Object.entries(userAnswers).map(([qId, data]) => (
                  <Card key={qId} className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                            {data.category}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {data.question}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          "{data.answer}"
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
