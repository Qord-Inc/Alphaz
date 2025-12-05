const express = require('express');
const router = express.Router();
const linkedinController = require('../controllers/linkedinController');

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

// Debug ACLs - raw response from LinkedIn
router.get('/linkedin/debug-acls/:clerkUserId', linkedinController.debugAcls);

// Refresh LinkedIn token (returns info about re-auth requirement)
router.post('/linkedin/refresh-token/:clerkUserId', linkedinController.refreshLinkedInToken);

module.exports = router;