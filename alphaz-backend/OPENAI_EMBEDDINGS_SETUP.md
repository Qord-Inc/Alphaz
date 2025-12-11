# OpenAI Embeddings Implementation - Setup Guide

## ✅ Code Changes Complete

All vector embedding generation has been implemented using OpenAI's `text-embedding-3-small` model.

### Changes Made:
1. **OpenAI SDK Integration**: Added `openai` client initialization
2. **generateEmbedding() Helper**: Generates 1536-dimensional embeddings with error handling
3. **Updated 4 Insert Operations**:
   - Analytics data embeddings (from cache)
   - Post performance embeddings (2 locations: generateEmbeddingsFromCache and storePost)
   - Summary embeddings

## 🚀 Setup Steps

### 1. Install OpenAI SDK
```bash
cd c:\Projects\Alphaz\alphaz-backend
npm install openai
```

### 2. Add OpenAI API Key to Environment
Add to your `.env` file in `alphaz-backend` directory:
```env
OPENAI_API_KEY=your-openai-api-key-here
```

### 3. Restart Backend Server
```bash
npm start
```

## 🧪 Testing

### 1. Trigger Embedding Generation
Go to the Monitor page in your app and click the **Refresh** button. This will:
- Fetch LinkedIn analytics and posts
- Generate embeddings for all content
- Store vectors in `organization_analytics_embeddings` table

### 2. Check Backend Logs
You should see:
```
✓ Generated X embeddings from cached data
✓ Created summary embedding for [Organization Name]
```

If there are API errors, you'll see:
```
Error generating embedding: [error message]
```

### 3. Verify Database
Run this query in Supabase SQL editor:
```sql
SELECT 
  id, 
  content_type, 
  organization_name,
  embedding IS NOT NULL as has_embedding,
  LENGTH(content) as content_length,
  updated_at
FROM organization_analytics_embeddings
ORDER BY updated_at DESC;
```

**Expected Result**: All records should have `has_embedding = true`

### 4. Check Embedding Dimensions
```sql
SELECT 
  content_type,
  array_length(embedding, 1) as dimension_count
FROM organization_analytics_embeddings
WHERE embedding IS NOT NULL
LIMIT 5;
```

**Expected Result**: `dimension_count = 1536` for all records

## 📊 What Gets Embedded

### 1. Analytics Data
- Follower growth statistics
- Impression/engagement metrics
- Date ranges and organization details

### 2. Post Performance
- Only high-performing posts (engagement_rate > 1 OR like_count > 10)
- Post content + engagement metrics
- Posted date and organization context

### 3. Summary
- Comprehensive summary combining all analytics
- Post statistics aggregated
- Organization overview

## 🔍 Troubleshooting

### No embeddings generated
- Check `OPENAI_API_KEY` is set correctly in `.env`
- Verify OpenAI API key is valid (test at platform.openai.com)
- Check backend logs for "Error generating embedding" messages

### Some embeddings are null
- This is OK! If OpenAI API fails, content is still stored without embedding
- Refresh again to regenerate missing embeddings
- Check OpenAI account has credits available

### Embeddings generated but queries fail
- Verify vector dimensions: `array_length(embedding, 1)` should be 1536
- Check schema has `vector(1536)` column type
- If wrong dimensions, regenerate embeddings after fixing

## 💰 Cost Tracking

With `text-embedding-3-small` at $0.020 per 1M tokens:
- **Per refresh**: ~$0.00006 (3,000 tokens typical)
- **Daily refresh**: ~$0.002/month
- **5 organizations**: ~$0.01/month

**Token limits**: Model automatically truncates to 30,000 characters (~8,191 tokens)

## 🎯 Next Steps

Once embeddings are working:
1. **Implement similarity search** for finding related content
2. **Add RAG (Retrieval Augmented Generation)** for AI insights
3. **Create semantic search** for posts and analytics
4. **Build recommendation engine** based on vector similarity

Example similarity search:
```sql
SELECT 
  content_type,
  content,
  1 - (embedding <=> query_embedding) as similarity
FROM organization_analytics_embeddings
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

## ✨ Features Enabled

✅ **Semantic search**: Find posts/analytics by meaning, not just keywords
✅ **Content clustering**: Group similar posts automatically
✅ **Trend detection**: Identify patterns across time periods
✅ **AI-powered insights**: Feed embeddings to GPT for analysis
✅ **Recommendation engine**: Suggest content strategies based on past performance

---

**Status**: Ready to test! Add your API key and run a refresh.
