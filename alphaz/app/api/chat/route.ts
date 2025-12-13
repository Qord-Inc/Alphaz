import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

/**
 * POST /api/chat
 * 
 * Handles AI chat requests with organization analytics context
 * Uses embedded data from database to provide relevant insights
 * 
 * Returns streaming response that updates in real-time
 */
export async function POST(request: Request) {
  try {
    const {
      messages,           // Chat history: [{ role: 'user'|'assistant', content: string }]
      organizationId,     // LinkedIn organization URN
      clerkUserId,        // User's Clerk ID
      contextData,        // Embedded analytics data
    } = await request.json();

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400 }
      );
    }

    if (!organizationId || !clerkUserId) {
      return new Response(
        JSON.stringify({ error: 'organizationId and clerkUserId are required' }),
        { status: 400 }
      );
    }

    // Build system prompt with organization context
    const systemPrompt = buildSystemPrompt(contextData);

    console.log(`\n📨 [API/CHAT] Processing request`);
    console.log(`   Organization: ${organizationId}`);
    console.log(`   User: ${clerkUserId}`);
    console.log(`   Messages count: ${messages.length}`);
    console.log(`   Context data provided: ${contextData && Object.keys(contextData).length > 0 ? 'YES ✅' : 'NO ❌'}`);

    // Log system prompt details
    console.log(`\n🧠 [SYSTEM PROMPT]`);
    console.log(`   Length: ${systemPrompt.length} chars`);
    console.log(`   Contains summary: ${systemPrompt.includes('Organization Summary') ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Contains demographics: ${systemPrompt.includes('Audience Demographics') ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Contains posts: ${systemPrompt.includes('Recent Post Examples') ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Contains patterns: ${systemPrompt.includes('What Resonates') ? 'YES ✅' : 'NO ❌'}`);

    // Log context data details
    if (contextData) {
      console.log(`\n📊 [CONTEXT DATA]`);
      if (contextData.summary) {
        console.log(`   Summary: ${contextData.summary.substring(0, 100)}...`);
      }
      if (contextData.demographicData) {
        console.log(`   Demographics: ${contextData.demographicData.substring(0, 100)}...`);
      }
      if (contextData.recentPosts) {
        console.log(`   Recent Posts: ${contextData.recentPosts.substring(0, 100)}...`);
      }
      if (contextData.engagementPatterns) {
        console.log(`   Patterns: ${contextData.engagementPatterns.substring(0, 100)}...`);
      }
    }

    console.log(`\n🤖 [OPENAI] Calling GPT-4o-mini with streaming`);
    console.log(`   Model: gpt-4o-mini`);
    console.log(`   Temperature: 0.7`);
    console.log(`   Stream: Enabled (real-time response)`);

    // Call OpenAI with streaming enabled
    const stream = streamText({
      model: openai('gpt-4o-mini'), // Fast, cost-effective model
      system: systemPrompt,
      messages: messages,
      temperature: 0.7, // Balanced creativity and consistency
    });

    console.log(`\n⏳ [STREAMING STARTED]`);
    console.log(`   Sending streamed response to client...`);

    // Return the streaming response to the client
    return (await stream).toTextStreamResponse();

  } catch (error: any) {
    console.error('[API/CHAT] Error:', error);

    // Handle OpenAI API errors
    if (error.message?.includes('authentication')) {
      return new Response(
        JSON.stringify({ error: 'API authentication failed. Check OPENAI_API_KEY.' }),
        { status: 401 }
      );
    }

    if (error.message?.includes('rate limit')) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429 }
      );
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate response',
      }),
      { status: 500 }
    );
  }
}

/**
 * Build system prompt that includes organization analytics context
 * This gives the AI relevant information about the organization
 */
function buildSystemPrompt(contextData: any): string {
  console.log(`\n🔨 [BUILDING SYSTEM PROMPT]`);
  console.log(`   Context data available: ${contextData ? 'YES ✅' : 'NO ❌'}`);

  let prompt = `You are a LinkedIn content expert helping create engaging posts. 
Your role is to help draft, refine, and improve LinkedIn content based on the organization's analytics and brand voice.

Key guidelines:
- Create authentic, professional content that matches the organization's voice
- Reference audience demographics and past performance when relevant
- Provide specific, actionable suggestions
- Keep posts concise and engaging (aim for 500-1500 characters)
- Include relevant emojis sparingly (1-2 per post maximum)
- Add 3-5 relevant hashtags when appropriate
- Always end with an engaging question or call-to-action

`;

  // Add organization analytics if available
  if (contextData) {
    if (contextData.summary) {
      console.log(`   ✅ Including Organization Summary (${contextData.summary.length} chars)`);
      prompt += `\n## Organization Summary\n${contextData.summary}\n`;
    }

    if (contextData.demographicData) {
      console.log(`   ✅ Including Audience Demographics (${contextData.demographicData.length} chars)`);
      prompt += `\n## Audience Demographics\n${contextData.demographicData}\n`;
    }

    if (contextData.recentPosts) {
      console.log(`   ✅ Including Recent Post Examples (${contextData.recentPosts.length} chars)`);
      prompt += `\n## Recent Post Examples\n${contextData.recentPosts}\n`;
    }

    if (contextData.engagementPatterns) {
      console.log(`   ✅ Including What Resonates (${contextData.engagementPatterns.length} chars)`);
      prompt += `\n## What Resonates\n${contextData.engagementPatterns}\n`;
    }
  } else {
    console.log(`   ⚠️  No context data provided - using generic prompt`);
  }

  prompt += `\nRemember: You're helping this specific organization create content that matches their voice and audience.`;

  console.log(`   Final prompt length: ${prompt.length} chars`);
  return prompt;
}
