const supabase = require('../../config/supabase');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 8 questions for the persona interview
const PERSONA_QUESTIONS = [
  {
    id: 1,
    category: 'Professional',
    question: 'Tell me about your professional background and current role. What do you do, and how did you get here?'
  },
  {
    id: 2,
    category: 'Values',
    question: 'What are your core values and beliefs that guide your work and life?'
  },
  {
    id: 3,
    category: 'Interests',
    question: 'What topics are you most passionate about? What could you talk about for hours?'
  },
  {
    id: 4,
    category: 'Experience',
    question: 'What challenges or pivotal moments have shaped who you are today?'
  },
  {
    id: 5,
    category: 'Perspective',
    question: 'What unique perspectives or insights do you bring that others might not have?'
  },
  {
    id: 6,
    category: 'Purpose',
    question: 'What impact do you want to make through your content and presence on LinkedIn?'
  },
  {
    id: 7,
    category: 'Personal',
    question: 'What are your hobbies or interests outside of work? What energizes you?'
  },
  {
    id: 8,
    category: 'Personality',
    question: 'How would your closest friends or colleagues describe you in three words?'
  }
];

// GET /api/persona/status/:clerkUserId
// Returns current progress and persona data
async function getPersonaStatus(req, res) {
  try {
    const { clerkUserId } = req.params;

    const { data: persona, error } = await supabase
      .from('user_personas')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (error) throw error;

    return res.json({
      exists: !!persona,
      completed: persona?.completed || false,
      progress: persona?.progress || 0,
      userProfile: persona?.user_profile || {},
      questions: PERSONA_QUESTIONS
    });

  } catch (err) {
    console.error('Error in getPersonaStatus:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/persona/start
// Body: { clerkUserId }
// Initializes or returns existing persona record
async function startPersona(req, res) {
  try {
    const { clerkUserId } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'clerkUserId required' });
    }

    // Check if already exists
    const { data: existing, error: fetchError } = await supabase
      .from('user_personas')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      return res.json({
        persona: existing,
        questions: PERSONA_QUESTIONS
      });
    }

    // Create new persona record
    const { data: newPersona, error: insertError } = await supabase
      .from('user_personas')
      .insert({
        clerk_user_id: clerkUserId,
        user_profile: {},
        progress: 0,
        completed: false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.json({
      persona: newPersona,
      questions: PERSONA_QUESTIONS
    });

  } catch (err) {
    console.error('Error in startPersona:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/persona/transcribe
// Body: { audioBase64 }
// Returns transcription using Whisper
async function transcribeAudio(req, res) {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 required' });
    }

    // Decode base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Write to temporary file for Whisper API (it requires a file)
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), `audio-${Date.now()}.webm`);
    
    fs.writeFileSync(tmpFile, audioBuffer);

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: 'whisper-1',
        language: 'en'
      });

      // Clean up temp file
      fs.unlinkSync(tmpFile);

      console.log('Transcription result:', transcription.text);

      return res.json({
        transcription: transcription.text
      });
    } catch (transcribeErr) {
      // Clean up temp file on error
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
      throw transcribeErr;
    }

  } catch (err) {
    console.error('Error in transcribeAudio:', err);
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

// POST /api/persona/tts
// Body: { text }
// Returns audio base64 using OpenAI TTS
async function textToSpeech(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    const mp3 = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts-2025-12-15',
      voice: 'alloy',
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    return res.json({
      audioBase64: base64Audio
    });

  } catch (err) {
    console.error('Error in textToSpeech:', err);
    return res.status(500).json({ error: 'Failed to generate speech' });
  }
}

// Generate user context summary using GPT-5.1
// Internal function - called after saving answers
async function generateUserContextSummary(clerkUserId, userProfile) {
  try {
    // Build Q&A pairs for GPT
    const qaPairs = [];
    for (let i = 1; i <= 8; i++) {
      const qa = userProfile[`question_${i}`];
      if (qa && !qa.skipped && qa.answer) {
        qaPairs.push({
          category: qa.category,
          question: qa.question,
          answer: qa.answer
        });
      }
    }

    // Only generate context if user has answered 6 or more questions
    if (qaPairs.length < 6) {
      console.log(`Only ${qaPairs.length} answered questions, need at least 6 to generate context`);
      return null;
    }

    console.log(`Generating context summary for ${qaPairs.length} answered questions`);

    const systemPrompt = `You are an AI assistant that creates structured persona summaries for use by other AI systems.
Your task is to analyze interview responses and create a comprehensive JSON summary that captures the user's professional identity, values, communication style, and unique characteristics.

Output ONLY valid JSON with this exact structure:
{
  "professional_background": "Brief summary of their career and current role",
  "core_values": ["value1", "value2", "value3"],
  "communication_style": "How they communicate - tone, language, preferences",
  "content_themes": ["theme1", "theme2", "theme3"],
  "personality_traits": ["trait1", "trait2", "trait3"],
  "unique_perspective": "What makes their viewpoint unique",
  "key_differentiators": ["differentiator1", "differentiator2"],
  "interests_and_passions": ["interest1", "interest2"],
  "goals_and_impact": "What they want to achieve",
  "raw_summary": "A 2-3 sentence comprehensive summary capturing their essence"
}

Be specific and extract actual insights from their answers. Do not use generic placeholders.`;

    const userPrompt = `Here are the user's interview responses:\n\n${qaPairs.map(qa => 
      `**${qa.category}**\nQ: ${qa.question}\nA: ${qa.answer}`
    ).join('\n\n')}\n\nCreate a structured JSON persona summary based on these responses.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const summaryJson = JSON.parse(response.choices[0].message.content);
    
    // Upsert to user_context table
    const { error: upsertError } = await supabase
      .from('user_context')
      .upsert({
        clerk_user_id: clerkUserId,
        user_profile_summary: summaryJson,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'clerk_user_id'
      });

    if (upsertError) {
      console.error('Error upserting user_context:', upsertError);
      throw upsertError;
    }

    console.log('Successfully generated and saved user context summary');
    return summaryJson;

  } catch (err) {
    console.error('Error generating user context summary:', err);
    // Don't throw - this is a background operation
    return null;
  }
}

// POST /api/persona/answer
// Body: { clerkUserId, questionId, answer, skipped }
// Saves answer or skip for a specific question
async function saveAnswer(req, res) {
  try {
    const { clerkUserId, questionId, answer, skipped } = req.body;

    if (!clerkUserId || !questionId) {
      return res.status(400).json({ error: 'clerkUserId and questionId required' });
    }

    // Get current persona
    const { data: persona, error: fetchError } = await supabase
      .from('user_personas')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (fetchError) throw fetchError;

    // Find the question
    const question = PERSONA_QUESTIONS.find(q => q.id === questionId);
    if (!question) {
      return res.status(400).json({ error: 'Invalid questionId' });
    }

    // Update user_profile
    const userProfile = persona.user_profile || {};
    userProfile[`question_${questionId}`] = {
      skipped: !!skipped,
      category: question.category,
      question: question.question,
      answer: skipped ? null : (answer || null)
    };

    console.log(`Saving answer for question ${questionId}:`, {
      skipped: !!skipped,
      answerLength: answer ? answer.length : 0,
      answer: answer ? answer.substring(0, 50) + '...' : null
    });

    // Calculate progress
    const answeredCount = Object.keys(userProfile).length;
    const completed = answeredCount >= 8;

    // Update in database
    const { data: updated, error: updateError } = await supabase
      .from('user_personas')
      .update({
        user_profile: userProfile,
        progress: answeredCount,
        completed,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', clerkUserId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating persona:', updateError);
      throw updateError;
    }

    console.log(`Successfully saved. Progress: ${answeredCount}/8`);

    // Generate/update user context summary (async, don't wait)
    // Only if we have at least 6 answered questions
    const actualAnsweredCount = Object.values(userProfile).filter((v) => v && !v.skipped && v.answer).length;
    if (!skipped && answer && actualAnsweredCount >= 6) {
      generateUserContextSummary(clerkUserId, userProfile).catch(err => {
        console.error('Background context generation failed:', err);
      });
    }

    return res.json({
      persona: updated,
      progress: answeredCount,
      completed
    });

  } catch (err) {
    console.error('Error in saveAnswer:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/persona/context/:clerkUserId
// Returns user context, creates if doesn't exist (for personalization page load)
async function getUserContext(req, res) {
  try {
    const { clerkUserId } = req.params;

    // Check if context exists
    const { data: context, error: fetchError } = await supabase
      .from('user_context')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    // If context exists and has user_profile_summary, return it
    if (context && context.user_profile_summary) {
      return res.json({
        exists: true,
        context: context
      });
    }

    // If no context or empty, try to generate from persona data
    const { data: persona, error: personaError } = await supabase
      .from('user_personas')
      .select('user_profile')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (personaError) throw personaError;

    // If no persona data, return empty
    if (!persona || !persona.user_profile || Object.keys(persona.user_profile).length === 0) {
      return res.json({
        exists: false,
        context: null,
        message: 'No persona data available to generate context'
      });
    }

    // Check if user has at least 6 answered questions
    const answeredCount = Object.values(persona.user_profile).filter((v) => v && !v.skipped && v.answer).length;
    if (answeredCount < 6) {
      return res.json({
        exists: false,
        context: null,
        message: `Only ${answeredCount} answered questions, need at least 6 to generate context`
      });
    }

    // Generate context from persona data
    console.log('Generating context for user on page visit:', clerkUserId);
    const summary = await generateUserContextSummary(clerkUserId, persona.user_profile);

    if (summary) {
      // Fetch the newly created context
      const { data: newContext } = await supabase
        .from('user_context')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .single();

      return res.json({
        exists: true,
        context: newContext,
        justCreated: true
      });
    }

    return res.json({
      exists: false,
      context: null,
      message: 'Failed to generate context'
    });

  } catch (err) {
    console.error('Error in getUserContext:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/persona/context/refresh
// Body: { clerkUserId }
// Force regenerate context from current persona data
async function refreshUserContext(req, res) {
  try {
    const { clerkUserId } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'clerkUserId required' });
    }

    // Get persona data
    const { data: persona, error: personaError } = await supabase
      .from('user_personas')
      .select('user_profile')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (personaError) throw personaError;

    if (!persona || !persona.user_profile) {
      return res.status(400).json({ error: 'No persona data available' });
    }

    // Check if user has at least 6 answered questions
    const answeredCount = Object.values(persona.user_profile).filter((v) => v && !v.skipped && v.answer).length;
    if (answeredCount < 6) {
      return res.status(400).json({ error: `Only ${answeredCount} answered questions, need at least 6 to generate context` });
    }

    // Regenerate context
    const summary = await generateUserContextSummary(clerkUserId, persona.user_profile);

    if (summary) {
      return res.json({
        success: true,
        summary: summary
      });
    }

    return res.status(500).json({ error: 'Failed to generate context' });

  } catch (err) {
    console.error('Error in refreshUserContext:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getPersonaStatus,
  startPersona,
  transcribeAudio,
  textToSpeech,
  saveAnswer,
  getUserContext,
  refreshUserContext,
  PERSONA_QUESTIONS
};
