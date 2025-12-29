import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, generateObject } from 'ai';
import { z } from 'zod';
import { buildOrganizationSystemPrompt } from '@/lib/prompts/organizationPrompts';
import { buildPersonalSystemPrompt, hasPersonalContext } from '@/lib/prompts/personalPrompts';

// Intent classification schema
const IntentSchema = z.object({
  intent: z.enum(['edit', 'ideate', 'draft', 'feedback']).describe(
    'edit: User wants to modify/refine existing content. ' +
    'ideate: User wants to brainstorm ideas/concepts. ' +
    'draft: User wants to create new content from scratch. ' +
    'feedback: User wants critique/analysis of content.'
  ),
});

// Edit response schema (for structured output)
const EditResponseSchema = z.object({
  type: z.enum(['draft', 'question']).describe(
    'draft: A revised version of the post. ' +
    'question: A clarifying question before editing.'
  ),
  content: z.string().describe('The revised post content or the clarifying question'),
  changes: z.array(z.string()).optional().describe('List of changes made (only for draft type)'),
  questionContext: z.string().optional().describe('Why clarification is needed (only for question type)'),
});

/**
 * Detect user intent using OpenAI function calling
 * Returns one of: edit, ideate, draft, feedback
 */
async function detectIntent(userMessage: string): Promise<string> {
  try {
    const result = await generateObject({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: openai('gpt-4o-mini') as any, // Good balance of speed and accuracy for classification
      schema: IntentSchema,
      prompt: `Classify the user's intent in one word. User message: "${userMessage}"`,
      temperature: 0.1, // Low temperature for consistent classification
    });
    
    return result.object.intent;
  } catch (error) {
    console.error('Intent detection failed:', error);
    return 'draft'; // Default fallback
  }
}

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

    if (!clerkUserId) {
      return new Response(
        JSON.stringify({ error: 'clerkUserId is required' }),
        { status: 400 }
      );
    }

    // Determine if this is organization or personal account
    const isOrganizationAccount = !!organizationId;
    console.log(`\n🏢 [ACCOUNT TYPE] ${isOrganizationAccount ? 'Organization' : 'Personal'}`);
    if (isOrganizationAccount) {
      console.log(`   Organization ID: ${organizationId}`);
    }

    // Validate personal account has context before allowing chat
    if (!isOrganizationAccount) {
      console.log(`   Has Context:`, hasPersonalContext(contextData));
      
      if (!hasPersonalContext(contextData)) {
        console.log(`\n❌ [PERSONAL CONTEXT MISSING] User has no personalization data`);
        return new Response(
          JSON.stringify({ 
            error: 'NO_PERSONALIZATION',
            message: 'Complete your personalization to start chatting',
            requiresPersonalization: true 
          }),
          { status: 403 }
        );
      }
    }

    // Get the latest user message for intent detection
    const latestUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    // Detect intent (fast: 0.1-0.5s)
    const startTime = Date.now();
    const intent = await detectIntent(latestUserMessage);
    const intentTime = Date.now() - startTime;
    
    console.log(`\n🎯 [INTENT DETECTED] ${intent.toUpperCase()}`);
    console.log(`   Response time: ${intentTime}ms`);
    console.log(`   User message: "${latestUserMessage.substring(0, 100)}${latestUserMessage.length > 100 ? '...' : ''}"`);

    // Build system prompt with appropriate context based on account type
    const systemPrompt = isOrganizationAccount
      ? buildOrganizationSystemPrompt(contextData, intent)
      : buildPersonalSystemPrompt(contextData, intent);

    console.log(`\n📨 [API/CHAT] Processing request`);
    console.log(`   Account type: ${isOrganizationAccount ? 'Organization' : 'Personal'}`);
    console.log(`   User: ${clerkUserId}`);
    console.log(`   Messages count: ${messages.length}`);
    console.log(`   Context data provided: ${contextData && Object.keys(contextData).length > 0 ? 'YES ✅' : 'NO ❌'}`);

    // Log context data details (organization or personal)
    if (contextData) {
      console.log(`\n📊 [CONTEXT DATA]`);
      if (isOrganizationAccount) {
        if (contextData.summary) {
          console.log(`   Org Summary: ${contextData.summary.substring(0, 100)}...`);
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
      } else {
        if (contextData.userProfileSummary) {
          console.log(`   User Profile: Available ✅`);
        }
      }
    }

    // Use Claude Opus 4.5 for edit/draft (best quality), GPT for other intents
    const useClaudeModel = intent === 'edit' || intent === 'draft';
    const modelName = useClaudeModel ? 'claude-opus-4-5-20251101' : 'gpt-5.1';
    const modelProvider = useClaudeModel ? 'Anthropic' : 'OpenAI';
    
    console.log(`\n🤖 [${modelProvider.toUpperCase()}] Calling ${modelName} with streaming`);
    console.log(`   Model: ${modelName}`);
    console.log(`   Temperature: 0.7`);
    console.log(`   Stream: Enabled (real-time response)`);
    console.log(`   Reason: ${useClaudeModel ? 'Edit/Draft intent - using Claude Opus 4.5 for best quality' : 'Ideate/Feedback intent - using GPT'}`);

    // Call AI with streaming enabled - use Claude Opus 4.5 for edit/draft, GPT for others
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = useClaudeModel ? anthropic('claude-opus-4-5-20251101') : openai('gpt-5.1');
    const stream = streamText({
      model: model as any, // Type cast needed due to SDK version mismatch
      system: systemPrompt,
      messages: messages,
      temperature: 0.7,
    });

    console.log(`\n⏳ [STREAMING STARTED]`);
    console.log(`   Sending streamed response to client...`);
    console.log(`   Intent: ${intent}`);

    // Get the response
    const result = await stream;
    
    // Create a custom response that includes intent in headers
    const response = result.toTextStreamResponse();
    response.headers.set('X-Intent', intent);
    
    return response;

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
