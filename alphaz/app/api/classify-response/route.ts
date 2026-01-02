import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// Response type classification schema
const ResponseTypeSchema = z.object({
  responseType: z.enum(['draft', 'question']).describe(
    'draft: The AI response contains actual LinkedIn post content ready for review/editing. Look for: formatted post text, hooks, body paragraphs, hashtags, calls-to-action, emojis used in post style. ' +
    'question: The AI is asking clarifying questions before writing the draft. Look for: numbered options, "Which approach?", "What angle?", "Do you want to...", seeking user preference/direction, asking for more context.'
  ),
});

/**
 * POST /api/classify-response
 * 
 * Classifies an AI response as either a draft or a follow-up question
 * Uses GPT-4o-mini for fast, accurate classification
 * 
 * Body:
 * - content: The AI response text to classify
 * - intent: The original intent (draft or edit)
 * 
 * Returns:
 * - { responseType: 'draft' | 'question' }
 */
export async function POST(request: Request) {
  try {
    const { content, intent } = await request.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'content is required' }),
        { status: 400 }
      );
    }

    // Only classify for draft/edit intents
    if (intent !== 'draft' && intent !== 'edit') {
      return new Response(
        JSON.stringify({ responseType: 'question' }), // Not a draft intent, treat as regular response
        { status: 200 }
      );
    }

    // Use GPT-4o-mini for fast classification
    const result = await generateObject({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: openai('gpt-4o-mini') as any,
      schema: ResponseTypeSchema,
      prompt: `Classify this AI assistant response. Is it an actual LinkedIn post draft, or is it asking clarifying questions before writing?

AI Response to classify:
"""
${content.substring(0, 1500)}
"""

Key indicators:
- DRAFT: Contains actual post content (hook, body, hashtags, CTA), formatted like a LinkedIn post, ready to publish/edit
- QUESTION: Asks "which approach?", "what angle?", offers numbered options, seeks user preference, asks for clarification

Classify this response:`,
      temperature: 0.1,
    });

    console.log(`🔍 [CLASSIFY RESPONSE] ${result.object.responseType.toUpperCase()}`);
    console.log(`   Content preview: "${content.substring(0, 100)}..."`);

    return new Response(
      JSON.stringify({ responseType: result.object.responseType }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Response classification error:', error);
    // Default to draft on error (safer - will show in draft panel)
    return new Response(
      JSON.stringify({ responseType: 'draft', error: 'Classification failed' }),
      { status: 200 }
    );
  }
}
