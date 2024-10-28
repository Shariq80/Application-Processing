const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Basic auth routes
router.post('/login', authController.login);
router.get('/check', authenticateToken, authController.checkAuth);
router.post('/logout', authController.logout);


router.get('/google/url', authenticateToken, authController.getGoogleAuthUrl);
router.get('/google/callback', authController.handleGoogleCallback);

module.exports = router;
