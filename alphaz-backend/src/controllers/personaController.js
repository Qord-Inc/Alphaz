const supabase = require('../config/supabase');
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
      model: 'tts-1',
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

module.exports = {
  getPersonaStatus,
  startPersona,
  transcribeAudio,
  textToSpeech,
  saveAnswer,
  PERSONA_QUESTIONS
};
