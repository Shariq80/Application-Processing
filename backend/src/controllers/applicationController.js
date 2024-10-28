const gmailService = require('../services/gmailService');
const openaiService = require('../services/openaiService');
const Application = require('../models/Application');
const Job = require('../models/Job');
const resumeParserService = require('../services/resumeParserService');
const mongoose = require('mongoose');

exports.fetchEmails = async (req, res) => {
  try {
    const { jobTitle } = req.query;
    
    if (!jobTitle) {
      return res.status(400).json({ error: 'Job title is required' });
    }

    const existingJob = await Job.findOne({ 
      title: { $regex: new RegExp(jobTitle, 'i') }
    });
    
    if (!existingJob) {
      return res.status(404).json({ 
        error: `No job found matching "${jobTitle}". Please create the job first.` 
      });
    }

    const gmail = await gmailService.getAuthorizedClient();
    
    // Search for unread emails with attachments
    const searchQuery = `has:attachment`;
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      labelIds: ['UNREAD']
    });

    const messages = messagesResponse.data.messages || [];
    const processedEmails = [];

    // Get all existing message IDs for this job to avoid reprocessing
    const existingMessageIds = await Application.distinct('emailMetadata.messageId', {
      job: existingJob._id
    });

    for (const message of messages) {
      try {
        // Skip if already processed
        if (existingMessageIds.includes(message.id)) {
          continue;
        }

        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const headers = messageData.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '';

        if (!subject.toLowerCase().includes(jobTitle.toLowerCase())) {
          continue;
        }

        const processedEmail = await this.processEmail(messageData.data, jobTitle);
        if (processedEmail) {
          processedEmail.emailMetadata = {
            messageId: message.id,
            threadId: messageData.data.threadId
          };
          await processedEmail.save();
          
          processedEmails.push(processedEmail);
          
          await gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            requestBody: {
              removeLabelIds: ['UNREAD']
            }
          });
          console.log(`Successfully processed and marked as read: ${message.id}`);
        }
      } catch (error) {
        console.error('Failed to process email:', {
          messageId: message.id,
          error: error.message,
          stack: error.stack
        });
      }
    }

    res.json({ 
      success: true, 
      applications: processedEmails,
      processed: processedEmails.length,
      total: messages.length
    });

  } catch (error) {
    console.error('Error in fetchEmails:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch emails' });
  }
};

exports.processEmail = async (emailData, jobTitle) => {
  try {
    console.log('=== Starting processEmail ===');
    
    const headers = emailData.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value;
    const from = headers.find(h => h.name === 'From')?.value;
    
    if (!subject || !from) {
      throw new Error('Missing required email headers');
    }

    if (!subject.toLowerCase().includes(jobTitle.toLowerCase())) {
      throw new Error('Job title not found in subject');
    }

    const job = await Job.findOne({ 
      title: { $regex: new RegExp(jobTitle, 'i') }
    }).select('title description'); // Add description to the query
    
    if (!job) {
      throw new Error(`No matching job found for title: ${jobTitle}`);
    }

    // Process attachments
    const attachments = [];
    let resumeText = '';
    
    if (emailData.payload.parts) {
      for (const part of emailData.payload.parts) {
        if (part.filename && (
          part.filename.endsWith('.pdf') || 
          part.filename.endsWith('.doc') || 
          part.filename.endsWith('.docx')
        )) {
          if (!part.body?.attachmentId) {
            console.warn('Missing attachment ID for file:', part.filename);
            continue;
          }

          try {
            const gmail = await gmailService.getAuthorizedClient();
            const attachment = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: emailData.id,
              id: part.body.attachmentId
            });

            if (attachment?.data?.data) {
              const attachmentData = Buffer.from(attachment.data.data, 'base64');
              attachments.push({
                filename: part.filename,
                contentType: part.mimeType,
                data: attachmentData
              });

              // Get resume text for the first attachment only
              if (!resumeText) {
                resumeText = await resumeParserService.parseResume(attachmentData, part.filename);
              }
            }
          } catch (error) {
            console.error('Failed to process attachment:', {
              filename: part.filename,
              error: error.message
            });
          }
        }
      }
    }

    if (attachments.length === 0) {
      throw new Error('No valid attachments found');
    }

    // Get AI score and summary
    const aiResult = await openaiService.scoreResume(resumeText, job.description);

    // Create application record
    const application = new Application({
      job: job._id,
      applicantEmail: from,
      applicantName: from.split('<')[0].trim(),
      emailSubject: subject,
      emailBody: emailData.snippet || '',
      attachments: attachments,
      resumeText: resumeText,
      aiScore: aiResult.score,
      aiSummary: aiResult.summary
    });

    await application.save();
    return application;

  } catch (error) {
    console.error('Error in processEmail:', error);
    throw error;
  }
};

exports.getAllApplications = async (req, res) => {
  try {
    const { jobId } = req.query;
    
    // Ensure jobId is a valid ObjectId
    if (jobId && !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Build query with job filter if jobId is provided
    const query = jobId ? { job: jobId } : {};

    const applications = await Application.find(query)
      .populate('job')
      .sort('-createdAt');

    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('job');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const { applicationId, attachmentId } = req.params;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const attachment = application.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Set response headers for file download
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);

    // Send the file buffer
    res.send(attachment.data);

  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
};

exports.toggleShortlist = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    application.isShortlisted = !application.isShortlisted;
    await application.save();
    
    res.json({ 
      isShortlisted: application.isShortlisted,
      message: `Application ${application.isShortlisted ? 'shortlisted' : 'removed from shortlist'}`
    });
  } catch (error) {
    console.error('Error in toggleShortlist:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.sendShortlistedApplications = async (req, res) => {
  try {
    console.log('\n=== Starting sendShortlistedApplications ===');
    
    const { jobId } = req.body;
    
    if (!jobId) {
      throw new Error('Job ID is required');
    }

    // Find all shortlisted but unsent applications for this job
    const applications = await Application.find({
      job: jobId,
      isShortlisted: true,
      sentAt: null
    }).populate('job');

    if (!applications.length) {
      throw new Error('No unsent shortlisted applications found');
    }

    // Get Gmail client
    const gmail = await gmailService.getAuthorizedClient();

    // Create HTML content for email
    const htmlContent = `
      <h2>Shortlisted Applications for ${applications[0].job.title}</h2>
      ${applications.map(app => `
        <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc;">
          <h3>${app.applicantName}</h3>
          <p><strong>Email:</strong> ${app.applicantEmail}</p>
          <p><strong>AI Score:</strong> ${app.aiScore}/10</p>
          <p><strong>AI Summary:</strong> ${app.aiSummary}</p>
          <p><strong>Date Received:</strong> ${new Date(app.createdAt).toLocaleDateString()}</p>
          <p><strong>Email Body:</strong></p>
          <div style="margin-left: 20px;">${app.emailBody}</div>
        </div>
      `).join('')}
    `;

    // Create message with attachments
    const boundary = 'boundary' + Date.now().toString();
    const message = [
      `Content-Type: multipart/mixed; boundary=${boundary}`,
      'MIME-Version: 1.0',
      `To: ${req.user.email}`,  // Use the authenticated user's email from req.user
      `Subject: Shortlisted Applications for ${applications[0].job.title}`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlContent
    ];

    // Add attachments
    for (const app of applications) {
      for (const attachment of app.attachments) {
        message.push(
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.data.toString('base64')
        );
      }
    }

    message.push(`--${boundary}--`);

    // Encode and send the email
    const encodedMessage = Buffer.from(message.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    // Update sentAt for all applications
    const updatedApplications = await Promise.all(
      applications.map(async (app) => {
        app.sentAt = new Date();
        await app.save();
        return {
          id: app._id,
          sentAt: app.sentAt
        };
      })
    );

    console.log(`Successfully sent ${applications.length} shortlisted applications for job: ${applications[0].job.title}`);

    res.json({
      message: 'Applications sent successfully',
      sentCount: applications.length,
      updatedApplications
    });
  } catch (error) {
    console.error('Error in sendShortlistedApplications:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedApplication = await Application.findByIdAndDelete(id);
    
    if (!deletedApplication) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: error.message });
  }
};
