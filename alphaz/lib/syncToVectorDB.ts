/**
 * Automatically sync organization analytics to Vector DB
 * This is called after localStorage is updated (on refresh or 24hr auto-sync)
 * Reuses already-fetched analytics data - no duplicate API calls
 */

interface SyncToVectorDBParams {
  clerkUserId: string
  organizationId: string
  organizationName: string
  analyticsData?: any // Optional: pass the analytics data from localStorage
  postsData?: any[] // Optional: pass the posts data from localStorage
}

/**
 * Sync organization analytics to vector database
 * Called automatically when analytics data is refreshed
 */
export async function syncToVectorDB({
  clerkUserId,
  organizationId,
  organizationName,
  analyticsData,
  postsData
}: SyncToVectorDBParams): Promise<{ success: boolean; error?: string }> {
  
  try {
    console.log(`🔄 Auto-syncing analytics to Vector DB for ${organizationName}...`)
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/embeddings/organization/${clerkUserId}/${organizationId}/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationName,
          analyticsData, // Pass the analytics data if available
          postsData // Pass the posts data if available
        })
      }
    )

    const data = await response.json()

    if (response.ok && data.success) {
      console.log(`✅ Vector DB sync complete for ${organizationName}`, data.results)
      return { success: true }
    } else {
      console.error(`❌ Vector DB sync failed:`, data.error)
      return { success: false, error: data.error }
    }
  } catch (error) {
    console.error('❌ Vector DB sync error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Check if we should sync to Vector DB
 * Only sync for organizations, not personal profiles
 * Debounce to avoid multiple syncs
 */
let lastSyncTimestamp: Record<string, number> = {}
const SYNC_DEBOUNCE_MS = 60000 // 1 minute

export function shouldSyncToVectorDB(organizationId: string): boolean {
  const now = Date.now()
  const lastSync = lastSyncTimestamp[organizationId] || 0
  
  if (now - lastSync < SYNC_DEBOUNCE_MS) {
    console.log(`⏭️ Skipping Vector DB sync (debounced)`)
    return false
  }
  
  lastSyncTimestamp[organizationId] = now
  return true
}
