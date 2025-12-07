"use client"

import { useEffect, useState } from "react"
import { MetricsCard } from "./metrics-card"
import { ChartCard, LineChart, BarChart } from "./chart-card"
import { Eye, Users, Heart, TrendingUp, MessageCircle, Share2, RefreshCw } from "lucide-react"
import { SimpleDropdown } from "@/components/ui/simple-dropdown"
import { useUser } from "@clerk/nextjs"
import { useOrganization } from "@/contexts/OrganizationContext"
import { OrganizationPosts } from "./organization-posts"

// Helper functions to decode LinkedIn URNs
const getIndustryName = (urn: string): string => {
  // Extract ID from URN like "urn:li:industry:4" or "urn:li:industryV2:4"
  const id = urn.split(':').pop()
  const industries: Record<string, string> = {
    '1': 'Accounting',
    '3': 'Airlines/Aviation',
    '4': 'Computer Software',
    '6': 'Internet',
    '7': 'Telecommunications',
    '8': 'Financial Services',
    '9': 'Information Technology and Services',
    '10': 'Hospital & Health Care',
    '12': 'Automotive',
    '14': 'Oil & Energy',
    '15': 'Marketing and Advertising',
    '16': 'Education Management',
    '17': 'Management Consulting',
    '18': 'Banking',
    '19': 'Construction',
    '20': 'Retail',
    '47': 'Marketing and Advertising',
    '96': 'Information Technology',
    '109': 'Financial Services'
  }
  return industries[id || ''] || `Industry ${id}`
}

const getFunctionName = (urn: string): string => {
  const id = urn.split(':').pop()
  const functions: Record<string, string> = {
    '1': 'Administrative',
    '3': 'Consulting',
    '4': 'Customer Service',
    '5': 'Education',
    '6': 'Engineering',
    '7': 'Entrepreneurship',
    '8': 'Finance',
    '12': 'Marketing',
    '15': 'Operations',
    '17': 'Product Management',
    '20': 'Sales'
  }
  return functions[id || ''] || `Function ${id}`
}

const getCountryName = (urn: string): string => {
  const id = urn.split(':').pop()
  const countries: Record<string, string> = {
    '101174742': 'Canada',
    '103644278': 'United States',
    '101165590': 'United Kingdom',
    '105646813': 'Spain',
    '102890719': 'India'
  }
  return countries[id || ''] || `Location`
}

const getSeniorityName = (urn: string): string => {
  const id = urn.split(':').pop()
  const seniorities: Record<string, string> = {
    '1': 'Unpaid',
    '2': 'Training',
    '3': 'Entry',
    '4': 'Senior',
    '5': 'Manager',
    '6': 'Director',
    '7': 'VP',
    '8': 'CXO',
    '9': 'Partner',
    '10': 'Owner'
  }
  return seniorities[id || ''] || `Seniority ${id}`
}

const getStaffCountRangeName = (range: string): string => {
  const staffRanges: Record<string, string> = {
    'SIZE_1': '1 employee',
    'SIZE_2_TO_10': '2-10 employees',
    'SIZE_11_TO_50': '11-50 employees',
    'SIZE_51_TO_200': '51-200 employees',
    'SIZE_201_TO_500': '201-500 employees',
    'SIZE_501_TO_1000': '501-1,000 employees',
    'SIZE_1001_TO_5000': '1,001-5,000 employees',
    'SIZE_5001_TO_10000': '5,001-10,000 employees',
    'SIZE_10001_OR_MORE': '10,001+ employees'
  }
  return staffRanges[range] || range
}

interface DashboardData {
  period: string
  organizationId?: string // For organization dashboards
  followers: { 
    lifetime?: number // For personal profiles
    total?: number // For organizations
    currentPeriod: number
    previousPeriod: number
    changePercent: string | null
  }
  posts?: { // Optional for organizations
    totalImpressions: number
    totalReactions: number
    totalComments: number
    totalReshares: number
    impressionChange: string | null
    reactionChange: string | null
    commentChange: string | null
    reshareChange: string | null
    engagementRate: string
    engagementChange: string | null
    lifetimeImpressions: number
    lifetimeReactions: number
    lifetimeComments: number
    lifetimeReshares: number
  }
  demographics?: { // For organizations
    industries?: any[]
    functions?: any[]
    countries?: any[]
    regions?: any[]
    seniorities?: any[]
    staffCountRanges?: any[]
    topIndustries?: any[] // legacy support
    topFunctions?: any[] // legacy support
    topCountries?: any[] // legacy support
    employeeFollowers?: number
  }
  pageViews?: { // For organizations
    currentPeriod: number
    previousPeriod: number
    changePercent: string | null
    uniqueViewsCurrent: number
    uniqueViewsPrevious: number
    lifetime: number
    breakdown?: {
      overviewPageViews: number
      jobsPageViews: number
      peoplePageViews: number
      aboutPageViews: number
      careersPageViews: number
      lifeAtPageViews: number
      productsPageViews: number
      insightsPageViews: number
      allDesktopPageViews: number
      allMobilePageViews: number
    }
    currentPeriodBreakdown?: {
      overviewPageViews: number
      jobsPageViews: number
      peoplePageViews: number
      aboutPageViews: number
      careersPageViews: number
      lifeAtPageViews: number
      productsPageViews: number
      insightsPageViews: number
      allDesktopPageViews: number
      allMobilePageViews: number
    }
    previousPeriodBreakdown?: {
      overviewPageViews: number
      jobsPageViews: number
      peoplePageViews: number
      aboutPageViews: number
      careersPageViews: number
      lifeAtPageViews: number
      productsPageViews: number
      insightsPageViews: number
      allDesktopPageViews: number
      allMobilePageViews: number
    }
  }
  pageViewDemographics?: { // For organizations
    countries?: any[]
    functions?: any[]
    industries?: any[]
    seniorities?: any[]
    companySizes?: any[]
    hasData?: boolean
  }
  lastUpdated: string
  requiresReauth?: boolean
  message?: string | null
}

export function MonitorLayout() {
  const { user } = useUser()
  const { selectedOrganization, isPersonalProfile } = useOrganization()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastCachedTime, setLastCachedTime] = useState<Date | null>(null)
  const [selectedRange, setSelectedRange] = useState("30d")
  
  // Sample data for charts (will be replaced with real data later)
  const followersGrowthData = [3500, 3600, 3650, 3700, 3800, 3900]
  const engagementData = [
    { likes: 400, comments: 50, shares: 20 },
    { likes: 380, comments: 60, shares: 25 },
    { likes: 520, comments: 80, shares: 30 },
    { likes: 460, comments: 70, shares: 28 },
    { likes: 550, comments: 90, shares: 35 },
    { likes: 600, comments: 100, shares: 40 }
  ]
  const ranges = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "1y", label: "Last 1 yr" },
  ]

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const fetchDashboard = async () => {
      try {
        setLoading(true)
        
        // Check localStorage for cached data
        const cacheKey = isPersonalProfile 
          ? `analytics_${user.id}_${selectedRange}`
          : `analytics_org_${selectedOrganization?.id}_${selectedRange}`
        const cachedData = localStorage.getItem(cacheKey)
        const cacheTimestampKey = `${cacheKey}_timestamp`
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey)
        
        // Check if cache is valid (less than 24 hours old)
        const twentyFourHours = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        const isCacheValid = cachedData && cacheTimestamp && 
          (Date.now() - parseInt(cacheTimestamp)) < twentyFourHours
        
        if (isCacheValid) {
          console.log(`Using cached analytics data for ${selectedRange}`)
          setDashboard(JSON.parse(cachedData))
          setLastCachedTime(new Date(parseInt(cacheTimestamp)))
          setError(null)
          setLoading(false)
          return
        }
        
        console.log(`Fetching fresh analytics data for ${selectedRange}`)
        const endpoint = isPersonalProfile
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/analytics/member/dashboard/${user.id}?period=${selectedRange}`
          : `${process.env.NEXT_PUBLIC_API_URL}/api/analytics/organization/dashboard/${user.id}/${selectedOrganization?.id}?period=${selectedRange}`
        
        const response = await fetch(endpoint)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch analytics')
        }

        const data = await response.json()
        const timestamp = Date.now()
        
        // If organization, also fetch page analytics
        if (!isPersonalProfile && selectedOrganization?.id) {
          try {
            const pageCacheKey = `page_analytics_org_${selectedOrganization.id}_${selectedRange}`
            const pageCacheTimestampKey = `${pageCacheKey}_timestamp`
            const cachedPageData = localStorage.getItem(pageCacheKey)
            const pageCacheTimestamp = localStorage.getItem(pageCacheTimestampKey)
            
            const isPageCacheValid = cachedPageData && pageCacheTimestamp && 
              (Date.now() - parseInt(pageCacheTimestamp)) < twentyFourHours
              
            if (isPageCacheValid) {
              console.log(`Using cached page analytics data for ${selectedRange}`)
              const pageData = JSON.parse(cachedPageData)
              data.pageViews = pageData.pageViews
              data.pageViewDemographics = pageData.demographics
            } else {
              console.log(`Fetching fresh page analytics data for ${selectedRange}`)
              const pageEndpoint = `${process.env.NEXT_PUBLIC_API_URL}/api/analytics/organization/page-dashboard/${user.id}/${selectedOrganization.id}?period=${selectedRange}`
              const pageResponse = await fetch(pageEndpoint)
              
              if (pageResponse.ok) {
                const pageData = await pageResponse.json()
                data.pageViews = pageData.pageViews
                data.pageViewDemographics = pageData.demographics
                
                // Cache page data separately
                localStorage.setItem(pageCacheKey, JSON.stringify(pageData))
                localStorage.setItem(pageCacheTimestampKey, timestamp.toString())
              }
            }
          } catch (pageError) {
            console.error('Failed to fetch page analytics:', pageError)
          }
        }
        
        // Cache the data
        localStorage.setItem(cacheKey, JSON.stringify(data))
        localStorage.setItem(cacheTimestampKey, timestamp.toString())
        setLastCachedTime(new Date(timestamp))
        
        // Also clean up old cache entries for other periods
        const periods = ['7d', '30d', '90d', '1y']
        periods.forEach(period => {
          if (period !== selectedRange) {
            const oldCacheKey = `analytics_${user.id}_${period}`
            const oldTimestampKey = `${oldCacheKey}_timestamp`
            const oldTimestamp = localStorage.getItem(oldTimestampKey)
            
            // Remove cache entries older than 24 hours
            if (oldTimestamp && (Date.now() - parseInt(oldTimestamp)) > twentyFourHours) {
              localStorage.removeItem(oldCacheKey)
              localStorage.removeItem(oldTimestampKey)
            }
          }
        })
        
        setDashboard(data)
        setError(null)
      } catch (err) {
        console.error('Analytics fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [user?.id, selectedRange, selectedOrganization?.id, isPersonalProfile])

  // Function to refresh data (clear cache and refetch)
  const refreshData = async () => {
    if (!user?.id || isRefreshing) return
    
    setIsRefreshing(true)
    
    // Clear cache for current period
    const cacheKey = isPersonalProfile 
      ? `analytics_${user.id}_${selectedRange}`
      : `analytics_org_${selectedOrganization?.id}_${selectedRange}`
    const cacheTimestampKey = `${cacheKey}_timestamp`
    localStorage.removeItem(cacheKey)
    localStorage.removeItem(cacheTimestampKey)
    
    // Also clear page analytics cache for organizations
    if (!isPersonalProfile && selectedOrganization?.id) {
      const pageCacheKey = `page_analytics_org_${selectedOrganization.id}_${selectedRange}`
      const pageCacheTimestampKey = `${pageCacheKey}_timestamp`
      localStorage.removeItem(pageCacheKey)
      localStorage.removeItem(pageCacheTimestampKey)
    }
    
    try {
      console.log(`Force refreshing analytics data for ${selectedRange}`)
      const endpoint = isPersonalProfile
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/analytics/member/dashboard/${user.id}?period=${selectedRange}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/analytics/organization/dashboard/${user.id}/${selectedOrganization?.id}?period=${selectedRange}`
      
      const response = await fetch(endpoint)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch analytics')
      }

      const data = await response.json()
      const timestamp = Date.now()
      
      // If organization, also refresh page analytics
      if (!isPersonalProfile && selectedOrganization?.id) {
        try {
          const pageEndpoint = `${process.env.NEXT_PUBLIC_API_URL}/api/analytics/organization/page-dashboard/${user.id}/${selectedOrganization.id}?period=${selectedRange}`
          const pageResponse = await fetch(pageEndpoint)
          
          if (pageResponse.ok) {
            const pageData = await pageResponse.json()
            data.pageViews = pageData.pageViews
            data.pageViewDemographics = pageData.demographics
            
            // Cache page data
            const pageCacheKey = `page_analytics_org_${selectedOrganization.id}_${selectedRange}`
            const pageCacheTimestampKey = `${pageCacheKey}_timestamp`
            localStorage.setItem(pageCacheKey, JSON.stringify(pageData))
            localStorage.setItem(pageCacheTimestampKey, timestamp.toString())
          }
        } catch (pageError) {
          console.error('Failed to refresh page analytics:', pageError)
        }
      }
      
      // Cache the new data
      localStorage.setItem(cacheKey, JSON.stringify(data))
      localStorage.setItem(cacheTimestampKey, timestamp.toString())
      setLastCachedTime(new Date(timestamp))
      
      setDashboard(data)
      setError(null)
    } catch (err) {
      console.error('Analytics refresh error:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh analytics')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Use engagement rate from API
  const engagementRate = dashboard?.posts?.engagementRate || "0"

  // Format last updated time
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return ''
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-background">
        <div>
          <h1 className="text-3xl font-bold">Monitor</h1>
          <p className="text-muted-foreground mt-1">
            {isPersonalProfile 
              ? "Track your personal LinkedIn performance and insights"
              : `Track analytics for ${selectedOrganization?.name}`
            }
            {lastCachedTime && !loading && (
              <span className="text-xs ml-2">
                • Last updated: {formatLastUpdated(lastCachedTime)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SimpleDropdown 
            options={ranges} 
            value={selectedRange} 
            onChange={setSelectedRange}
          />
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh analytics data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      <main className="flex-1 overflow-auto p-6">
        {/* Error State */}
        {error === 'LinkedIn not connected' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              Please connect your LinkedIn account in the sidebar to view analytics.
            </p>
          </div>
        )}
        
        {/* Re-authentication Required */}
        {dashboard?.requiresReauth && !error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-800 font-medium">Analytics Permission Required</p>
            <p className="text-amber-700 text-sm mt-1">
              {dashboard.message || 'Please reconnect your LinkedIn account to grant analytics permissions.'}
            </p>
            <p className="text-amber-600 text-xs mt-2">
              Disconnect and reconnect LinkedIn in the sidebar to access follower and post analytics.
            </p>
          </div>
        )}

        {/* Audience Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Audience</h2>
          
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {isPersonalProfile ? (
              <>
                <MetricsCard
                  title="Impressions"
                  value={loading ? "..." : error ? "N/A" : 
                    dashboard?.posts?.totalImpressions ? 
                      dashboard.posts.totalImpressions >= 1000 ? 
                        `${(dashboard.posts.totalImpressions / 1000).toFixed(1)}K` : 
                        dashboard.posts.totalImpressions.toString() : 
                      "0"
                  }
                  change={loading || error || !dashboard ? "" : 
                    dashboard.posts?.impressionChange 
                      ? `${Number(dashboard.posts.impressionChange) > 0 ? '+' : ''}${dashboard.posts.impressionChange}% vs last period`
                      : "No previous data"
                  }
                  changeType={!dashboard?.posts?.impressionChange ? "positive" : 
                    Number(dashboard.posts.impressionChange) >= 0 ? "positive" : "negative"
                  }
                  icon={Eye}
                  iconColor="text-blue-500"
                />
                <MetricsCard
                  title="New Followers"
                  value={loading ? "..." : error ? "N/A" : 
                    dashboard?.followers.currentPeriod !== undefined ? 
                      dashboard.followers.currentPeriod >= 1000 ? 
                        `+${(dashboard.followers.currentPeriod / 1000).toFixed(1)}K` : 
                        `+${dashboard.followers.currentPeriod}` : 
                      "+0"
                  }
                  change={loading || error || !dashboard ? "" : 
                    dashboard.followers.changePercent 
                      ? `${Number(dashboard.followers.changePercent) > 0 ? '+' : ''}${dashboard.followers.changePercent}% vs last period • Total: ${dashboard.followers.lifetime?.toLocaleString()}`
                      : dashboard.followers.lifetime && dashboard.followers.lifetime > 0
                        ? `Total followers: ${dashboard.followers.lifetime.toLocaleString()}`
                        : "No previous data"
                  }
                  changeType={!dashboard?.followers.changePercent ? "positive" : 
                    Number(dashboard.followers.changePercent) >= 0 ? "positive" : "negative"
                  }
                  icon={Users}
                  iconColor="text-purple-500"
                />
                <MetricsCard
                  title="Engagement Rate"
                  value={loading ? "..." : error ? "N/A" : `${engagementRate}%`}
                  change={loading || error || !dashboard ? "" : 
                    dashboard.posts?.engagementChange 
                      ? `${Number(dashboard.posts.engagementChange) > 0 ? '+' : ''}${dashboard.posts.engagementChange}% vs last period`
                      : "No previous data"
                  }
                  changeType={!dashboard?.posts?.engagementChange ? "positive" : 
                    Number(dashboard.posts.engagementChange) >= 0 ? "positive" : "negative"
                  }
                  icon={Heart}
                  iconColor="text-pink-500"
                />
              </>
            ) : (
              <>
                <MetricsCard
                  title="Page Views"
                  value={loading ? "..." : error ? "N/A" : 
                    dashboard?.pageViews?.currentPeriod !== undefined ? 
                      dashboard.pageViews.currentPeriod >= 1000 ? 
                        `${(dashboard.pageViews.currentPeriod / 1000).toFixed(1)}K` : 
                        dashboard.pageViews.currentPeriod.toString() : 
                      "0"
                  }
                  change={loading || error || !dashboard ? "" : 
                    dashboard.pageViews?.changePercent 
                      ? `${Number(dashboard.pageViews.changePercent) > 0 ? '+' : ''}${dashboard.pageViews.changePercent}% vs last period • Lifetime: ${dashboard.pageViews.lifetime?.toLocaleString()}`
                      : dashboard.pageViews?.lifetime && dashboard.pageViews.lifetime > 0
                        ? `Lifetime views: ${dashboard.pageViews.lifetime.toLocaleString()}`
                        : "No previous data"
                  }
                  changeType={!dashboard?.pageViews?.changePercent ? "positive" : 
                    Number(dashboard.pageViews.changePercent) >= 0 ? "positive" : "negative"
                  }
                  icon={Eye}
                  iconColor="text-blue-500"
                />
                <MetricsCard
                  title="New Followers"
                  value={loading ? "..." : error ? "N/A" : 
                    dashboard?.followers.currentPeriod !== undefined ? 
                      dashboard.followers.currentPeriod >= 1000 ? 
                        `+${(dashboard.followers.currentPeriod / 1000).toFixed(1)}K` : 
                        `+${dashboard.followers.currentPeriod}` : 
                      "+0"
                  }
                  change={loading || error || !dashboard ? "" : 
                    dashboard.followers.changePercent 
                      ? `${Number(dashboard.followers.changePercent) > 0 ? '+' : ''}${dashboard.followers.changePercent}% vs last period • Total: ${dashboard.followers.total?.toLocaleString()}`
                      : dashboard.followers.total && dashboard.followers.total > 0
                        ? `Total followers: ${dashboard.followers.total.toLocaleString()}`
                        : "No previous data"
                  }
                  changeType={!dashboard?.followers.changePercent ? "positive" : 
                    Number(dashboard.followers.changePercent) >= 0 ? "positive" : "negative"
                  }
                  icon={Users}
                  iconColor="text-green-500"
                />
                <MetricsCard
                  title="Engagement Rate"
                  value={loading ? "..." : error ? "N/A" : `${engagementRate}%`}
                  change={loading || error || !dashboard ? "" : "Based on recent page activity"}
                  changeType="positive"
                  icon={Heart}
                  iconColor="text-pink-500"
                />
              </>
            )}
          </div>

          {/* Additional Metrics - Only for Personal Profiles */}
          {isPersonalProfile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MetricsCard
                title="Reactions"
                value={loading ? "..." : error ? "N/A" : 
                  dashboard?.posts?.totalReactions ? 
                    dashboard.posts.totalReactions.toLocaleString() : "0"
                }
                change={loading || error || !dashboard ? "" : 
                  dashboard.posts?.reactionChange 
                    ? `${Number(dashboard.posts.reactionChange) > 0 ? '+' : ''}${dashboard.posts.reactionChange}% vs last period`
                    : "No previous data"
                }
                changeType={!dashboard?.posts?.reactionChange ? "positive" : 
                  Number(dashboard.posts.reactionChange) >= 0 ? "positive" : "negative"
                }
                icon={TrendingUp}
                iconColor="text-green-500"
              />
              <MetricsCard
                title="Comments"
                value={loading ? "..." : error ? "N/A" : 
                  dashboard?.posts?.totalComments ? 
                    dashboard.posts.totalComments.toLocaleString() : "0"
                }
                change={loading || error || !dashboard ? "" : 
                  dashboard.posts?.commentChange 
                    ? `${Number(dashboard.posts.commentChange) > 0 ? '+' : ''}${dashboard.posts.commentChange}% vs last period`
                    : "No previous data"
                }
                changeType={!dashboard?.posts?.commentChange ? "positive" : 
                  Number(dashboard.posts.commentChange) >= 0 ? "positive" : "negative"
                }
                icon={MessageCircle}
                iconColor="text-orange-500"
              />
              <MetricsCard
                title="Reshares"
                value={loading ? "..." : error ? "N/A" : 
                  dashboard?.posts?.totalReshares ? 
                    dashboard.posts.totalReshares.toLocaleString() : "0"
                }
                change={loading || error || !dashboard ? "" : 
                  dashboard.posts?.reshareChange 
                    ? `${Number(dashboard.posts.reshareChange) > 0 ? '+' : ''}${dashboard.posts.reshareChange}% vs last period`
                    : "No previous data"
                }
                changeType={!dashboard?.posts?.reshareChange ? "positive" : 
                  Number(dashboard.posts.reshareChange) >= 0 ? "positive" : "negative"
                }
                icon={Share2}
                iconColor="text-indigo-500"
              />
            </div>
          )}

          {/* Charts - Only for Personal Profiles */}
          {isPersonalProfile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Followers Growth">
                <LineChart data={followersGrowthData} />
              </ChartCard>
              
              <ChartCard title="Engagement Breakdown">
                <BarChart data={engagementData} />
              </ChartCard>
            </div>
          )}
          
          {/* Demographics - Only for Organizations */}
          {!isPersonalProfile && dashboard?.demographics && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Follower Demographics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Top Industries */}
                {dashboard.demographics?.industries && dashboard.demographics.industries.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Top Industries</h3>
                    {dashboard.demographics.industries.slice(0, 3).map((industry: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getIndustryName(industry.industry)}</span>
                        <span className="text-sm font-medium">{industry.followerCounts.organicFollowerCount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Top Functions */}
                {dashboard.demographics?.functions && dashboard.demographics.functions.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Top Functions</h3>
                    {dashboard.demographics.functions.slice(0, 3).map((func: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getFunctionName(func.function)}</span>
                        <span className="text-sm font-medium">{func.followerCounts.organicFollowerCount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Top Countries */}
                {dashboard.demographics?.countries && dashboard.demographics.countries.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Top Countries</h3>
                    {dashboard.demographics.countries.slice(0, 3).map((country: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getCountryName(country.geo)}</span>
                        <span className="text-sm font-medium">{country.followerCounts.organicFollowerCount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Seniority Levels */}
                {dashboard.demographics?.seniorities && dashboard.demographics.seniorities.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Seniority Levels</h3>
                    {dashboard.demographics.seniorities.slice(0, 3).map((seniority: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getSeniorityName(seniority.seniority)}</span>
                        <span className="text-sm font-medium">{seniority.followerCounts.organicFollowerCount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Company Sizes */}
                {dashboard.demographics?.staffCountRanges && dashboard.demographics.staffCountRanges.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Company Sizes</h3>
                    {dashboard.demographics.staffCountRanges.slice(0, 3).map((range: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getStaffCountRangeName(range.staffCountRange)}</span>
                        <span className="text-sm font-medium">{range.followerCounts.organicFollowerCount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Page View Breakdown for organizations */}
          {!isPersonalProfile && dashboard?.pageViews?.breakdown && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Page Views by Section</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Page sections */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-2xl font-bold">{dashboard.pageViews.currentPeriodBreakdown?.overviewPageViews || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Overview</div>
                  {dashboard.pageViews.previousPeriodBreakdown && (
                    <div className={`text-xs ${
                      (dashboard.pageViews.currentPeriodBreakdown?.overviewPageViews || 0) >= (dashboard.pageViews.previousPeriodBreakdown?.overviewPageViews || 0)
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((dashboard.pageViews.currentPeriodBreakdown?.overviewPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.overviewPageViews || 0) >= 0 ? '+' : '')}
                      {((dashboard.pageViews.currentPeriodBreakdown?.overviewPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.overviewPageViews || 0))}
                    </div>
                  )}
                </div>
                
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-2xl font-bold">{dashboard.pageViews.currentPeriodBreakdown?.aboutPageViews || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">About</div>
                  {dashboard.pageViews.previousPeriodBreakdown && (
                    <div className={`text-xs ${
                      (dashboard.pageViews.currentPeriodBreakdown?.aboutPageViews || 0) >= (dashboard.pageViews.previousPeriodBreakdown?.aboutPageViews || 0)
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((dashboard.pageViews.currentPeriodBreakdown?.aboutPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.aboutPageViews || 0) >= 0 ? '+' : '')}
                      {((dashboard.pageViews.currentPeriodBreakdown?.aboutPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.aboutPageViews || 0))}
                    </div>
                  )}
                </div>
                
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-2xl font-bold">{dashboard.pageViews.currentPeriodBreakdown?.jobsPageViews || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Jobs</div>
                  {dashboard.pageViews.previousPeriodBreakdown && (
                    <div className={`text-xs ${
                      (dashboard.pageViews.currentPeriodBreakdown?.jobsPageViews || 0) >= (dashboard.pageViews.previousPeriodBreakdown?.jobsPageViews || 0)
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((dashboard.pageViews.currentPeriodBreakdown?.jobsPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.jobsPageViews || 0) >= 0 ? '+' : '')}
                      {((dashboard.pageViews.currentPeriodBreakdown?.jobsPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.jobsPageViews || 0))}
                    </div>
                  )}
                </div>
                
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-2xl font-bold">{dashboard.pageViews.currentPeriodBreakdown?.peoplePageViews || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">People</div>
                  {dashboard.pageViews.previousPeriodBreakdown && (
                    <div className={`text-xs ${
                      (dashboard.pageViews.currentPeriodBreakdown?.peoplePageViews || 0) >= (dashboard.pageViews.previousPeriodBreakdown?.peoplePageViews || 0)
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((dashboard.pageViews.currentPeriodBreakdown?.peoplePageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.peoplePageViews || 0) >= 0 ? '+' : '')}
                      {((dashboard.pageViews.currentPeriodBreakdown?.peoplePageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.peoplePageViews || 0))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Device breakdown */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Desktop Views</div>
                      <div className="text-2xl font-bold">{dashboard.pageViews.currentPeriodBreakdown?.allDesktopPageViews || 0}</div>
                    </div>
                    <div className="text-3xl">💻</div>
                  </div>
                  {dashboard.pageViews.previousPeriodBreakdown && (
                    <div className={`text-sm mt-2 ${
                      (dashboard.pageViews.currentPeriodBreakdown?.allDesktopPageViews || 0) >= (dashboard.pageViews.previousPeriodBreakdown?.allDesktopPageViews || 0)
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((dashboard.pageViews.currentPeriodBreakdown?.allDesktopPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.allDesktopPageViews || 0) >= 0 ? '+' : '')}
                      {((dashboard.pageViews.currentPeriodBreakdown?.allDesktopPageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.allDesktopPageViews || 0))} from last period
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Mobile Views</div>
                      <div className="text-2xl font-bold">{dashboard.pageViews.currentPeriodBreakdown?.allMobilePageViews || 0}</div>
                    </div>
                    <div className="text-3xl">📱</div>
                  </div>
                  {dashboard.pageViews.previousPeriodBreakdown && (
                    <div className={`text-sm mt-2 ${
                      (dashboard.pageViews.currentPeriodBreakdown?.allMobilePageViews || 0) >= (dashboard.pageViews.previousPeriodBreakdown?.allMobilePageViews || 0)
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {((dashboard.pageViews.currentPeriodBreakdown?.allMobilePageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.allMobilePageViews || 0) >= 0 ? '+' : '')}
                      {((dashboard.pageViews.currentPeriodBreakdown?.allMobilePageViews || 0) - (dashboard.pageViews.previousPeriodBreakdown?.allMobilePageViews || 0))} from last period
                    </div>
                  )}
                </div>
              </div>
              
              {/* Lifetime totals */}
              {dashboard.pageViews.breakdown && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">All-Time Page Views</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="text-xl font-bold">{dashboard.pageViews.breakdown.overviewPageViews}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Overview</div>
                    </div>
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="text-xl font-bold">{dashboard.pageViews.breakdown.aboutPageViews}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">About</div>
                    </div>
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="text-xl font-bold">{dashboard.pageViews.breakdown.jobsPageViews}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Jobs</div>
                    </div>
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="text-xl font-bold">{dashboard.pageViews.breakdown.peoplePageViews}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">People</div>
                    </div>
                    <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <div className="text-xl font-bold">{dashboard.pageViews.breakdown.careersPageViews}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Careers</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Page View Demographics - Only for Organizations */}
          {!isPersonalProfile && dashboard?.pageViewDemographics && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Page Viewer Demographics</h2>
              {dashboard.pageViewDemographics.hasData === false ? (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    Page view demographic data is not yet available. LinkedIn requires a minimum number of page views before providing demographic breakdowns to protect viewer privacy.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Total lifetime page views: {dashboard.pageViews?.lifetime?.toLocaleString() || 0}
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Views by Country */}
                {dashboard.pageViewDemographics?.countries && dashboard.pageViewDemographics.countries.length > 0 && dashboard.pageViewDemographics.countries.some((item: any) => item.views > 0) && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Views by Country</h3>
                    {dashboard.pageViewDemographics.countries.filter((item: any) => item.views > 0).slice(0, 3).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getCountryName(item.country)}</span>
                        <span className="text-sm font-medium">{item.views.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Views by Industry */}
                {dashboard.pageViewDemographics?.industries && dashboard.pageViewDemographics.industries.length > 0 && dashboard.pageViewDemographics.industries.some((item: any) => item.views > 0) && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Views by Industry</h3>
                    {dashboard.pageViewDemographics.industries.filter((item: any) => item.views > 0).slice(0, 3).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getIndustryName(item.industry)}</span>
                        <span className="text-sm font-medium">{item.views.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Views by Function */}
                {dashboard.pageViewDemographics?.functions && dashboard.pageViewDemographics.functions.length > 0 && dashboard.pageViewDemographics.functions.some((item: any) => item.views > 0) && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Views by Function</h3>
                    {dashboard.pageViewDemographics.functions.filter((item: any) => item.views > 0).slice(0, 3).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getFunctionName(item.function)}</span>
                        <span className="text-sm font-medium">{item.views.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Views by Seniority */}
                {dashboard.pageViewDemographics?.seniorities && dashboard.pageViewDemographics.seniorities.length > 0 && dashboard.pageViewDemographics.seniorities.some((item: any) => item.views > 0) && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Views by Seniority</h3>
                    {dashboard.pageViewDemographics.seniorities.filter((item: any) => item.views > 0).slice(0, 3).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getSeniorityName(item.seniority)}</span>
                        <span className="text-sm font-medium">{item.views.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Views by Company Size */}
                {dashboard.pageViewDemographics?.companySizes && dashboard.pageViewDemographics.companySizes.length > 0 && dashboard.pageViewDemographics.companySizes.some((item: any) => item.views > 0) && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Views by Company Size</h3>
                    {dashboard.pageViewDemographics.companySizes.filter((item: any) => item.views > 0).slice(0, 3).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{getStaffCountRangeName(item.staffCountRange)}</span>
                        <span className="text-sm font-medium">{item.views.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* Organization Posts */}
          {!isPersonalProfile && (
            <div className="mt-8">
              <OrganizationPosts />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}