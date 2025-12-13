# AI Chat Implementation Guide

## Overview
The Create page now has AI-powered chat functionality that helps users write LinkedIn posts with context from their organization's analytics and past content.

## How It Works

### 1. **User Flow**
```
User types message → AI receives context → AI generates response → User can copy/refine
```

### 2. **Context-Aware AI**
The AI has access to:
- **Demographics**: Follower industries, seniorities, regions, company sizes
- **Post History**: Past post content and engagement metrics
- **Analytics Summary**: Follower counts, page views, top-performing content
- **Organization Info**: Company name and branding

### 3. **Key Features**
- ✅ Real-time streaming responses (words appear as AI types)
- ✅ Organization-specific context (tailored to YOUR audience)
- ✅ Copy button for easy post publishing
- ✅ Chat history (conversation continues in same thread)
- ✅ Error handling (graceful fallback if API fails)
- ✅ Loading states (clear feedback while AI thinks)

## File Structure

### Frontend (Next.js)
```
app/
  create/page.tsx          # Main chat UI
  api/chat/route.ts        # API endpoint for OpenAI

hooks/
  useAIChat.ts             # Chat state management hook

.env.local                 # Environment variables (OPENAI_API_KEY)
```

### Backend (Express)
```
src/controllers/
  vectorEmbeddingsController.js   # Provides context via /api/embeddings/organization/:id/context
```

## Code Explanation (For Beginners)

### 1. **useAIChat Hook** (`hooks/useAIChat.ts`)
```typescript
// This hook manages the chat conversation
export function useAIChat() {
  const { selectedOrganization } = useOrganization();
  const { user } = useUser();

  // useChat is from the AI SDK - handles messages, streaming, etc.
  const chat = useChat({
    api: '/api/chat',  // Where to send messages
    body: {
      organizationId: selectedOrganization?.id,  // Send org context
      clerkUserId: user?.id,
    },
  });

  return {
    messages,     // Array of all chat messages
    input,        // Current text input value
    setInput,     // Function to update input
    handleSubmit, // Function to send message
    isLoading,    // Is AI currently responding?
  };
}
```

**What it does:**
- Connects to the OpenAI API route
- Automatically sends organization ID with each message
- Manages message history and streaming

### 2. **Chat API Route** (`app/api/chat/route.ts`)
```typescript
export async function POST(req: Request) {
  // 1. Get user's message and organization ID
  const { messages, organizationId, clerkUserId } = await req.json();

  // 2. Fetch organization's embedded context from backend
  const contextResponse = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/embeddings/organization/${clerkUserId}/${organizationId}/context`
  );

  // 3. Build system prompt with context
  let systemPrompt = `You are a LinkedIn content expert...`;
  systemPrompt += contextData.embeddings; // Add org analytics

  // 4. Call OpenAI with streaming
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
  });

  // 5. Return streaming response
  return result.toTextStreamResponse();
}
```

**What it does:**
- Receives user's message
- Fetches organization context (demographics, posts, analytics)
- Sends everything to OpenAI
- Streams response back in real-time

### 3. **UI Components** (`app/create/page.tsx`)

#### Initial State (Before Messages)
```tsx
{showInitialState && (
  <div>
    <h1>What are you writing today?</h1>
    <Textarea value={input} onChange={setInput} />
    <Button onClick={handleSubmit}>Send</Button>
  </div>
)}
```

#### Chat Messages (After Conversation Starts)
```tsx
{!showInitialState && (
  <>
    {/* Message List */}
    <div className="messages">
      {messages.map(message => (
        <div className={message.role === 'user' ? 'user-message' : 'ai-message'}>
          {message.content}
          {message.role === 'assistant' && (
            <Button onClick={() => copyToClipboard(message.content)}>
              Copy
            </Button>
          )}
        </div>
      ))}
    </div>

    {/* Input Bar */}
    <Textarea value={input} onChange={setInput} />
    <Button onClick={handleSubmit}>Send</Button>
  </>
)}
```

**What it does:**
- Shows welcome screen until first message
- Displays conversation as chat bubbles
- Provides copy button for AI responses
- Fixed input bar at bottom

## Example Conversations

### Example 1: Basic Post Request
```
User: "Write a post about our new feature launch"

AI: "🚀 Exciting News for Our Community!

We're thrilled to announce [Feature Name] is now live! 

After months of development and feedback from our amazing users, we've built something that will help you [key benefit].

Here's what makes it special:
✨ [Benefit 1]
⚡ [Benefit 2]
🎯 [Benefit 3]

Perfect for teams in [industry from demographics] looking to [solve problem].

What feature should we build next? Drop your ideas below! 👇

#ProductLaunch #Innovation #[Industry]"
```

### Example 2: Audience-Specific Content
```
User: "Write about hiring engineers"

AI: "We're Growing Our Engineering Team! 🔧

Based on your audience (60% Engineering, 40% Management in Tech industry):

Looking for senior engineers who love solving complex problems at scale...

[Rest of post tailored to your actual follower demographics]
```

## How Context Improves AI Responses

### Without Context (Generic AI)
```
"We're hiring! Join our team! Apply now!"
```

### With Your Organization's Context
```
"🔧 Calling Software Engineers in India & US!

We're a 11-50 person startup in [your industry] looking for 
someone who can [specific to your tech stack].

Our followers tell us they love our [topic from past posts].
This role will help us double down on that.

Interested? Comment below or DM me directly."
```

**Why it's better:**
- ✅ Mentions actual follower regions (India, US)
- ✅ References company size (11-50 employees)
- ✅ Uses industry-specific language
- ✅ Connects to past successful content themes

## Testing the Feature

### 1. Start the backend
```bash
cd alphaz-backend
npm start
```

### 2. Start the frontend
```bash
cd alphaz
npm run dev
```

### 3. Test Flow
1. Navigate to `/create`
2. Select an organization (not personal profile)
3. Type: "Write a LinkedIn post about our company culture"
4. Watch AI stream the response
5. Click "Copy" to use the content

### 4. Check Context is Working
Look at the backend logs:
```
✓ Fetched context for organization: Alphaz
  - 1 summary embedding
  - 1 demographic_data embedding
  - 7 post_performance embeddings
```

## Cost Analysis

### Per Conversation
- **Input tokens**: ~1,500 tokens (system prompt + context + user message)
- **Output tokens**: ~300 tokens (AI response)
- **Total cost**: ~$0.0003 per message (~0.03 cents)

### For 100 Users
- **Daily**: 100 users × 5 messages/day = 500 messages = **$0.15/day**
- **Monthly**: **$4.50/month**
- **Yearly**: **$54/year**

**Note**: This is just for the chat API. Embedding generation (covered separately) happens once per 24 hours.

## Common Issues & Solutions

### Issue 1: "AI is not using my organization's context"
**Solution**: Check backend logs for:
```
✓ Fetched context for organization: [Your Org]
```

If missing, run the "Refresh" button on Monitor page to generate embeddings.

### Issue 2: "Error: Failed to process chat request"
**Solutions**:
- Check `OPENAI_API_KEY` in `.env.local`
- Verify backend is running on port 5000
- Check browser console for API errors

### Issue 3: "Messages not streaming, just appearing all at once"
**Solution**: This is expected behavior in some browsers/networks. The AI SDK handles streaming automatically.

### Issue 4: "Copy button not working"
**Solution**: Browsers require HTTPS for clipboard API. In development (localhost), it should work. If not, check browser permissions.

## Extending the Feature

### Add More Context Sources
Edit `app/api/chat/route.ts`:
```typescript
// Add competitor analysis
const competitorData = await fetch(`/api/competitors/${organizationId}`);
systemPrompt += `\nCompetitors: ${competitorData}`;

// Add trending topics
const trends = await fetch(`/api/trends/${industry}`);
systemPrompt += `\nTrending: ${trends}`;
```

### Add Image Generation
```typescript
// In the chat UI
const generateImage = async (prompt: string) => {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: `LinkedIn post image for: ${prompt}`,
    size: "1024x1024",
  });
  return response.data[0].url;
};
```

### Add Tone Selection
```tsx
<select onChange={(e) => setTone(e.target.value)}>
  <option value="professional">Professional</option>
  <option value="casual">Casual</option>
  <option value="inspiring">Inspiring</option>
</select>

// Then pass to API:
body: { tone, organizationId, clerkUserId }
```

## Best Practices

1. **Always provide organization context** - The AI is much better with real data
2. **Keep conversations focused** - Start new chat for different topics
3. **Iterate on responses** - Ask AI to "make it shorter" or "add more data"
4. **Review before posting** - AI is a starting point, not a replacement for human judgment
5. **Monitor costs** - Set up OpenAI usage alerts at platform.openai.com

## Next Steps

1. ✅ Basic chat working
2. 🔄 Add conversation history/threads (coming soon)
3. 🔄 Add post scheduling (coming soon)
4. 🔄 Add A/B testing suggestions (coming soon)
5. 🔄 Add image generation (coming soon)

## Questions?

The code is designed to be readable for beginners. Key concepts:
- **Hooks** = Functions that manage state (like useState but fancier)
- **Streaming** = Data arrives piece by piece (like typing)
- **Context** = Extra information given to AI (your org's data)
- **Embeddings** = Vector representations of text (for search/context)

Happy content creating! 🚀
