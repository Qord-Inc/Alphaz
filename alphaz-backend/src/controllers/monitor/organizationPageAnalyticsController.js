const { getLinkedInAccessToken } = require('../core/linkedinController');

/**
 * Get organization page statistics (lifetime or time-bound)
 * @route GET /api/analytics/organization/page-stats/:clerkUserId/:organizationId
 * @query period - Time period: 7d, 30d, 90d, 1y, lifetime (default: 30d)
 */
const getOrganizationPageStats = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;
    const { period = '30d' } = req.query;

    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;
    
    // Build URL based on period
    let url;
    let timeIntervals = '';
    
    if (period === 'lifetime') {
      // Lifetime stats - no time intervals
      url = `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encodeURIComponent(`urn:li:organization:${organizationId}`)}`;
      console.log('Fetching lifetime page statistics');
    } else {
      // Time-bound stats
      const now = new Date();
      // LinkedIn API data has ~2 day delay, so we end 2 days before today
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);
      
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };
      
      const daysAgo = periodDays[period] || 30;
      const endDate = twoDaysAgo;
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - daysAgo);
      
      // Use Restli 2.0 format
      const start = startDate.getTime();
      const end = endDate.getTime();
      timeIntervals = `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
      
      url = `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encodeURIComponent(`urn:li:organization:${organizationId}`)}&timeIntervals=${timeIntervals}`;
      console.log(`Fetching time-bound page statistics for ${period}`);
    }
    
    console.log('Page statistics URL:', url);

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
        error: 'Failed to fetch page statistics',
        details: data 
      });
    }

    // Process response based on type
    if (period === 'lifetime' && data.elements?.[0]) {
      const element = data.elements[0];
      
      // Extract lifetime statistics
      const result = {
        type: 'lifetime',
        organizationId,
        totalViews: element.totalPageStatistics?.views?.allPageViews?.pageViews || 0,
        desktopViews: element.totalPageStatistics?.views?.allDesktopPageViews?.pageViews || 0,
        mobileViews: element.totalPageStatistics?.views?.allMobilePageViews?.pageViews || 0,
        overviewViews: element.totalPageStatistics?.views?.overviewPageViews?.pageViews || 0,
        careersViews: element.totalPageStatistics?.views?.careersPageViews?.pageViews || 0,
        demographics: {
          byCountry: (element.pageStatisticsByGeoCountry || []).map(item => ({
            country: item.geo,
            views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
          })).slice(0, 5),
          byFunction: (element.pageStatisticsByFunction || []).map(item => ({
            function: item.function,
            views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
          })).slice(0, 5),
          byIndustry: (element.pageStatisticsByIndustryV2 || []).map(item => ({
            industry: item.industryV2,
            views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
          })).slice(0, 5),
          bySeniority: (element.pageStatisticsBySeniority || []).map(item => ({
            seniority: item.seniority,
            views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
          })).slice(0, 5),
          byCompanySize: (element.pageStatisticsByStaffCountRange || []).map(item => ({
            staffCountRange: item.staffCountRange,
            views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
          })).slice(0, 5)
        },
        lastUpdated: new Date().toISOString()
      };
      
      res.json(result);
    } else {
      // Time-bound statistics
      const totalViews = data.elements?.reduce((sum, element) => {
        return sum + (element.totalPageStatistics?.views?.allPageViews?.pageViews || 0);
      }, 0) || 0;
      
      const dailyViews = data.elements?.map(element => ({
        date: new Date(element.timeRange.start).toISOString().split('T')[0],
        views: element.totalPageStatistics?.views?.allPageViews?.pageViews || 0,
        uniqueViews: element.totalPageStatistics?.views?.allPageViews?.uniquePageViews || 0
      })) || [];
      
      const result = {
        type: 'time-bound',
        period,
        organizationId,
        totalViews,
        dailyViews,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        lastUpdated: new Date().toISOString()
      };
      
      res.json(result);
    }

  } catch (error) {
    console.error('Error fetching page statistics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

/**
 * Get comprehensive page analytics dashboard
 * Combines page views with follower data for a complete picture
 * @route GET /api/analytics/organization/page-dashboard/:clerkUserId/:organizationId
 * @query period - Time period: 7d, 30d, 90d, 1y (default: 30d)
 */
const getOrganizationPageDashboard = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;
    const { period = '30d' } = req.query;
    
    // Get LinkedIn access token
    const tokenResult = await getLinkedInAccessToken(clerkUserId);
    if (!tokenResult.success) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected',
        details: tokenResult.error 
      });
    }

    const { accessToken } = tokenResult;
    
    // Calculate date ranges
    // LinkedIn API data has ~2 day delay, so we end 2 days before today
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    
    const periodDays = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const daysAgo = periodDays[period] || 30;
    
    // Current period
    const currentPeriodEnd = twoDaysAgo;
    const currentPeriodStart = new Date(currentPeriodEnd);
    currentPeriodStart.setDate(currentPeriodEnd.getDate() - daysAgo);
    
    // Previous period for comparison
    const previousPeriodEnd = new Date(currentPeriodStart);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd);
    previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysAgo);
    
    // Helper function to fetch page views for a period
    const fetchPageViewsForPeriod = async (startDate, endDate) => {
      const start = startDate.getTime();
      const end = endDate.getTime();
      const timeIntervals = `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
      
      const url = `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encodeURIComponent(`urn:li:organization:${organizationId}`)}&timeIntervals=${timeIntervals}`;
      
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
        // console.log(`Fetched page views for period ${startDate.toISOString()} to ${endDate.toISOString()}`, data);
        if (!response.ok) {
          console.error('Failed to fetch page views:', data);
          return null;
        }
        
        // Sum up views for the period and collect breakdown
        let totalViews = 0;
        let uniqueViews = 0;
        const breakdown = {
          overviewPageViews: 0,
          jobsPageViews: 0,
          peoplePageViews: 0,
          aboutPageViews: 0,
          careersPageViews: 0,
          lifeAtPageViews: 0,
          productsPageViews: 0,
          insightsPageViews: 0,
          allDesktopPageViews: 0,
          allMobilePageViews: 0
        };
        
        data.elements?.forEach(element => {
          const views = element.totalPageStatistics?.views;
          if (views) {
            totalViews += views.allPageViews?.pageViews || 0;
            uniqueViews += views.allPageViews?.uniquePageViews || 0;
            
            // Collect breakdown
            breakdown.overviewPageViews += views.overviewPageViews?.pageViews || 0;
            breakdown.jobsPageViews += views.jobsPageViews?.pageViews || 0;
            breakdown.peoplePageViews += views.peoplePageViews?.pageViews || 0;
            breakdown.aboutPageViews += views.aboutPageViews?.pageViews || 0;
            breakdown.careersPageViews += views.careersPageViews?.pageViews || 0;
            breakdown.lifeAtPageViews += views.lifeAtPageViews?.pageViews || 0;
            breakdown.productsPageViews += views.productsPageViews?.pageViews || 0;
            breakdown.insightsPageViews += views.insightsPageViews?.pageViews || 0;
            breakdown.allDesktopPageViews += views.allDesktopPageViews?.pageViews || 0;
            breakdown.allMobilePageViews += views.allMobilePageViews?.pageViews || 0;
          }
        });
        
        return { totalViews, uniqueViews, breakdown };
      } catch (error) {
        console.error('Error fetching page views:', error);
        return null;
      }
    };
    
    // Fetch data in parallel
    const [currentPeriodData, previousPeriodData, lifetimeStatsResponse] = await Promise.all([
      fetchPageViewsForPeriod(currentPeriodStart, currentPeriodEnd),
      fetchPageViewsForPeriod(previousPeriodStart, previousPeriodEnd),
      fetch(`https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encodeURIComponent(`urn:li:organization:${organizationId}`)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202511',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      })
    ]);
    
    // Process lifetime statistics for demographics
    let lifetimeDemographics = null;
    let lifetimeBreakdown = null;
    if (lifetimeStatsResponse.ok) {
      const lifetimeData = await lifetimeStatsResponse.json();
    //   console.log('Lifetime page statistics response:', JSON.stringify(lifetimeData, null, 2));
      
      if (lifetimeData.elements?.[0]) {
        const element = lifetimeData.elements[0];
        const views = element.totalPageStatistics?.views;
        // console.log('Total lifetime views:', views?.allPageViews?.pageViews);
        // console.log('Countries data:', element.pageStatisticsByGeoCountry?.length);
        // console.log('Functions data:', element.pageStatisticsByFunction?.length);
        // console.log('Industries data:', element.pageStatisticsByIndustryV2?.length);
        // console.log('Seniorities data:', element.pageStatisticsBySeniority?.length);
        // console.log('Company sizes data:', element.pageStatisticsByStaffCountRange?.length);
        
        lifetimeDemographics = {
          totalLifetimeViews: views?.allPageViews?.pageViews || 0,
          viewsByCountry: (element.pageStatisticsByGeoCountry || []).slice(0, 5),
          viewsByFunction: (element.pageStatisticsByFunction || []).slice(0, 5),
          viewsByIndustry: (element.pageStatisticsByIndustryV2 || []).slice(0, 5),
          viewsBySeniority: (element.pageStatisticsBySeniority || []).slice(0, 5),
          viewsByCompanySize: (element.pageStatisticsByStaffCountRange || []).slice(0, 5)
        };
        
        // Extract lifetime breakdown
        lifetimeBreakdown = {
          overviewPageViews: views?.overviewPageViews?.pageViews || 0,
          jobsPageViews: views?.jobsPageViews?.pageViews || 0,
          peoplePageViews: views?.peoplePageViews?.pageViews || 0,
          aboutPageViews: views?.aboutPageViews?.pageViews || 0,
          careersPageViews: views?.careersPageViews?.pageViews || 0,
          lifeAtPageViews: views?.lifeAtPageViews?.pageViews || 0,
          productsPageViews: views?.productsPageViews?.pageViews || 0,
          insightsPageViews: views?.insightsPageViews?.pageViews || 0,
          allDesktopPageViews: views?.allDesktopPageViews?.pageViews || 0,
          allMobilePageViews: views?.allMobilePageViews?.pageViews || 0
        };
      }
    } else {
      console.error('Failed to fetch lifetime page statistics:', lifetimeStatsResponse.status);
      const errorData = await lifetimeStatsResponse.json();
      console.error('Error response:', errorData);
    }
    
    // Calculate change percentages
    const viewsChangePercent = previousPeriodData?.totalViews > 0 
      ? ((currentPeriodData?.totalViews - previousPeriodData.totalViews) / previousPeriodData.totalViews * 100).toFixed(1)
      : null;
    
    // Build dashboard response
    const dashboard = {
      period,
      organizationId,
      pageViews: {
        currentPeriod: currentPeriodData?.totalViews || 0,
        previousPeriod: previousPeriodData?.totalViews || 0,
        changePercent: viewsChangePercent,
        uniqueViewsCurrent: currentPeriodData?.uniqueViews || 0,
        uniqueViewsPrevious: previousPeriodData?.uniqueViews || 0,
        lifetime: lifetimeDemographics?.totalLifetimeViews || 0,
        breakdown: lifetimeBreakdown,
        currentPeriodBreakdown: currentPeriodData?.breakdown,
        previousPeriodBreakdown: previousPeriodData?.breakdown
      },
      demographics: lifetimeDemographics ? {
        countries: lifetimeDemographics.viewsByCountry.map(item => ({
          country: item.geo,
          views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
        })),
        functions: lifetimeDemographics.viewsByFunction.map(item => ({
          function: item.function,
          views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
        })),
        industries: lifetimeDemographics.viewsByIndustry.map(item => ({
          industry: item.industryV2,
          views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
        })),
        seniorities: lifetimeDemographics.viewsBySeniority.map(item => ({
          seniority: item.seniority,
          views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
        })),
        companySizes: lifetimeDemographics.viewsByCompanySize.map(item => ({
          staffCountRange: item.staffCountRange,
          views: item.pageStatistics?.views?.allPageViews?.pageViews || 0
        })),
        hasData: lifetimeDemographics.viewsByCountry.length > 0 || 
                 lifetimeDemographics.viewsByFunction.length > 0 || 
                 lifetimeDemographics.viewsByIndustry.length > 0 || 
                 lifetimeDemographics.viewsBySeniority.length > 0 || 
                 lifetimeDemographics.viewsByCompanySize.length > 0
      } : null,
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
      lastUpdated: new Date().toISOString()
    };
    
    // console.log('Page dashboard demographics:', dashboard.demographics ? {
    //   countries: dashboard.demographics.countries?.length || 0,
    //   functions: dashboard.demographics.functions?.length || 0,
    //   industries: dashboard.demographics.industries?.length || 0,
    //   seniorities: dashboard.demographics.seniorities?.length || 0,
    //   companySizes: dashboard.demographics.companySizes?.length || 0
    // } : 'null');
    
    res.json(dashboard);
    
  } catch (error) {
    console.error('Error fetching page dashboard:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

module.exports = {
  getOrganizationPageStats,
  getOrganizationPageDashboard
};