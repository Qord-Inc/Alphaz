const express = require('express');
const router = express.Router();
const multer = require('multer');
const linkedinController = require('../../controllers/core/linkedinController');

// Configure multer for memory storage (image upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB limit (LinkedIn's limit)
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Generate LinkedIn OAuth URL
router.get('/auth/linkedin/url', linkedinController.getLinkedInAuthUrl);

// Handle LinkedIn OAuth callback
router.get('/auth/linkedin/callback', linkedinController.handleLinkedInCallback);

// Get LinkedIn connection status
router.get('/linkedin/status/:clerkUserId', linkedinController.getLinkedInStatus);

// Disconnect LinkedIn
router.delete('/linkedin/disconnect/:clerkUserId', linkedinController.disconnectLinkedIn);

// Get user's company pages
router.get('/linkedin/company-pages/:clerkUserId', linkedinController.getCompanyPages);

// Upload image to LinkedIn (returns asset URN for use in posts)
router.post('/linkedin/upload-image', upload.single('image'), linkedinController.uploadImage);

// Post to LinkedIn as an organization
router.post('/linkedin/post', linkedinController.postOrganizationUpdate);

// Post to LinkedIn as personal profile
router.post('/linkedin/post/personal', linkedinController.postPersonalUpdate);

// Debug ACLs - raw response from LinkedIn
router.get('/linkedin/debug-acls/:clerkUserId', linkedinController.debugAcls);

// Refresh LinkedIn token (returns info about re-auth requirement)
router.post('/linkedin/refresh-token/:clerkUserId', linkedinController.refreshLinkedInToken);

module.exports = router;