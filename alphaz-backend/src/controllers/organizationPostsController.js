const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Fetch posts for an organization
const getOrganizationPosts = async (req, res) => {
  try {
    const { clerkUserId, organizationUrn } = req.params;
    const { start = 0, count = 10 } = req.query;

    if (!organizationUrn) {
      return res.status(400).json({ 
        error: 'Organization URN is required' 
      });
    }

    // Get user's LinkedIn token
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('linkedin_access_token')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (userError || !userData?.linkedin_access_token) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected' 
      });
    }

    const accessToken = userData.linkedin_access_token;

    // Fetch posts from LinkedIn API
    const postsUrl = `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(organizationUrn)}&start=${start}&count=${count}&sortBy=CREATED&viewContext=AUTHOR`;
    
    console.log('Fetching organization posts:', postsUrl);
    console.log('Organization URN:', organizationUrn);
    console.log('Request params:', { start, count });

    let response;
    try {
      response = await axios.get(postsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202511',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
    } catch (apiError) {
      // If we get a 404, it might mean no posts exist yet
      if (apiError.response?.status === 404) {
        console.log('No posts found for organization (404)');
        return res.json({
          posts: [],
          paging: {
            start: 0,
            count: count,
            total: 0,
            links: []
          }
        });
      }
      throw apiError; // Re-throw other errors
    }

    const posts = response.data.elements || [];
    
    // Process posts to extract key information
    const processedPosts = posts.map(post => {
     // console.log('Raw post structure:', JSON.stringify(post, null, 2));
      
      // Extract text content
      let textContent = '';
      if (post.commentary) {
        textContent = post.commentary;
      } else if (post.content?.multiImage?.altText) {
        textContent = post.content.multiImage.altText;
      }

      // Extract media information
      let media = [];
      if (post.content?.multiImage?.images) {
        media = post.content.multiImage.images.map(img => ({
          type: 'image',
          url: img.digitalmediaAsset
        }));
      } else if (post.content?.video) {
        media = [{
          type: 'video',
          url: post.content.video.digitalmediaAsset,
          thumbnail: post.content.video.thumbnail
        }];
      } else if (post.content?.article) {
        media = [{
          type: 'article',
          url: post.content.article.source,
          title: post.content.article.title,
          description: post.content.article.description,
          thumbnail: post.content.article.thumbnail
        }];
      }

      // Extract engagement metrics
      const socialDetail = post.socialDetail || {};
      console.log('Post social detail structure:', JSON.stringify(socialDetail, null, 2));
      
      // Try multiple possible paths for metrics
      let metrics = {
        likes: 0,
        comments: 0,
        reposts: 0,
        impressions: 0
      };

      // Check different possible structures
      if (socialDetail.totalSocialActivityCounts) {
        metrics = {
          likes: socialDetail.totalSocialActivityCounts.numLikes || 0,
          comments: socialDetail.totalSocialActivityCounts.numComments || 0,
          reposts: socialDetail.totalSocialActivityCounts.numShares || 0,
          impressions: socialDetail.totalSocialActivityCounts.numImpressions || 0
        };
      } else if (socialDetail.socialActivityCounts) {
        metrics = {
          likes: socialDetail.socialActivityCounts.numLikes || 0,
          comments: socialDetail.socialActivityCounts.numComments || 0,
          reposts: socialDetail.socialActivityCounts.numShares || 0,
          impressions: socialDetail.socialActivityCounts.numImpressions || 0
        };
      } else if (post.socialCounts) {
        metrics = {
          likes: post.socialCounts.numLikes || 0,
          comments: post.socialCounts.numComments || 0,
          reposts: post.socialCounts.numShares || 0,
          impressions: post.socialCounts.numImpressions || 0
        };
      }

      console.log('Extracted metrics:', metrics);

      return {
        id: post.id,
        urn: post.$URN,
        author: post.author,
        createdAt: post.createdAt,
        lastModifiedAt: post.lastModifiedAt,
        visibility: post.visibility,
        textContent: textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''), // Preview text
        fullText: textContent,
        media,
        metrics,
        lifecycleState: post.lifecycleState,
        publishedAt: post.publishedAt,
        distributionTarget: post.target
      };
    });

    // Get pagination info
    const paging = response.data.paging || {};
    
    res.json({
      posts: processedPosts,
      paging: {
        start: paging.start || start,
        count: paging.count || count,
        total: paging.total,
        links: paging.links || []
      }
    });

  } catch (error) {
    console.error('Error fetching organization posts:', error.response?.data || error.message);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to fetch organization posts';
    let details = error.response?.data || error.message;
    
    if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to view posts for this organization';
      details = 'You must be an administrator or content admin of the organization to view its posts.';
    } else if (error.response?.status === 404 && error.response?.data?.code === 'RESOURCE_NOT_FOUND') {
      errorMessage = 'Posts not available for this organization';
      details = 'This organization may not have any posts yet, or you may not have the required permissions.';
    }
    
    res.status(error.response?.status || 500).json({ 
      error: errorMessage,
      details: details,
      status: error.response?.status,
      code: error.response?.data?.code
    });
  }
};

// Get a single post with full details
const getPostDetails = async (req, res) => {
  try {
    const { clerkUserId, postUrn } = req.params;

    if (!postUrn) {
      return res.status(400).json({ 
        error: 'Post URN is required' 
      });
    }

    // Get user's LinkedIn token
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('linkedin_access_token')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (userError || !userData?.linkedin_access_token) {
      return res.status(401).json({ 
        error: 'LinkedIn not connected' 
      });
    }

    const accessToken = userData.linkedin_access_token;

    // Fetch post details from LinkedIn API
    const postUrl = `https://api.linkedin.com/rest/posts/${encodeURIComponent(postUrn)}?viewContext=AUTHOR`;
    
    console.log('Fetching post details:', postUrl);

    const response = await axios.get(postUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202511',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const post = response.data;
    console.log('Post details structure:', JSON.stringify(post, null, 2));
    
    // Process post with full details
    let textContent = '';
    if (post.commentary) {
      textContent = post.commentary;
    } else if (post.content?.multiImage?.altText) {
      textContent = post.content.multiImage.altText;
    }

    // Extract media information
    let media = [];
    if (post.content?.multiImage?.images) {
      media = post.content.multiImage.images.map(img => ({
        type: 'image',
        url: img.digitalmediaAsset
      }));
    } else if (post.content?.video) {
      media = [{
        type: 'video',
        url: post.content.video.digitalmediaAsset,
        thumbnail: post.content.video.thumbnail
      }];
    } else if (post.content?.article) {
      media = [{
        type: 'article',
        url: post.content.article.source,
        title: post.content.article.title,
        description: post.content.article.description,
        thumbnail: post.content.article.thumbnail
      }];
    }

    // Extract engagement metrics
    const socialDetail = post.socialDetail || {};
    console.log('Post details social structure:', JSON.stringify(socialDetail, null, 2));
    
    // Try multiple possible paths for metrics
    let metrics = {
      likes: 0,
      comments: 0,
      reposts: 0,
      impressions: 0
    };

    // Check different possible structures
    if (socialDetail.totalSocialActivityCounts) {
      metrics = {
        likes: socialDetail.totalSocialActivityCounts.numLikes || 0,
        comments: socialDetail.totalSocialActivityCounts.numComments || 0,
        reposts: socialDetail.totalSocialActivityCounts.numShares || 0,
        impressions: socialDetail.totalSocialActivityCounts.numImpressions || 0
      };
    } else if (socialDetail.socialActivityCounts) {
      metrics = {
        likes: socialDetail.socialActivityCounts.numLikes || 0,
        comments: socialDetail.socialActivityCounts.numComments || 0,
        reposts: socialDetail.socialActivityCounts.numShares || 0,
        impressions: socialDetail.socialActivityCounts.numImpressions || 0
      };
    } else if (post.socialCounts) {
      metrics = {
        likes: post.socialCounts.numLikes || 0,
        comments: post.socialCounts.numComments || 0,
        reposts: post.socialCounts.numShares || 0,
        impressions: post.socialCounts.numImpressions || 0
      };
    }

    console.log('Post details extracted metrics:', metrics);

    const processedPost = {
      id: post.id,
      urn: post.$URN,
      author: post.author,
      createdAt: post.createdAt,
      lastModifiedAt: post.lastModifiedAt,
      visibility: post.visibility,
      fullText: textContent,
      media,
      metrics,
      lifecycleState: post.lifecycleState,
      publishedAt: post.publishedAt,
      distributionTarget: post.target,
      content: post.content // Full content structure
    };

    res.json(processedPost);

  } catch (error) {
    console.error('Error fetching post details:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to fetch post details',
      details: error.response?.data?.message || error.message
    });
  }
};

module.exports = {
  getOrganizationPosts,
  getPostDetails
};