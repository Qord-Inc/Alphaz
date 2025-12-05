const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Member Analytics Routes

// Get member follower statistics (lifetime or time-bound)
router.get('/analytics/member/followers/:clerkUserId', analyticsController.getMemberFollowerStats);

// Get member post analytics (single post or aggregated)
router.get('/analytics/member/posts/:clerkUserId', analyticsController.getMemberPostAnalytics);

// Get aggregated dashboard data for member
router.get('/analytics/member/dashboard/:clerkUserId', analyticsController.getMemberDashboard);

module.exports = router;