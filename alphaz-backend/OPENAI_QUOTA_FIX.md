# OpenAI Quota Exceeded - Fix Guide

## 🔴 Error Encountered

```
Error 429: You exceeded your current quota, please check your plan and billing details.
```

**What this means**: Your OpenAI API key has no credits or has hit a spending limit.

---

## ✅ Solution: Add OpenAI Credits

### Step 1: Go to OpenAI Billing
Visit: https://platform.openai.com/account/billing

### Step 2: Add Payment Method
- Click "Payment methods"
- Add credit/debit card
- Verify payment method

### Step 3: Add Credits
- Click "Add to credit balance"
- **Minimum**: $5 (will last ~250,000 refreshes at $0.00002 each)
- **Recommended**: $10-20 for peace of mind

### Step 4: Wait for Activation
- Credits take 5-10 minutes to activate
- Check usage at: https://platform.openai.com/account/usage

### Step 5: Test
```bash
# Restart backend
npm start

# Go to Monitor page → Click Refresh
```

---

## 💰 Cost Breakdown

### Your Usage
- **Content size**: 15,816 characters
- **Estimated tokens**: ~4,000 tokens
- **Cost per embedding**: $0.00008
- **Daily refresh**: $0.00008
- **Monthly cost**: $0.0024 (~$0.00 practically)

### Credits Recommendation
| Credits | Refreshes | Months of Daily Use |
|---------|-----------|---------------------|
| $5 | 62,500 | 5,208 months (434 years!) |
| $10 | 125,000 | 10,416 months |
| $20 | 250,000 | 20,833 months |

**Bottom line**: $5 is more than enough for lifetime use of this app.

---

## 🔍 Check Current Quota

### API Request (if you want to verify)
```bash
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Or Visit Dashboard
https://platform.openai.com/account/usage

---

## 🛡️ Alternative: Store Without Embeddings (Temporary)

**Current code change applied**: Content will now be stored even if OpenAI fails. You can add credits later and regenerate embeddings.

### What Happens Now
1. ✅ **Content stored** in database (all analytics + posts)
2. ❌ **Embedding = null** (can't do semantic search yet)
3. ⏳ **Add credits** → **Refresh again** → **Embedding generated**

### Verify Content Stored
```sql
SELECT 
  organization_name,
  content_type,
  LENGTH(content) as chars,
  embedding IS NULL as no_embedding,
  metadata
FROM organization_analytics_embeddings
WHERE organization_id = '110182086';
```

**Expected**:
- 1 row
- content_type = 'comprehensive'
- chars = ~15,000
- no_embedding = true (until you add credits)
- metadata has post_ids

---

## 🔄 After Adding Credits

### Regenerate Embeddings
Just click **Refresh** again on Monitor page. The code will:
1. Delete old record (content without embedding)
2. Generate new embedding with OpenAI
3. Store content + embedding together

---

## 🚨 Common Issues

### Issue 1: Credits Not Showing
**Wait**: 5-10 minutes after adding
**Check**: https://platform.openai.com/account/billing/overview

### Issue 2: Still Getting 429
**Reasons**:
- Credits not activated yet
- Using wrong API key (check .env)
- Rate limit (wait 1 minute, try again)

### Issue 3: Different Error Code
**401 Unauthorized**: Wrong API key
**403 Forbidden**: Country restrictions
**500 Server Error**: OpenAI service issue (retry later)

---

## 💡 Pro Tips

### Set Spending Limits
1. Go to https://platform.openai.com/account/billing/limits
2. Set "Hard limit" to $10 or $20
3. Set "Soft limit" to $5
4. Get email alerts when approaching limit

### Monitor Usage
- Dashboard: https://platform.openai.com/account/usage
- Check weekly/monthly spend
- Your app will use ~$0.07/year (negligible)

### Free Alternatives (If You Don't Want to Pay)
1. **HuggingFace Inference API**: Free tier available
2. **Cohere**: Free tier with 100 requests/min
3. **Local Models**: Sentence-transformers (free but slower)

But honestly, $5 for 434 years of usage is worth it 😄

---

## 📋 Checklist

- [ ] Go to https://platform.openai.com/account/billing
- [ ] Add payment method
- [ ] Add $5-10 credits
- [ ] Wait 5-10 minutes
- [ ] Restart backend: `npm start`
- [ ] Click Refresh on Monitor page
- [ ] Verify embedding created:
  ```sql
  SELECT embedding IS NOT NULL FROM organization_analytics_embeddings;
  ```

---

## ✅ Success Indicators

**Logs should show**:
```
📊 Comprehensive content prepared: 15816 characters
✓ Embedding generated successfully (1536 dimensions)
✓ Cleaned up old embeddings
✅ Generated 1 comprehensive embedding (7 posts + analytics)
✅ Inserted data: [id]
```

**Database should have**:
```sql
-- 1 row with embedding
SELECT COUNT(*) FROM organization_analytics_embeddings 
WHERE embedding IS NOT NULL;
-- Result: 1
```

---

**Current Status**: 
- ✅ Content prepared (15,816 chars)
- ✅ 7 posts cached
- ✅ Analytics cached
- ❌ Embedding = null (waiting for OpenAI credits)

**Action Required**: Add $5 to OpenAI account → Retry refresh
