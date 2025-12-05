# LinkedIn API Scopes Guide

## Available Scopes

### 1. Basic Scopes (Available by Default)

These scopes are available immediately when you create a LinkedIn app:

- `openid` - OpenID Connect authentication
- `profile` - Basic profile information (name, picture, headline)
- `email` - Email address

### 2. Advanced Scopes (Require LinkedIn Approval)

These scopes require submitting your app for LinkedIn review:

#### Publishing Scopes
- `w_member_social` - Share content on behalf of the authenticated member
- `w_organization_social` - Share content on behalf of an organization

#### Organization Management
- `r_organization_admin` - Retrieve organizations where the member is an admin
- `r_organization_social` - Read organization social content analytics
- `rw_organization_admin` - Full organization admin access

#### Analytics & Insights
- `r_ads_reporting` - Access advertising analytics
- `r_member_social` - Access member's social analytics

## Getting Advanced Scopes Approved

### Step 1: Basic Implementation
1. Start with basic scopes only
2. Implement core functionality
3. Ensure your app works properly with limited access

### Step 2: Apply for LinkedIn Partner Program
1. Go to [LinkedIn Marketing Developer Platform](https://business.linkedin.com/marketing-solutions/marketing-partners/become-a-partner)
2. Submit your application with:
   - Company information
   - Use case description
   - Expected API usage
   - Security measures

### Step 3: App Review Process
1. LinkedIn reviews your application (can take 2-4 weeks)
2. You may need to provide:
   - Demo of your application
   - Security audit details
   - Privacy policy
   - Terms of service

### Step 4: Compliance Requirements
- Implement proper data handling
- Follow LinkedIn's API Terms of Use
- Maintain security best practices
- Regular compliance reviews

## Working with Limited Scopes

Until you get approval for advanced scopes, you can:

1. **User Authentication**: ✅ Works with basic scopes
2. **Profile Information**: ✅ Get user's name, email, picture
3. **Manual Posting**: ❌ Users must post manually on LinkedIn
4. **Company Pages**: ❌ Cannot access programmatically
5. **Analytics**: ❌ No access to post analytics

## Temporary Solution

For development and testing:

```javascript
// In src/config/linkedin.js
scope: [
  'openid',
  'profile', 
  'email'
].join(' ')
```

## Future Implementation

Once approved for advanced scopes:

```javascript
// Add these scopes after approval
scope: [
  'openid',
  'profile', 
  'email',
  'w_member_social',        // Post as user
  'r_organization_admin',   // Get company pages
  'w_organization_social',  // Post as company
  'r_organization_social'   // Company analytics
].join(' ')
```

## Alternative Approaches

While waiting for API approval:

1. **Manual Integration**
   - Let users authenticate
   - Store their LinkedIn profile URL
   - Provide "Open in LinkedIn" buttons
   - Users post content manually

2. **LinkedIn Share Button**
   - Use LinkedIn's share widget
   - Pre-fill content programmatically
   - User completes the post manually

3. **Webhook Integration**
   - Set up webhooks for when users post
   - Track engagement manually
   - Build analytics from user-reported data

## Resources

- [LinkedIn API Documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn Partner Program](https://business.linkedin.com/marketing-solutions/marketing-partners)
- [API Terms of Use](https://legal.linkedin.com/api-terms-of-use)
- [Developer Support](https://developer.linkedin.com/support)