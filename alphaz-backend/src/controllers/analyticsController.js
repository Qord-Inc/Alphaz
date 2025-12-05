const { getLinkedInAccessToken } = require('./linkedinController');
const config = require('../config/linkedin');

/**
 * Get member follower statistics (lifetime or time-bound)
 * @route GET /api/analytics/member/followers/:clerkUserId
 * @query dateRange - Optional date range for time-bound statistics
 */
const getMemberFollowerStats = async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const { dateRange } = req.query;

    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;
    let url = 'https://api.linkedin.com/rest/memberFollowersCount';
    
    // Build URL based on whether dateRange is provided
    if (dateRange) {
      // Parse dateRange from JSON string
      const range = typeof dateRange === 'string' ? JSON.parse(dateRange) : dateRange;
      
      // Format: ?q=dateRange&dateRange=(start:(year:2024,month:5,day:4),end:(year:2024,month:5,day:6))
      const dateRangeParam = `(start:(year:${range.start.year},month:${range.start.month},day:${range.start.day})`;
      const endParam = range.end ? `,end:(year:${range.end.year},month:${range.end.month},day:${range.end.day}))` : ')';
      
      url += `?q=dateRange&dateRange=${dateRangeParam}${endParam}`;
      
    } else {
      // Lifetime stats
      url += '?q=me';
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202511',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('LinkedIn API error:', data);
      return res.status(response.status).json({ 
        error: 'Failed to fetch follower statistics',
        details: data 
      });
    }

    // Transform response for easier consumption
    const result = dateRange ? {
      type: 'time-bound',
      dateRange: JSON.parse(dateRange),
      data: data.elements.map(element => ({
        date: element.dateRange,
        followerCount: element.memberFollowersCount
      }))
    } : {
      type: 'lifetime',
      followerCount: data.elements[0]?.memberFollowersCount || 0
    };

    res.json(result);

  } catch (error) {
    console.error('Error fetching member follower stats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

/**
 * Get member post analytics (single post or aggregated)
 * @route GET /api/analytics/member/posts/:clerkUserId
 * @query entity - Optional post URN for single post analytics
 * @query queryType - Metric type (IMPRESSION, MEMBERS_REACHED, RESHARE, REACTION, COMMENT)
 * @query aggregation - DAILY or TOTAL (default: TOTAL)
 * @query dateRange - Optional date range
 */
const getMemberPostAnalytics = async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const { entity, queryType, aggregation = 'TOTAL', dateRange } = req.query;

    // Validate queryType
    const validQueryTypes = ['IMPRESSION', 'MEMBERS_REACHED', 'RESHARE', 'REACTION', 'COMMENT'];
    if (!queryType || !validQueryTypes.includes(queryType)) {
      return res.status(400).json({ 
        error: 'Invalid queryType',
        validTypes: validQueryTypes 
      });
    }

    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }
    console.log(`tokenResult:`, tokenResult);

    const { accessToken } = tokenResult;
    let url = 'https://api.linkedin.com/rest/memberCreatorPostAnalytics';
    
    // Build URL based on whether entity is provided
    if (entity) {
      // Single post analytics
      // Handle both ugcPost and share URNs
      const encodedEntity = entity.includes('ugcPost') 
        ? `(ugc:${encodeURIComponent(entity)})`
        : `(share:${encodeURIComponent(entity)})`;
      
      url += `?q=entity&entity=${encodedEntity}&queryType=${queryType}&aggregation=${aggregation}`;
      
    } else {
      // Aggregated analytics for all member posts
      url += `?q=me&queryType=${queryType}&aggregation=${aggregation}`;
      
    }

    // Add date range if provided
    if (dateRange) {
      const range = typeof dateRange === 'string' ? JSON.parse(dateRange) : dateRange;
      const dateRangeParam = `&dateRange=(start:(year:${range.start.year},month:${range.start.month},day:${range.start.day})`;
      const endParam = range.end ? `,end:(year:${range.end.year},month:${range.end.month},day:${range.end.day}))` : ')';
      url += dateRangeParam + endParam;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202511',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const data = await response.json();
    console.log(`LinkedIn post analytics response:`, data);
    
    if (!response.ok) {
      console.error('LinkedIn API error:', data);
      return res.status(response.status).json({ 
        error: 'Failed to fetch post analytics',
        details: data 
      });
    }

    // Transform response for easier consumption
    const result = {
      entity: entity || 'all_posts',
      metric: queryType,
      aggregation: aggregation,
      dateRange: dateRange ? JSON.parse(dateRange) : null,
      data: data.elements.map(element => ({
        date: element.dateRange || null,
        count: element.count,
        metricType: element.metricType
      }))
    };

    res.json(result);

  } catch (error) {
    console.error('Error fetching member post analytics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

/**
 * Get aggregated analytics dashboard data
 * @route GET /api/analytics/member/dashboard/:clerkUserId
 * @query period - Time period: 7d, 30d, 90d, 1y (default: 30d)
 * Returns follower count, recent posts analytics summary
 */
const getMemberDashboard = async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const { period = '30d' } = req.query;
    
    // Calculate date ranges based on period
    const now = new Date();
    const periodDays = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const daysAgo = periodDays[period] || 30;
    const currentPeriodStart = new Date(now);
    currentPeriodStart.setDate(now.getDate() - daysAgo);
    
    // Previous period for comparison
    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - daysAgo);
    
    console.log(`Fetching dashboard for period: ${period} (${daysAgo} days)`);
    console.log(`Current period: ${currentPeriodStart.toISOString()} to ${now.toISOString()}`);
    console.log(`Previous period: ${previousPeriodStart.toISOString()} to ${currentPeriodStart.toISOString()}`);
    
    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;

    // Helper function to fetch follower count for a date range
    const fetchFollowerCountForRange = async (startDate, endDate) => {
      const dateRange = {
        start: {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate()
        },
        end: {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate()
        }
      };
      
      const url = `https://api.linkedin.com/rest/memberFollowersCount?q=dateRange&dateRange=(start:(year:${dateRange.start.year},month:${dateRange.start.month},day:${dateRange.start.day}),end:(year:${dateRange.end.year},month:${dateRange.end.month},day:${dateRange.end.day}))`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });
        
        const data = await response.json();
        if (!response.ok) {
          console.warn('Failed to fetch follower count for range:', data);
          return null;
        }
        
        // Sum up daily counts
        const totalNewFollowers = data.elements?.reduce((sum, element) => 
          sum + (element.memberFollowersCount || 0), 0
        ) || 0;
        
        return totalNewFollowers;
      } catch (error) {
        console.error('Error fetching follower count for range:', error);
        return null;
      }
    };

    // Fetch lifetime follower count
    const followerResponse = await fetch('https://api.linkedin.com/rest/memberFollowersCount?q=me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202511',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const followerData = await followerResponse.json();
    
    // Handle error response - 404 typically means missing permissions
    let hasFollowerAccess = true;
    if (!followerResponse.ok || followerData.status === 404) {
      console.warn('Member follower count API returned error, likely missing r_member_profileAnalytics permission');
      hasFollowerAccess = false;
    }
    
    const lifetimeFollowers = followerData.elements?.[0]?.memberFollowersCount || 0;
    
    // Fetch follower growth for current and previous periods
    const currentPeriodFollowers = await fetchFollowerCountForRange(currentPeriodStart, now);
    const previousPeriodFollowers = await fetchFollowerCountForRange(previousPeriodStart, currentPeriodStart);
    
    // Calculate follower change percentage
    const followerChangePercent = previousPeriodFollowers && previousPeriodFollowers > 0 
      ? ((currentPeriodFollowers - previousPeriodFollowers) / previousPeriodFollowers * 100).toFixed(1)
      : null;

    // Helper function to fetch post metrics for a date range
    const fetchMetricsForRange = async (metric, startDate, endDate) => {
      const dateRange = `&dateRange=(start:(year:${startDate.getFullYear()},month:${startDate.getMonth() + 1},day:${startDate.getDate()}),end:(year:${endDate.getFullYear()},month:${endDate.getMonth() + 1},day:${endDate.getDate()}))`;
      const url = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=me&queryType=${metric}&aggregation=TOTAL${dateRange}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });
        
        const data = await response.json();
        if (!response.ok || data.status === 404) {
          return { count: 0, error: true };
        }
        
        return { count: data.elements?.[0]?.count || 0, error: false };
      } catch (error) {
        return { count: 0, error: true };
      }
    };

    // Fetch aggregated post metrics for current and previous periods
    const metrics = ['IMPRESSION', 'REACTION', 'COMMENT', 'RESHARE'];
    const currentMetricsPromises = metrics.map(metric => fetchMetricsForRange(metric, currentPeriodStart, now));
    const previousMetricsPromises = metrics.map(metric => fetchMetricsForRange(metric, previousPeriodStart, currentPeriodStart));
    
    const [currentMetrics, previousMetrics] = await Promise.all([
      Promise.all(currentMetricsPromises),
      Promise.all(previousMetricsPromises)
    ]);
    
    // Also fetch lifetime totals for fallback
    const lifetimeMetricsPromises = metrics.map(async (metric) => {
      try {
        const response = await fetch(`https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=me&queryType=${metric}&aggregation=TOTAL`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });
        
        const data = await response.json();
        
        if (!response.ok || data.status === 404) {
          console.warn(`Member post analytics API error for ${metric}:`, data);
          return { 
            elements: [{ count: 0 }], 
            status: data.status, 
            code: data.code 
          };
        }
        
        return data;
      } catch (error) {
        console.error(`Error fetching ${metric} analytics:`, error);
        return { elements: [{ count: 0 }] };
      }
    });

    const metricsResults = await Promise.all(lifetimeMetricsPromises);
    
    // Check if any API returned 404 (permission issue)
    const hasPostAnalyticsErrors = metricsResults.some(result => 
      result.status === 404 || result.code === 'RESOURCE_NOT_FOUND'
    );
    
    // Determine if user needs to re-authenticate for analytics permissions
    const needsAnalyticsPermissions = !hasFollowerAccess || hasPostAnalyticsErrors;
    
    // Check if we have any actual data
    const hasAnalyticsData = lifetimeFollowers > 0 || 
      metricsResults.some(result => (result.elements?.[0]?.count || 0) > 0);
    
    // Calculate change percentages for each metric
    const calculateChange = (current, previous) => {
      if (!previous || previous === 0) return null;
      return ((current - previous) / previous * 100).toFixed(1);
    };
    
    const impressionChange = calculateChange(currentMetrics[0].count, previousMetrics[0].count);
    const reactionChange = calculateChange(currentMetrics[1].count, previousMetrics[1].count);
    const commentChange = calculateChange(currentMetrics[2].count, previousMetrics[2].count);
    const reshareChange = calculateChange(currentMetrics[3].count, previousMetrics[3].count);
    
    // Calculate engagement rate and its change
    const currentEngagement = currentMetrics[0].count > 0 
      ? ((currentMetrics[1].count + currentMetrics[2].count + currentMetrics[3].count) / currentMetrics[0].count * 100)
      : 0;
      // Engagement rate = ((reaction (like) + comment + reshare) divided by impressions) x 100
      // 0 -> impression, 1 -> reaction, 2 -> comment, 3 -> reshare
    
    const previousEngagement = previousMetrics[0].count > 0
      ? ((previousMetrics[1].count + previousMetrics[2].count + previousMetrics[3].count) / previousMetrics[0].count * 100)
      : 0;
      
    const engagementChange = calculateChange(currentEngagement, previousEngagement);

    // Build dashboard response
    const dashboard = {
      period: period,
      followers: {
        lifetime: lifetimeFollowers,
        currentPeriod: currentPeriodFollowers || 0,
        previousPeriod: previousPeriodFollowers || 0,
        changePercent: followerChangePercent
      },
      posts: {
        // Current period metrics
        totalImpressions: currentMetrics[0].count,
        totalReactions: currentMetrics[1].count,
        totalComments: currentMetrics[2].count,
        totalReshares: currentMetrics[3].count,
        // Change percentages
        impressionChange: impressionChange,
        reactionChange: reactionChange,
        commentChange: commentChange,
        reshareChange: reshareChange,
        // Engagement rate
        engagementRate: currentEngagement.toFixed(1),
        engagementChange: engagementChange,
        // Lifetime totals as fallback
        lifetimeImpressions: metricsResults[0].elements?.[0]?.count || 0,
        lifetimeReactions: metricsResults[1].elements?.[0]?.count || 0,
        lifetimeComments: metricsResults[2].elements?.[0]?.count || 0,
        lifetimeReshares: metricsResults[3].elements?.[0]?.count || 0
      },
      lastUpdated: new Date().toISOString(),
      requiresReauth: needsAnalyticsPermissions,
      message: needsAnalyticsPermissions ? 
        'LinkedIn analytics permissions required. Please disconnect and reconnect your LinkedIn account to grant access to profile and post analytics.' : 
        !hasAnalyticsData ? 
        'No analytics data available yet. Post some content on LinkedIn to see your analytics.' :
        null
    };

    // Log permission issues if detected
    if (needsAnalyticsPermissions) {
      console.log('Analytics permission issues detected:', {
        hasFollowerAccess,
        hasPostAnalyticsErrors,
        message: 'User needs to reconnect LinkedIn with r_member_profileAnalytics and r_member_postAnalytics scopes'
      });
    }
    
    res.json(dashboard);

  } catch (error) {
    console.error('Error fetching member dashboard:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

module.exports = {
  getMemberFollowerStats,
  getMemberPostAnalytics,
  getMemberDashboard
};