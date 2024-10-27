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
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
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
  try {
    const { code } = req.query;
    await gmailService.handleCallback(code);
    
    // After successful OAuth, redirect to a frontend success page
    res.redirect('/oauth-success');
  } catch (error) {
    console.error('Google OAuth Error:', error);
    res.redirect('/oauth-error');
  }
};
