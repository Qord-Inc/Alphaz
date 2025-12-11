-- Add unique constraint to organization_analytics_embeddings table
-- This prevents duplicate embeddings for the same organization and content type

-- First, remove any existing duplicates (keep the most recent one)
DELETE FROM organization_analytics_embeddings a
USING organization_analytics_embeddings b
WHERE a.id < b.id
  AND a.user_clerk_id = b.user_clerk_id
  AND a.organization_id = b.organization_id
  AND a.content_type = b.content_type
  AND (
    -- For analytics_data: one per org
    (a.content_type = 'analytics_data' AND b.content_type = 'analytics_data')
    -- For summary: one per org
    OR (a.content_type = 'summary' AND b.content_type = 'summary')
    -- For posts: one per post_id
    OR (
      a.content_type = 'post_performance' 
      AND b.content_type = 'post_performance'
      AND a.metadata->>'post_id' = b.metadata->>'post_id'
    )
  );

-- Create unique index for analytics_data (one per org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique_analytics
ON organization_analytics_embeddings(user_clerk_id, organization_id, content_type)
WHERE content_type = 'analytics_data';

-- Create unique index for summary (one per org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique_summary
ON organization_analytics_embeddings(user_clerk_id, organization_id, content_type)
WHERE content_type = 'summary';

-- Create unique index for post_performance (one per post)
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique_post
ON organization_analytics_embeddings(user_clerk_id, organization_id, (metadata->>'post_id'))
WHERE content_type = 'post_performance';

-- Verify the constraints
SELECT 
  content_type,
  COUNT(*) as total,
  COUNT(DISTINCT (user_clerk_id, organization_id, content_type)) as unique_combos
FROM organization_analytics_embeddings
GROUP BY content_type;
