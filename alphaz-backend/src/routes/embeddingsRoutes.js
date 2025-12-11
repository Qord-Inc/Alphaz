const express = require('express');
const router = express.Router();
const {
  generateOrganizationEmbeddings,
  getOrganizationContext
} = require('../controllers/vectorEmbeddingsController');

// Generate embeddings for an organization's analytics data
router.post('/organization/:clerkUserId/:organizationId/generate', generateOrganizationEmbeddings);

// Get organization context for AI (all analytics data as text)
router.get('/organization/:clerkUserId/:organizationId/context', getOrganizationContext);

module.exports = router;
