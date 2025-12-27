"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUser } from "@/hooks/useUser"
import { CheckCircle2, SkipForward, Pencil, X, Check, Loader2, Mic, ArrowLeft } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

interface Question {
  id: number
  category: string
  question: string
}

export default function EditInterviewPage() {
  const router = useRouter()
  const { user } = useUser()
  const [questions, setQuestions] = useState<Question[]>([])
  const [userAnswers, setUserAnswers] = useState<Record<number, { question: string; category: string; answer: string }>>({})
  const [skippedQuestions, setSkippedQuestions] = useState<Set<number>>(new Set())
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  const clerkUserId = user?.clerk_user_id
  const answeredCount = Object.keys(userAnswers).length

  // Load questions and answers on mount
  useEffect(() => {
    if (!clerkUserId) return

    const loadData = async () => {
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
            }
          }
        })
        
        setUserAnswers(loadedAnswers)
        setSkippedQuestions(new Set(loadedSkipped))
      } catch (err) {
        console.error('Failed to load questions:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clerkUserId])

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
    } catch (err: any) {
      console.error('Failed to save edit:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const retakeQuestion = (questionId: number) => {
    // Navigate back to interview with question to retake
    router.push(`/personalization/interview?retake=${questionId}`)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-gradient-to-b from-blue-50 to-white dark:from-background dark:to-background">
        <div className="max-w-4xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push('/personalization/interview')}
              className="mb-4 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Summary
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Edit Your Answers
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You can edit any answer by typing or retake the question with voice recording.
            </p>
          </div>

          {/* Progress */}
          <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progress
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {answeredCount} / {questions.length} answered
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {questions.map((q) => {
              const answer = userAnswers[q.id]
              const isSkipped = skippedQuestions.has(q.id)
              const isAnswered = !!answer
              
              return (
                <Card 
                  key={q.id} 
                  className={`p-5 ${
                    isAnswered 
                      ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : isSkipped
                      ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                      : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {isAnswered ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    ) : isSkipped ? (
                      <SkipForward className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-gray-400 dark:border-gray-600 mt-0.5 flex-shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          isAnswered
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : isSkipped
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {q.category}
                        </span>
                        {isSkipped && (
                          <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Skipped</span>
                        )}
                      </div>
                      
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                        {q.question}
                      </p>
                      
                      {isAnswered && (
                        <div className="mt-3">
                          {editingQuestionId === q.id ? (
                            <div className="space-y-3">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full min-h-[120px] p-3 text-sm border-2 border-green-300 dark:border-green-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Type your answer here..."
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveEditedAnswer(q.id)}
                                  disabled={isSavingEdit || !editText.trim()}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {isSavingEdit ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  disabled={isSavingEdit}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                                  "{answer.answer}"
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditingAnswer(q.id, answer.answer)}
                                  className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                                >
                                  <Pencil className="h-4 w-4 mr-1.5" />
                                  Edit Answer
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => retakeQuestion(q.id)}
                                  className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <Mic className="h-4 w-4 mr-1.5" />
                                  Retake Question
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!isAnswered && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            onClick={() => retakeQuestion(q.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Mic className="h-4 w-4 mr-1.5" />
                            Answer This Question
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Bottom Actions */}
          <div className="mt-8 flex justify-center">
            <Button
              onClick={() => router.push('/personalization/interview')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8"
              size="lg"
            >
              View Updated Summary
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
