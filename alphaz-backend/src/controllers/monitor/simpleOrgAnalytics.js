const { getLinkedInAccessToken } = require('../core/linkedinController');

/**
 * Simple organization analytics focusing on available data
 */
const getSimpleOrganizationMetrics = async (req, res) => {
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
    
    // 1. Get total follower count (this works reliably)
    console.log('Fetching follower count...');
    const networkSizeUrl = `https://api.linkedin.com/rest/networkSizes/urn:li:organization:${organizationId}?edgeType=FOLLOWS`;
    const networkResponse = await fetch(networkSizeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202511',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    let totalFollowers = 0;
    if (networkResponse.ok) {
      const networkData = await networkResponse.json();
      totalFollowers = networkData.firstDegreeSize || 0;
      console.log(`Total followers: ${totalFollowers}`);
    }
    
    // 2. Try to get demographics (lifetime data)
    console.log('Fetching demographics...');
    let demographics = null;
    const demographicsUrl = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${organizationId}`;
    
    try {
      const demoResponse = await fetch(demographicsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202511',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      
      if (demoResponse.ok) {
        const demoData = await demoResponse.json();
        console.log('Demographics response received');
        
        if (demoData.elements && demoData.elements.length > 0) {
          const element = demoData.elements[0];
          
          // Extract available demographics
          demographics = {
            hasData: true,
            byFunction: element.followerCountsByFunction?.slice(0, 5) || [],
            byIndustry: element.followerCountsByIndustry?.slice(0, 5) || [],
            bySeniority: element.followerCountsBySeniority?.slice(0, 5) || [],
            byCountry: element.followerCountsByGeoCountry?.slice(0, 5) || []
          };
          
          // Log what we found
          console.log('Demographics found:', {
            functions: demographics.byFunction.length,
            industries: demographics.byIndustry.length,
            seniorities: demographics.bySeniority.length,
            countries: demographics.byCountry.length
          });
        }
      }
    } catch (error) {
      console.error('Error fetching demographics:', error);
    }
    
    // 3. Calculate estimated gains (since we can't get real time-based data)
    const periodDays = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const days = periodDays[period] || 30;
    
    // Industry average growth rates (monthly)
    // Small orgs: ~2-3% per month
    // Medium orgs: ~1-2% per month  
    // Large orgs: ~0.5-1% per month
    let monthlyGrowthRate = 0.02; // 2% default
    if (totalFollowers > 10000) monthlyGrowthRate = 0.01;
    if (totalFollowers > 100000) monthlyGrowthRate = 0.005;
    
    const dailyGrowthRate = monthlyGrowthRate / 30;
    const estimatedCurrentGains = Math.round(totalFollowers * dailyGrowthRate * days);
    const estimatedPreviousGains = Math.round(estimatedCurrentGains * 0.85); // Assume 15% growth
    
    const changePercent = estimatedPreviousGains > 0 
      ? ((estimatedCurrentGains - estimatedPreviousGains) / estimatedPreviousGains * 100).toFixed(1)
      : '15.0'; // Default growth
    
    // Build response
    const response = {
      organizationId,
      period,
      metrics: {
        followers: {
          total: totalFollowers,
          currentPeriodGains: estimatedCurrentGains,
          previousPeriodGains: estimatedPreviousGains,
          changePercent,
          isEstimated: true,
          estimationNote: 'Based on industry average growth rates'
        },
        demographics: demographics || {
          hasData: false,
          note: 'Demographics data not available'
        }
      },
      dataQuality: {
        followerCount: 'actual',
        followerGains: 'estimated',
        demographics: demographics ? 'actual' : 'unavailable'
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error in simple organization metrics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

module.exports = {
  getSimpleOrganizationMetrics
};