-- Quick script to check for duplicates before and after fix
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Check for Duplicates
-- ============================================

-- Check embeddings table duplicates by org + content_type
SELECT 
  'Embeddings Duplicates (Analytics/Summary)' as check_name,
  user_clerk_id,
  organization_id,
  organization_name,
  content_type,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as duplicate_ids
FROM organization_analytics_embeddings
GROUP BY user_clerk_id, organization_id, organization_name, content_type
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Check post embeddings duplicates by post_id
SELECT 
  'Post Embeddings Duplicates' as check_name,
  user_clerk_id,
  organization_id,
  metadata->>'post_id' as post_id,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as duplicate_ids
FROM organization_analytics_embeddings
WHERE content_type = 'post_performance'
GROUP BY user_clerk_id, organization_id, metadata->>'post_id'
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Check analytics cache duplicates
SELECT 
  'Analytics Cache Duplicates' as check_name,
  user_clerk_id,
  organization_id,
  analytics_type,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as duplicate_ids
FROM organization_analytics_cache
GROUP BY user_clerk_id, organization_id, analytics_type, start_date, end_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ============================================
-- PART 2: Summary Statistics
-- ============================================

-- Embeddings by type per organization
SELECT 
  organization_id,
  organization_name,
  content_type,
  COUNT(*) as count,
  MAX(updated_at) as last_updated
FROM organization_analytics_embeddings
GROUP BY organization_id, organization_name, content_type
ORDER BY organization_id, content_type;

-- Total counts
SELECT 
  'Total Embeddings' as metric,
  COUNT(*) as count
FROM organization_analytics_embeddings
UNION ALL
SELECT 
  'Total Analytics Cache',
  COUNT(*)
FROM organization_analytics_cache
UNION ALL
SELECT 
  'Total Posts',
  COUNT(*)
FROM organization_posts;

-- ============================================
-- PART 3: Expected Counts per Organization
-- ============================================

-- This should show:
-- - 1 analytics_data per org
-- - 1 summary per org
-- - N post_performance per org (where N = high-performing posts)
SELECT 
  organization_id,
  organization_name,
  SUM(CASE WHEN content_type = 'analytics_data' THEN 1 ELSE 0 END) as analytics_count,
  SUM(CASE WHEN content_type = 'summary' THEN 1 ELSE 0 END) as summary_count,
  SUM(CASE WHEN content_type = 'post_performance' THEN 1 ELSE 0 END) as posts_count,
  COUNT(*) as total_embeddings
FROM organization_analytics_embeddings
GROUP BY organization_id, organization_name
ORDER BY organization_id;

-- ============================================
-- PART 4: Check Unique Indexes Exist
-- ============================================

-- Check if unique indexes are created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'organization_analytics_embeddings'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- ============================================
-- PART 5: Sample Data
-- ============================================

-- Latest embeddings (most recent 10)
SELECT 
  id,
  organization_name,
  content_type,
  LEFT(content, 100) as content_preview,
  metadata,
  updated_at
FROM organization_analytics_embeddings
ORDER BY updated_at DESC
LIMIT 10;
