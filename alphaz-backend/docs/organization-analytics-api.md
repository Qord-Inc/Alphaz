# Organization Analytics API

This document describes the organization analytics endpoints for fetching LinkedIn company page analytics data.

## Endpoints

### 1. Get Organization Follower Statistics

Get detailed follower statistics for an organization, either lifetime demographics or time-bound gains.

**Endpoint:** `GET /analytics/organization/followers/:clerkUserId/:organizationId`

**Parameters:**
- `clerkUserId` (path parameter) - The Clerk user ID
- `organizationId` (path parameter) - The LinkedIn organization ID
- `timeGranularity` (query parameter, optional) - `DAY`, `WEEK`, or `MONTH` for time-bound stats
- `startDate` (query parameter, optional) - Start date in ISO format (required if timeGranularity is set)
- `endDate` (query parameter, optional) - End date in ISO format (defaults to current date)

**Examples:**

#### Get Lifetime Demographics
```bash
GET /analytics/organization/followers/user_123/12345
```

**Response:**
```json
{
  "type": "lifetime-demographics",
  "demographics": {
    "byFunction": [
      {
        "followerCounts": {
          "organicFollowerCount": 1662,
          "paidFollowerCount": 0
        },
        "function": "urn:li:function:22"
      }
    ],
    "byIndustry": [
      {
        "followerCounts": {
          "organicFollowerCount": 33,
          "paidFollowerCount": 0
        },
        "industry": "urn:li:industry:96"
      }
    ],
    "bySeniority": [
      {
        "followerCounts": {
          "organicFollowerCount": 4,
          "paidFollowerCount": 0
        },
        "seniority": "urn:li:seniority:2"
      }
    ],
    "byGeoCountry": [
      {
        "geo": "urn:li:geo:102713980",
        "followerCounts": {
          "organicFollowerCount": 66,
          "paidFollowerCount": 0
        }
      }
    ],
    "byStaffCountRange": [
      {
        "followerCounts": {
          "organicFollowerCount": 29,
          "paidFollowerCount": 0
        },
        "staffCountRange": "SIZE_1"
      }
    ],
    "byAssociationType": [
      {
        "followerCounts": {
          "organicFollowerCount": 196,
          "paidFollowerCount": 0
        },
        "associationType": "EMPLOYEE"
      }
    ]
  }
}
```

#### Get Time-Bound Statistics
```bash
GET /analytics/organization/followers/user_123/12345?timeGranularity=DAY&startDate=2024-01-01&endDate=2024-01-07
```

Note: The backend uses Restli 2.0 format for LinkedIn API calls. The actual LinkedIn API request will be formatted as:
```
?timeIntervals=(timeRange:(start:1704067200000,end:1704672000000),timeGranularityType:DAY)
```

**Response:**
```json
{
  "type": "time-bound",
  "granularity": "DAY",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-07"
  },
  "data": [
    {
      "timeRange": {
        "start": 1704067200000,
        "end": 1704153600000
      },
      "organicGain": 223,
      "paidGain": 12,
      "totalGain": 235
    }
  ]
}
```

### 2. Get Organization Network Size

Get the total follower count for an organization.

**Endpoint:** `GET /analytics/organization/network-size/:clerkUserId/:organizationId`

**Parameters:**
- `clerkUserId` (path parameter) - The Clerk user ID
- `organizationId` (path parameter) - The LinkedIn organization ID

**Example:**
```bash
GET /analytics/organization/network-size/user_123/12345
```

**Response:**
```json
{
  "organizationId": "12345",
  "totalFollowers": 15234,
  "lastUpdated": "2024-12-03T15:45:00.000Z"
}
```

### 3. Get Organization Analytics Dashboard

Get aggregated analytics dashboard data for an organization with period comparisons.

**Endpoint:** `GET /analytics/organization/dashboard/:clerkUserId/:organizationId`

**Parameters:**
- `clerkUserId` (path parameter) - The Clerk user ID
- `organizationId` (path parameter) - The LinkedIn organization ID
- `period` (query parameter, optional) - Time period: `7d`, `30d` (default), `90d`, `1y`

**Example:**
```bash
GET /analytics/organization/dashboard/user_123/12345?period=30d
```

**Response:**
```json
{
  "period": "30d",
  "organizationId": "12345",
  "followers": {
    "total": 15234,                // Total followers
    "currentPeriod": 145,         // New followers gained in selected period
    "previousPeriod": 98,         // New followers gained in previous period
    "changePercent": "48.0"       // Percentage change between periods
  },
  "demographics": {
    "topIndustries": [
      {
        "followerCounts": {
          "organicFollowerCount": 33,
          "paidFollowerCount": 0
        },
        "industry": "urn:li:industry:96"
      }
    ],
    "topFunctions": [
      {
        "followerCounts": {
          "organicFollowerCount": 1662,
          "paidFollowerCount": 0
        },
        "function": "urn:li:function:22"
      }
    ],
    "topCountries": [
      {
        "geo": "urn:li:geo:102713980",
        "followerCounts": {
          "organicFollowerCount": 66,
          "paidFollowerCount": 0
        }
      }
    ],
    "employeeFollowers": 196
  },
  "lastUpdated": "2024-12-03T15:45:00.000Z"
}
```

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "error": "LinkedIn not connected",
  "details": "User has not connected LinkedIn account"
}
```

### 403 Forbidden
```json
{
  "error": "Failed to fetch organization follower statistics",
  "details": {
    "status": 403,
    "code": "MISSING_PERMISSION",
    "message": "Not enough permissions to access resource"
  }
}
```

### 404 Not Found
```json
{
  "error": "Failed to fetch organization network size",
  "details": {
    "status": 404,
    "code": "RESOURCE_NOT_FOUND",
    "message": "Organization not found or user is not an admin"
  }
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

1. **Permissions**: These endpoints require the `rw_organization_admin` LinkedIn permission
2. **Admin Access**: User must have ADMINISTRATOR role for the organization
3. **Rate Limits**: LinkedIn API rate limits apply
4. **Data Availability**: Time-bound data is available from 12 months before request date until 2 days before request date
5. **Demographics**: Lifetime statistics show top 100 results per facet category
6. **Caching**: Frontend implements 24-hour caching to reduce API calls