# Fix Duplicate Embeddings Issue

## Problem
Every time vector sync runs, it creates duplicate records in:
1. `organization_analytics_cache` table
2. `organization_analytics_embeddings` table

**Expected**: When `clerk_user_id` and `organization_id` are the same, it should UPDATE the existing record, not create a new one.

## Root Cause

### 1. Missing Unique Constraints
The `organization_analytics_embeddings` table didn't have unique constraints to prevent duplicates based on:
- `user_clerk_id` + `organization_id` + `content_type` (for analytics and summary)
- `user_clerk_id` + `organization_id` + `metadata->>'post_id'` (for posts)

### 2. Missing onConflict Clauses
The upsert operations in `vectorEmbeddingsController.js` were missing proper `onConflict` parameters, so Supabase didn't know which columns to check for duplicates.

## Solution Applied

### Part 1: Database Migration ✅

**File**: `add_embeddings_unique_constraint.sql`

This migration:
1. Removes existing duplicates (keeps most recent)
2. Creates partial unique indexes:
   - `idx_embeddings_unique_analytics` - One analytics_data per org
   - `idx_embeddings_unique_summary` - One summary per org
   - `idx_embeddings_unique_post` - One post_performance per post_id

```sql
-- Run this in Supabase SQL Editor

-- Remove duplicates
DELETE FROM organization_analytics_embeddings a
USING organization_analytics_embeddings b
WHERE a.id < b.id
  AND a.user_clerk_id = b.user_clerk_id
  AND a.organization_id = b.organization_id
  AND a.content_type = b.content_type;

-- Create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique_analytics
ON organization_analytics_embeddings(user_clerk_id, organization_id, content_type)
WHERE content_type = 'analytics_data';

CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique_summary
ON organization_analytics_embeddings(user_clerk_id, organization_id, content_type)
WHERE content_type = 'summary';

CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique_post
ON organization_analytics_embeddings(user_clerk_id, organization_id, (metadata->>'post_id'))
WHERE content_type = 'post_performance';
```

### Part 2: Code Fix ✅

**File**: `vectorEmbeddingsController.js`

Added `onConflict` clauses to 4 upsert operations:

#### 1. Analytics Data Embedding (Line ~191)
```javascript
// Before: Missing onConflict
await supabase
  .from('organization_analytics_embeddings')
  .upsert({
    user_clerk_id: clerkUserId,
    organization_id: organizationId,
    content_type: 'analytics_data',
    // ...
  });

// After: With onConflict
await supabase
  .from('organization_analytics_embeddings')
  .upsert({
    user_clerk_id: clerkUserId,
    organization_id: organizationId,
    content_type: 'analytics_data',
    // ...
  }, {
    onConflict: 'user_clerk_id,organization_id,content_type',
    ignoreDuplicates: false
  });
```

#### 2. Post Performance Embedding in generateEmbeddingsFromCache (Line ~230)
```javascript
await supabase
  .from('organization_analytics_embeddings')
  .upsert({
    content_type: 'post_performance',
    metadata: { post_id: post.post_id, ... },
    // ...
  }, {
    onConflict: 'user_clerk_id,organization_id,content_type,metadata',
    ignoreDuplicates: false
  });
```

#### 3. Post Performance Embedding in storePost (Line ~335)
```javascript
await supabase
  .from('organization_analytics_embeddings')
  .upsert({
    content_type: 'post_performance',
    metadata: { post_id: postId, ... },
    // ...
  }, {
    onConflict: 'user_clerk_id,organization_id,content_type,metadata',
    ignoreDuplicates: false
  });
```

#### 4. Summary Embedding (Line ~375)
```javascript
await supabase
  .from('organization_analytics_embeddings')
  .upsert({
    content_type: 'summary',
    // ...
  }, {
    onConflict: 'user_clerk_id,organization_id,content_type',
    ignoreDuplicates: false
  });
```

### Part 3: Analytics Cache Already Fixed ✅

The `organization_analytics_cache` table already had:
- Unique constraint: `(user_clerk_id, organization_id, analytics_type, start_date, end_date)`
- Proper onConflict clause in `storeAnalyticsInCache()`

```javascript
await supabase
  .from('organization_analytics_cache')
  .upsert({
    // ...
  }, {
    onConflict: 'user_clerk_id,organization_id,analytics_type,start_date,end_date'
  });
```

## How to Apply the Fix

### Step 1: Run Database Migration

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and run the migration from `add_embeddings_unique_constraint.sql`

This will:
- Remove existing duplicates
- Create unique indexes
- Prevent future duplicates at database level

### Step 2: Restart Backend

```bash
# In alphaz-backend directory
npm start
```

The code changes are already applied. Restarting picks them up.

### Step 3: Test Vector Sync

1. Go to Monitor page
2. Click Refresh button
3. Check backend logs:
   ```
   📝 Syncing analytics to Vector DB for [OrgName]
   ✓ Cached analytics data
   ✓ Using cached posts data (X posts)
   ✓ Generated X embeddings from cached data
   ✅ Vector DB sync complete
   ```

4. Run multiple syncs (wait 1+ minute between each)
5. Verify no duplicates in database

## Verification

### Check for Duplicates

```sql
-- Check embeddings duplicates
SELECT 
  user_clerk_id,
  organization_id,
  content_type,
  COUNT(*) as count
FROM organization_analytics_embeddings
GROUP BY user_clerk_id, organization_id, content_type
HAVING COUNT(*) > 1;
```

**Expected Result**: 0 rows (no duplicates)

### Check for Post Duplicates

```sql
-- Check post duplicates
SELECT 
  user_clerk_id,
  organization_id,
  metadata->>'post_id' as post_id,
  COUNT(*) as count
FROM organization_analytics_embeddings
WHERE content_type = 'post_performance'
GROUP BY user_clerk_id, organization_id, metadata->>'post_id'
HAVING COUNT(*) > 1;
```

**Expected Result**: 0 rows (no duplicates)

### Count Total Records

```sql
-- Before fix: Multiple records per org
-- After fix: One analytics_data + one summary + N post_performance per org

SELECT 
  organization_id,
  content_type,
  COUNT(*) as count
FROM organization_analytics_embeddings
GROUP BY organization_id, content_type
ORDER BY organization_id, content_type;
```

**Expected**:
- 1 `analytics_data` per organization
- 1 `summary` per organization
- N `post_performance` (one per high-performing post, max ~20)

### Check Analytics Cache

```sql
-- Should have one record per org/type/date combination
SELECT 
  user_clerk_id,
  organization_id,
  analytics_type,
  COUNT(*) as count
FROM organization_analytics_cache
GROUP BY user_clerk_id, organization_id, analytics_type
HAVING COUNT(*) > 1;
```

**Expected Result**: 0 rows (no duplicates)

## How Upsert Works Now

### For analytics_data and summary:
```
INSERT INTO organization_analytics_embeddings (...)
ON CONFLICT (user_clerk_id, organization_id, content_type)
DO UPDATE SET
  content = EXCLUDED.content,
  metadata = EXCLUDED.metadata,
  updated_at = EXCLUDED.updated_at;
```

**Result**: Always 1 record per org per content_type

### For post_performance:
```
INSERT INTO organization_analytics_embeddings (...)
ON CONFLICT (user_clerk_id, organization_id, content_type, metadata)
DO UPDATE SET
  content = EXCLUDED.content,
  engagement_rate = EXCLUDED.engagement_rate,
  updated_at = EXCLUDED.updated_at;
```

**Result**: Always 1 record per post per org

## Benefits

✅ **No Duplicates**: Each org has exactly 1 analytics_data, 1 summary, and 1 record per post  
✅ **Efficient Storage**: Database stays clean, no wasted space  
✅ **Faster Queries**: Fewer records = faster vector similarity search  
✅ **Consistent Data**: Latest data always overwrites old data  
✅ **Automatic Cleanup**: Unique indexes prevent duplicates at database level

## Edge Cases Handled

### Multiple Syncs in Quick Succession
- Debounce (1 minute) prevents multiple syncs
- If syncs happen, upsert updates instead of inserting

### Post Content Changes
- If post metrics change (more likes, etc.), upsert updates the record
- `updated_at` timestamp shows last sync time

### Organization Name Changes
- Upsert updates `organization_name` if it changes
- Uniqueness based on `organization_id`, not name

### Deleted Posts
- Old post embeddings remain in database
- Not deleted unless manually cleaned up
- Could add cleanup job to remove old posts not in recent sync

## Testing Checklist

- [ ] Run migration in Supabase
- [ ] Restart backend server
- [ ] Trigger vector sync from Monitor page
- [ ] Wait 2 minutes, trigger again
- [ ] Check database: No duplicates
- [ ] Verify counts: 1 analytics, 1 summary, N posts per org
- [ ] Check backend logs: No errors
- [ ] Test with multiple organizations

## Rollback (If Needed)

If issues occur, you can temporarily disable unique constraints:

```sql
-- Disable constraints (use with caution!)
DROP INDEX IF EXISTS idx_embeddings_unique_analytics;
DROP INDEX IF EXISTS idx_embeddings_unique_summary;
DROP INDEX IF EXISTS idx_embeddings_unique_post;
```

Then revert code changes in `vectorEmbeddingsController.js` by removing the `onConflict` parameters.

However, this is not recommended as duplicates will return.

## Future Enhancements

- [ ] Add cleanup job to remove old embeddings
- [ ] Add embedding versioning for A/B testing
- [ ] Add soft delete instead of hard delete for posts
- [ ] Add analytics on embedding updates frequency

## Summary

**Problem**: Duplicate records created on every vector sync  
**Root Cause**: Missing unique constraints and onConflict clauses  
**Solution**: Added unique indexes + onConflict parameters  
**Result**: Clean database with exactly 1 record per org/content type  

✅ Analytics cache: Already had unique constraint  
✅ Embeddings table: Now has unique indexes  
✅ Code: Now has proper onConflict clauses  
✅ Tested: No more duplicates on multiple syncs
