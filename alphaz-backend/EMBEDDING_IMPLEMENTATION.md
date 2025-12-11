# Implementing Vector Embeddings

## Current State
✅ Database schema ready (`embedding vector(1536)`)  
✅ Text content being stored  
❌ Embeddings not being generated (column is NULL)

## Option 1: OpenAI (Recommended)

### Setup

1. **Install OpenAI SDK**:
```bash
npm install openai
```

2. **Add to `.env`**:
```env
OPENAI_API_KEY=sk-...your-key-here...
```

3. **Get API Key**:
- Go to https://platform.openai.com/api-keys
- Create new key
- Add $5 credit (will last months)

### Implementation

Add to `vectorEmbeddingsController.js`:

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

/**
 * Generate embedding vector from text using OpenAI
 */
async function generateEmbedding(text) {
  try {
    // Truncate text if too long (OpenAI limit: 8191 tokens)
    const truncatedText = text.substring(0, 30000); // ~8000 tokens
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
      encoding_format: "float"
    });
    
    return response.data[0].embedding; // 1536-dimensional array
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}
```

### Update Insert Operations

**For analytics_data**:
```javascript
const content = formatAnalyticsForEmbedding(cache.analytics_data, organizationName);
const embedding = await generateEmbedding(content); // ← Generate embedding

await supabase
  .from('organization_analytics_embeddings')
  .insert({
    // ... existing fields
    content: content,
    embedding: embedding,  // ← Add embedding vector
    updated_at: new Date().toISOString()
  });
```

**For post_performance**:
```javascript
const content = formatPostForEmbedding(post, organizationName, metrics);
const embedding = await generateEmbedding(content); // ← Generate embedding

await supabase
  .from('organization_analytics_embeddings')
  .insert({
    // ... existing fields
    content: content,
    embedding: embedding,  // ← Add embedding vector
    updated_at: new Date().toISOString()
  });
```

**For summary**:
```javascript
const summary = createOrganizationSummary(organizationName, cacheData, postStats);
const embedding = await generateEmbedding(summary); // ← Generate embedding

await supabase
  .from('organization_analytics_embeddings')
  .insert({
    // ... existing fields
    content: summary,
    embedding: embedding,  // ← Add embedding vector
    updated_at: new Date().toISOString()
  });
```

### Cost Estimate

**Per organization sync**:
- Analytics data: ~500 tokens = $0.00001
- Summary: ~300 tokens = $0.000006
- 20 posts: ~10,000 tokens = $0.0002
- **Total per sync**: ~$0.0002 (0.02 cents)

**Monthly** (daily sync):
- 30 syncs × $0.0002 = **$0.006/month** (less than 1 cent!)

---

## Option 2: Hugging Face (Free, Local)

### Setup

1. **Install Transformers**:
```bash
npm install @xenova/transformers
```

2. **No API key needed!**

### Implementation

```javascript
const { pipeline } = require('@xenova/transformers');

// Initialize once (cache the model)
let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'sentence-transformers/all-MiniLM-L6-v2'
    );
  }
  return embedder;
}

async function generateEmbedding(text) {
  try {
    const extractor = await getEmbedder();
    const truncatedText = text.substring(0, 5000); // Smaller limit for local
    
    const output = await extractor(truncatedText, {
      pooling: 'mean',
      normalize: true
    });
    
    // Returns 384 dimensions - need to pad to 1536 or change schema
    const embedding = Array.from(output.data);
    
    // Option 1: Pad to 1536 (not recommended)
    while (embedding.length < 1536) {
      embedding.push(0);
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}
```

**Note**: Requires changing schema to `vector(384)` for better results, or padding (not ideal).

---

## Option 3: Google Gemini (Free Tier)

### Setup

1. **Install SDK**:
```bash
npm install @google/generative-ai
```

2. **Add to `.env`**:
```env
GOOGLE_API_KEY=your-key-here
```

3. **Get API Key**:
- Go to https://aistudio.google.com/app/apikey
- Create API key (free tier: 1500 requests/day)

### Implementation

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "text-embedding-004" 
    });
    
    const truncatedText = text.substring(0, 10000);
    const result = await model.embedContent(truncatedText);
    
    // Returns 768 dimensions - need to pad or change schema
    const embedding = result.embedding.values;
    
    // Pad to 1536 (or change schema to vector(768))
    while (embedding.length < 1536) {
      embedding.push(0);
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}
```

**Free Tier**: 1500 requests/day = 50 org syncs/day (plenty!)

---

## Comparison Table

| Provider | Dimensions | Cost | Setup | Quality | Speed |
|----------|------------|------|-------|---------|-------|
| **OpenAI** | 1536 ✅ | $0.006/mo | Easy | Best | Fast |
| **HuggingFace** | 384 | Free 💰 | Medium | Good | Slow |
| **Google Gemini** | 768 | Free 🆓 | Easy | Good | Fast |

## Schema Changes (If Needed)

If you choose 384 or 768 dimensions:

```sql
-- Change embedding dimensions
ALTER TABLE organization_analytics_embeddings
ALTER COLUMN embedding TYPE vector(384);  -- or vector(768)

-- Update index
DROP INDEX IF EXISTS idx_analytics_embeddings_vector;
CREATE INDEX idx_analytics_embeddings_vector
  ON public.organization_analytics_embeddings
  USING hnsw (embedding vector_cosine_ops);
```

## Recommendation

**For your use case**: Use **OpenAI text-embedding-3-small**

**Reasons**:
1. ✅ 1536 dimensions (schema already set up!)
2. ✅ Best quality embeddings
3. ✅ Extremely cheap ($0.006/month)
4. ✅ Easy to implement
5. ✅ Fast API response
6. ✅ Production-ready

**Next Steps**:
1. Add $5 to OpenAI account
2. Get API key
3. Install `npm install openai`
4. Add `OPENAI_API_KEY` to `.env`
5. Update 3 insert operations (I can do this for you!)

Cost = **~$0.18/year** (less than a coffee!)

Want me to implement OpenAI embeddings in your code?
