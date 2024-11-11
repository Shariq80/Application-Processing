const mongoose = require('mongoose');

const oAuthCredentialSchema = new mongoose.Schema({
  access_token: String,
  refresh_token: String,
  scope: String,
  token_type: String,
  expiry_date: Number,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Create compound index for userId + email
oAuthCredentialSchema.index({ userId: 1, email: 1 }, { unique: true });

// Add index for just email to quickly check if an email exists
oAuthCredentialSchema.index({ email: 1 });

// Static methods
oAuthCredentialSchema.statics.getUserCredentials = async function(userId) {
  return await this.find({ userId }).sort({ createdAt: -1 });
};

oAuthCredentialSchema.statics.getCredentials = async function(userId) {
  // First try to find user's preferred credentials
  const user = await mongoose.model('User').findById(userId);
  if (user?.preferredGmailId) {
    const preferred = await this.findById(user.preferredGmailId);
    if (preferred) return preferred;
  }
  
  // Then try to find any credentials owned by the user
  const userCred = await this.findOne({ userId });
  if (userCred) return userCred;
  
  // Finally, fall back to default credentials
  const defaultCred = await this.findOne({ isDefault: true });
  if (!defaultCred) {
    throw new Error('No OAuth credentials found');
  }
  return defaultCred;
};

// Method to check if email is already connected by any user
oAuthCredentialSchema.statics.isEmailConnected = async function(email) {
  return await this.findOne({ email }) !== null;
};

module.exports = mongoose.model('OAuthCredential', oAuthCredentialSchema);
