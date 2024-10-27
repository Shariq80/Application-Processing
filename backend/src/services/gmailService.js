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
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true
    });
  }

  async handleCallback(code) {
    try {
      console.log('1. Starting OAuth callback with code:', code.substring(0, 10) + '...');

      if (!code) {
        throw new Error('Authorization code is required');
      }

      // Check if we already have valid credentials
      const existingCreds = await OAuthCredential.findOne({});
      if (existingCreds && existingCreds.access_token) {
        console.log('Found existing valid credentials, skipping token exchange');
        return {
          access_token: existingCreds.access_token,
          refresh_token: existingCreds.refresh_token,
          expiry_date: existingCreds.expiry_date,
          scope: existingCreds.scope,
          token_type: existingCreds.token_type
        };
      }

      // Clear any existing credentials
      console.log('2. Creating new OAuth2 client...');
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Get tokens
      console.log('3. Attempting to exchange code for tokens...');
      const { tokens } = await this.oauth2Client.getToken(code);
      
      console.log('4. Token exchange response:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'none',
        scopeLength: tokens.scope?.length || 0
      });

      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      // Save tokens first
      console.log('5. Saving tokens to database...');
      await this.saveTokens(tokens);

      // Verify saved tokens
      console.log('6. Verifying saved credentials...');
      const savedCreds = await OAuthCredential.findOne({});
      console.log('7. Saved credentials check:', {
        hasAccessToken: !!savedCreds?.access_token,
        hasRefreshToken: !!savedCreds?.refresh_token,
        savedExpiryDate: savedCreds?.expiry_date ? new Date(savedCreds.expiry_date).toISOString() : 'none'
      });

      // Then set credentials
      console.log('8. Setting credentials on OAuth2 client...');
      this.oauth2Client.setCredentials(tokens);
      
      return tokens;
    } catch (error) {
      console.error('OAuth Error Details:', {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        stack: error.stack // Adding stack trace for better debugging
      });

      if (error.message.includes('invalid_grant')) {
        // Don't clear credentials if we already have valid ones
        const existingCreds = await OAuthCredential.findOne({});
        if (!existingCreds || !existingCreds.access_token) {
          await OAuthCredential.deleteMany({});
          console.log('9. Cleared existing credentials due to invalid_grant error');
        }
        throw new Error('Authorization code expired or already used. Please start the OAuth process again if needed.');
      }
      throw error;
    }
  }

  async saveTokens(tokens) {
    console.log('SaveTokens: Starting token save...');
    try {
      const result = await OAuthCredential.findOneAndUpdate(
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
      console.log('SaveTokens: Successfully saved tokens:', {
        hasAccessToken: !!result.access_token,
        hasRefreshToken: !!result.refresh_token,
        savedAt: result.updatedAt
      });
    } catch (error) {
      console.error('SaveTokens Error:', error);
      throw error;
    }
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

  async sendEmail(to, subject, message, attachments = []) {
    const gmail = await this.getAuthorizedClient();
    
    // Create email content
    let email = [
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${to}`,
      'From: me',
      `Subject: ${subject}`,
      '',
      message
    ].join('\r\n');

    if (attachments.length > 0) {
      const boundary = 'boundary' + Date.now().toString();
      email = [
        `Content-Type: multipart/mixed; boundary=${boundary}`,
        'MIME-Version: 1.0',
        `To: ${to}`,
        'From: me',
        `Subject: ${subject}`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        message,
      ].join('\r\n');

      // Add attachments
      for (const attachment of attachments) {
        email += [
          '',
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.data.toString('base64').replace(/(.{76})/g, "$1\r\n"),
        ].join('\r\n');
      }

      email += `\r\n--${boundary}--`;
    }

    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
  }
}

module.exports = new GmailService();
