const supabase = require('../config/supabase');

// System instructions for Realtime voice conversation
const CHECKIN_INSTRUCTIONS = `You are Alphaz's friendly content check-in assistant. Your goal is to learn the user's personal writing persona for LinkedIn through a natural voice conversation.

Your conversation goals:
1) Writing style: tone (professional, casual, inspirational), formality level, voice (first person vs third person), sentence length preference, emoji/hashtag usage, storytelling vs bullet points
2) Target audience: job roles, industries, seniority levels, company sizes, geographic regions, their pain points and interests
3) Content themes: 5-8 recurring topics they want to post about, content examples they admire, any contrarian or unique perspectives they hold

Conversation guidelines:
- Be warm, conversational, and encouraging
- Ask one question at a time, wait for response
- Acknowledge and paraphrase what you hear before moving on
- If answers are vague, ask one clarifying follow-up
- Keep it to about 5-7 questions total
- When you feel you have enough information, tell the user you're going to save their persona and then call the save_persona function with all the collected data

IMPORTANT: When you have collected sufficient information about all three areas (writing style, audience, and content themes), you MUST call the save_persona function to complete the check-in. Do not end the conversation without calling this function.`;

// GET /api/checkin/status/:clerkUserId
// Check if user can do check-in (not blocked) and get existing persona if any
async function getCheckinStatus(req, res) {
  try {
    const { clerkUserId } = req.params;
    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

    const { data, error } = await supabase
      .from('checkin_personas')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase error (check existing persona):', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Check if persona has all required content - only block if complete
    const isComplete = data && 
      data.writing_style && 
      data.audience && 
      data.content_themes;

    if (isComplete) {
      return res.json({
        blocked: true,
        reason: 'Persona already captured for this user.',
        persona: data
      });
    }

    return res.json({
      blocked: false,
      existingPersona: data || null
    });
  } catch (err) {
    console.error('Error in getCheckinStatus:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/checkin/session
// Creates an ephemeral token for OpenAI Realtime WebRTC session
async function createRealtimeSession(req, res) {
  try {
    const { clerkUserId } = req.body;
    
    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

    // Check if user is blocked
    const { data: existing, error: selectError } = await supabase
      .from('checkin_personas')
      .select('writing_style, audience, content_themes')
      .eq('clerk_user_id', clerkUserId)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('Supabase error:', selectError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Only block if all fields are populated
    const isComplete = existing && 
      existing.writing_style && 
      existing.audience && 
      existing.content_themes;

    if (isComplete) {
      return res.status(409).json({
        blocked: true,
        reason: 'Persona already captured for this user.'
      });
    }

    // Create ephemeral token for WebRTC connection
    const sessionConfig = {
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "alloy",
      instructions: CHECKIN_INSTRUCTIONS,
      tools: [
        {
          type: "function",
          name: "save_persona",
          description: "Save the user's collected persona data. Call this function when you have gathered sufficient information about writing style, target audience, and content themes.",
          parameters: {
            type: "object",
            properties: {
              writing_style: {
                type: "string",
                description: "The user's preferred writing style: tone, formality, voice, sentence length, emoji usage, storytelling preference"
              },
              audience: {
                type: "string", 
                description: "The user's target audience: job roles, industries, seniority, company size, geographic focus, pain points"
              },
              content_themes: {
                type: "array",
                items: { type: "string" },
                description: "5-8 recurring topics/themes the user wants to post about"
              },
              summary: {
                type: "string",
                description: "A brief summary of the overall persona"
              }
            },
            required: ["writing_style", "audience", "content_themes"]
          }
        }
      ],
      tool_choice: "auto",
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
      expiresAt: data.client_secret?.expires_at
    });

  } catch (err) {
    console.error('Error in createRealtimeSession:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/checkin/complete
// Body: { clerkUserId, writingStyle, audience, contentThemes, summary, rawTranscript }
async function completeCheckin(req, res) {
  try {
    const { clerkUserId, writingStyle, audience, contentThemes, summary, rawTranscript } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

    // Check if already complete
    const { data: existing, error: selectError } = await supabase
      .from('checkin_personas')
      .select('id, writing_style, audience, content_themes')
      .eq('clerk_user_id', clerkUserId)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('Supabase error (select persona):', selectError);
      return res.status(500).json({ error: 'Database error' });
    }

    const isComplete = existing && 
      existing.writing_style && 
      existing.audience && 
      existing.content_themes;

    if (isComplete) {
      return res.status(409).json({
        blocked: true,
        reason: 'Persona already captured for this user.'
      });
    }

    const payload = {
      clerk_user_id: clerkUserId,
      writing_style: writingStyle || null,
      audience: audience || null,
      content_themes: Array.isArray(contentThemes) ? contentThemes.join('\n') : (contentThemes || null),
      raw_persona: {
        summary: summary || null,
        transcript: rawTranscript || null,
        capturedAt: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing partial record
      const { data: updateData, error: updateError } = await supabase
        .from('checkin_personas')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Supabase error (update persona):', updateError);
        return res.status(500).json({ error: 'Failed to update persona' });
      }
      result = updateData;
    } else {
      // Insert new record
      const { data: insertData, error: insertError } = await supabase
        .from('checkin_personas')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        console.error('Supabase error (insert persona):', insertError);
        return res.status(500).json({ error: 'Failed to save persona' });
      }
      result = insertData;
    }

    return res.json({ success: true, persona: result });
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
