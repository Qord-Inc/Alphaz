"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"

interface SyncAnalyticsButtonProps {
  clerkUserId: string
  organizationId: string
  organizationName: string
  onSyncComplete?: () => void
}

export function SyncAnalyticsButton({
  clerkUserId,
  organizationId,
  organizationName,
  onSyncComplete
}: SyncAnalyticsButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSync = async () => {
    setSyncing(true)
    setStatus('idle')
    setMessage('')

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/embeddings/organization/${clerkUserId}/${organizationId}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationName
          })
        }
      )

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
        setMessage('Analytics synced successfully!')
        onSyncComplete?.()
        
        // Reset status after 3 seconds
        setTimeout(() => {
          setStatus('idle')
          setMessage('')
        }, 3000)
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to sync analytics')
      }
    } catch (error) {
      console.error('Error syncing analytics:', error)
      setStatus('error')
      setMessage('Network error. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant={status === 'success' ? 'default' : 'outline'}
        size="sm"
        className={
          status === 'success' 
            ? 'bg-green-500 hover:bg-green-600 text-white' 
            : status === 'error'
            ? 'border-red-300 text-red-600'
            : ''
        }
      >
        {syncing ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Syncing...
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Synced
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="h-4 w-4 mr-2" />
            Retry Sync
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Analytics
          </>
        )}
      </Button>
      
      {message && (
        <span className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
