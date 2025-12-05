# LinkedIn OAuth Setup Guide

This guide will walk you through setting up LinkedIn OAuth for the Alphaz platform.

## Prerequisites

- LinkedIn Developer Account
- Business or Premium LinkedIn account (for accessing company pages)

## Step 1: Create LinkedIn App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click "Create app"
3. Fill in the required information:
   - **App name**: Alphaz Analytics Platform
   - **LinkedIn Page**: Select your company page
   - **Privacy policy URL**: Your privacy policy URL
   - **App logo**: Upload your app logo
4. Click "Create app"

## Step 2: Configure OAuth Settings

1. In your app dashboard, go to the **Auth** tab
2. Add OAuth 2.0 redirect URLs:
   - Development: `http://localhost:5000/api/auth/linkedin/callback`
   - Production: `https://your-api-domain.com/api/auth/linkedin/callback`
3. Note down your:
   - **Client ID**
   - **Client Secret**

## Step 3: Request API Access

1. Go to the **Products** tab in your LinkedIn app
2. Request access to the following products:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn**
   - **Marketing Developer Platform** (for company page management)

Note: Some products require LinkedIn review and approval.

## Step 4: Configure Scopes

The application requests the following OAuth scopes:
- `openid` - OpenID Connect authentication
- `profile` - Basic profile information
- `email` - Email address
- `w_member_social` - Post on behalf of the user
- `r_organization_admin` - Manage company pages
- `w_organization_social` - Post on company pages
- `r_organization_social` - Read company page insights

## Step 5: Update Environment Variables

Add the following to your backend `.env` file:

```env
# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:5000/api/auth/linkedin/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Step 6: Test the Integration

1. Start the backend server:
```bash
cd alphaz-backend
npm run dev
```

2. Start the frontend:
```bash
cd alphaz
npm run dev
```

3. Navigate to the Dashboard and click "Connect LinkedIn"
4. Authorize the app to access your LinkedIn account
5. Verify that your company pages are loaded

## OAuth Flow

1. User clicks "Connect LinkedIn" in the dashboard
2. Frontend requests OAuth URL from backend
3. Backend generates secure state token and returns LinkedIn auth URL
4. User is redirected to LinkedIn for authorization
5. LinkedIn redirects back with authorization code
6. Backend exchanges code for access token
7. Backend stores encrypted token and fetches user's company pages
8. User is redirected back to dashboard with success status

## Security Considerations

- Access tokens are stored encrypted in the database
- State parameter prevents CSRF attacks
- Tokens expire after 60 days (LinkedIn limitation)
- Users must re-authenticate when tokens expire

## Troubleshooting

### "Invalid redirect_uri" error
- Ensure the redirect URI in your LinkedIn app matches exactly
- Check for trailing slashes or protocol differences

### "Scope not authorized" error
- Verify you've requested access to required products
- Some scopes require LinkedIn approval

### Company pages not showing
- Ensure user has admin access to company pages
- Check if Marketing Developer Platform access is approved

## Production Deployment

1. Update redirect URIs in LinkedIn app settings
2. Use HTTPS for all OAuth endpoints
3. Implement proper token encryption
4. Set up monitoring for token expiration
5. Consider implementing a token refresh strategy

## Rate Limits

LinkedIn API has rate limits:
- 100 requests per day per user
- 1000 requests per day per app
- Plan your API usage accordingly

## Additional Resources

- [LinkedIn OAuth Documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn API Reference](https://learn.microsoft.com/en-us/linkedin/marketing/overview)
- [OpenID Connect with LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)