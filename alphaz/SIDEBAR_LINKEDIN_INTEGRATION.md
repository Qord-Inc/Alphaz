# Sidebar LinkedIn Profile Integration

## Overview

Once a user connects their LinkedIn account, the sidebar will display their LinkedIn profile picture and name instead of the default "Alphaz" branding.

## Features

### Connected State
- Shows LinkedIn profile picture (32x32px rounded)
- Displays LinkedIn profile name
- Shows "LinkedIn" label underneath
- Profile picture remains visible even when sidebar is collapsed

### Disconnected State
- Shows default "Alphaz" branding
- No profile information displayed

## Implementation Details

### Database Schema
Added columns to `users` table:
- `linkedin_profile_name` - User's full name from LinkedIn
- `linkedin_profile_picture_url` - URL to profile picture

### Backend Updates
- LinkedIn OAuth callback saves profile data:
  - `name` from LinkedIn OpenID response
  - `picture` URL from LinkedIn OpenID response
- Status endpoint returns profile information
- Disconnect endpoint clears profile data

### Frontend Components
- `useUser` hook includes LinkedIn profile fields
- Sidebar component conditionally renders:
  - LinkedIn profile when connected
  - Default branding when disconnected

## Future Enhancements

As mentioned, future updates will include:
- Dropdown to switch between personal account and company pages
- Company page profile pictures and names
- Account switcher UI

## Testing

1. Connect LinkedIn account via Dashboard
2. Verify profile picture appears in sidebar
3. Check name is displayed correctly
4. Test collapsed/expanded states
5. Disconnect and verify it returns to default branding

## Notes

- Profile pictures are served directly from LinkedIn CDN
- Names are truncated if too long (max 140px width)
- Profile data is cleared when user disconnects LinkedIn