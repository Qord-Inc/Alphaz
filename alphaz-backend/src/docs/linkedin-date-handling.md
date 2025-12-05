# LinkedIn API Date Handling Documentation

## Issue Summary
The LinkedIn API has strict date constraints for fetching analytics data:
- Data is only available from **12 months ago to 2 days ago**
- The system date is December 3, 2025
- LinkedIn API may not have data beyond 2024 (API design limitation)

## Current Implementation

### Date Adjustment Strategy
1. **Reference Date**: We use November 28, 2025 as the effective "now" date
2. **Two-Day Delay**: LinkedIn requires a 2-day delay for data availability
3. **12-Month Window**: We ensure all date ranges fall within the 12-month window

### Fallback Mechanism
When time-based queries fail, we fall back to:
1. All-time statistics endpoint (no date parameters)
2. Estimated period gains based on all-time data

### Endpoints

#### 1. Dashboard Endpoint (Time-based with fallback)
```
GET /api/analytics/organization/dashboard/:clerkUserId/:organizationId?period=30d
```
- Attempts time-based queries first
- Falls back to all-time statistics if needed
- Returns `dataSource` field indicating data origin

#### 2. Overview Endpoint (Simple, no time queries)
```
GET /api/analytics/organization/overview/:clerkUserId/:organizationId
```
- Gets total follower count
- Gets all-time follower gains
- No complex date calculations

### Response Format
```json
{
  "followers": {
    "total": 1000,
    "currentPeriod": 50,
    "previousPeriod": 40,
    "changePercent": "25.0",
    "dataSource": "time-based" // or "all-time-estimated" or "none"
  },
  "dateRange": {
    "current": {
      "start": "2025-10-29T00:00:00.000Z",
      "end": "2025-11-26T00:00:00.000Z"
    },
    "previous": {
      "start": "2025-09-29T00:00:00.000Z", 
      "end": "2025-10-29T00:00:00.000Z"
    }
  }
}
```

## Debugging Tips

1. Check the console logs for:
   - "LinkedIn data availability window"
   - "Fetching follower gains"
   - "Successfully fetched time-based follower gains" or fallback messages

2. If time-based queries fail:
   - Verify the date ranges are within 12 months
   - Check LinkedIn API version headers
   - Use the `/overview` endpoint for basic data

3. Common errors:
   - "Invalid query parameters" - Usually means date range issues
   - 400 errors - Check URL encoding and parameter format

## Future Improvements

1. Implement proper caching to avoid repeated API calls
2. Add retry logic with exponential backoff
3. Consider using LinkedIn's batch API for multiple time ranges
4. Add support for different time granularities (MONTH, QUARTER)