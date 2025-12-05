const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Clerk webhook endpoint - note: raw body required for signature verification
router.post('/clerk', express.raw({ type: 'application/json' }), webhookController.handleClerkWebhook);

module.exports = router;