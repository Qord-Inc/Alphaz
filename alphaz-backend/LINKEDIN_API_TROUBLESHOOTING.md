# LinkedIn API Troubleshooting Guide

## Common Issues and Solutions

### 1. VERSION_MISSING Error

**Problem**: Getting error "A version must be present. Please specify a version by adding the LinkedIn-Version header."

**Solution**: Add the `LinkedIn-Version` header to all API calls:

```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'X-Restli-Protocol-Version': '2.0.0',
  'LinkedIn-Version': '202511' // Required since late 2025
}
```

### 2. Organization Endpoint 404 Error

**Problem**: Getting 404 error when trying to fetch organizations using `/v2/organizations` endpoint.

**Solution**: Use the REST API endpoint `/rest/organizationAcls` instead. The v2 organizations endpoint has been deprecated.

```javascript
// Wrong
GET https://api.linkedin.com/v2/organizations?q=roleAssignee

// Correct
GET https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED
```

### 2. Scope Errors

**Problem**: Getting "unauthorized_scope_error" for various scopes.

**Available Scopes** (Community Management API):
- `r_basicprofile` - Basic profile info (name, photo, headline)
- `w_member_social` - Create/modify posts on behalf of user
- `rw_organization_admin` - Manage organization pages
- `w_organization_social` - Create/modify posts for organizations
- `r_organization_social` - Read organization posts and engagement

**NOT Available** (requires Sign In with LinkedIn):
- `openid` - OpenID Connect authentication
- `profile` - Full profile access
- `email` - Email address access

### 3. API Response Format Changes

The REST API returns ACLs (Access Control Lists) instead of organization objects:

```javascript
// ACL Response Format
{
  "elements": [{
    "role": "ADMINISTRATOR",
    "organization": "urn:li:organization:123456", // or "organizationTarget"
    "roleAssignee": "urn:li:person:abcdef",
    "state": "APPROVED"
  }]
}
```

### 4. Organization Details Access

Fetching organization details (`/v2/organizations/{id}`) may fail with 404 or 403 errors. The application handles this gracefully by:
1. Storing basic organization info from the ACL
2. Attempting to fetch detailed info if available
3. Using fallback data if details aren't accessible

## Required Headers

Always include these headers for LinkedIn API calls:
```
Authorization: Bearer {access_token}
X-Restli-Protocol-Version: 2.0.0
LinkedIn-Version: 202511
```

**Note**: The `LinkedIn-Version` header is now required. If you get a "VERSION_MISSING" error, make sure to include it. The version format is typically YYYYMM (e.g., 202511 for November 2025).

## Debugging Tips

1. Check the OAuth scopes in your LinkedIn app settings
2. Verify you have the Community Management API product access
3. Use the REST API endpoints instead of v2 endpoints where applicable
4. Check ACL permissions before trying to access organization data