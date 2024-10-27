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
  }
}, { timestamps: true });

// We'll only ever have one document for the shared Gmail account
oAuthCredentialSchema.statics.getCredentials = async function() {
  const credentials = await this.findOne({});
  if (!credentials) {
    throw new Error('OAuth credentials not found');
  }
  return credentials;
};

module.exports = mongoose.model('OAuthCredential', oAuthCredentialSchema);
