const { createClient } = require('@supabase/supabase-js');
const { getLinkedInAccessToken } = require('./linkedinController');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding vector using OpenAI
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]|null>} - 1536-dimensional embedding array or null
 */
async function generateEmbedding(text) {
  if (!text?.trim()) return null;
  
  try {
    // Truncate to ~8191 tokens limit (roughly 30k characters)
    const truncatedText = text.substring(0, 30000);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
      encoding_format: "float"
    });
    
    return response.data[0].embedding; // 1536-dimensional array
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    return null; // Return null so content is stored without embedding
  }
}

/**
 * Generate embeddings for organization analytics data
 * This will be used with OpenAI or Google's embedding API
 * For now, we'll structure the data preparation
 */

/**
 * Sync already-fetched analytics data to vector DB
 * Reuses data from existing API endpoints - no duplicate LinkedIn API calls
 * @route POST /api/embeddings/organization/:clerkUserId/:organizationId/generate
 */
const generateOrganizationEmbeddings = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;
    const { organizationName, analyticsData, postsData } = req.body;

    console.log(`📝 Syncing analytics to Vector DB for ${organizationName}`);

    const results = {
      analyticsCache: false,
      postsCache: false,
      embeddings: 0,
      summary: false
    };

    // 1. Store analytics data in cache (if provided)
    if (analyticsData) {
      const cacheResult = await storeAnalyticsInCache(clerkUserId, organizationId, analyticsData);
      results.analyticsCache = cacheResult;
    }

    // 2. Use cached posts data or fetch from organizationPostsController endpoint
    let postsResult;
    if (postsData && postsData.length > 0) {
      console.log(`✓ Using cached posts data (${postsData.length} posts)`);
      postsResult = await cacheProvidedPosts(clerkUserId, organizationId, organizationName, postsData);
    } else {
      console.log('📥 Fetching posts from endpoint (no cached data provided)');
      postsResult = await fetchAndCacheOrganizationPosts(clerkUserId, organizationId, organizationName);
    }
    results.postsCache = postsResult.success;

    // 3. Generate embeddings from cached data
    const embeddingsCount = await generateEmbeddingsFromCache(clerkUserId, organizationId, organizationName);
    results.embeddings = embeddingsCount;

    // 4. Create summary embedding
    const summaryResult = await createSummaryEmbedding(clerkUserId, organizationId, organizationName);
    results.summary = summaryResult;

    console.log(`✅ Vector DB sync complete for ${organizationName}:`, results);

    res.json({
      success: true,
      message: 'Analytics data synced to vector DB',
      organization: {
        id: organizationId,
        name: organizationName
      },
      results
    });

  } catch (error) {
    console.error('Error syncing to vector DB:', error);
    res.status(500).json({ 
      error: 'Failed to sync to vector DB',
      details: error.message 
    });
  }
};

/**
 * Store analytics data (from dashboard endpoint) in cache
 */
async function storeAnalyticsInCache(clerkUserId, organizationId, analyticsData) {
  try {
    // Store follower/demographic data
    if (analyticsData.followers || analyticsData.demographics) {
      // Delete existing cache for this org, then insert new
      await supabase
        .from('organization_analytics_cache')
        .delete()
        .eq('user_clerk_id', clerkUserId)
        .eq('organization_id', organizationId)
        .eq('analytics_type', 'dashboard_lifetime')
        .is('start_date', null)
        .is('end_date', null);
      
      await supabase
        .from('organization_analytics_cache')
        .insert({
          user_clerk_id: clerkUserId,
          organization_id: organizationId,
          analytics_type: 'dashboard_lifetime',
          analytics_data: analyticsData,
          start_date: null,
          end_date: null,
          updated_at: new Date().toISOString()
        });
      
      console.log('✓ Cached analytics data');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error storing analytics in cache:', error);
    return false;
  }
}

/**
 * Cache posts data provided from frontend (localStorage)
 */
async function cacheProvidedPosts(clerkUserId, organizationId, organizationName, postsData) {
  try {
    let storedCount = 0;
    
    // Store each post in database
    for (const post of postsData) {
      const stored = await storePost(clerkUserId, organizationId, organizationName, post);
      if (stored) storedCount++;
    }
    
    console.log(`✓ Cached ${storedCount} posts from localStorage`);
    return { success: true, count: storedCount };
    
  } catch (error) {
    console.error('Error caching provided posts:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Fetch posts from existing endpoint and cache them
 */
async function fetchAndCacheOrganizationPosts(clerkUserId, organizationId, organizationName) {
  try {
    // Use the existing posts endpoint
    const url = `${process.env.API_URL || 'http://localhost:5000'}/api/organization/posts/${clerkUserId}/${encodeURIComponent(`urn:li:organization:${organizationId}`)}?count=200`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch posts from endpoint');
      return { success: false, count: 0 };
    }

    const data = await response.json();
    const posts = data.posts || [];
    
    let storedCount = 0;
    
    // Store each post in database
    for (const post of posts) {
      const stored = await storePost(clerkUserId, organizationId, organizationName, post);
      if (stored) storedCount++;
    }
    
    console.log(`✓ Cached ${storedCount} posts`);
    return { success: true, count: storedCount };
    
  } catch (error) {
    console.error('Error fetching/caching posts:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Generate embeddings from already cached data
 */
async function generateEmbeddingsFromCache(clerkUserId, organizationId, organizationName) {
  try {
    let embeddingsCount = 0;
    
    // 1. Get cached analytics data
    const { data: cachedAnalytics } = await supabase
      .from('organization_analytics_cache')
      .select('*')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId);
    
    // 2. Create embeddings from analytics data
    if (cachedAnalytics && cachedAnalytics.length > 0) {
      for (const cache of cachedAnalytics) {
        const content = formatAnalyticsForEmbedding(cache.analytics_data, organizationName);
        console.log(`Processing analytics type: ${cache.analytics_type}`);
        console.log(`✓ Generated analytics content (${content.length} chars)`);
        
        if (content) {
          // Check if existing record needs update (smart caching)
          const { data: existingRecord } = await supabase
            .from('organization_analytics_embeddings')
            .select('id, embedding, created_at')
            .eq('user_clerk_id', clerkUserId)
            .eq('organization_id', organizationId)
            .eq('content_type', 'demographic_data')
            .single();
          
          let shouldUpdate = true;
          
          if (existingRecord) {
            const createdAt = new Date(existingRecord.created_at);
            const now = new Date();
            const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
            
            // Skip if embedding exists and is less than 24 hours old
            if (existingRecord.embedding !== null && hoursSinceCreation < 24) {
              console.log(`  ⏭️  demographic_data - Skipped (${hoursSinceCreation.toFixed(1)}hrs old, < 24hrs)`);
              shouldUpdate = false;
              embeddingsCount++; // Count as processed
            } else if (existingRecord.embedding === null) {
              console.log(`  🔄 demographic_data - Updating (embedding NULL)`);
            } else {
              console.log(`  🔄 demographic_data - Updating (${hoursSinceCreation.toFixed(1)}hrs old, > 24hrs)`);
            }
          } else {
            console.log(`  ✨ demographic_data - Creating new embedding`);
          }
          
          if (shouldUpdate) {
            // Generate embedding vector
            const embedding = await generateEmbedding(content);
            console.log(`✓ Generated embedding: ${embedding ? 'success (' + embedding.length + ' dimensions)' : 'null (will retry)'}`);
            
            // Delete existing record, then insert new
            const { error: deleteError } = await supabase
              .from('organization_analytics_embeddings')
              .delete()
              .eq('user_clerk_id', clerkUserId)
              .eq('organization_id', organizationId)
              .eq('content_type', 'demographic_data');
            
            if (deleteError) {
              console.error('❌ Delete error:', deleteError);
            }
            
            const { data: insertData, error: insertError } = await supabase
              .from('organization_analytics_embeddings')
              .insert({
                user_clerk_id: clerkUserId,
                organization_id: organizationId,
                organization_name: organizationName,
                content: content,
                content_type: 'demographic_data',
                embedding: embedding,
                metadata: {
                  source: cache.analytics_type,
                  cached_at: cache.updated_at
                },
                updated_at: new Date().toISOString()
              })
              .select();
            
            if (insertError) {
              console.error('❌ Insert error for demographic_data:', insertError);
              console.error('Insert error details:', JSON.stringify(insertError, null, 2));
            } else {
              console.log('✅ Successfully saved demographic_data embedding');
              embeddingsCount++;
            }
          }
        }
      }
    }
    
    // 3. Get ALL cached posts and create embeddings (no engagement filter)
    const { data: posts } = await supabase
      .from('organization_posts')
      .select('*')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId)
      .order('posted_at', { ascending: false }); // Most recent first, no limit
    
    if (posts && posts.length > 0) {
      console.log(`\n📝 Processing ${posts.length} posts for embeddings...`);
      let postsCreated = 0;
      let postsUpdated = 0;
      let postsSkipped = 0;
      
      for (const post of posts) {
        // Embed ALL posts, not just high performers
        const content = formatPostForEmbedding(post, organizationName, {
          likeCount: post.like_count,
          commentCount: post.comment_count,
          shareCount: post.share_count,
          impressionCount: post.impression_count,
          engagementRate: post.engagement_rate
        });
        
        // Check if existing record needs update (smart caching)
        const { data: existingPost } = await supabase
          .from('organization_analytics_embeddings')
          .select('id, embedding, created_at')
          .eq('user_clerk_id', clerkUserId)
          .eq('organization_id', organizationId)
          .eq('content_type', 'post_performance')
          .filter('metadata->>post_id', 'eq', post.post_id)
          .single();
        
        let shouldUpdate = true;
        
        if (existingPost) {
          const createdAt = new Date(existingPost.created_at);
          const now = new Date();
          const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
          
          // Skip if embedding exists and is less than 24 hours old
          if (existingPost.embedding !== null && hoursSinceCreation < 24) {
            console.log(`  ⏭️  Post ${post.post_id.substring(0, 15)}... - Skipped (${hoursSinceCreation.toFixed(1)}hrs old, < 24hrs)`);
            shouldUpdate = false;
            postsSkipped++;
          } else if (existingPost.embedding === null) {
            console.log(`  🔄 Post ${post.post_id.substring(0, 15)}... - Updating (embedding NULL)`);
            postsUpdated++;
          } else {
            console.log(`  🔄 Post ${post.post_id.substring(0, 15)}... - Updating (${hoursSinceCreation.toFixed(1)}hrs old, > 24hrs)`);
            postsUpdated++;
          }
        } else {
          console.log(`  ✨ Post ${post.post_id.substring(0, 15)}... - Creating new embedding`);
          postsCreated++;
        }
        
        if (shouldUpdate) {
          // Generate embedding vector
          const embedding = await generateEmbedding(content);
          
          // Delete existing embedding for this post, then insert new
          await supabase
            .from('organization_analytics_embeddings')
            .delete()
            .eq('user_clerk_id', clerkUserId)
            .eq('organization_id', organizationId)
            .eq('content_type', 'post_performance')
            .filter('metadata->>post_id', 'eq', post.post_id);
          
          await supabase
            .from('organization_analytics_embeddings')
            .insert({
              user_clerk_id: clerkUserId,
              organization_id: organizationId,
              organization_name: organizationName,
              content: content,
              content_type: 'post_performance',
              embedding: embedding,
              metadata: {
                post_id: post.post_id,
                engagement_rate: post.engagement_rate,
                likes: post.like_count
              },
              data_start_date: post.posted_at,
              data_end_date: post.posted_at,
              updated_at: new Date().toISOString()
            });
        }
        
        embeddingsCount++;
      }
      
      console.log(`\n✅ Posts Summary: ${postsCreated} created, ${postsUpdated} updated, ${postsSkipped} skipped`);
    }
    
    console.log(`\n✓ Total embeddings processed: ${embeddingsCount}`);
    return embeddingsCount;
    
  } catch (error) {
    console.error('Error generating embeddings from cache:', error);
    return 0;
  }
}

/**
 * Store individual post in database
 */
async function storePost(clerkUserId, organizationId, organizationName, post) {
  try {
    const postId = post.id;
    // Extract content from various possible fields
    const content = post.fullText || post.full_text || post.textContent || post.commentary || '';
    const author = post.author;
    const createdAt = post.createdAt ? new Date(post.createdAt) : null;
    
    // Extract metrics - prioritize post.metrics if available (from social actions API)
    const metrics = post.metrics || {};
    const likeCount = metrics.likes || post.lifecycleState?.likeCount || 0;
    const commentCount = metrics.comments || post.lifecycleState?.commentCount || 0;
    const shareCount = metrics.reposts || post.lifecycleState?.shareCount || 0;
    const impressionCount = metrics.impressions || post.lifecycleState?.impressionCount || 0;
    
    // Calculate engagement rate
    const engagementRate = impressionCount > 0 
      ? ((likeCount + commentCount + shareCount) / impressionCount) * 100 
      : 0;

    // Store in organization_posts table
    const { error: postError } = await supabase
      .from('organization_posts')
      .upsert({
        user_clerk_id: clerkUserId,
        organization_id: organizationId,
        post_id: postId,
        post_content: content,
        post_author: author,
        like_count: likeCount,
        comment_count: commentCount,
        share_count: shareCount,
        impression_count: impressionCount,
        engagement_rate: engagementRate,
        posted_at: createdAt,
        raw_data: post,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'post_id'
      });

    if (postError) {
      console.error('Error storing post:', postError);
      return;
    }

    // Create embedding for ALL posts (with smart caching)
    const embeddingContent = formatPostForEmbedding(post, organizationName, {
      likeCount,
      commentCount,
      shareCount,
      impressionCount,
      engagementRate
    });

    // Check if existing record needs update (smart caching)
    const { data: existingPostEmbed } = await supabase
      .from('organization_analytics_embeddings')
      .select('id, embedding, created_at')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId)
      .eq('content_type', 'post_performance')
      .filter('metadata->>post_id', 'eq', postId)
      .single();
    
    let shouldUpdate = true;
    
    if (existingPostEmbed) {
      const createdAt = new Date(existingPostEmbed.created_at);
      const now = new Date();
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
      
      // Skip if embedding exists and is less than 24 hours old
      if (existingPostEmbed.embedding !== null && hoursSinceCreation < 24) {
        shouldUpdate = false;
      }
    }
    
    if (shouldUpdate) {
      // Generate embedding vector
      const embedding = await generateEmbedding(embeddingContent);

      // Delete existing embedding for this post, then insert new
      await supabase
          .from('organization_analytics_embeddings')
          .delete()
          .eq('user_clerk_id', clerkUserId)
          .eq('organization_id', organizationId)
          .eq('content_type', 'post_performance')
          .filter('metadata->>post_id', 'eq', postId);
        
      await supabase
        .from('organization_analytics_embeddings')
        .insert({
          user_clerk_id: clerkUserId,
          organization_id: organizationId,
          organization_name: organizationName,
          content: embeddingContent,
          content_type: 'post_performance',
          embedding: embedding,
          metadata: {
            post_id: postId,
            engagement_rate: engagementRate,
            likes: likeCount,
            comments: commentCount,
            shares: shareCount
          },
          data_start_date: createdAt,
          data_end_date: createdAt,
          updated_at: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('Error in storePost:', error);
  }
}

/**
 * Create a summary embedding combining all analytics
 */
async function createSummaryEmbedding(clerkUserId, organizationId, organizationName) {
  try {
    // Get all cached analytics
    const { data: cacheData } = await supabase
      .from('organization_analytics_cache')
      .select('*')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId);

    // Get post statistics
    const { data: postStats } = await supabase
      .from('organization_posts')
      .select('like_count, comment_count, share_count, impression_count, engagement_rate')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId);

    // Create comprehensive summary
    const summary = createOrganizationSummary(organizationName, cacheData, postStats);

    // Check if existing record needs update (smart caching)
    const { data: existingSummary } = await supabase
      .from('organization_analytics_embeddings')
      .select('id, embedding, created_at')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId)
      .eq('content_type', 'summary')
      .single();
    
    let shouldUpdate = true;
    
    if (existingSummary) {
      const createdAt = new Date(existingSummary.created_at);
      const now = new Date();
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
      
      // Skip if embedding exists and is less than 24 hours old
      if (existingSummary.embedding !== null && hoursSinceCreation < 24) {
        console.log(`  ⏭️  summary - Skipped (${hoursSinceCreation.toFixed(1)}hrs old, < 24hrs)`);
        shouldUpdate = false;
      } else if (existingSummary.embedding === null) {
        console.log(`  🔄 summary - Updating (embedding NULL)`);
      } else {
        console.log(`  🔄 summary - Updating (${hoursSinceCreation.toFixed(1)}hrs old, > 24hrs)`);
      }
    } else {
      console.log(`  ✨ summary - Creating new embedding`);
    }
    
    if (shouldUpdate) {
      // Generate embedding vector
      const embedding = await generateEmbedding(summary);

      // Store summary embedding - delete existing first, then insert new
      await supabase
        .from('organization_analytics_embeddings')
        .delete()
        .eq('user_clerk_id', clerkUserId)
        .eq('organization_id', organizationId)
        .eq('content_type', 'summary');
      
      await supabase
        .from('organization_analytics_embeddings')
        .insert({
          user_clerk_id: clerkUserId,
          organization_id: organizationId,
          organization_name: organizationName,
          content: summary,
          content_type: 'summary',
          embedding: embedding,
          metadata: {
            generated_at: new Date().toISOString(),
            data_sources: cacheData?.length || 0,
            posts_analyzed: postStats?.length || 0
          },
          updated_at: new Date().toISOString()
        });
    }

    console.log(`✓ Created summary embedding for ${organizationName}`);
    return true;
  } catch (error) {
    console.error('Error in createSummaryEmbedding:', error);
    return false;
  }
}

/**
 * Format analytics data (from dashboard) as natural language for embedding
 * Handles actual dashboard_lifetime data structure with followers, page views, demographics
 */
function formatAnalyticsForEmbedding(data, orgName) {
  let content = `${orgName} LinkedIn Analytics Summary:\n\n`;
  
  // Followers - Lifetime First
  if (data.followers) {
    content += `Follower Metrics:\n`;
    content += `- Total Followers (ALL TIME): ${data.followers.total || 0}\n`;
    if (data.followers.currentPeriod || data.followers.previousPeriod) {
      content += `- Recent Period: ${data.followers.currentPeriod || 0} followers\n`;
      content += `- Previous Period: ${data.followers.previousPeriod || 0} followers\n`;
      if (data.followers.changePercent !== null && data.followers.changePercent !== undefined) {
        content += `- Growth Rate: ${data.followers.changePercent}%\n`;
      }
    }
    content += `\n`;
  }
  
  // Page Views - Lifetime First
  if (data.pageViews) {
    content += `Page View Metrics:\n`;
    content += `- Lifetime Page Views (ALL TIME): ${data.pageViews.lifetime || 0}\n`;
    
    // Lifetime breakdown if available
    if (data.pageViews.breakdown) {
      content += `\nAll-Time Page View Breakdown:\n`;
      const breakdown = data.pageViews.breakdown;
      if (breakdown.overviewPageViews) content += `- Overview Page: ${breakdown.overviewPageViews} views\n`;
      if (breakdown.aboutPageViews) content += `- About Page: ${breakdown.aboutPageViews} views\n`;
      if (breakdown.peoplePageViews) content += `- People Page: ${breakdown.peoplePageViews} views\n`;
      if (breakdown.jobsPageViews) content += `- Jobs Page: ${breakdown.jobsPageViews} views\n`;
      if (breakdown.careersPageViews) content += `- Careers Page: ${breakdown.careersPageViews} views\n`;
      if (breakdown.insightsPageViews) content += `- Insights Page: ${breakdown.insightsPageViews} views\n`;
      if (breakdown.productsPageViews) content += `- Products Page: ${breakdown.productsPageViews} views\n`;
      if (breakdown.lifeAtPageViews) content += `- Life At Page: ${breakdown.lifeAtPageViews} views\n`;
      if (breakdown.allDesktopPageViews) content += `- Desktop Views (All Time): ${breakdown.allDesktopPageViews} views\n`;
      if (breakdown.allMobilePageViews) content += `- Mobile Views (All Time): ${breakdown.allMobilePageViews} views\n`;
    }
    
    // Recent period data (secondary)
    if (data.pageViews.currentPeriod || data.pageViews.previousPeriod) {
      content += `\nRecent Period Activity:\n`;
      content += `- Recent Period Views: ${data.pageViews.currentPeriod || 0}\n`;
      content += `- Previous Period Views: ${data.pageViews.previousPeriod || 0}\n`;
      content += `- Unique Visitors (Recent): ${data.pageViews.uniqueViewsCurrent || 0}\n`;
    }
    
    if (data.pageViews.currentPeriodBreakdown) {
      content += `\nRecent Period Page Breakdown:\n`;
      const breakdown = data.pageViews.currentPeriodBreakdown;
      if (breakdown.overviewPageViews) content += `- Overview Page: ${breakdown.overviewPageViews}\n`;
      if (breakdown.aboutPageViews) content += `- About Page: ${breakdown.aboutPageViews}\n`;
      if (breakdown.peoplePageViews) content += `- People Page: ${breakdown.peoplePageViews}\n`;
      if (breakdown.jobsPageViews) content += `- Jobs Page: ${breakdown.jobsPageViews}\n`;
      if (breakdown.careersPageViews) content += `- Careers Page: ${breakdown.careersPageViews}\n`;
      if (breakdown.insightsPageViews) content += `- Insights Page: ${breakdown.insightsPageViews}\n`;
      if (breakdown.productsPageViews) content += `- Products Page: ${breakdown.productsPageViews}\n`;
      if (breakdown.allDesktopPageViews) content += `- Desktop Views: ${breakdown.allDesktopPageViews}\n`;
      if (breakdown.allMobilePageViews) content += `- Mobile Views: ${breakdown.allMobilePageViews}\n`;
    }
    content += `\n`;
  }
  
  // Demographics
  if (data.demographics) {
    content += `Follower Demographics:\n\n`;
    
    // Countries
    if (data.demographics.countries && data.demographics.countries.length > 0) {
      content += `Top Countries by Followers:\n`;
      data.demographics.countries.forEach((item, idx) => {
        const organic = item.followerCounts?.organicFollowerCount || 0;
        const paid = item.followerCounts?.paidFollowerCount || 0;
        const total = organic + paid;
        content += `  ${idx + 1}. Country ${item.geo}: ${total} followers (${organic} organic, ${paid} paid)\n`;
      });
      content += `\n`;
    }
    
    // Regions
    if (data.demographics.regions && data.demographics.regions.length > 0) {
      content += `Top Regions by Followers:\n`;
      data.demographics.regions.forEach((item, idx) => {
        const organic = item.followerCounts?.organicFollowerCount || 0;
        const paid = item.followerCounts?.paidFollowerCount || 0;
        const total = organic + paid;
        content += `  ${idx + 1}. Region ${item.geo}: ${total} followers (${organic} organic, ${paid} paid)\n`;
      });
      content += `\n`;
    }
    
    // Industries
    if (data.demographics.industries && data.demographics.industries.length > 0) {
      content += `Top Industries by Followers:\n`;
      data.demographics.industries.forEach((item, idx) => {
        const organic = item.followerCounts?.organicFollowerCount || 0;
        const paid = item.followerCounts?.paidFollowerCount || 0;
        const total = organic + paid;
        content += `  ${idx + 1}. Industry ${item.industry}: ${total} followers (${organic} organic, ${paid} paid)\n`;
      });
      content += `\n`;
    }
    
    // Functions
    if (data.demographics.functions && data.demographics.functions.length > 0) {
      content += `Top Job Functions by Followers:\n`;
      data.demographics.functions.forEach((item, idx) => {
        const organic = item.followerCounts?.organicFollowerCount || 0;
        const paid = item.followerCounts?.paidFollowerCount || 0;
        const total = organic + paid;
        content += `  ${idx + 1}. Function ${item.function}: ${total} followers (${organic} organic, ${paid} paid)\n`;
      });
      content += `\n`;
    }
    
    // Seniorities
    if (data.demographics.seniorities && data.demographics.seniorities.length > 0) {
      content += `Follower Seniority Levels:\n`;
      data.demographics.seniorities.forEach((item, idx) => {
        const organic = item.followerCounts?.organicFollowerCount || 0;
        const paid = item.followerCounts?.paidFollowerCount || 0;
        const total = organic + paid;
        content += `  ${idx + 1}. Seniority ${item.seniority}: ${total} followers (${organic} organic, ${paid} paid)\n`;
      });
      content += `\n`;
    }
    
    // Company Sizes
    if (data.demographics.staffCountRanges && data.demographics.staffCountRanges.length > 0) {
      content += `Follower Company Sizes:\n`;
      data.demographics.staffCountRanges.forEach((item, idx) => {
        const organic = item.followerCounts?.organicFollowerCount || 0;
        const paid = item.followerCounts?.paidFollowerCount || 0;
        const total = organic + paid;
        content += `  ${idx + 1}. ${item.staffCountRange}: ${total} followers (${organic} organic, ${paid} paid)\n`;
      });
      content += `\n`;
    }
  }
  
  // Add context message if exists
  if (data.message) {
    content += `Notes: ${data.message}\n`;
  }
  
  return content;
}

/**
 * OLD FORMAT FUNCTION - KEEPING FOR REFERENCE
 */
function OLD_formatFollowerStatsForEmbedding(data, orgName) {
  const elements = data.elements || [];
  if (elements.length === 0) {
    return `${orgName} has no follower statistics available yet.`;
  }

  const stats = elements[0];
  const followerCounts = stats.followerCounts || {};
  const organicFollowerCount = followerCounts.organicFollowerCount || 0;
  const paidFollowerCount = followerCounts.paidFollowerCount || 0;
  const totalFollowers = organicFollowerCount + paidFollowerCount;

  let content = `${orgName} LinkedIn Analytics:\n\n`;
  content += `Total Followers: ${totalFollowers.toLocaleString()} (${organicFollowerCount.toLocaleString()} organic, ${paidFollowerCount.toLocaleString()} paid)\n\n`;

  // Demographics
  if (stats.followerCountsByFunction) {
    content += `Top Functions: ${JSON.stringify(stats.followerCountsByFunction)}\n`;
  }
  if (stats.followerCountsBySeniority) {
    content += `Top Seniorities: ${JSON.stringify(stats.followerCountsBySeniority)}\n`;
  }
  if (stats.followerCountsByIndustry) {
    content += `Top Industries: ${JSON.stringify(stats.followerCountsByIndustry)}\n`;
  }
  if (stats.followerCountsByRegion) {
    content += `Top Regions: ${JSON.stringify(stats.followerCountsByRegion)}\n`;
  }

  return content;
}

/**
 * Format share stats for embedding
 */
function formatShareStatsForEmbedding(data, orgName) {
  const elements = data.elements || [];
  if (elements.length === 0) {
    return `${orgName} has no share statistics available yet.`;
  }

  const stats = elements[0];
  const totalShareCount = stats.totalShareStatistics?.shareCount || 0;
  const clickCount = stats.totalShareStatistics?.clickCount || 0;
  const commentCount = stats.totalShareStatistics?.commentCount || 0;
  const likeCount = stats.totalShareStatistics?.likeCount || 0;
  const engagement = stats.totalShareStatistics?.engagement || 0;
  const impressionCount = stats.totalShareStatistics?.impressionCount || 0;

  let content = `${orgName} Share Statistics:\n\n`;
  content += `Total Shares: ${totalShareCount.toLocaleString()}\n`;
  content += `Total Impressions: ${impressionCount.toLocaleString()}\n`;
  content += `Likes: ${likeCount.toLocaleString()}\n`;
  content += `Comments: ${commentCount.toLocaleString()}\n`;
  content += `Clicks: ${clickCount.toLocaleString()}\n`;
  content += `Engagement: ${engagement.toLocaleString()}\n`;
  
  if (impressionCount > 0) {
    const engagementRate = ((engagement / impressionCount) * 100).toFixed(2);
    content += `Engagement Rate: ${engagementRate}%\n`;
  }

  return content;
}

/**
 * Format post for embedding with full content and comprehensive metrics
 */
function formatPostForEmbedding(post, orgName, metrics) {
  let content = `LinkedIn Post from ${orgName}:\n\n`;
  
  // Extract full post content from various possible fields
  const postText = post.fullText || post.full_text || post.textContent || post.commentary || post.post_content || 'No text content';
  content += `Post Content:\n"${postText}"\n\n`;
  
  // Performance Metrics
  content += `Engagement Metrics:\n`;
  content += `- Likes: ${metrics.likeCount || 0}\n`;
  content += `- Comments: ${metrics.commentCount || 0}\n`;
  content += `- Shares: ${metrics.shareCount || 0}\n`;
  content += `- Impressions: ${metrics.impressionCount || 0}\n`;
  content += `- Engagement Rate: ${(metrics.engagementRate || 0).toFixed(2)}%\n`;
  
  // Post metadata
  const postedDate = post.createdAt || post.posted_at || post.created_at;
  if (postedDate) {
    content += `- Posted Date: ${new Date(postedDate).toLocaleDateString()}\n`;
  }
  
  // Post ID for reference
  if (post.post_id || post.postId) {
    content += `- Post ID: ${post.post_id || post.postId}\n`;
  }
  
  // Calculate engagement quality
  const totalEngagement = (metrics.likeCount || 0) + (metrics.commentCount || 0) + (metrics.shareCount || 0);
  if (totalEngagement > 0) {
    content += `- Total Engagements: ${totalEngagement}\n`;
    if (metrics.impressionCount > 0) {
      const clickThroughRate = ((totalEngagement / metrics.impressionCount) * 100).toFixed(2);
      content += `- Engagement-to-Impression Ratio: ${clickThroughRate}%\n`;
    }
  }

  return content;
}

/**
 * Create comprehensive organization summary including analytics and posts
 */
function createOrganizationSummary(orgName, cacheData, postStats) {
  let summary = `Comprehensive LinkedIn Analytics Summary for ${orgName}:\n\n`;

  // Analyze cached analytics with rich details
  if (cacheData && cacheData.length > 0) {
    summary += `Analytics Data Sources: ${cacheData.length} dataset(s)\n\n`;
    
    // Extract key metrics from cache
    cacheData.forEach(cache => {
      summary += `Data Type: ${cache.analytics_type}\n`;
      
      // Parse analytics_data if it's a string
      let data = cache.analytics_data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // Already parsed
        }
      }
      
      // Add follower summary
      if (data.followers) {
        summary += `  - Total Followers: ${data.followers.total || 0}\n`;
        summary += `  - Recent Growth: ${data.followers.currentPeriod || 0} followers\n`;
      }
      
      // Add page view summary
      if (data.pageViews) {
        summary += `  - Lifetime Page Views: ${data.pageViews.lifetime || 0}\n`;
        summary += `  - Current Period Views: ${data.pageViews.currentPeriod || 0}\n`;
      }
      
      // Add demographics count
      if (data.demographics) {
        const demoCount = [
          data.demographics.countries?.length || 0,
          data.demographics.regions?.length || 0,
          data.demographics.industries?.length || 0,
          data.demographics.functions?.length || 0,
          data.demographics.seniorities?.length || 0
        ].reduce((a, b) => a + b, 0);
        summary += `  - Demographic Data Points: ${demoCount}\n`;
      }
      
      summary += `\n`;
    });
  }

  // Analyze post performance
  if (postStats && postStats.length > 0) {
    const totalPosts = postStats.length;
    const totalLikes = postStats.reduce((sum, p) => sum + (p.like_count || 0), 0);
    const totalComments = postStats.reduce((sum, p) => sum + (p.comment_count || 0), 0);
    const totalShares = postStats.reduce((sum, p) => sum + (p.share_count || 0), 0);
    const totalImpressions = postStats.reduce((sum, p) => sum + (p.impression_count || 0), 0);
    const avgEngagement = postStats.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / totalPosts;

    summary += `Post Performance Analysis:\n`;
    summary += `- Total Posts Analyzed: ${totalPosts}\n`;
    summary += `- Total Likes: ${totalLikes.toLocaleString()}\n`;
    summary += `- Total Comments: ${totalComments.toLocaleString()}\n`;
    summary += `- Total Shares: ${totalShares.toLocaleString()}\n`;
    summary += `- Total Impressions: ${totalImpressions.toLocaleString()}\n`;
    summary += `- Average Engagement Rate: ${avgEngagement.toFixed(2)}%\n`;
    summary += `- Average Likes per Post: ${(totalLikes / totalPosts).toFixed(1)}\n`;
    summary += `- Average Comments per Post: ${(totalComments / totalPosts).toFixed(1)}\n`;
    
    // Include actual post content previews (top 10 most recent)
    summary += `\n--- Recent Post Content ---\n\n`;
    const recentPosts = postStats
      .sort((a, b) => new Date(b.posted_at || b.created_at) - new Date(a.posted_at || a.created_at))
      .slice(0, 10);
    
    recentPosts.forEach((post, idx) => {
      const postText = post.post_content || post.fullText || post.full_text || post.textContent || post.commentary || 'No content';
      const truncatedText = postText.length > 300 ? postText.substring(0, 300) + '...' : postText;
      const postedDate = new Date(post.posted_at || post.created_at).toLocaleDateString();
      
      summary += `Post ${idx + 1} (${postedDate}):\n`;
      summary += `"${truncatedText}"\n`;
      summary += `Engagement: ${post.like_count || 0} likes, ${post.comment_count || 0} comments, ${post.share_count || 0} shares\n\n`;
    });
  }

  return summary;
}

/**
 * Get organization analytics context for AI
 * This retrieves relevant context without embeddings search (for initial implementation)
 * @route GET /api/embeddings/organization/:clerkUserId/:organizationId/context
 */
const getOrganizationContext = async (req, res) => {
  try {
    const { clerkUserId, organizationId } = req.params;

    // Get all embeddings content (without vector search for now)
    const { data: embeddings, error } = await supabase
      .from('organization_analytics_embeddings')
      .select('content, content_type, metadata, data_start_date, data_end_date')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get recent high-performing posts
    const { data: topPosts } = await supabase
      .from('organization_posts')
      .select('post_content, like_count, comment_count, share_count, engagement_rate, posted_at')
      .eq('user_clerk_id', clerkUserId)
      .eq('organization_id', organizationId)
      .order('engagement_rate', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      embeddings: embeddings || [],
      topPosts: topPosts || [],
      totalEmbeddings: embeddings?.length || 0
    });

  } catch (error) {
    console.error('Error getting organization context:', error);
    res.status(500).json({ 
      error: 'Failed to get organization context',
      details: error.message 
    });
  }
};

module.exports = {
  generateOrganizationEmbeddings,
  getOrganizationContext
};
