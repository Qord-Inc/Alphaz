const express = require('express');
const { extractText, uploadMiddleware } = require('../../controllers/core/fileExtractionController');

const router = express.Router();

// Extract text from documents (PDF, DOC, DOCX, TXT)
router.post('/extract-text', uploadMiddleware, extractText);

module.exports = router;
