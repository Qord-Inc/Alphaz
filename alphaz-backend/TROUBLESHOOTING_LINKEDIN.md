# LinkedIn OAuth Troubleshooting Guide

## Common Error: "linkedin_auth_failed"

This error occurs when LinkedIn denies the authorization request. Common causes:

### 1. Check LinkedIn App Configuration

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Select your app
3. Verify the following:

   **Auth Tab:**
   - Redirect URL must match exactly: `http://localhost:5000/api/auth/linkedin/callback`
   - No trailing slashes
   - Correct protocol (http for local, https for production)

   **Products Tab:**
   - Ensure "Sign In with LinkedIn using OpenID Connect" is added
   - Status should be "Added" not "Pending"

### 2. Environment Variables

Check your backend `.env` file:
```env
LINKEDIN_CLIENT_ID=your_actual_client_id
LINKEDIN_CLIENT_SECRET=your_actual_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:5000/api/auth/linkedin/callback
FRONTEND_URL=http://localhost:3000
```

Common mistakes:
- Using placeholder values instead of actual credentials
- Extra spaces or quotes in values
- Mismatched redirect URI

### 3. Debug Steps

1. **Check Backend Logs**
   ```bash
   cd alphaz-backend
   npm run dev
   ```
   Look for console errors when clicking "Connect LinkedIn"

2. **Verify OAuth URL Generation**
   - Open browser developer tools
   - Click "Connect LinkedIn" 
   - Check Network tab for `/api/auth/linkedin/url` request
   - Verify response contains valid `authUrl`

3. **LinkedIn Authorization Page**
   - Check the URL parameters when redirected to LinkedIn
   - Ensure `client_id` is present and correct
   - Verify `redirect_uri` matches your app configuration

4. **Common LinkedIn Errors**

   **"The application is disabled"**
   - Your LinkedIn app might be in development mode
   - Check app status in LinkedIn Developer Portal

   **"Invalid redirect_uri"**
   - Exact match required including protocol and port
   - No URL encoding issues

   **"Invalid scope"**
   - Some scopes require approval from LinkedIn
   - Start with basic scopes: `openid profile email`

### 4. Test with Minimal Scopes

Update `src/config/linkedin.js` temporarily:
```javascript
scope: [
  'openid',
  'profile', 
  'email'
].join(' '),
```

### 5. Verify Callback Handling

Add debug logging to `linkedinController.js`:
```javascript
console.log('Callback received:', {
  code: req.query.code ? 'present' : 'missing',
  state: req.query.state ? 'present' : 'missing',
  error: req.query.error,
  error_description: req.query.error_description
});
```

### 6. Token Exchange Issues

If you see "token_exchange_failed":
- Verify client secret is correct
- Check if app is approved for production
- Ensure redirect URI matches exactly

### 7. CORS Issues

If requests fail before reaching LinkedIn:
- Check browser console for CORS errors
- Verify `ALLOWED_ORIGINS` in backend includes frontend URL

### 8. Quick Fix Checklist

- [ ] LinkedIn app is active (not disabled)
- [ ] Redirect URI matches exactly
- [ ] Environment variables are set correctly
- [ ] No extra spaces in credentials
- [ ] Products are approved in LinkedIn app
- [ ] Backend server is running
- [ ] Frontend is using correct API URL

### 9. Test Connection

Use this curl command to test OAuth URL generation:
```bash
curl http://localhost:5000/api/auth/linkedin/url?clerkUserId=test_user_123
```

Should return:
```json
{
  "authUrl": "https://www.linkedin.com/oauth/v2/authorization?..."
}
```

### 10. Contact LinkedIn Support

If all else fails:
1. Take screenshots of your app configuration
2. Note the exact error messages
3. Contact LinkedIn Developer Support
4. Provide your app ID and issue details