const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController');

// Get persona status and questions
router.get('/status/:clerkUserId', personaController.getPersonaStatus);

// Start or resume persona interview
router.post('/start', personaController.startPersona);

// Transcribe audio using Whisper
router.post('/transcribe', personaController.transcribeAudio);

// Generate speech from text using TTS
router.post('/tts', personaController.textToSpeech);

// Save answer or skip for a question
router.post('/answer', personaController.saveAnswer);

module.exports = router;
