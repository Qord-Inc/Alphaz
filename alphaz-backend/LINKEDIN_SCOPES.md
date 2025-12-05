# LinkedIn OAuth 2.0 Scopes Available

This document lists all the OAuth 2.0 scopes available for this LinkedIn application.

## Available Scopes

### Profile & Analytics
- `r_basicprofile` - Use your basic profile including your name, photo, headline, and public profile URL
- `r_member_profileAnalytics` - Retrieve your profile analytics, including number of profile viewers, followers, and search appearances
- `r_member_postAnalytics` - Retrieve your posts and their reporting data
- `r_1st_connections_size` - Retrieve the number of 1st-degree connections within your network

### Member Social Actions
- `w_member_social` - Create, modify, and delete posts, comments, and reactions on your behalf
- `w_member_social_feed` - Create, modify, and delete comments and reactions on posts on your behalf

### Organization Management
- `rw_organization_admin` - Manage your organization's pages and retrieve reporting data
- `r_organization_followers` - Use your followers' data so your organization can mention them in posts
- `r_organization_social` - Retrieve your organization's posts, comments, reactions, and other engagement data
- `r_organization_social_feed` - Retrieve comments, reactions, and other engagement data on your organization's posts
- `w_organization_social` - Create, modify, and delete posts, comments, and reactions on your organization's behalf
- `w_organization_social_feed` - Create, modify, and delete comments and reactions on your organization's posts

## Currently Used Scopes

The application currently requests the following scopes:
1. `r_basicprofile` - For fetching user's name and profile picture
2. `w_member_social` - For posting on behalf of user
3. `rw_organization_admin` - For managing company pages
4. `w_organization_social` - For posting on company pages
5. `r_organization_social` - For reading organization posts and engagement data

## Notes

- The application does NOT use OpenID Connect (no `openid` scope)
- The application does NOT require `profile` or `email` scopes
- All scopes listed above are part of the Community Management API access