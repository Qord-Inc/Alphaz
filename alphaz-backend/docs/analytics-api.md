# Analytics API Documentation

## Overview

The Analytics API provides endpoints for retrieving LinkedIn member (personal profile) analytics data including follower statistics and post analytics.

## Base URL

```
http://localhost:5000/api
```

## Authentication

All endpoints require a valid `clerkUserId` parameter to identify the user whose LinkedIn analytics are being requested.

## Endpoints

### 1. Get Member Follower Statistics

Retrieve follower statistics for a member's personal LinkedIn profile.

**Endpoint:** `GET /analytics/member/followers/:clerkUserId`

**Parameters:**
- `clerkUserId` (path parameter) - The Clerk user ID
- `dateRange` (query parameter, optional) - JSON object for time-bound statistics

**Examples:**

#### Get Lifetime Follower Count
```bash
GET /analytics/member/followers/user_123456
```

**Response:**
```json
{
  "type": "lifetime",
  "followerCount": 1250
}
```

#### Get Time-bound Follower Statistics
```bash
GET /analytics/member/followers/user_123456?dateRange={"start":{"year":2024,"month":12,"day":1},"end":{"year":2024,"month":12,"day":3}}
```

**Response:**
```json
{
  "type": "time-bound",
  "dateRange": {
    "start": {"year": 2024, "month": 12, "day": 1},
    "end": {"year": 2024, "month": 12, "day": 3}
  },
  "data": [
    {
      "date": {
        "start": {"year": 2024, "month": 12, "day": 1},
        "end": {"year": 2024, "month": 12, "day": 2}
      },
      "followerCount": 5
    },
    {
      "date": {
        "start": {"year": 2024, "month": 12, "day": 2},
        "end": {"year": 2024, "month": 12, "day": 3}
      },
      "followerCount": 8
    }
  ]
}
```

### 2. Get Member Post Analytics

Retrieve analytics for a specific post or aggregated analytics for all member posts.

**Endpoint:** `GET /analytics/member/posts/:clerkUserId`

**Parameters:**
- `clerkUserId` (path parameter) - The Clerk user ID
- `entity` (query parameter, optional) - Post URN for single post analytics
- `queryType` (query parameter, required) - Metric type: `IMPRESSION`, `MEMBERS_REACHED`, `RESHARE`, `REACTION`, `COMMENT`
- `aggregation` (query parameter, optional) - `DAILY` or `TOTAL` (default: `TOTAL`)
- `dateRange` (query parameter, optional) - JSON object for time range

**Examples:**

#### Get Total Impressions for All Posts
```bash
GET /analytics/member/posts/user_123456?queryType=IMPRESSION&aggregation=TOTAL
```

**Response:**
```json
{
  "entity": "all_posts",
  "metric": "IMPRESSION",
  "aggregation": "TOTAL",
  "dateRange": null,
  "data": [
    {
      "date": null,
      "count": 45678,
      "metricType": "IMPRESSION"
    }
  ]
}
```

#### Get Daily Reactions for a Specific Post
```bash
GET /analytics/member/posts/user_123456?entity=urn:li:ugcPost:7325786486870552578&queryType=REACTION&aggregation=DAILY&dateRange={"start":{"year":2024,"month":12,"day":1},"end":{"year":2024,"month":12,"day":3}}
```

**Response:**
```json
{
  "entity": "urn:li:ugcPost:7325786486870552578",
  "metric": "REACTION",
  "aggregation": "DAILY",
  "dateRange": {
    "start": {"year": 2024, "month": 12, "day": 1},
    "end": {"year": 2024, "month": 12, "day": 3}
  },
  "data": [
    {
      "date": {
        "start": {"year": 2024, "month": 12, "day": 1},
        "end": {"year": 2024, "month": 12, "day": 2}
      },
      "count": 12,
      "metricType": "REACTION"
    },
    {
      "date": {
        "start": {"year": 2024, "month": 12, "day": 2},
        "end": {"year": 2024, "month": 12, "day": 3}
      },
      "count": 8,
      "metricType": "REACTION"
    }
  ]
}
```

### 3. Get Member Dashboard

Get aggregated analytics dashboard data including lifetime followers and total post metrics with period comparisons.

**Endpoint:** `GET /analytics/member/dashboard/:clerkUserId`

**Parameters:**
- `clerkUserId` (path parameter) - The Clerk user ID
- `period` (query parameter, optional) - Time period: `7d`, `30d` (default), `90d`, `1y`

**Example:**
```bash
GET /analytics/member/dashboard/user_123456?period=30d
```

**Response:**
```json
{
  "period": "30d",
  "followers": {
    "lifetime": 1250,        // Total followers (all time)
    "currentPeriod": 45,     // New followers gained in selected period (e.g., last 30 days)
    "previousPeriod": 32,    // New followers gained in previous period (e.g., 30 days before that)
    "changePercent": "40.6"  // Percentage change between current and previous period
  },
  "posts": {
    "totalImpressions": 12450,
    "totalReactions": 234,
    "totalComments": 45,
    "totalReshares": 12,
    "impressionChange": "25.3",
    "reactionChange": "18.2", 
    "commentChange": "-5.4",
    "reshareChange": "33.3",
    "engagementRate": "2.3",
    "engagementChange": "-8.0",
    "lifetimeImpressions": 45678,
    "lifetimeReactions": 892,
    "lifetimeComments": 156,
    "lifetimeReshares": 67
  },
  "lastUpdated": "2024-12-03T15:45:00.000Z",
  "requiresReauth": false,
  "message": null
}
```

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "error": "LinkedIn not connected",
  "details": "User has not connected their LinkedIn account"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid queryType",
  "validTypes": ["IMPRESSION", "MEMBERS_REACHED", "RESHARE", "REACTION", "COMMENT"]
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "Error message details"
}
```

## Notes

1. **Date Format**: All date ranges use year, month, day format
2. **URN Format**: Post URNs can be either `ugcPost` or `share` format
3. **Metrics**: 
   - `MEMBERS_REACHED` cannot be used with `DAILY` aggregation
   - Daily impression metrics are not supported for individual posts
4. **Rate Limits**: LinkedIn API has rate limits - implement appropriate caching on the frontend
5. **Token Expiry**: If the LinkedIn token has expired, the API will return a 401 error

## Frontend Implementation Tips

1. **Dashboard View**: Use the `/dashboard` endpoint for the main monitor page overview
2. **Detailed Analytics**: Use specific endpoints for drill-down views
3. **Date Range**: For time-series charts, use the `dateRange` parameter with appropriate start/end dates
4. **Caching**: Consider caching dashboard data for 5-10 minutes to reduce API calls
5. **Error Handling**: Show appropriate messages for LinkedIn disconnection or token expiry