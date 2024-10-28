const jwt = require('jsonwebtoken');
const User = require('../models/User');
const gmailService = require('../services/gmailService');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const url = await gmailService.getAuthUrl();
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.handleGoogleCallback = async (req, res) => {
  const requestId = Date.now(); // Add request ID for tracking
  
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    const tokens = await gmailService.handleCallback(code);
    
    res.json({ 
      success: true, 
      message: 'Google OAuth successful. Gmail access granted.',
      details: {
        hasAccessToken: !!tokens.access_token,
        expiryDate: new Date(tokens.expiry_date).toISOString(),
        scope: tokens.scope
      }
    });
  } catch (error) {
    console.error(`Google OAuth Error [${requestId}]:`, error);
    
    const errorMessage = error.message.includes('invalid_grant') 
      ? 'Authorization code expired or already used. Please try again if needed.'
      : error.message;

    res.status(401).json({ 
      success: false, 
      error: errorMessage,
      requestId // Include request ID in error response
    });
  }
};
