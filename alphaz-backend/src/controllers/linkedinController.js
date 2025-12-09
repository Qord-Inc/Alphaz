const axios = require('axios');
const linkedInConfig = require('../config/linkedin');
const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

// Generate LinkedIn OAuth URL
async function getLinkedInAuthUrl(req, res) {
  try {
    const { clerkUserId } = req.query;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Clerk user ID is required' });
    }

    // Check for required environment variables
    if (!linkedInConfig.clientId || !linkedInConfig.clientSecret) {
      console.error('Missing LinkedIn OAuth credentials');
      return res.status(500).json({ 
        error: 'LinkedIn OAuth not configured',
        details: 'Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET' 
      });
    }

    // Generate state token for security
    const state = jwt.sign(
      { clerkUserId, timestamp: Date.now() },
      process.env.CLERK_SECRET_KEY,
      { expiresIn: '1h' }
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: linkedInConfig.clientId,
      redirect_uri: linkedInConfig.redirectUri,
      scope: linkedInConfig.scope,
      state: state
    });

    const authUrl = `${linkedInConfig.authorizationUrl}?${params.toString()}`;

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating LinkedIn auth URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate authentication URL',
      details: error.message 
    });
  }
}

// Handle LinkedIn OAuth callback
async function handleLinkedInCallback(req, res) {
  try {
    const { code, state, error: linkedInError } = req.query;

    // Handle LinkedIn errors
    if (linkedInError) {
      console.error('LinkedIn OAuth error:', linkedInError, req.query.error_description);
      const errorMessage = req.query.error_description || 'linkedin_auth_failed';
      return res.redirect(`${process.env.FRONTEND_URL}/?error=${encodeURIComponent(errorMessage)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=missing_params`);
    }

    // Verify state token
    let stateData;
    try {
      stateData = jwt.verify(state, process.env.CLERK_SECRET_KEY);
    } catch (err) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=invalid_state`);
    }

    const { clerkUserId } = stateData;

    // Exchange code for access token
    let tokenResponse;
    try {
      console.log('Exchanging code for token with:', {
        client_id: linkedInConfig.clientId,
        redirect_uri: linkedInConfig.redirectUri,
        code_length: code?.length
      });

      tokenResponse = await axios.post(linkedInConfig.tokenUrl, 
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: linkedInConfig.redirectUri,
          client_id: linkedInConfig.clientId,
          client_secret: linkedInConfig.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } catch (tokenError) {
      console.error('Token exchange error:', tokenError.response?.data || tokenError.message);
      return res.redirect(`${process.env.FRONTEND_URL}/?error=token_exchange_failed`);
    }

    const { access_token, expires_in } = tokenResponse.data;

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));

    // Get basic profile info using r_basicprofile scope
    let profileData = {
      id: null,
      name: 'LinkedIn User',
      pictureUrl: null
    };

    try {
      const profileResponse = await axios.get(linkedInConfig.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'LinkedIn-Version': '202511'
        }
      });

      const profile = profileResponse.data;
      
      // Extract profile data
      profileData.id = profile.id;
      profileData.name = `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || 'LinkedIn User';
      
      // Extract profile picture URL if available
      if (profile.profilePicture?.['displayImage~']?.elements?.[0]) {
        const imageElements = profile.profilePicture['displayImage~'].elements;
        // Get the highest quality image
        const bestImage = imageElements[imageElements.length - 1];
        profileData.pictureUrl = bestImage.identifiers?.[0]?.identifier;
      }
    } catch (profileError) {
      console.log('Could not fetch basic profile:', profileError.message);
      // Continue without profile data
    }

    // Update user in database with LinkedIn profile info
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        linkedin_connected: true,
        linkedin_access_token: access_token, // Should be encrypted in production
        linkedin_token_expires_at: tokenExpiresAt.toISOString(),
        linkedin_user_id: profileData.id,
        linkedin_profile_url: profileData.id ? `https://www.linkedin.com/in/${profileData.id}` : null,
        linkedin_profile_name: profileData.name,
        linkedin_profile_picture_url: profileData.pictureUrl,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', clerkUserId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user LinkedIn data:', updateError);
      return res.redirect(`${process.env.FRONTEND_URL}/?error=update_failed`);
    }

    // Fetch user's company pages
    try {
      await fetchUserCompanyPages(clerkUserId, access_token);
    } catch (err) {
      console.error('Error fetching company pages:', err);
      // Don't fail the flow if company pages can't be fetched
    }

    // Redirect back to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/?linkedin=connected`);

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/?error=linkedin_callback_failed`);
  }
}

// Disconnect LinkedIn
async function disconnectLinkedIn(req, res) {
  try {
    const { clerkUserId } = req.params;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Clerk user ID is required' });
    }

    // Clear LinkedIn data from user record
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        linkedin_connected: false,
        linkedin_access_token: null,
        linkedin_token_expires_at: null,
        linkedin_user_id: null,
        linkedin_profile_url: null,
        linkedin_profile_name: null,
        linkedin_profile_picture_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', clerkUserId)
      .select()
      .single();

    if (error) {
      console.error('Error disconnecting LinkedIn:', error);
      return res.status(500).json({ 
        error: 'Failed to disconnect LinkedIn',
        details: error.message 
      });
    }

    // Also remove company pages
    await supabase
      .from('linkedin_company_pages')
      .delete()
      .eq('user_clerk_id', clerkUserId);

    res.json({ 
      message: 'LinkedIn disconnected successfully',
      user: updatedUser 
    });

  } catch (error) {
    console.error('Error disconnecting LinkedIn:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Get LinkedIn connection status
async function getLinkedInStatus(req, res) {
  try {
    const { clerkUserId } = req.params;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Clerk user ID is required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('linkedin_connected, linkedin_profile_url, linkedin_profile_name, linkedin_profile_picture_url, linkedin_token_expires_at')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if token is expired
    const isTokenExpired = user.linkedin_token_expires_at 
      ? new Date(user.linkedin_token_expires_at) < new Date()
      : true;

    res.json({
      connected: user.linkedin_connected && !isTokenExpired,
      profileUrl: user.linkedin_profile_url,
      profileName: user.linkedin_profile_name,
      profilePicture: user.linkedin_profile_picture_url,
      tokenExpired: isTokenExpired
    });

  } catch (error) {
    console.error('Error getting LinkedIn status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Fetch user's company pages
async function fetchUserCompanyPages(clerkUserId, accessToken) {
  try {
    let allAcls = [];
    let start = 0;
    const count = 50; // Max items per page
    let hasMore = true;

    // Fetch all pages of ACLs
    while (hasMore) {
      // Note: We're specifically looking for ADMINISTRATOR role as it has full access
      // Other roles like CONTENT_ADMINISTRATOR have limited access
      const response = await axios.get(
        `${linkedInConfig.organizationAclsUrl}?q=roleAssignee&state=APPROVED&start=${start}&count=${count}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202511'
          }
        }
      );
      
      console.log(`Organization ACLs response page (start=${start}):`, {
        status: response.status,
        dataLength: response.data.elements?.length || 0,
        total: response.data.paging?.total
      });

      const pageAcls = response.data.elements || [];
      allAcls = allAcls.concat(pageAcls);

      // Check if there are more pages
      const paging = response.data.paging || {};
      if (pageAcls.length < count || start + count >= (paging.total || 0)) {
        hasMore = false;
      } else {
        start += count;
      }
    }

    // Log ALL ACLs to see what roles they have
    console.log('All ACLs with their roles:');
    allAcls.forEach((acl, index) => {
      console.log(`ACL ${index + 1}:`, {
        role: acl.role,
        state: acl.state,
        organization: acl.organization || acl.organizationTarget || acl.organizationUrn,
        roleAssignee: acl.roleAssignee
      });
    });

    // Filter for ADMINISTRATOR and CONTENT_ADMINISTRATOR roles
    // Both roles should have sufficient permissions with rw_organization_admin scope
    const adminRoles = ['ADMINISTRATOR', 'CONTENT_ADMINISTRATOR'];
    const acls = allAcls.filter(acl => adminRoles.includes(acl.role));
    console.log(`Found ${allAcls.length} total ACLs, ${acls.length} with admin roles for user ${clerkUserId}`);
    console.log('ACLs:', acls);

    // Extract unique organization URNs from ACLs
    console.log('Extracting organization URNs from ACLs...');
    const organizationData = acls.map(acl => {
      // Based on API docs, organizationTarget is the primary field in responses
      const urn = acl.organizationTarget || acl.organization || acl.organizationUrn;
      return {
        urn,
        role: acl.role,
        hasFullAccess: acl.role === 'ADMINISTRATOR' // Only ADMINISTRATOR has rw_organization_admin access
      };
    });

    const organizationUrns = [...new Set(organizationData.map(org => org.urn).filter(urn => urn))]; // Filter out any undefined/null URNs
    
    const organizations = [];

    // For each organization URN, fetch detailed organization data
    for (const orgUrn of organizationUrns) {
      try {
        // Extract organization ID from URN (format: urn:li:organization:123456 or urn:li:organizationBrand:123456)
        const urnParts = orgUrn.split(':');
        const orgType = urnParts[2]; // 'organization' or 'organizationBrand'
        const orgId = urnParts[3];
        
        // Try to fetch organization details
        let company = {
          id: orgId,
          localizedName: `Organization ${orgId}`,
          vanityName: null,
          logoV2: null
        };
        
        try {
          // Use the appropriate endpoint based on organization type
          const endpoint = orgType === 'organizationBrand' 
            ? `https://api.linkedin.com/v2/organizationBrands/${orgId}`
            : `https://api.linkedin.com/v2/organizations/${orgId}`;
            
          const orgResponse = await axios.get(endpoint, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
              'LinkedIn-Version': '202511'
            }
          });
          company = orgResponse.data;
          console.log(`Successfully fetched details for ${orgType} ${orgId}`);
        } catch (detailError) {
          console.log(`Could not fetch details for ${orgType} ${orgId}: ${detailError.message}`);
          // Try the organization endpoint as fallback if brand endpoint fails
          if (orgType === 'organizationBrand') {
            try {
              const orgResponse = await axios.get(
                `https://api.linkedin.com/v2/organizations/${orgId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202511'
                  }
                }
              );
              company = orgResponse.data;
              console.log(`Fallback successful: fetched as organization instead of brand`);
            } catch (fallbackError) {
              console.log(`Fallback also failed: ${fallbackError.message}`);
            }
          }
        }
        
        organizations.push(company);
        
        // Find the role for this organization
        const orgData = organizationData.find(od => od.urn === orgUrn);
        const userRole = orgData ? orgData.role : 'UNKNOWN';
        
        // Store company pages in database
        // Note: CONTENT_ADMINISTRATOR role has limited API access compared to ADMINISTRATOR
        // - ADMINISTRATOR: Full access with rw_organization_admin scope
        // - CONTENT_ADMINISTRATOR: Content posting only with w_organization_social scope
        const upsertData = {
          user_clerk_id: clerkUserId,
          company_id: orgId,
          company_name: company.localizedName || company.name || `Organization ${orgId}`,
          company_vanity_name: company.vanityName,
          company_logo_url: company.logoV2?.cropped || company.logoV2?.original || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('Upserting company page:', upsertData);
        
        const { error: upsertError } = await supabase
          .from('linkedin_company_pages')
          .upsert(upsertData, {
            onConflict: 'user_clerk_id,company_id'
          });
          
        if (upsertError) {
          console.error('Error upserting company page:', upsertError);
        } else {
          console.log('Successfully upserted company page');
        }
      } catch (orgError) {
        console.error(`Error fetching organization ${orgUrn}:`, orgError.message);
        // Continue with other organizations even if one fails
      }
    }

    return organizations;
  } catch (error) {
    console.error('Error fetching company pages:', error);
    throw error;
  }
}

// Get user's company pages
async function getCompanyPages(req, res) {
  try {
    const { clerkUserId } = req.params;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Clerk user ID is required' });
    }

    console.log('Getting company pages for user:', clerkUserId);

    // First, let's see all company pages for this user
    const { data: allPages, error: allError } = await supabase
      .from('linkedin_company_pages')
      .select('*')
      .eq('user_clerk_id', clerkUserId);
    
    console.log(`All company pages in DB for user: ${allPages?.length || 0}`);
    if (allPages) {
      allPages.forEach(page => {
        console.log(`- Company: ${page.company_name} (ID: ${page.company_id}, Active: ${page.is_active})`);
      });
    }

    const { data: companyPages, error } = await supabase
      .from('linkedin_company_pages')
      .select('*')
      .eq('user_clerk_id', clerkUserId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching company pages:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch company pages',
        details: error.message 
      });
    }

    console.log(`Found ${companyPages?.length || 0} company pages in database`);

    // Transform company pages to match frontend expectations
    const transformedPages = (companyPages || []).map(page => ({
      id: page.company_id,
      name: page.company_name,
      vanityName: page.company_vanity_name,
      logoUrl: page.company_logo_url
    }));

    console.log('Returning transformed pages:', transformedPages);

    res.json({ companyPages: transformedPages });

  } catch (error) {
    console.error('Error getting company pages:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Refresh LinkedIn token (if needed)
async function refreshLinkedInToken(req, res) {
  try {
    const { clerkUserId } = req.params;

    // LinkedIn access tokens are valid for 60 days and cannot be refreshed
    // User needs to re-authenticate when token expires
    res.json({ 
      message: 'LinkedIn tokens cannot be refreshed. User must re-authenticate.',
      requiresReauth: true 
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Debug endpoint to test ACLs directly
async function debugAcls(req, res) {
  try {
    const { clerkUserId } = req.params;

    // Get user's access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('linkedin_access_token')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (userError || !user?.linkedin_access_token) {
      return res.status(400).json({ error: 'User not connected to LinkedIn' });
    }

    // Fetch raw ACLs without filtering
    const response = await axios.get(
      `${linkedInConfig.organizationAclsUrl}?q=roleAssignee&state=APPROVED`,
      {
        headers: {
          'Authorization': `Bearer ${user.linkedin_access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202511'
        }
      }
    );

    res.json({
      rawResponse: response.data,
      summary: {
        totalAcls: response.data.elements?.length || 0,
        byRole: response.data.elements?.reduce((acc, acl) => {
          acc[acl.role] = (acc[acl.role] || 0) + 1;
          return acc;
        }, {}),
        organizations: response.data.elements?.map(acl => ({
          role: acl.role,
          orgUrn: acl.organizationTarget || acl.organization,
          state: acl.state
        }))
      }
    });

  } catch (error) {
    console.error('Debug ACLs error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Debug failed',
      details: error.response?.data || error.message 
    });
  }
}

// Helper function to get LinkedIn access token (exported for analytics controller)
const getLinkedInAccessToken = async (clerkUserId) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('linkedin_access_token, linkedin_token_expires_at')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error || !user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.linkedin_access_token) {
      return { success: false, error: 'LinkedIn not connected' };
    }

    // Check if token is expired
    if (user.linkedin_token_expires_at && new Date(user.linkedin_token_expires_at) < new Date()) {
      return { success: false, error: 'LinkedIn token expired' };
    }

    return { success: true, accessToken: user.linkedin_access_token };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  getLinkedInAuthUrl,
  handleLinkedInCallback,
  disconnectLinkedIn,
  getLinkedInStatus,
  getCompanyPages,
  refreshLinkedInToken,
  debugAcls,
  getLinkedInAccessToken
};