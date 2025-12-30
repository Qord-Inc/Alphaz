const express = require('express');
const router = express.Router();
const {
  getScheduledDrafts,
  createScheduledDraft,
  updateScheduledDraft,
  deleteScheduledDraft,
  getDraftsByDate,
  generateTitle
} = require('../../controllers/create/scheduledDraftsController');

// Generate title for a draft using AI
router.post('/generate-title', generateTitle);

// Get all scheduled drafts for a user
router.get('/scheduled-drafts/:clerkUserId', getScheduledDrafts);

// Get drafts grouped by date for calendar view
router.get('/scheduled-drafts/by-date/:clerkUserId', getDraftsByDate);

// Create a new scheduled draft
router.post('/scheduled-drafts', createScheduledDraft);

// Update a scheduled draft
router.patch('/scheduled-drafts/:id', updateScheduledDraft);

// Delete a scheduled draft
router.delete('/scheduled-drafts/:id', deleteScheduledDraft);

module.exports = router;
