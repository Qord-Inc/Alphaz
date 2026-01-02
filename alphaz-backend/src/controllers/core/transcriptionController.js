const OpenAI = require('openai');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/ogg',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`));
    }
  }
});

/**
 * Transcribe audio using GPT-4o Mini Transcribe
 * POST /api/transcribe
 * 
 * Body (multipart/form-data):
 * - audio: audio file (webm, wav, mp3, etc.)
 * - language: (optional) ISO-639-1 language code
 * - prompt: (optional) context to guide transcription
 */
async function transcribeAudio(req, res) {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    tempFilePath = req.file.path;
    console.log('📝 Transcribing audio file:', tempFilePath);

    // Prepare transcription parameters
    const transcriptionParams = {
      file: require('fs').createReadStream(tempFilePath),
      model: 'gpt-4o-mini-transcribe', // GPT-4o Mini Transcribe model
      language: 'en', // Force English to prevent auto-detection of other languages
      prompt: 'This is a professional business conversation in English or French about LinkedIn content creation, social media strategy, marketing ideas, or work-related topics.', // Guide the model with context
    };

    // Allow override to French if explicitly specified
    if (req.body.language === 'fr') {
      transcriptionParams.language = 'fr';
      transcriptionParams.prompt = 'This is a professional business conversation in French about LinkedIn content creation, social media strategy, marketing ideas, or work-related topics.';
    }
    
    // Allow additional prompt context if provided
    if (req.body.prompt) {
      transcriptionParams.prompt = req.body.prompt;
    }

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create(transcriptionParams);

    console.log('✅ Transcription complete:', transcription.text.substring(0, 100));

    // Clean up temp file
    await fs.unlink(tempFilePath);
    tempFilePath = null;

    return res.status(200).json({
      text: transcription.text,
      duration: req.body.duration || null,
    });

  } catch (error) {
    console.error('❌ Transcription error:', error);

    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('Failed to cleanup temp file:', unlinkError);
      }
    }

    return res.status(500).json({ 
      error: 'Transcription failed',
      details: error.message 
    });
  }
}

module.exports = {
  transcribeAudio,
  upload
};
