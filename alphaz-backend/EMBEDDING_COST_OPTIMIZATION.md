# Embedding Cost Optimization - 24-Hour Retry Logic

## 💰 Cost-Saving Strategy

To prevent unnecessary OpenAI API calls and save costs, the system now implements a **24-hour retry policy** for failed embedding generations.

## 🔍 How It Works

Before generating an embedding for any content type, the system checks:

1. **Does a record already exist?**
2. **Does it have a valid embedding?** (`embedding IS NOT NULL`)
3. **When was it created?** (`created_at` timestamp)

### Decision Logic

```javascript
if (existingRecord.embedding !== null) {
  // ✅ Already has embedding → SKIP (no cost)
  // Don't regenerate, save API calls
}
else if (hoursSinceCreation < 24) {
  // ⏰ Recently failed (<24hrs) → SKIP (wait for retry window)
  // Prevents hammering OpenAI API when quota is exceeded
}
else {
  // ♻️ Old failure (>24hrs) → RETRY
  // Enough time has passed, try again (maybe credits added)
}
```

## 📊 Applied To All Content Types

### 1. Demographic Data (Analytics)
- **Content Type**: `demographic_data`
- **What it contains**: Followers, page views, demographics
- **Retry logic**: Checks existing record before generating embedding

### 2. Post Performance
- **Content Type**: `post_performance`
- **What it contains**: Individual post content + engagement metrics
- **Retry logic**: Applied in TWO locations:
  - `generateEmbeddingsFromCache()` - Bulk post processing
  - `storePost()` - Individual post storage
- **Per-post check**: Uses `metadata->>'post_id'` to identify specific posts

### 3. Summary
- **Content Type**: `summary`
- **What it contains**: Comprehensive overview (analytics + top 10 posts)
- **Retry logic**: Checks before regenerating summary

## 🎯 Cost Savings Examples

### Scenario 1: API Quota Exceeded
```
First Refresh (No credits):
✓ Content inserted with embedding: null
✓ Created: 2025-12-10 10:00 AM
Cost: $0 (API failed, no charge)

Second Refresh (1 hour later, still no credits):
⏭️ Skipping: Created 1.0hrs ago, wait 24hrs
Cost: $0 (no API call made)

Third Refresh (25 hours later, credits added):
♻️ Retrying: Null embedding, 25.0hrs old
✓ Generated embedding: success (1536 dimensions)
Cost: $0.00002 per embedding
```

**Savings**: Prevented ~23 failed API calls during the 24-hour window

### Scenario 2: Already Embedded
```
First Refresh (With credits):
✓ Generated embedding: success
Cost: $0.00002 per item

All Subsequent Refreshes:
⏭️ Skipping: Already has embedding
Cost: $0 (no API calls)
```

**Savings**: Infinite - embeddings never regenerated once successful

## 📈 Real-World Cost Impact

### Without 24-Hour Logic
- User clicks Refresh every hour when quota exceeded
- 24 failed API attempts per item
- Even with $0 charge for failures, wastes API rate limits
- Confusing logs: repeated errors

### With 24-Hour Logic
- First failure: Record created with `embedding: null`
- Next 23 hours: Automatically skipped
- Hour 25: Single retry attempt
- **Result**: 96% fewer API calls, cleaner logs

## 🔧 Implementation Details

### Database Query
```javascript
const { data: existingRecord } = await supabase
  .from('organization_analytics_embeddings')
  .select('id, embedding, created_at')
  .eq('user_clerk_id', clerkUserId)
  .eq('organization_id', organizationId)
  .eq('content_type', 'demographic_data') // or post_performance, summary
  .single();
```

### Time Calculation
```javascript
const createdDate = new Date(existingRecord.created_at);
const hoursSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);

if (hoursSinceCreation < 24) {
  console.log(`⏭️ Skipping: Created ${hoursSinceCreation.toFixed(1)}hrs ago`);
}
```

### Logging
- `⏭️ Skipping`: Already has embedding or too soon to retry
- `♻️ Retrying`: Null embedding + >24hrs old
- `✓ Generated embedding`: Success message with dimensions or "null (will retry in 24hrs)"

## 💡 User Experience

### When API Quota Exceeded

**Without optimization:**
```
Error generating embedding: 429 quota exceeded
Error generating embedding: 429 quota exceeded
Error generating embedding: 429 quota exceeded
... (repeated every refresh)
```

**With optimization:**
```
First Refresh:
✓ Generated embedding: null (will retry in 24hrs)

Subsequent Refreshes (<24hrs):
⏭️ Skipping demographic_data: Created 2.3hrs ago, wait 24hrs (cost savings)
⏭️ Skipping 7 posts with existing embeddings

After 24 hours:
♻️ Retrying demographic_data: Null embedding, 25.1hrs old
✓ Generated embedding: success (1536 dimensions)
```

## 🎯 Benefits

### 1. **Cost Reduction**
- Prevents redundant API calls for already-embedded content
- Avoids hammering API during quota exceeded periods
- Typical savings: **95-99% reduction in duplicate embedding costs**

### 2. **Better Rate Limit Management**
- Respects OpenAI rate limits
- Prevents temporary bans from excessive failed requests
- Graceful degradation when quota exceeded

### 3. **Cleaner Logs**
- Fewer error messages cluttering logs
- Clear indicators of what's happening
- Easy to understand retry schedule

### 4. **Content Preserved**
- Even if embedding fails, content is stored
- Can manually query content without embeddings
- Embeddings regenerated automatically after 24hrs

## 📋 Testing

### Verify Cost Savings Working

**1. Check existing embeddings:**
```sql
SELECT 
  content_type,
  embedding IS NOT NULL as has_embedding,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_old
FROM organization_analytics_embeddings
WHERE user_clerk_id = 'your_clerk_id'
ORDER BY created_at DESC;
```

**2. Click Refresh multiple times:**
- First time: Should attempt embedding generation
- Subsequent times (<24hrs): Should skip with log messages

**3. Check logs:**
```
⏭️ Skipping demographic_data: Already has embedding (cost savings)
⏭️ Skipping summary: Created 1.5hrs ago, wait 24hrs (cost savings)
```

### Force Retry (for testing)

**Option 1**: Delete existing records
```sql
DELETE FROM organization_analytics_embeddings 
WHERE user_clerk_id = 'your_clerk_id';
```

**Option 2**: Set old created_at
```sql
UPDATE organization_analytics_embeddings
SET created_at = NOW() - INTERVAL '25 hours'
WHERE user_clerk_id = 'your_clerk_id'
AND embedding IS NULL;
```

Then click Refresh - should see retry messages

## 🚀 Future Enhancements

1. **Configurable retry window**: Change from 24hrs to custom duration
2. **Exponential backoff**: 1hr → 6hrs → 24hrs → 7 days
3. **Manual retry button**: Force regeneration on demand
4. **Batch retry**: Retry all null embeddings at once when credits restored
5. **Cost tracking**: Log actual API costs and savings metrics

## ✅ Status

**Implementation**: Complete
**Applied to**: All 3 content types (demographic_data, post_performance, summary)
**Cost savings**: ~95-99% reduction in duplicate API calls
**User impact**: Minimal - transparent retry logic

---

**Last Updated**: December 10, 2025
**Status**: Active and tested
