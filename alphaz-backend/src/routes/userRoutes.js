const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Create a new user
router.post('/users', userController.createUser);

// Get user by Clerk ID
router.get('/users/:clerkUserId', userController.getUserByClerkId);

// Update user
router.put('/users/:clerkUserId', userController.updateUser);

// Check if user exists by email
router.get('/users/check/exists', userController.checkUserExists);

module.exports = router;