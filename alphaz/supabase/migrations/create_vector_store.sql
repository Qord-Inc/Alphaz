-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create organization_analytics_embeddings table
-- This stores vectorized analytics data for AI context retrieval
CREATE TABLE IF NOT EXISTS public.organization_analytics_embeddings (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign keys
  user_clerk_id VARCHAR(255) NOT NULL REFERENCES public.users(clerk_user_id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  organization_name VARCHAR(255),
  
  -- Content and metadata
  content TEXT NOT NULL, -- The actual text content that was embedded
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN (
    'follower_stats', 
    'share_stats', 
    'engagement_stats',
    'post_content',
    'post_performance',
    'demographic_data',
    'lifecycle_stats',
    'summary'
  )),
  
  -- Vector embedding (1536 dimensions for OpenAI ada-002 or 768 for other models)
  embedding vector(1536),
  
  -- Metadata for filtering and context
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Time range this data represents (if applicable)
  data_start_date TIMESTAMP WITH TIME ZONE,
  data_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_analytics_embeddings_user_org 
  ON public.organization_analytics_embeddings(user_clerk_id, organization_id);

CREATE INDEX idx_analytics_embeddings_content_type 
  ON public.organization_analytics_embeddings(content_type);

CREATE INDEX idx_analytics_embeddings_org_id 
  ON public.organization_analytics_embeddings(organization_id);

-- Create vector similarity search index using HNSW algorithm
-- This enables fast similarity search on embeddings
CREATE INDEX idx_analytics_embeddings_vector 
  ON public.organization_analytics_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create trigger for updating updated_at
CREATE TRIGGER update_analytics_embeddings_updated_at 
  BEFORE UPDATE ON public.organization_analytics_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_organization_analytics(
  query_embedding vector(1536),
  match_organization_id VARCHAR(255),
  match_user_clerk_id VARCHAR(255),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_content_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  content_type VARCHAR(50),
  metadata JSONB,
  similarity FLOAT,
  organization_id VARCHAR(255),
  organization_name VARCHAR(255),
  data_start_date TIMESTAMP WITH TIME ZONE,
  data_end_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oae.id,
    oae.content,
    oae.content_type,
    oae.metadata,
    1 - (oae.embedding <=> query_embedding) AS similarity,
    oae.organization_id,
    oae.organization_name,
    oae.data_start_date,
    oae.data_end_date
  FROM organization_analytics_embeddings oae
  WHERE 
    oae.organization_id = match_organization_id
    AND oae.user_clerk_id = match_user_clerk_id
    AND (filter_content_types IS NULL OR oae.content_type = ANY(filter_content_types))
    AND 1 - (oae.embedding <=> query_embedding) > match_threshold
  ORDER BY oae.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create organization_posts table for storing LinkedIn posts
CREATE TABLE IF NOT EXISTS public.organization_posts (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign keys
  user_clerk_id VARCHAR(255) NOT NULL REFERENCES public.users(clerk_user_id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  
  -- LinkedIn post data
  post_id VARCHAR(500) UNIQUE NOT NULL, -- LinkedIn post URN
  post_content TEXT,
  post_author VARCHAR(255),
  
  -- Media and links
  media_urls TEXT[],
  external_links TEXT[],
  
  -- Engagement metrics
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  engagement_rate FLOAT,
  
  -- Post metadata
  posted_at TIMESTAMP WITH TIME ZONE,
  post_type VARCHAR(50), -- TEXT, IMAGE, VIDEO, ARTICLE, etc.
  visibility VARCHAR(50), -- PUBLIC, CONNECTIONS, etc.
  
  -- Raw data from LinkedIn API
  raw_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for posts
CREATE INDEX idx_org_posts_user_org 
  ON public.organization_posts(user_clerk_id, organization_id);

CREATE INDEX idx_org_posts_post_id 
  ON public.organization_posts(post_id);

CREATE INDEX idx_org_posts_posted_at 
  ON public.organization_posts(posted_at DESC);

CREATE INDEX idx_org_posts_engagement 
  ON public.organization_posts(engagement_rate DESC);

-- Create trigger for updating posts updated_at
CREATE TRIGGER update_org_posts_updated_at 
  BEFORE UPDATE ON public.organization_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create organization_analytics_cache table for storing raw analytics
CREATE TABLE IF NOT EXISTS public.organization_analytics_cache (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign keys
  user_clerk_id VARCHAR(255) NOT NULL REFERENCES public.users(clerk_user_id) ON DELETE CASCADE,
  organization_id VARCHAR(255) NOT NULL,
  
  -- Analytics type and data
  analytics_type VARCHAR(100) NOT NULL, -- follower_stats, share_stats, etc.
  analytics_data JSONB NOT NULL,
  
  -- Time range
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicate cache entries
  UNIQUE(user_clerk_id, organization_id, analytics_type, start_date, end_date)
);

-- Create indexes for analytics cache
CREATE INDEX idx_analytics_cache_user_org_type 
  ON public.organization_analytics_cache(user_clerk_id, organization_id, analytics_type);

CREATE INDEX idx_analytics_cache_dates 
  ON public.organization_analytics_cache(start_date, end_date);

-- Create trigger for updating analytics cache updated_at
CREATE TRIGGER update_analytics_cache_updated_at 
  BEFORE UPDATE ON public.organization_analytics_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.organization_analytics_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_analytics_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for embeddings
CREATE POLICY "Users can view own analytics embeddings" 
  ON public.organization_analytics_embeddings
  FOR SELECT USING (auth.uid()::text = user_clerk_id);

CREATE POLICY "Service role has full access to embeddings" 
  ON public.organization_analytics_embeddings
  USING (auth.jwt()->>'role' = 'service_role');

-- Create policies for posts
CREATE POLICY "Users can view own organization posts" 
  ON public.organization_posts
  FOR SELECT USING (auth.uid()::text = user_clerk_id);

CREATE POLICY "Service role has full access to posts" 
  ON public.organization_posts
  USING (auth.jwt()->>'role' = 'service_role');

-- Create policies for analytics cache
CREATE POLICY "Users can view own analytics cache" 
  ON public.organization_analytics_cache
  FOR SELECT USING (auth.uid()::text = user_clerk_id);

CREATE POLICY "Service role has full access to analytics cache" 
  ON public.organization_analytics_cache
  USING (auth.jwt()->>'role' = 'service_role');

-- Create helper function to get organization summary for embeddings
CREATE OR REPLACE FUNCTION get_organization_summary(
  p_user_clerk_id VARCHAR(255),
  p_organization_id VARCHAR(255)
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_summary TEXT;
  v_org_name VARCHAR(255);
  v_post_count INTEGER;
  v_total_engagement INTEGER;
  v_avg_likes FLOAT;
  v_recent_posts TEXT;
BEGIN
  -- Get organization name
  SELECT organization_name INTO v_org_name
  FROM organization_analytics_embeddings
  WHERE user_clerk_id = p_user_clerk_id 
    AND organization_id = p_organization_id
  LIMIT 1;
  
  -- Get post stats
  SELECT 
    COUNT(*),
    SUM(like_count + comment_count + share_count),
    AVG(like_count)
  INTO v_post_count, v_total_engagement, v_avg_likes
  FROM organization_posts
  WHERE user_clerk_id = p_user_clerk_id 
    AND organization_id = p_organization_id;
  
  -- Build summary
  v_summary := format(
    'Organization: %s (ID: %s). Total posts: %s. Total engagement: %s. Average likes per post: %s.',
    COALESCE(v_org_name, 'Unknown'),
    p_organization_id,
    COALESCE(v_post_count::TEXT, '0'),
    COALESCE(v_total_engagement::TEXT, '0'),
    COALESCE(ROUND(v_avg_likes::NUMERIC, 2)::TEXT, '0')
  );
  
  RETURN v_summary;
END;
$$;

COMMENT ON TABLE public.organization_analytics_embeddings IS 'Stores vector embeddings of organization analytics data for AI-powered content generation';
COMMENT ON TABLE public.organization_posts IS 'Stores LinkedIn posts for organizations with engagement metrics';
COMMENT ON TABLE public.organization_analytics_cache IS 'Caches raw analytics data from LinkedIn API to reduce API calls';
COMMENT ON FUNCTION match_organization_analytics IS 'Performs similarity search on organization analytics embeddings';
COMMENT ON FUNCTION get_organization_summary IS 'Generates a text summary of organization data for embedding';
