# LinkedIn API Endpoints Clarification

## Two Different APIs for Organization Data

### 1. Organization Page Statistics API
**Endpoint**: `/rest/organizationPageStatistics`
**Purpose**: Returns page VIEW statistics
**Data includes**:
- Page views (overview, jobs, about, etc.)
- Views by industry, function, seniority, geography
- **NOT follower data**

### 2. Organizational Entity Follower Statistics API  
**Endpoint**: `/rest/organizationalEntityFollowerStatistics`
**Purpose**: Returns FOLLOWER statistics
**Data includes**:
- Follower counts by demographics
- Follower gains (organic and paid)
- Time-series follower data (when time parameters are provided)

## Current Implementation Status

### Working ✅
- Total follower count via `/rest/networkSizes`

### Attempting to Use 🔄
- Follower gains via `/rest/organizationalEntityFollowerStatistics`
- Falls back to estimates when data not available

### Not Using ❌
- Page view statistics (was mistakenly used earlier)

## Frontend Expectations

The frontend expects follower data in this format:
```json
{
  "followers": {
    "total": 1234,        // From networkSizes API
    "currentPeriod": 50,  // From follower statistics or estimated
    "previousPeriod": 40, // From follower statistics or estimated
    "changePercent": "25" // Calculated
  }
}
```

## Recommendation

The current implementation is correct in concept:
1. Get total followers from `networkSizes` ✅
2. Try to get follower gains from `organizationalEntityFollowerStatistics` 🔄
3. Fall back to estimates if data unavailable ✅

The issue may be with:
- LinkedIn API permissions
- Time parameter formatting
- API response structure variations