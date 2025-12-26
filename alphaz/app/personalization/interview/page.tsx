"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUser } from "@/hooks/useUser"
import { Mic, MicOff, Volume2, Loader2, SkipForward, ChevronRight, CheckCircle2 } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

interface Question {
  id: number
  category: string
  question: string
}

type InterviewState = 'ready' | 'idle' | 'loading' | 'ai-speaking' | 'listening' | 'processing' | 'completed'

export default function PersonaInterviewPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionQueue, setQuestionQueue] = useState<number[]>([]) // Queue of question IDs to ask
  const [interviewState, setInterviewState] = useState<InterviewState>('ready')
  const [userAnswers, setUserAnswers] = useState<Record<number, { question: string; category: string; answer: string }>>({})
  const [skippedQuestions, setSkippedQuestions] = useState<Set<number>>(new Set())
  const [isRecording, setIsRecording] = useState(false)
  
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
    if (!clerkUserId) return

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
        const loadedSkipped: number[] = []
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
        
        setUserAnswers(loadedAnswers)
        setSkippedQuestions(new Set(loadedSkipped))
        
        // Build question queue: skipped questions first, then remaining unanswered
        const allQuestionIds = loadedQuestions.map((q: Question) => q.id)
        const unansweredIds = allQuestionIds.filter((id: number) => 
          !answeredIds.has(id) && !loadedSkipped.includes(id)
        )
        
        // Priority: skipped first (sorted by id), then unanswered (sorted by id)
        const queue = [...loadedSkipped.sort((a, b) => a - b), ...unansweredIds]
        setQuestionQueue(queue)
        
      } catch (err) {
        console.error('Failed to load questions:', err)
      }
    }

    loadQuestions()
  }, [clerkUserId])

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
        setInterviewState('completed')
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

  // Start the interview (user clicks button, unlocking audio autoplay)
  const startInterview = () => {
    setInterviewState('idle')  // This triggers the useEffect to play first question
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
    
    return (
      <AppLayout>
        <div className="flex-1 overflow-auto p-4 bg-gradient-to-b from-blue-50 to-white dark:from-background dark:to-background">
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
                    You've answered all {answeredCount} questions. Alphaz now understands you better!
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
              
              {allAnswered && (
                <Button
                  onClick={() => router.push('/personalization')}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Back to Personalization
                </Button>
              )}
            </Card>

            {/* Show answered questions */}
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
                              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                "{answer.answer}"
                              </p>
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
        <div className="flex-1 overflow-auto p-4 bg-gradient-to-b from-emerald-50 to-white dark:from-background dark:to-background">
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
                              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                "{answer.answer}"
                              </p>
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
      <div className="flex-1 overflow-auto bg-gradient-to-b from-blue-50 to-white dark:from-background dark:to-background">
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
