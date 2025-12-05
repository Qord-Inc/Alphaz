const express = require('express');
const router = express.Router();
const { 
  getOrganizationFollowerStats,
  getOrganizationNetworkSize,
  getOrganizationDashboard,
  getOrganizationOverview
} = require('../controllers/organizationAnalyticsController');
const { getSimpleOrganizationMetrics } = require('../controllers/simpleOrgAnalytics');
const { 
  getOrganizationPageStats,
  getOrganizationPageDashboard
} = require('../controllers/organizationPageAnalyticsController');

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

module.exports = router;