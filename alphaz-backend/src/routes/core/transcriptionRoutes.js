const express = require('express');
const { transcribeAudio, upload } = require('../../controllers/core/transcriptionController');

const router = express.Router();

// Transcribe audio to text using Whisper-1
router.post('/transcribe', upload.single('audio'), transcribeAudio);

module.exports = router;
