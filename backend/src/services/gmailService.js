const { google } = require('googleapis');
const OAuthCredential = require('../models/OAuthCredential');
const resumeParserService = require('./resumeParserService');
const User = require('../models/User');

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
  }

  createOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async getAuthUrl() {
    this.initializeOAuth2Client();
    const SCOPES = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      include_granted_scopes: true
    });
  }

  initializeOAuth2Client() {
    if (!this.oauth2Client) {
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      this.oauth2Client.setMaxListeners(20);
    }
  }

  async handleCallback(code) {
    try {
      if (!code) {
        throw new Error('Authorization code is required');
      }

      this.oauth2Client = this.createOAuth2Client();
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Get Gmail address
      this.oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      return {
        tokens,
        email: profile.data.emailAddress
      };

    } catch (error) {
      console.error('HandleCallback Error:', error);
      throw error;
    }
  }

  async getAuthorizedClient(userId) {
    try {
      const credentials = await OAuthCredential.getCredentials(userId);
      
      if (this.gmail) {
        return this.gmail;
      }

      this.oauth2Client = this.createOAuth2Client();
      this.oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expiry_date: credentials.expiry_date,
        token_type: credentials.token_type,
        scope: credentials.scope
      });

      if (!this.oauth2Client.listenerCount('tokens')) {
        this.oauth2Client.on('tokens', async (tokens) => {
          if (tokens.refresh_token) {
            await OAuthCredential.findOneAndUpdate(
              { _id: credentials._id },
              { ...tokens }
            );
          }
        });
      }

      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      return this.gmail;
    } catch (error) {
      console.error('Error getting authorized client:', error);
      throw error;
    }
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
