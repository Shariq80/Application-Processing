const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User');
const gmailService = require('../services/gmailService');
const OAuthCredential = require('../models/OAuthCredential');

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
  try {
    const { code, state } = req.query;
    
    // Get user from token (state contains the JWT token)
    if (!state) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Use the updated handleCallback method
      const { tokens, email } = await gmailService.handleCallback(code);

      // Check if this Gmail is already connected by any user
      const existingCredential = await OAuthCredential.findOne({ email });
      if (existingCredential) {
        return res.status(400).json({ 
          error: 'This Gmail account is already connected to a user' 
        });
      }

      // Save new credentials
      const credential = new OAuthCredential({
        ...tokens,
        userId: user._id,
        email,
        isDefault: false
      });
      
      await credential.save();

      // Set as user's preferred account if they don't have one
      if (!user.preferredGmailId) {
        user.preferredGmailId = credential._id;
        await user.save();
      }

      res.json({ 
        success: true, 
        message: 'Gmail account connected successfully' 
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'You have already connected this Gmail account' 
      });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getGmailAccounts = async (req, res) => {
  try {
    const accounts = await OAuthCredential.getUserCredentials(req.user._id);
    res.json(accounts.map(acc => ({
      id: acc._id,
      email: acc.email,
      isDefault: acc.isDefault,
      isPreferred: acc._id.equals(req.user.preferredGmailId)
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setPreferredGmail = async (req, res) => {
  try {
    const { credentialId } = req.body;
    
    // Verify the credential belongs to this user or is default
    const credential = await OAuthCredential.findOne({
      _id: credentialId,
      $or: [
        { userId: req.user._id },
        { isDefault: true }
      ]
    });

    if (!credential) {
      return res.status(404).json({ error: 'Gmail account not found' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      preferredGmailId: credentialId
    });

    res.json({ message: 'Preferred Gmail account updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
