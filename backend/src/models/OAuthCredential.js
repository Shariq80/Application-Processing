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
    ref: 'User'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  email: String
}, { timestamps: true });

oAuthCredentialSchema.statics.getCredentials = async function(userId) {
  let credentials = await this.findOne({ userId });
  if (!credentials) {
    credentials = await this.findOne({ isDefault: true });
  }
  if (!credentials) {
    throw new Error('OAuth credentials not found');
  }
  return credentials;
};

oAuthCredentialSchema.statics.getUserCredentials = async function(userId) {
  const credentials = await this.find({ 
    $or: [
      { userId },
      { isDefault: true }
    ]
  });
  return credentials;
};

module.exports = mongoose.model('OAuthCredential', oAuthCredentialSchema);
