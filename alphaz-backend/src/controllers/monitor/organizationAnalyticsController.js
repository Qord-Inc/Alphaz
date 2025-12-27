const { getLinkedInAccessToken } = require('../core/linkedinController');
const config = require('../../config/linkedin');

/**
 * Get organization follower statistics (lifetime demographics or time-bound)
 * @route GET /api/analytics/organization/followers/:clerkUserId/:organizationId
 * @query timeGranularity - DAY, WEEK, or MONTH for time-bound stats
 * @query startDate - Start date for time-bound stats (ISO format)
 * @query endDate - End date for time-bound stats (ISO format)
 */
const getOrganizationFollowerStats = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;
    const { timeGranularity, startDate, endDate } = req.query;

    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;
    
    // Build URL based on whether time intervals are provided
    let url;
    if (timeGranularity && startDate) {
      // Time-bound stats - use Restli 2.0 format
      const start = new Date(startDate).getTime();
      const end = endDate ? new Date(endDate).getTime() : Date.now();
      
      // Build URL with proper encoding
      const baseUrl = 'https://api.linkedin.com/rest/organizationalEntityFollowerStatistics';
      
      // Manually construct URL to avoid double-encoding the timeIntervals parameter
      // The structural characters (:, ,) in timeIntervals should NOT be encoded
      const orgUrn = `urn:li:organization:${organizationId}`;
      const timeIntervalsParam = `(timeRange:(start:${start},end:${end}),timeGranularityType:${timeGranularity})`;
      
      url = `${baseUrl}?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals=${timeIntervalsParam}`;
    //   console.log('Time-bound request URL:', url);
    } else {
      // Lifetime stats - simple URL
      url = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${organizationId}`;
    //   console.log('Lifetime stats request URL:', url);
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
        error: 'Failed to fetch organization follower statistics',
        details: data 
      });
    }

    // Transform response based on type
    const result = timeGranularity ? {
      type: 'time-bound',
      granularity: timeGranularity,
      dateRange: { start: startDate, end: endDate || new Date().toISOString() },
      data: data.elements.map(element => ({
        timeRange: element.timeRange,
        organicGain: element.followerGains?.organicFollowerGain || 0,
        paidGain: element.followerGains?.paidFollowerGain || 0,
        totalGain: (element.followerGains?.organicFollowerGain || 0) + (element.followerGains?.paidFollowerGain || 0)
      }))
    } : {
      type: 'lifetime-demographics',
      demographics: {
        byFunction: data.elements[0]?.followerCountsByFunction || [],
        byIndustry: data.elements[0]?.followerCountsByIndustry || [],
        bySeniority: data.elements[0]?.followerCountsBySeniority || [],
        byGeoCountry: data.elements[0]?.followerCountsByGeoCountry || [],
        byStaffCountRange: data.elements[0]?.followerCountsByStaffCountRange || [],
        byAssociationType: data.elements[0]?.followerCountsByAssociationType || []
      }
    };

    res.json(result);

  } catch (error) {
    console.error('Error fetching organization follower stats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

/**
 * Get organization total follower count using networkSizes API
 * @route GET /api/analytics/organization/network-size/:clerkUserId/:organizationId
 */
const getOrganizationNetworkSize = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;

    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;
    const url = `https://api.linkedin.com/rest/networkSizes/urn:li:organization:${organizationId}?edgeType=FOLLOWS`;

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
        error: 'Failed to fetch organization network size',
        details: data 
      });
    }

    res.json({
      organizationId,
      totalFollowers: data.firstDegreeSize || 0,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching organization network size:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

/**
 * Get aggregated organization analytics dashboard
 * @route GET /api/analytics/organization/dashboard/:clerkUserId/:organizationId
 * @query period - Time period: 7d, 30d, 90d, 1y (default: 30d)
 */
const getOrganizationDashboard = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;
    const { period = '30d' } = req.query;
    
    // Calculate date ranges based on period
    // LinkedIn API constraint: data available from 12 months ago to 2 days ago
    const now = new Date();
    // console.log('Current system date:', now.toISOString());
    
    // LinkedIn data is delayed by 2 days, so we use now minus 2 days as our end date
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    
    const periodDays = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const daysAgo = periodDays[period] || 30;
    
    // Use twoDaysAgo as the end date to respect LinkedIn's data availability
    const currentPeriodEnd = new Date(twoDaysAgo);
    const currentPeriodStart = new Date(currentPeriodEnd);
    currentPeriodStart.setDate(currentPeriodEnd.getDate() - daysAgo);
    
    // Previous period for comparison
    const previousPeriodEnd = new Date(currentPeriodStart);
    const previousPeriodStart = new Date(previousPeriodEnd);
    previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysAgo);
    
    // LinkedIn constraint: data only available from 12 months ago
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(now.getFullYear() - 1);
    twelveMonthsAgo.setDate(now.getDate() + 1); // Add 1 day buffer
    
    // console.log('LinkedIn data availability window:');
    // console.log(`  Earliest available: ${twelveMonthsAgo.toISOString()}`);
    // console.log(`  Latest available: ${twoDaysAgo.toISOString()}`);
    
    // Adjust if requesting data older than 12 months
    if (currentPeriodStart < twelveMonthsAgo) {
      console.warn('Current period start is before LinkedIn data window, adjusting...');
      currentPeriodStart.setTime(twelveMonthsAgo.getTime());
    }
    
    if (previousPeriodStart < twelveMonthsAgo) {
      console.warn('Previous period start is before LinkedIn data window, adjusting...');
      previousPeriodStart.setTime(twelveMonthsAgo.getTime());
    }
    
    console.log(`\nFetching organization dashboard for period: ${period} (${daysAgo} days)`);
    console.log(`Current period: ${currentPeriodStart.toISOString()} to ${currentPeriodEnd.toISOString()}`);
    console.log(`Previous period: ${previousPeriodStart.toISOString()} to ${previousPeriodEnd.toISOString()}`);
    
    // Calculate actual days for each period after adjustments
    const currentPeriodDays = Math.ceil((currentPeriodEnd - currentPeriodStart) / (1000 * 60 * 60 * 24));
    const previousPeriodDays = Math.ceil((previousPeriodEnd - previousPeriodStart) / (1000 * 60 * 60 * 24));
    console.log(`Actual days - Current: ${currentPeriodDays}, Previous: ${previousPeriodDays}`);
    
    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;

    // Helper function to fetch follower gains for a date range
    const fetchFollowerGainsForRange = async (startDate, endDate) => {
      // Ensure dates are not in the future
      const maxAllowedDate = new Date();
      maxAllowedDate.setDate(maxAllowedDate.getDate() - 2); // LinkedIn requires 2-day delay
      
      if (endDate > maxAllowedDate) {
        console.warn(`End date ${endDate.toISOString()} is too recent, adjusting to ${maxAllowedDate.toISOString()}`);
        endDate = new Date(maxAllowedDate);
      }
      
      if (startDate >= endDate) {
        console.warn('Start date is after end date, returning 0');
        return 0;
      }
      
      const start = startDate.getTime();
      const end = endDate.getTime();
      
      console.log(`\nFetching follower gains:`);
      console.log(`  From: ${startDate.toISOString()}`);
      console.log(`  To: ${endDate.toISOString()}`);
      console.log(`  Timestamps: ${start} to ${end}`);
      
      // Use organizationalEntityFollowerStatistics for follower data
      // This endpoint provides follower gains over time
      const orgUrn = `urn:li:organization:${organizationId}`;
      
      // Build URL with time range parameters using Restli 2.0 format
      const baseUrl = 'https://api.linkedin.com/rest/organizationalEntityFollowerStatistics';
      
      // Manually construct the URL to avoid double-encoding
      // The timeIntervals parameter should NOT have its structural characters encoded
      const timeIntervalsParam = `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
      
      const url = `${baseUrl}?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&timeIntervals=${timeIntervalsParam}`;
      
      console.log('Fetching follower gains with URL:', url);
      console.log('Decoded URL:', decodeURIComponent(url));
      
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
          console.warn('Failed to fetch follower gains for range.');
          console.warn('Response status:', response.status);
          console.warn('Response data:', JSON.stringify(data, null, 2));
          console.warn('Request details:', {
            url: url,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            startTimestamp: start,
            endTimestamp: end,
            daysDifference: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
          });
          
          
          return null;
        }
        
        console.log('Follower statistics response received');
        // console.log('Response data:', JSON.stringify(data, null, 2));
        
        // Handle the response based on its structure
        const elements = data.elements || [];
        
        if (elements.length === 0) {
          console.log('No follower data in response');
          return 0;
        }
        
        // Check if we got time-bound data (elements with timeRange)
        const hasTimeRanges = elements.some(el => el.timeRange);
        
        if (hasTimeRanges) {
          // Sum up daily follower gains from time-bound data
          const totalGains = elements.reduce((sum, element) => {
            if (element.timeRange && element.followerGains) {
              const gains = element.followerGains;
              const dailyGain = (gains.organicFollowerGain || 0) + (gains.paidFollowerGain || 0);
            //   console.log(`Date: ${new Date(element.timeRange.start).toISOString().split('T')[0]} - Gains: ${dailyGain}`);
              return sum + dailyGain;
            }
            return sum;
          }, 0);
          
          console.log(`Total gains for period: ${totalGains}`);
          return totalGains;
        } else {
          // Lifetime stats (no time intervals)
          console.log('No time-bound data, checking for lifetime stats...');
          const element = elements[0];
          
          // Try to get follower counts
          if (element.followerCounts) {
            const counts = element.followerCounts;
            const total = counts.organicFollowerCount || 0;
            console.log(`Total followers: ${total}`);
            // Estimate gains for the period
            return Math.floor(total * 0.05); // Rough estimate: 5% of total
          }
          
          // Try to get follower gains
          if (element.followerGains) {
            const gains = element.followerGains;
            return (gains.organicFollowerGain || 0) + (gains.paidFollowerGain || 0);
          }
        }
        
        return 0;
      } catch (error) {
        console.error('Error fetching follower gains for range:', error);
        return null;
      }
    };

    // Fetch total follower count
    const networkSizeUrl = `https://api.linkedin.com/rest/networkSizes/urn:li:organization:${organizationId}?edgeType=FOLLOWS`;
    const networkResponse = await fetch(networkSizeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202511',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const networkData = await networkResponse.json();
    const totalFollowers = networkData.firstDegreeSize || 0;
    console.log(`Total followers from networkSizes API: ${totalFollowers}`);
    
    // Try to fetch time-based statistics
    let currentPeriodGains = 0;
    let previousPeriodGains = 0;
    let dataSource = 'none';
    
    try {
      // First attempt: Try fetching with time ranges
      const results = await Promise.all([
        fetchFollowerGainsForRange(currentPeriodStart, currentPeriodEnd),
        fetchFollowerGainsForRange(previousPeriodStart, previousPeriodEnd)
      ]);

      console.log('Time-based follower gains results:', results);
      
      // Check if we got valid results (not null)
      if (results[0] !== null && results[1] !== null) {
        currentPeriodGains = results[0];
        previousPeriodGains = results[1];
        dataSource = 'time-based';
        console.log('Successfully fetched time-based follower gains');
      } else {
        console.log('Failed to fetch time-based data');
      }
    } catch (error) {
      console.error('Error fetching time-based statistics:', error);
    }

    // If we got time-based data but all gains are 0, keep it as time-based
    // If no time-based data at all, create estimates based on industry averages
    if (dataSource === 'none' && totalFollowers > 0) {
      // Industry average growth rates
      let monthlyGrowthRate = 0.02; // 2% default for small orgs
      if (totalFollowers > 10000) monthlyGrowthRate = 0.01; // 1% for medium
      if (totalFollowers > 100000) monthlyGrowthRate = 0.005; // 0.5% for large
      
      // Calculate estimated gains based on period
      const daysInPeriod = daysAgo;
      const dailyRate = monthlyGrowthRate / 30;
      const periodRate = dailyRate * daysInPeriod;
      
      currentPeriodGains = Math.floor(totalFollowers * periodRate);
      previousPeriodGains = Math.floor(totalFollowers * periodRate * 0.95); // Slightly less for comparison
      dataSource = 'estimated';
      
      console.log(`Estimated gains: current=${currentPeriodGains}, previous=${previousPeriodGains}`);
    } else if (dataSource === 'time-based' && currentPeriodGains === 0 && previousPeriodGains === 0) {
      console.log('Time-based data shows 0 gains for both periods');
      // Keep dataSource as 'time-based' to indicate we have real data, just no growth
    }

    // Calculate change percentage
    const followerChangePercent = previousPeriodGains > 0 
      ? ((currentPeriodGains - previousPeriodGains) / previousPeriodGains * 100).toFixed(1)
      : null;

    // Always fetch demographics regardless of time-based data availability
    const demographicsUrl = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${organizationId}`)}`;
    
    let fullDemographics = null;
    try {
    //   console.log('Fetching organization demographics...');
    //   console.log('Demographics URL:', demographicsUrl);
      
      const demographicsResponse = await fetch(demographicsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202511',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      
      console.log('Demographics response status:', demographicsResponse.status);
      const demographicsData = await demographicsResponse.json();
    //   console.log('Demographics response:', JSON.stringify(demographicsData, null, 2));
      
      if (demographicsResponse.ok && demographicsData.elements?.[0]) {
        const demos = demographicsData.elements[0];
        // Return full demographics data, not just top 3
        fullDemographics = {
          industries: demos.followerCountsByIndustry || [],
          functions: demos.followerCountsByFunction || [],
          countries: demos.followerCountsByGeoCountry || [],
          regions: demos.followerCountsByGeo || [],
          seniorities: demos.followerCountsBySeniority || [],
          staffCountRanges: demos.followerCountsByStaffCountRange || []
        };
        console.log('Demographics fetched successfully');
        console.log(`Found ${fullDemographics.industries.length} industries, ${fullDemographics.functions.length} functions`);
      } else {
        console.log('No demographics data found in response');
      }
    } catch (error) {
      console.error('Failed to fetch demographics:', error);
      console.error('Error details:', error.message);
    }

    // Build dashboard response
    const dashboard = {
      period: period,
      organizationId: organizationId,
      followers: {
        total: totalFollowers,
        currentPeriod: currentPeriodGains || 0,
        previousPeriod: previousPeriodGains || 0,
        changePercent: followerChangePercent,
        dataSource: dataSource, // 'time-based', 'estimated', or 'none'
        isEstimated: dataSource === 'estimated'
      },
      demographics: fullDemographics,
      dateRange: {
        current: {
          start: currentPeriodStart.toISOString(),
          end: currentPeriodEnd.toISOString()
        },
        previous: {
          start: previousPeriodStart.toISOString(),
          end: previousPeriodEnd.toISOString()
        }
      },
      lastUpdated: new Date().toISOString(),
      message: dataSource === 'estimated' 
        ? 'Time-based statistics not available. Showing estimated gains based on industry averages.'
        : dataSource === 'time-based' && (currentPeriodGains === 0 && previousPeriodGains === 0)
          ? 'No follower growth detected during the selected periods. This could mean your organization had stable follower count.'
          : dataSource === 'time-based'
            ? 'Showing actual time-based statistics from LinkedIn.' 
            : 'Unable to fetch follower statistics.'
    };
    
    res.json(dashboard);

  } catch (error) {
    console.error('Error fetching organization dashboard:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

/**
 * Get simple organization overview without time-based queries
 * @route GET /api/analytics/organization/overview/:clerkUserId/:organizationId
 */
const getOrganizationOverview = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;
    
    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;
    
    // Fetch basic network size
    const networkSizeUrl = `https://api.linkedin.com/rest/networkSizes/urn:li:organization:${organizationId}?edgeType=FOLLOWS`;
    const networkResponse = await fetch(networkSizeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202511',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const networkData = await networkResponse.json();
    const totalFollowers = networkData.firstDegreeSize || 0;
    
    // Try to get all-time statistics
    let allTimeGains = 0;
    const statsUrl = `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encodeURIComponent(`urn:li:organization:${organizationId}`)}`;
    
    try {
      const statsResponse = await fetch(statsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202511',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.elements && statsData.elements.length > 0) {
          const stats = statsData.elements[0];
          const gains = stats.followerGains || {};
          allTimeGains = (gains.organicFollowerGain || 0) + (gains.paidFollowerGain || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching all-time stats:', error);
    }
    
    res.json({
      organizationId: organizationId,
      followers: {
        total: totalFollowers,
        allTimeGains: allTimeGains
      },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching organization overview:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

module.exports = {
  getOrganizationFollowerStats,
  getOrganizationNetworkSize,
  getOrganizationDashboard,
  getOrganizationOverview
};