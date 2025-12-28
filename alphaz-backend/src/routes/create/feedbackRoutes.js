const express = require('express');
const router = express.Router();
const feedbackController = require('../../controllers/create/feedbackController');

// Save/update feedback on a message
router.post('/feedback', feedbackController.saveFeedback);

// Get user's feedback for a thread (for UI display)
router.get('/feedback/thread/:threadId', feedbackController.getThreadFeedback);

// Get all feedback (for dev dashboard/analytics)
router.get('/feedback/all', feedbackController.getAllFeedback);

// Delete feedback
router.delete('/feedback/:feedbackId', feedbackController.deleteFeedback);

module.exports = router;
