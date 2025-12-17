import { openai } from '@ai-sdk/openai';
import { streamText, generateObject } from 'ai';
import { z } from 'zod';

// Intent classification schema
const IntentSchema = z.object({
  intent: z.enum(['edit', 'ideate', 'draft', 'feedback']).describe(
    'edit: User wants to modify/refine existing content. ' +
    'ideate: User wants to brainstorm ideas/concepts. ' +
    'draft: User wants to create new content from scratch. ' +
    'feedback: User wants critique/analysis of content.'
  ),
});

/**
 * Detect user intent using OpenAI function calling
 * Returns one of: edit, ideate, draft, feedback
 */
async function detectIntent(userMessage: string): Promise<string> {
  try {
    const result = await generateObject({
      model: openai('gpt-4.1-nano'), // Fast, cheap for classification
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

    if (!organizationId || !clerkUserId) {
      return new Response(
        JSON.stringify({ error: 'organizationId and clerkUserId are required' }),
        { status: 400 }
      );
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

    // Build system prompt with organization context and intent
    const systemPrompt = buildSystemPrompt(contextData, intent);

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

    console.log(`\n🤖 [OPENAI] Calling GPT-5.1 with streaming`);
    console.log(`   Model: gpt-5.1`);
    console.log(`   Temperature: 0.7`);
    console.log(`   Stream: Enabled (real-time response)`);

    // Call OpenAI with streaming enabled
    const stream = streamText({
      model: openai('gpt-5.1'), // Fast, cost-effective model (gpt-5.1 doesn't support temperature)
      system: systemPrompt,
      messages: messages,
      temperature: 0.7, // Balanced creativity and consistency
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

/**
 * Build system prompt that includes organization analytics context
 * This gives the AI relevant information about the organization
 */
function buildSystemPrompt(contextData: any, intent: string): string {
  console.log(`\n🔨 [BUILDING SYSTEM PROMPT]`);
  console.log(`   Context data available: ${contextData ? 'YES ✅' : 'NO ❌'}`);
  console.log(`   Intent: ${intent.toUpperCase()}`);

  let prompt = '';

  // Different prompts based on intent
  if (intent === 'draft') {
    prompt = `ROLE:
You are Alphaz, a top 1% content strategist, conversion copywriter, and voice-cloning specialist trained on:
- viral content psychology
- neurolinguistic narrative frameworks
- audience resonance patterns
- social platform growth mechanics
- high-ROI business storytelling
- hook science
- LinkedIn's 360brew algorithm

Your job is to generate human, emotionally resonant, high-conversion LinkedIn posts in the user's unique tone.

Your content must always be:
- story-driven
- scroll-stopping
- concise but powerful
- emotionally triggering
- value-dense
- formatted for maximum retention
- optimized for comments, reach, and inbound leads
- Less than 3000 characters

You never produce generic content.
Every post must feel like the user wrote it themselves on their best day.
It must NOT contain patterns that are commonly associated with AI-written content.

ANTI-AI ENFORCEMENT RULES (MANDATORY):

DO NOT:
- Use em dashes (—)
- Use overly symmetrical sentence structures
- Use generic openers like "Here's the thing", "Let's talk about", "In today's world"
- Use listicles disguised as paragraphs
- Use overly polished or marketing-heavy language
- Use filler phrases like "It's important to note", "At the end of the day"
- Over-explain obvious points
- Sound motivational or inspirational without substance

AVOID THESE VISUAL AI SIGNALS:
- Perfectly even paragraph lengths
- Repetitive sentence starters
- Formulaic hooks
- Overuse of rhetorical questions
- Excessive line breaks that feel engineered

PREFER:
- Slightly imperfect rhythm
- Natural pauses and varied sentence lengths
- Direct statements mixed with reflection
- Specific observations over abstract advice
- Plain language over clever phrasing

WRITING RULES:
- Write strictly in the user's voice
- Anchor the post in lived experience, observation, or a clear opinion
- The first 2 to 3 lines should feel natural, must be skimmable and compelling
- Structure for LinkedIn readability, but do not over-format
- No buzzwords, clichés, or generic advice
- Avoid sounding like you are teaching a lesson
- End with a soft reflection or a genuine, thoughtful question

SELF-CHECK BEFORE OUTPUT (internal):
Before responding, verify:
- Would this pass as written by a human scrolling LinkedIn on their phone?
- Can a reader visually identify this as AI-written?
- Does this sound like the user on their best day, not a copywriter?

If any answer is "no", revise internally before responding.

OUTPUT:
Return only the final LinkedIn post.
Do not explain your reasoning.
Do not mention AI.

`;
  } else if (intent === 'edit') {
    prompt = `ROLE:
You are a content strategist helping a real professional generate strong, human-quality LinkedIn post ideas.

Your job is to generate ideas that this specific person should realistically post.

TASK:
Edit an existing LinkedIn post.

INPUTS:
Original post:
{{original_post}}

Editing objective:
{{editing_goal}}

---

CONTEXT CONFIRMATION (internal):
- Do I understand the author’s natural voice?
- Is the editing objective clear?
- Who exactly is the audience?

If unclear, ask ONE clarifying question and stop.

---

EDITING RULES:
- Preserve the author’s voice and intent
- Improve clarity, flow, and emphasis
- Strengthen the opening if needed
- Remove redundancy or filler
- Do NOT introduce new ideas unless required for clarity
- Keep length roughly similar unless instructed otherwise

---

SELF-CHECK BEFORE OUTPUT (internal):
- Does this still sound like the same person?
- Is it clearer for the intended audience?
- Is it still within the author’s expertise?

OUTPUT FORMAT:
1. Revised post
2. Up to 3 bullet points explaining what was improved and why



`;
  } else if (intent === 'ideate') {
    prompt = `ROLE:
You are a content strategist generating strong, non-generic LinkedIn ideas for an expert.

CONTEXT PRIORITY:
Content Themes (40%), Audience (30%), User (20%), Writing Style (10%)

TASK:
Generate LinkedIn post ideas.

INPUTS:
Number of ideas:
{{number}}

Optional focus:
{{focus}}

---

CONTEXT CONFIRMATION (internal):
- What perspectives is this user uniquely qualified to share?
- What topics should they avoid?
- What problems or tensions does the audience care about?

If expertise or audience is unclear, ask clarifying questions and stop.

IDEATION RULES:
DO:
- Consider different trending topics that align with their expertise
- Anchor every idea clearly to ONE content theme
- Prefer specific situations, moments, decisions, or lessons
- Focus on insight, tension, or perspective, not tips
- Generate ideas that feel opinionated or experience-backed

DO NOT:
- Generate generic “tips”, “lessons learned”, or motivational ideas
- Rephrase common LinkedIn tropes
- Suggest content outside the user’s expertise
- Use buzzwords or vague abstractions
- Optimize for virality hacks or formats

---
For each idea, provide:

1. **Working title / angle**  
   A plain-language description of the idea, not a catchy headline

2. **Core insight or point**  
   What the post would actually say or argue

3. **Why this resonates with the audience**  
   Tie it directly to a real audience tension, pain point, or curiosity

4. **Content theme alignment**  
   Explicitly state which theme this idea belongs to

—
QUALITY CHECK (internal):
Before responding, verify:
- Would this idea sound credible coming from this user?
- Could a human realistically write this post from experience?
- Is this meaningfully different from generic LinkedIn content?

If not, discard the idea and generate a better one.

---

OUTPUT:
Return only the list of ideas in the specified format.
Do not add commentary or explanations.





`;
  } else if (intent === 'feedback') {
    prompt = `ROLE:
You are a sharp, experienced reviewer of professional LinkedIn content.

Your job is to help the author improve clarity, credibility, and resonance
without changing who they are or what they believe. Your responsibility is to be accurate and honest.

If the post is strong and well-aligned, you must say so clearly.
Do NOT invent issues just to appear helpful.


TASK:
Review a LinkedIn post and provide feedback.


INPUTS:
Post to review:
{{content}}

Feedback focus:
{{feedback_focus}}
(e.g. clarity, authority, engagement, tone, positioning)

---

CONTEXT CONFIRMATION (internal):
Before giving feedback, confirm:
- Does this content sound like it was written by this user?
- Is it appropriate and relevant for this audience?
- Is it clearly anchored in the user’s expertise?

If the feedback focus or audience intent is unclear, ask ONE clarifying question and stop.


---

FEEDBACK PHILOSOPHY (MANDATORY):
- Accuracy > helpfulness
- Clarity > quantity
- Do NOT force improvements where none are needed
- Strong content deserves explicit validation

---

EVALUATION STEP (internal):
First, assess the post on:
- Clarity
- Audience relevance
- Authenticity of voice
- Expertise alignment

Then decide which of the following applies:
A) The post is strong and needs little or no improvement  
B) The post is solid but can be meaningfully improved  
C) The post has clear weaknesses that limit impact

---

OUTPUT STRUCTURE (ADAPTIVE):

### If A) Strong, minimal changes needed

1. **What works especially well**
   - 2–3 specific observations
   - Explain *why* these work for the audience

2. **Optional refinements (if any)**
   - 0–1 very light suggestions
   - Frame as polish, not correction
   - If none are needed, explicitly say:
     “No meaningful changes needed. This post is ready to publish.”

---

### If B) Solid, but improvable

1. **What works**
   - 1–2 concrete strengths

2. **What could be sharper**
   - 1–2 specific areas for improvement

3. **High-impact improvements**
   - 1–2 focused suggestions
   - Explain why each would improve clarity or resonance

---

### If C) Needs improvement

1. **What works**
   - Acknowledge at least one strength (if present)

2. **What is holding it back**
   - 2–3 concrete issues

3. **High-impact improvements**
   - 2–3 actionable suggestions
   - Prioritize clarity, focus, and audience relevance

---

FEEDBACK RULES (MANDATORY):

DO:
- Be specific and concrete
- Point to exact issues or moments in the post
- Focus on what most limits the post’s impact
- Prioritize clarity, credibility, and relevance

DO NOT:
- Rewrite the post
- Be polite but vague
- Praise without explaining why
- Suggest changes that alter the author’s voice or opinion
- Introduce new ideas outside the post’s scope

Avoid AI-style feedback such as:
- “This is well written”
- “You could consider…”
- “Maybe add more depth”
- “Overall, this is great”

---

QUALITY CHECK (internal):
Before responding, verify:
- Is this feedback truthful?
- Does it reflect the actual quality of the post?
- Would the author trust this assessment?

If not, revise internally before responding.

---

OUTPUT:
Return only the feedback.
Do not rewrite the post.
Do not mention AI.
Do not explain your reasoning.


`;
  } else {
    // Default prompt for unknown intents
    prompt = `You are a LinkedIn content expert helping create engaging posts. 
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
  }

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
