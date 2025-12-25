const express = require('express');
const router = express.Router();
const { getCheckinStatus, createRealtimeSession, completeCheckin } = require('../controllers/checkinController');

// Check if user can do check-in (not blocked by complete persona)
router.get('/checkin/status/:clerkUserId', getCheckinStatus);

// Create ephemeral token for OpenAI Realtime WebRTC session
router.post('/checkin/session', createRealtimeSession);

// Save persona once conversation is done
router.post('/checkin/complete', completeCheckin);

module.exports = router;
