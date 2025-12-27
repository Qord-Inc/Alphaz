const express = require('express');
const router = express.Router();
const { 
  getOrganizationFollowerStats,
  getOrganizationNetworkSize,
  getOrganizationDashboard,
  getOrganizationOverview
} = require('../../controllers/monitor/organizationAnalyticsController');
const { getSimpleOrganizationMetrics } = require('../../controllers/monitor/simpleOrgAnalytics');
const { 
  getOrganizationPageStats,
  getOrganizationPageDashboard
} = require('../../controllers/monitor/organizationPageAnalyticsController');
const {
  getOrganizationPosts,
  getPostDetails
} = require('../../controllers/monitor/organizationPostsController');

// Get organization follower statistics (lifetime or time-bound)
router.get('/organization/followers/:clerkUserId/:organizationId', getOrganizationFollowerStats);

// Get organization total follower count
router.get('/organization/network-size/:clerkUserId/:organizationId', getOrganizationNetworkSize);

// Get organization analytics dashboard
router.get('/organization/dashboard/:clerkUserId/:organizationId', getOrganizationDashboard);

// Get simple organization overview (no time-based queries)
router.get('/organization/overview/:clerkUserId/:organizationId', getOrganizationOverview);

// Get simplified organization metrics with estimations
router.get('/organization/simple/:clerkUserId/:organizationId', getSimpleOrganizationMetrics);

// Get organization page statistics (lifetime or time-bound)
router.get('/organization/page-stats/:clerkUserId/:organizationId', getOrganizationPageStats);

// Get organization page analytics dashboard
router.get('/organization/page-dashboard/:clerkUserId/:organizationId', getOrganizationPageDashboard);

// Get organization posts
router.get('/organization/posts/:clerkUserId/:organizationUrn', getOrganizationPosts);

// Get post details
router.get('/organization/post/:clerkUserId/:postUrn', getPostDetails);

module.exports = router;