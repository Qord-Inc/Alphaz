const supabase = require('../../config/supabase');
const OpenAI = require('openai');
const { z } = require('zod');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHECKIN_INSTRUCTIONS = `You are Alphaz, a human-sounding thinking partner for a short daily voice check-in.
Start the call yourself (user hasn't spoken yet). Keep it natural, calm, and conversational.
Keep the total conversation under ~4 minutes.
Do NOT ask the user to end the call. The system will end it.

Purpose of the check-in:
Have a real discussion about their day that leaves them feeling clearer and interested to return tomorrow.
You are not an interviewer. You are a participant.

Style principles:
- Do NOT ask questions every turn. It’s okay to respond with a thought, reflection, or perspective with no question.
- Avoid agreeing with everything. If something feels unclear, contradictory, or assumptive, gently challenge or offer an alternate view.
- Keep it human: short, specific reactions. Avoid generic validation like “totally” or “that’s great” on every turn.
- Ask at most 2–3 questions total in the whole check-in. Questions should be occasional and genuine, one at a time, short.

How to participate (preferred moves):
1) Reflect: briefly mirror what you heard in your own words.
2) Add a perspective: offer a possible interpretation, reframe, or pattern you notice.
3) Nudge: propose one small angle they may not have considered.
4) Only then, if needed, ask one short question.

Examples of natural partner lines (use sparingly, adapt to what they said):
- “That’s interesting. The way you’re describing it, it sounds like the real issue wasn’t X, it was Y.”
- “I’m not completely convinced it was just ‘bad luck.’ There might be a pattern here.”
- “Part of you seems proud, and part of you seems annoyed. That mix usually points to a trade-off.”
- “If I had to guess, the moment that mattered was the part you rushed through.”

Avoid these habits:
- Don’t validate every sentence.
- Don’t use therapy language.
- Don’t run a checklist (wins, challenges, lessons, next steps).
- Don’t mention LinkedIn or posting during the call.

What to collect implicitly (without sounding like a form):
- one moment that mattered
- what made it meaningful or frustrating
- any tension/trade-off
- what changed in their thinking (even slightly)
- one concrete detail (a phrase, example, or metric)

Opening:
Start with a simple warm line and one gentle invite, not an interview question.
Example: “Hey, good to hear you. What’s one moment from today that’s still on your mind?”

Closing:
When it feels complete, close with:
“Got it. I’ll pull out a few insights and draft directions for you.”`;

const REALTIME_MODEL = 'gpt-realtime-mini-2025-10-06'; //gpt-4o-realtime-preview-2024-12-17
const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_WINDOW_HOURS = 24;

const InsightArraySchema = z.array(z.object({
  title: z.string().min(3),
  summary: z.string().min(3),
  confidence: z.number().min(0).max(1).optional()
})).max(3);

const IdeaArraySchema = z.array(z.object({
  headline: z.string().min(3),
  description: z.string().min(3),
  angle: z.string().optional()
})).max(3);

const InsightsSchema = z.object({
  key_insights: InsightArraySchema.nullable(),
  content_ideas: IdeaArraySchema.nullable(),
  recap: z.string().optional()
});

function computeRateLimit(windowCalls = []) {
  const remainingCalls = Math.max(0, RATE_LIMIT_MAX - windowCalls.length);
  let nextAvailableAt = null;

  if (remainingCalls <= 0 && windowCalls.length > 0) {
    const oldest = windowCalls[windowCalls.length - 1];
    const next = new Date(new Date(oldest.created_at).getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
    nextAvailableAt = next.toISOString();
  }

  return { remainingCalls, blocked: remainingCalls <= 0, nextAvailableAt };
}

async function getRecentCalls(clerkUserId) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: windowCalls, error: windowError } = await supabase
    .from('checkin_insights_calls')
    .select('id, created_at')
    .eq('clerk_user_id', clerkUserId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });

  if (windowError) throw windowError;

  const { data: latestCall, error: latestError } = await supabase
    .from('checkin_insights_calls')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  const { data: recentCalls, error: recentError } = await supabase
    .from('checkin_insights_calls')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentError) throw recentError;

  return { windowCalls: windowCalls || [], latestCall: latestCall || null, recentCalls: recentCalls || [] };
}

// GET /api/checkin/status/:clerkUserId
// Check if user can do check-in (limit 2 calls per 24h) and return last call summary
async function getCheckinStatus(req, res) {
  try {
    const { clerkUserId } = req.params;
    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

    const { windowCalls, latestCall, recentCalls } = await getRecentCalls(clerkUserId);
    const rate = computeRateLimit(windowCalls);

    return res.json({
      ...rate,
      latestCall,
      recentCalls
    });
  } catch (err) {
    console.error('Error in getCheckinStatus:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/checkin/session
// Creates an ephemeral token for OpenAI Realtime WebRTC session (blocked if over limit)
async function createRealtimeSession(req, res) {
  try {
    const { clerkUserId } = req.body;
    
    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

  const { windowCalls } = await getRecentCalls(clerkUserId);
    const rate = computeRateLimit(windowCalls);

    if (rate.blocked) {
      return res.status(429).json({
        blocked: true,
        reason: 'Daily check-in limit reached',
        nextAvailableAt: rate.nextAvailableAt
      });
    }

    // Create ephemeral token for WebRTC connection
    const sessionConfig = {
      model: REALTIME_MODEL,
      voice: "ash",
      instructions: CHECKIN_INSTRUCTIONS,
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        silence_duration_ms: 800
      },
      input_audio_transcription: {
        model: "whisper-1"
      }
    };

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sessionConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Realtime session error:', errorText);
      return res.status(500).json({ error: 'Failed to create Realtime session' });
    }

    const data = await response.json();
    
    return res.json({
      ephemeralKey: data.client_secret?.value,
      expiresAt: data.client_secret?.expires_at,
      model: REALTIME_MODEL
    });

  } catch (err) {
    console.error('Error in createRealtimeSession:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/checkin/complete
// Body: { clerkUserId, transcript, durationSeconds }
async function completeCheckin(req, res) {
  try {
    const { clerkUserId, transcript, durationSeconds } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

    const textTranscript = (transcript || '').toString().trim();
    if (!textTranscript) {
      return res.status(400).json({ error: 'Missing transcript' });
    }

    // Enforce rate limit
    const { windowCalls } = await getRecentCalls(clerkUserId);
    const rate = computeRateLimit(windowCalls);
    if (rate.blocked) {
      return res.status(429).json({
        blocked: true,
        reason: 'Daily check-in limit reached',
        nextAvailableAt: rate.nextAvailableAt
      });
    }

    // Keep transcript modest to save tokens
    const truncatedTranscript = textTranscript.slice(0, 15000);

    // Ask GPT-5.1 for structured insights using only this call's transcript
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: 'You are a concise analyst. Use ONLY the current call transcript. Do NOT invent details. Produce up to 3 key insights and up to 3 LinkedIn content ideas based solely on provided text. If there is insufficient detail for an item, omit it.'
        },
        {
          role: 'user',
          content: `Transcript from this voice check-in (short, conversational, no prior context):\n\n${truncatedTranscript}\n\nReturn JSON with keys: key_insights (array of 0-3 items with title, summary, confidence 0-1 optional) and content_ideas (array of 0-3 items with headline, description, angle optional). If nothing is meaningful, return empty arrays.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6
    });

    const rawContent = completion.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      console.error('Failed to parse GPT response:', err, rawContent);
      return res.status(502).json({ error: 'Failed to parse AI response' });
    }

    const validation = InsightsSchema.safeParse(parsed);
    if (!validation.success) {
      console.error('Insights validation failed:', validation.error.issues);
      return res.status(422).json({ error: 'AI response missing required fields', details: validation.error.issues });
    }

    const keyInsights = validation.data.key_insights && validation.data.key_insights.length > 0
      ? validation.data.key_insights.slice(0, 3)
      : null;

    const contentIdeas = validation.data.content_ideas && validation.data.content_ideas.length > 0
      ? validation.data.content_ideas.slice(0, 3)
      : null;

    const payload = {
      clerk_user_id: clerkUserId,
      key_insights: keyInsights,
      content_ideas: contentIdeas,
      transcript: truncatedTranscript,
      duration_seconds: durationSeconds || null,
      model_used: completion.model || 'gpt-5.1',
      created_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('checkin_insights_calls')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) {
      console.error('Supabase error (insert insights):', insertError);
      return res.status(500).json({ error: 'Failed to save insights' });
    }

    const updatedWindowCalls = [...windowCalls, insertData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const updatedRate = computeRateLimit(updatedWindowCalls);

    return res.json({ success: true, record: insertData, ...updatedRate });
  } catch (err) {
    console.error('Error in completeCheckin:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getCheckinStatus,
  createRealtimeSession,
  completeCheckin,
};
