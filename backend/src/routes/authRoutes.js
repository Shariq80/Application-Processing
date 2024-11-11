const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Basic auth routes
router.post('/login', authController.login);
router.get('/check', authenticateToken, authController.checkAuth);
router.post('/logout', authController.logout);

// Google OAuth routes
router.get('/google/url', authenticateToken, authController.getGoogleAuthUrl);

// Update this route to include the token in the redirect URI
router.get('/google/callback', authController.handleGoogleCallback);

// Gmail account management routes
router.get('/gmail/accounts', authenticateToken, authController.getGmailAccounts);
router.post('/gmail/preferred', authenticateToken, authController.setPreferredGmail);

module.exports = router;
