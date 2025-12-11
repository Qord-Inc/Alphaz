# AI Chat Architecture for LinkedIn Content Generation

## Overview

This document outlines the architecture for AI-powered content generation using organization analytics data stored in Supabase vector database.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │ Create Page  │───▶│  Chat UI     │───▶│ Sync Analytics  │  │
│  │  /create     │    │              │    │     Button      │  │
│  └──────────────┘    └──────────────┘    └─────────────────┘  │
│         │                    │                      │          │
└─────────┼────────────────────┼──────────────────────┼──────────┘
          │                    │                      │
          ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Express.js)                     │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Chat Endpoint   │  │ Context Fetcher  │  │ Embeddings    │ │
│  │ /api/chat       │  │ /api/embeddings  │  │ Generator     │ │
│  └─────────────────┘  └──────────────────┘  └───────────────┘ │
│         │                      │                     │         │
└─────────┼──────────────────────┼─────────────────────┼─────────┘
          │                      │                     │
          ▼                      ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL + pgvector)               │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │ organization_analytics   │  │  organization_posts      │   │
│  │     _embeddings          │  │  (with metrics)          │   │
│  │  - content (text)        │  │  - post_content          │   │
│  │  - embedding (vector)    │  │  - engagement_rate       │   │
│  │  - content_type          │  │  - like/comment/share    │   │
│  └──────────────────────────┘  └──────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────┐                                  │
│  │ organization_analytics   │                                  │
│  │      _cache              │                                  │
│  │  - raw LinkedIn data     │                                  │
│  └──────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Model (Gemini / GPT)                      │
│                                                                 │
│  Context + User Query ───▶ Generate Content ───▶ Stream Response│
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Analytics Sync Phase

```
User Connects LinkedIn
    │
    ▼
Sync Analytics Button Clicked
    │
    ▼
POST /api/embeddings/organization/:userId/:orgId/generate
    │
    ├─▶ Fetch Follower Stats from LinkedIn API
    │   └─▶ Store in analytics_cache + embeddings
    │
    ├─▶ Fetch Share Stats from LinkedIn API
    │   └─▶ Store in analytics_cache + embeddings
    │
    ├─▶ Fetch Organization Posts (up to 200)
    │   └─▶ Store in organization_posts
    │   └─▶ High-performers → embeddings
    │
    └─▶ Generate Summary
        └─▶ Store in embeddings
```

### 2. Chat Generation Phase

```
User Types Query in Create Page
    │
    ▼
Check if Personal Profile
    │
    ├─▶ Yes: Show "Organization Required" message
    │
    └─▶ No: Continue to chat
        │
        ▼
GET /api/embeddings/organization/:userId/:orgId/context
        │
        ├─▶ Fetch all embeddings content
        ├─▶ Fetch top 10 posts
        └─▶ Return context
            │
            ▼
    Combine context + user query
            │
            ▼
    POST /api/chat (with Vercel AI SDK)
            │
            ▼
    AI Model (Gemini) generates response
            │
            ▼
    Stream response to frontend
```

## Database Schema

### organization_analytics_embeddings

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_clerk_id | VARCHAR(255) | Foreign key to users |
| organization_id | VARCHAR(255) | LinkedIn org ID |
| organization_name | VARCHAR(255) | Org display name |
| content | TEXT | Text content for embedding |
| content_type | VARCHAR(50) | Type: follower_stats, share_stats, post_performance, summary |
| embedding | vector(1536) | Vector embedding (OpenAI ada-002) |
| metadata | JSONB | Additional metadata |
| data_start_date | TIMESTAMP | Start of data range |
| data_end_date | TIMESTAMP | End of data range |

### organization_posts

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_clerk_id | VARCHAR(255) | Foreign key to users |
| organization_id | VARCHAR(255) | LinkedIn org ID |
| post_id | VARCHAR(500) | LinkedIn post URN |
| post_content | TEXT | Post text |
| like_count | INTEGER | Number of likes |
| comment_count | INTEGER | Number of comments |
| share_count | INTEGER | Number of shares |
| impression_count | INTEGER | Number of impressions |
| engagement_rate | FLOAT | Calculated engagement % |
| posted_at | TIMESTAMP | When post was published |

## Implementation Phases

### Phase 1: Data Collection ✅ COMPLETE

- [x] Create database schema with pgvector
- [x] Create embeddings controller
- [x] Implement data fetching from LinkedIn API
- [x] Store analytics in cache
- [x] Prepare text content for embeddings
- [x] Store posts with metrics
- [x] Create API endpoints
- [x] Add sync button component

### Phase 2: Vector Embeddings (NEXT)

**Tools needed:**
```bash
npm install openai  # or @ai-sdk/openai
```

**Steps:**
1. Add OpenAI API key to `.env`
2. Update `vectorEmbeddingsController.js` to generate embeddings
3. Store embeddings in database
4. Implement similarity search using `match_organization_analytics()` function

**Code Example:**
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generate embedding
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: content
});

const embedding = response.data[0].embedding;

// Store with embedding
await supabase
  .from('organization_analytics_embeddings')
  .update({ embedding })
  .eq('id', recordId);
```

### Phase 3: AI Chat Integration (NEXT)

**Tools needed:**
```bash
npm install ai @ai-sdk/google @ai-sdk/openai
```

**Features:**
1. Create `/api/chat` endpoint
2. Implement context retrieval
3. Use Vercel AI SDK for streaming
4. Support multiple AI models (Gemini, GPT)

**Code Example:**
```javascript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req) {
  const { messages, organizationId, clerkUserId } = await req.json();
  
  // Get context
  const context = await getOrganizationContext(clerkUserId, organizationId);
  
  // Generate with AI
  const result = streamText({
    model: google('gemini-1.5-pro'),
    messages,
    system: `You are a LinkedIn content expert. Use this context: ${context}`
  });
  
  return result.toDataStreamResponse();
}
```

### Phase 4: Frontend Chat UI

**Features:**
1. Chat message list
2. Streaming responses
3. Thread management
4. Context indicator
5. Copy/edit generated content

## Recommended AI Setup

### Option 1: Google Gemini (Recommended for budget)

**Pros:**
- Free tier available
- Excellent for content generation
- Large context window
- Good at following instructions

**Setup:**
```bash
npm install @ai-sdk/google
```

```javascript
import { google } from '@ai-sdk/google';

const result = await generateText({
  model: google('gemini-1.5-pro'),
  prompt: `Context: ${context}\n\nUser: ${query}`
});
```

### Option 2: OpenAI GPT-4

**Pros:**
- Highest quality outputs
- Best instruction following
- Excellent for creative content

**Cons:**
- More expensive

**Setup:**
```bash
npm install @ai-sdk/openai
```

```javascript
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4-turbo'),
  prompt: `Context: ${context}\n\nUser: ${query}`
});
```

### Option 3: Anthropic Claude

**Pros:**
- Excellent reasoning
- Very safe outputs
- Good at following style guides

**Setup:**
```bash
npm install @ai-sdk/anthropic
```

## Vector Search Strategy

### When to Use Vector Search

Use vector similarity search when:
- User query is semantic (e.g., "posts about innovation")
- Need to find similar successful posts
- Looking for patterns in data

### When to Use Direct Retrieval

Use direct database queries when:
- Getting all recent data
- Fetching specific metrics
- Initial context building

### Hybrid Approach (Recommended)

```javascript
async function getContext(clerkUserId, orgId, query) {
  // 1. Get general context (all-time summary)
  const summary = await getSummaryEmbedding(clerkUserId, orgId);
  
  // 2. Get relevant specific data via vector search
  const queryEmbedding = await generateEmbedding(query);
  const relevant = await vectorSearch(queryEmbedding, clerkUserId, orgId);
  
  // 3. Get top posts
  const topPosts = await getTopPosts(clerkUserId, orgId, 5);
  
  return combineContext(summary, relevant, topPosts);
}
```

## Performance Optimization

### Caching Strategy

```javascript
// Cache context for 5 minutes
const cacheKey = `context:${orgId}`;
let context = cache.get(cacheKey);

if (!context) {
  context = await fetchContext(orgId);
  cache.set(cacheKey, context, 300); // 5 min TTL
}
```

### Pagination for Posts

```javascript
// Fetch in batches
const BATCH_SIZE = 50;
for (let start = 0; start < 200; start += BATCH_SIZE) {
  await fetchAndStorePosts(start, BATCH_SIZE);
}
```

### Incremental Updates

```javascript
// Only fetch new posts since last sync
const lastSyncDate = await getLastSyncDate(orgId);
const newPosts = await fetchPostsSince(lastSyncDate);
```

## Cost Estimation

### Vector Embeddings (OpenAI text-embedding-3-small)

- Cost: $0.02 per 1M tokens
- Average content: ~500 tokens per embedding
- 100 embeddings: ~50,000 tokens = $0.001
- **Very cheap!**

### AI Generation (Google Gemini 1.5 Pro)

- Free tier: 50 requests/day
- Paid: $0.00125 per 1K characters input, $0.005 per 1K characters output
- Average request: 2K chars input, 500 chars output = $0.005
- 1000 generations: $5

### AI Generation (OpenAI GPT-4 Turbo)

- Cost: $10 per 1M input tokens, $30 per 1M output tokens
- Average request: 2K tokens input, 500 tokens output = $0.035
- 1000 generations: $35

**Recommendation:** Start with Gemini free tier, upgrade to paid as needed.

## Testing Checklist

- [ ] Run migration in Supabase
- [ ] Verify pgvector extension enabled
- [ ] Test sync analytics endpoint
- [ ] Verify data stored in all 3 tables
- [ ] Check embedding content is readable
- [ ] Test context retrieval endpoint
- [ ] Verify RLS policies work
- [ ] Test with multiple organizations

## Next Steps

1. Run the SQL migration in Supabase dashboard
2. Test the sync endpoint with your LinkedIn organization
3. Verify data is being stored correctly
4. Add OpenAI embeddings generation (Phase 2)
5. Create chat API endpoint (Phase 3)
6. Build chat UI (Phase 4)

## Questions?

Review:
- `VECTOR_DB_SETUP.md` - Detailed setup instructions
- `vectorEmbeddingsController.js` - Implementation details
- `create_vector_store.sql` - Database schema
