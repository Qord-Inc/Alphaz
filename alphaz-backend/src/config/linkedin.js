require('dotenv').config();

const linkedInConfig = {
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/auth/linkedin/callback',
  scope: [
    'r_basicprofile', // Basic profile info (name, photo, headline)
    // 'w_member_social', // For posting on behalf of user
    'rw_organization_admin', // For managing company pages and retrieve reporting data
    //'w_organization_social', // For posting on company pages
    'r_organization_social', // For reading organization posts and engagement data
    'r_member_profileAnalytics', // For member follower statistics
    'r_member_postAnalytics' // For member post analytics
  ].join(' '),
  authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  userInfoUrl: 'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~digitalmediaAsset))',
  organizationAclsUrl: 'https://api.linkedin.com/rest/organizationAcls'
};

// Log configuration status (without exposing secrets)
console.log('LinkedIn OAuth Configuration:', {
  clientIdConfigured: !!linkedInConfig.clientId,
  clientSecretConfigured: !!linkedInConfig.clientSecret,
  redirectUri: linkedInConfig.redirectUri,
  scopesRequested: linkedInConfig.scope.split(' ')
});

if (!linkedInConfig.clientId || !linkedInConfig.clientSecret) {
  console.error('WARNING: LinkedIn OAuth credentials are not configured!');
  console.error('Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in your .env file');
}

module.exports = linkedInConfig;