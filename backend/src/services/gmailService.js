const { google } = require('googleapis');
const OAuthCredential = require('../models/OAuthCredential');
const resumeParserService = require('./resumeParserService');

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async handleCallback(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    await OAuthCredential.findOneAndUpdate(
      {},
      tokens,
      { upsert: true }
    );
  }

  async saveTokens(tokens) {
    await OAuthCredential.findOneAndUpdate(
      {}, 
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
      },
      { upsert: true, new: true }
    );
  }

  async getAuthorizedClient() {
    const credentials = await OAuthCredential.getCredentials();
    
    this.oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expiry_date: credentials.expiry_date,
    });

    // Set up token refresh handler
    this.oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await this.saveTokens(tokens);
      }
    });

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }


  async getEmailContent(messageId) {
    try {
      const gmail = await this.getAuthorizedClient();
      
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return message.data;
    } catch (error) {
      console.error('Error fetching email content:', error);
      throw error;
    }
  }
}

module.exports = new GmailService();
