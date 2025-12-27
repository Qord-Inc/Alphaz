"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUser } from "@/hooks/useUser"
import { Sparkles, Timer, Volume2, MessageSquare, CheckCircle2, SkipForward } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

type TabType = 'user' | 'content' | 'audience' | 'brand' | 'instructions' | 'templates'

export default function PersonalizationPage() {
  const [activeTab, setActiveTab] = useState<TabType>('user')

  const tabs = [
    { id: 'user' as TabType, label: 'User Profile' },
    { id: 'content' as TabType, label: 'Content Profile' },
    { id: 'audience' as TabType, label: 'Audience Profile' },
    { id: 'brand' as TabType, label: 'Brand Guidelines' },
    { id: 'instructions' as TabType, label: 'Instructions' },
    { id: 'templates' as TabType, label: 'Templates' },
  ]

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto bg-gradient-to-b from-orange-50 to-white dark:from-background dark:to-background">
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Personalization</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize how Alphaz creates content for you
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          {activeTab === 'user' ? (
            <UserProfileTab />
          ) : (
            <PlaceholderTab tabName={tabs.find(t => t.id === activeTab)?.label || ''} />
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function UserProfileTab() {
  const { user } = useUser()
  const [personaData, setPersonaData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const questions = [
    {
      id: 1,
      number: 1,
      category: 'Professional',
      question: 'Tell me about your professional background and current role. What do you do, and how did you get here?'
    },
    {
      id: 2,
      number: 2,
      category: 'Values',
      question: 'What are your core values and beliefs that guide your work and life?'
    },
    {
      id: 3,
      number: 3,
      category: 'Interests',
      question: 'What topics are you most passionate about? What could you talk about for hours?'
    },
    {
      id: 4,
      number: 4,
      category: 'Experience',
      question: 'What challenges or pivotal moments have shaped who you are today?'
    },
    {
      id: 5,
      number: 5,
      category: 'Perspective',
      question: 'What unique perspectives or insights do you bring that others might not have?'
    },
    {
      id: 6,
      number: 6,
      category: 'Purpose',
      question: 'What impact do you want to make through your content and presence on LinkedIn?'
    },
    {
      id: 7,
      number: 7,
      category: 'Personal',
      question: 'What are your hobbies or interests outside of work? What energizes you?'
    },
    {
      id: 8,
      number: 8,
      category: 'Personality',
      question: 'How would your closest friends or colleagues describe you in three words?'
    }
  ]

  // Load persona data and check/create context
  useEffect(() => {
    if (!user?.clerk_user_id) return

    const loadPersonaData = async () => {
      try {
        // Load persona status
        const resp = await fetch(`${API_BASE_URL}/api/persona/status/${user.clerk_user_id}`)
        const data = await resp.json()
        setPersonaData(data)

        // Check/create user context (catch_all check)
        // This will create context if it doesn't exist but persona data is available
        fetch(`${API_BASE_URL}/api/persona/context/${user.clerk_user_id}`)
          .then(res => res.json())
          .then(contextData => {
            if (contextData.justCreated) {
              console.log('User context was just created from persona data')
            }
          })
          .catch(err => {
            console.error('Failed to check/create user context:', err)
          })
      } catch (err) {
        console.error('Failed to load persona data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPersonaData()
  }, [user?.clerk_user_id])

  // Calculate status for each question
  const getQuestionStatus = (questionId: number) => {
    if (!personaData?.userProfile) return 'pending'
    const answer = personaData.userProfile[`question_${questionId}`]
    if (!answer) return 'pending'
    if (answer.skipped) return 'skipped'
    if (answer.answer) return 'answered'
    return 'pending'
  }

  const answeredCount = personaData?.userProfile 
    ? Object.values(personaData.userProfile).filter((v: any) => v && !v.skipped && v.answer).length 
    : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Hero & CTA (Always visible, sticky on desktop) */}
      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        {/* Hero Card */}
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-8 border-0 overflow-hidden relative">
          <div className="relative z-10 flex flex-col items-center text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-white/30 flex items-center justify-center">
                <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {answeredCount === 8 ? 'Profile Complete!' : answeredCount > 0 ? `${answeredCount} of 8 Completed` : "Let's Get to Know You"}
              </h2>
              <p className="text-white/90">
                {answeredCount === 8 
                  ? 'You\'ve completed the interview! Alphaz now knows you better.'
                  : answeredCount > 0
                  ? `You've answered ${answeredCount} questions. ${8 - answeredCount} remaining.`
                  : 'This interactive voice interview will help Alphaz understand your personality, values, and unique perspective.'
                }
              </p>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        </Card>

        {/* Interview Info */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Timer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Duration</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">10-20 minutes</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Volume2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Format</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Voice guided interview</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Questions</div>
              <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">8 thoughtful questions</div>
            </div>
          </div>
        </Card>

        {/* CTA Button */}
        <div className="space-y-3">
          <Button 
            size="lg"
            onClick={() => window.location.href = '/personalization/interview'}
            className={`w-full text-white text-lg py-6 rounded-xl shadow-lg ${
              answeredCount === 8 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                : 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/30'
            }`}
          >
            {answeredCount === 8 ? 'View Profile Summary' : answeredCount > 0 ? 'Continue Interview' : "Let's Begin"}
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {answeredCount === 8 
              ? 'View and edit your answers anytime'
              : 'Make sure you\'re in a quiet environment with your microphone enabled'
            }
          </p>
        </div>
      </div>

      {/* Right Column - Questions List (Scrollable) */}
      <div>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">We'll Cover:</h3>
          
          <div className="space-y-6">
            {questions.map((item) => {
              const status = getQuestionStatus(item.id)
              
              return (
                <div key={item.number} className={`flex gap-4 p-3 rounded-lg transition-colors ${
                  status === 'answered' 
                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10' 
                    : status === 'skipped'
                    ? 'bg-yellow-50/50 dark:bg-yellow-900/10'
                    : ''
                }`}>
                  <div className="flex-shrink-0">
                    {status === 'answered' ? (
                      <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    ) : status === 'skipped' ? (
                      <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <SkipForward className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400">
                        {item.number}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        status === 'answered'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : status === 'skipped'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {item.category}
                      </div>
                      {status === 'answered' && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Answered</span>
                      )}
                      {status === 'skipped' && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Skipped</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {item.question}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function PlaceholderTab({ tabName }: { tabName: string }) {
  return (
    <Card className="p-12">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {tabName} - Coming Soon
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
            This section is under development. We're working on bringing you powerful customization options.
          </p>
        </div>
      </div>
    </Card>
  )
}
