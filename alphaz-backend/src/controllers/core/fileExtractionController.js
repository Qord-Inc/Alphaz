const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

// Configure multer for document file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `doc-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/svg+xml',
    ];
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: PDF, DOC, DOCX, TXT, JPG, PNG, SVG`));
    }
  }
});

/**
 * Extract text content from a PDF file
 */
async function extractPdfText(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  // Convert Buffer to Uint8Array as required by pdf-parse v2
  const uint8Array = new Uint8Array(dataBuffer);
  const pdfParser = new PDFParse(uint8Array);
  await pdfParser.load();
  const textResult = await pdfParser.getText();
  pdfParser.destroy();
  
  // getText() may return an array of page texts or an object
  if (Array.isArray(textResult)) {
    return textResult.join('\n\n');
  } else if (typeof textResult === 'object' && textResult !== null) {
    // If it's an object with text property or pages
    if (textResult.text) return textResult.text;
    if (textResult.pages) return textResult.pages.join('\n\n');
    return JSON.stringify(textResult);
  }
  return String(textResult || '');
}

/**
 * Extract text content from a Word document (.doc, .docx)
 */
async function extractWordText(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: dataBuffer });
  return result.value;
}

/**
 * Extract text content from a plain text file
 */
async function extractTxtText(filePath) {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Extract text from uploaded document
 * POST /api/extract-text
 * 
 * Body (multipart/form-data):
 * - file: document file (pdf, doc, docx, txt)
 * 
 * Returns:
 * - { text: string, filename: string, type: string }
 */
async function extractText(req, res) {
  let tempFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    tempFilePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = req.file.mimetype;
    
    let text = '';
    let type = 'unknown';
    
    // Handle different file types
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      type = 'pdf';
      text = await extractPdfText(tempFilePath);
    } else if (
      mimeType === 'application/msword' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.doc' || 
      ext === '.docx'
    ) {
      type = 'word';
      text = await extractWordText(tempFilePath);
    } else if (mimeType === 'text/plain' || ext === '.txt') {
      type = 'text';
      text = await extractTxtText(tempFilePath);
    } else if (mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.svg'].includes(ext)) {
      // For images, we can't extract text directly
      // Return a placeholder that indicates it's an image
      type = 'image';
      text = `[Image file: ${originalName}]`;
      
      // Convert to base64 for potential vision API use
      const imageBuffer = await fs.readFile(tempFilePath);
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      return res.json({
        text,
        filename: originalName,
        type,
        isImage: true,
        dataUrl, // Include base64 data URL for images
      });
    } else {
      return res.status(400).json({ 
        error: `Unsupported file type: ${ext}`,
        supportedTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'svg']
      });
    }
    
    // Clean up the text
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Limit text length (to avoid overwhelming the AI context)
    const MAX_TEXT_LENGTH = 50000; // ~50k characters
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '\n\n[... content truncated due to length ...]';
    }
    
    console.log(`📄 Extracted ${text.length} characters from ${originalName} (${type})`);
    
    res.json({
      text,
      filename: originalName,
      type,
      characterCount: text.length,
    });
    
  } catch (error) {
    console.error('File extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to extract text from file',
      details: error.message 
    });
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.warn('Failed to delete temp file:', e.message);
      }
    }
  }
}

module.exports = {
  extractText,
  uploadMiddleware: upload.single('file'),
};
